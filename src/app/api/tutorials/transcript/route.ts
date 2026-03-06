import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// ── InnerTube API (più affidabile dello scraping HTML su server cloud) ──────────
const INNERTUBE_API_URL = 'https://www.youtube.com/youtubei/v1/player'
const INNERTUBE_KEY = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8' // chiave pubblica WEB

async function getCaptionTracksFromInnerTube(videoId: string): Promise<any[]> {
    const body = {
        videoId,
        context: {
            client: {
                clientName: 'WEB',
                clientVersion: '2.20241201.00.00',
                hl: 'it',
                gl: 'IT',
            },
        },
    }

    const res = await fetch(`${INNERTUBE_API_URL}?key=${INNERTUBE_KEY}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36',
            'Origin': 'https://www.youtube.com',
            'Referer': 'https://www.youtube.com/',
        },
        body: JSON.stringify(body),
    })

    if (!res.ok) return []

    const data = await res.json()
    const tracks: any[] = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? []
    return tracks
}

// ── Fallback: scraping HTML ────────────────────────────────────────────────────
function extractCaptionTracksFromHtml(html: string): any[] {
    const startIdx = html.indexOf('"captionTracks":')
    if (startIdx === -1) return []
    const arrStart = html.indexOf('[', startIdx)
    if (arrStart === -1) return []
    let depth = 0, i = arrStart
    while (i < html.length) {
        const ch = html[i]
        if (ch === '[' || ch === '{') depth++
        else if (ch === ']' || ch === '}') { depth--; if (depth === 0) break }
        i++
    }
    const raw = html.slice(arrStart, i + 1)
        .replace(/\\u0026/g, '&').replace(/\\u003d/g, '=')
        .replace(/\\u003c/g, '<').replace(/\\u003e/g, '>')
    try { return JSON.parse(raw) } catch { return [] }
}

async function getCaptionTracksFallback(videoId: string): Promise<any[]> {
    const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36',
            'Accept-Language': 'it-IT,it;q=0.9,en;q=0.8',
            'Cookie': 'CONSENT=YES+cb; SOCS=CAI',
        },
    })
    if (!res.ok) return []
    const html = await res.text()
    return extractCaptionTracksFromHtml(html)
}

// ── GET: restituisce captionTracks al client ───────────────────────────────────
export async function GET(req: NextRequest) {
    const videoId = req.nextUrl.searchParams.get('videoId')
    if (!videoId) return NextResponse.json({ error: 'videoId mancante' }, { status: 400 })

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

    try {
        // Prima prova InnerTube API
        let rawTracks = await getCaptionTracksFromInnerTube(videoId)

        // Fallback: scraping HTML
        if (!rawTracks.length) {
            rawTracks = await getCaptionTracksFallback(videoId)
        }

        if (!rawTracks.length) {
            return NextResponse.json({
                error: 'Questo video non ha sottotitoli disponibili. Attiva i sottotitoli automatici sul video YouTube.',
            }, { status: 404 })
        }

        const tracks = rawTracks.map((t: any) => ({
            languageCode: t.languageCode,
            kind: t.kind,
            name: t.name?.simpleText ?? t.name?.runs?.[0]?.text ?? '',
            baseUrl: t.baseUrl,
        }))

        return NextResponse.json({ success: true, tracks })
    } catch (err: any) {
        console.error('[Transcript GET]', err.message)
        return NextResponse.json({ error: err.message || 'Errore interno' }, { status: 500 })
    }
}

// ── Traduzione via Groq ────────────────────────────────────────────────────────
interface TranscriptSegment { text: string; start: number; duration: number }

function getGroqClient() {
    if (!process.env.GROQ_API_KEY) throw new Error('GROQ_API_KEY non configurato')
    return new OpenAI({ apiKey: process.env.GROQ_API_KEY, baseURL: 'https://api.groq.com/openai/v1' })
}

async function translateChunk(groq: OpenAI, texts: string[]): Promise<string[]> {
    const joined = texts.map((t, i) => `[${i}] ${t}`).join('\n')
    const res = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 2000,
        temperature: 0.2,
        messages: [
            {
                role: 'system',
                content: 'Sei un traduttore. Traduci ciascun segmento in italiano. Rispondi SOLO con i segmenti tradotti nello stesso formato [indice] testo, uno per riga. Non aggiungere altro.',
            },
            { role: 'user', content: joined },
        ],
    })
    const raw = res.choices[0]?.message?.content ?? ''
    const result: string[] = new Array(texts.length).fill('')
    for (const line of raw.split('\n').filter(l => l.trim())) {
        const match = line.match(/^\[(\d+)\]\s*(.+)/)
        if (match) result[parseInt(match[1])] = match[2].trim()
    }
    return result
}

// ── POST: riceve trascrizione dal client → traduce → salva su Supabase ─────────
export async function POST(req: NextRequest) {
    try {
        const { tutorialId, transcript, translate = false } = await req.json() as {
            tutorialId: string
            transcript: TranscriptSegment[]
            translate?: boolean
        }

        if (!tutorialId || !transcript?.length) {
            return NextResponse.json({ success: false, error: 'Dati mancanti' }, { status: 400 })
        }

        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return NextResponse.json({ success: false, error: 'Non autenticato.' }, { status: 401 })

        let translated: TranscriptSegment[] | undefined

        if (translate) {
            const CHUNK = 80
            const allTexts = transcript.map(s => s.text)
            const translatedTexts: string[] = []
            const groq = getGroqClient()
            for (let i = 0; i < allTexts.length; i += CHUNK) {
                const chunk = allTexts.slice(i, i + CHUNK)
                translatedTexts.push(...(await translateChunk(groq, chunk)))
            }
            translated = transcript.map((s, i) => ({ ...s, text: translatedTexts[i] || s.text }))
        }

        const transcriptData = {
            transcript,
            translated: translated ?? null,
            generated_at: new Date().toISOString(),
            has_translation: !!translated,
        }

        const db = createServiceClient()
        await db.from('tutorials').update({ transcript_data: transcriptData })
            .eq('id', tutorialId).eq('user_id', user.id)

        return NextResponse.json({ success: true, translated: translated ?? null })
    } catch (error: any) {
        console.error('[Transcript POST]', error)
        return NextResponse.json({ success: false, error: error.message || 'Errore trascrizione.' }, { status: 500 })
    }
}
