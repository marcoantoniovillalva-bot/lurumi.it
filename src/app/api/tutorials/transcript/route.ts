import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export const runtime = 'edge'

const YOUTUBE_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'it-IT,it;q=0.9,en;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'Cookie': 'CONSENT=YES+cb; SOCS=CAI; GPS=1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Cache-Control': 'no-cache',
}

interface TranscriptSegment { text: string; start: number; duration: number }

// ── Estrae captionTracks dall'HTML ────────────────────────────────────────────
function extractTracksFromHtml(html: string): any[] {
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

// ── Sceglie la traccia migliore ───────────────────────────────────────────────
function pickBestTrack(tracks: any[]): any {
    return (
        tracks.find(t => t.languageCode === 'it' && t.kind !== 'asr') ||
        tracks.find(t => t.languageCode === 'it') ||
        tracks.find(t => t.kind === 'asr') ||
        tracks.find(t => t.languageCode?.startsWith('en')) ||
        tracks[0]
    )
}

// ── Scarica e parsa il timedtext JSON dal server ──────────────────────────────
async function fetchSegments(baseUrl: string): Promise<TranscriptSegment[]> {
    const url = baseUrl + '&fmt=json3'
    const res = await fetch(url, {
        headers: {
            'User-Agent': YOUTUBE_HEADERS['User-Agent'],
            'Cookie': YOUTUBE_HEADERS['Cookie'],
        },
    })
    if (!res.ok) return []
    let data: any
    try { data = await res.json() } catch { return [] }
    const events: any[] = data?.events ?? []
    return events
        .filter(e => e.segs && e.tStartMs !== undefined)
        .map(e => ({
            text: (e.segs as any[])
                .map((s: any) => s.utf8 ?? '').join('')
                .replace(/\n/g, ' ')
                .replace(/&amp;/g, '&').replace(/&#39;/g, "'")
                .replace(/&quot;/g, '"').trim(),
            start: (e.tStartMs ?? 0) / 1000,
            duration: (e.dDurationMs ?? 0) / 1000,
        }))
        .filter(s => s.text)
}

// ── GET: tutto server-side, restituisce i segmenti direttamente al client ─────
export async function GET(req: NextRequest) {
    const videoId = req.nextUrl.searchParams.get('videoId')
    if (!videoId) return NextResponse.json({ error: 'videoId mancante' }, { status: 400 })

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

    try {
        const pageRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
            headers: YOUTUBE_HEADERS,
        })
        if (!pageRes.ok) {
            return NextResponse.json({ error: `YouTube non raggiungibile (${pageRes.status})` }, { status: 502 })
        }

        const html = await pageRes.text()
        const rawTracks = extractTracksFromHtml(html)

        if (!rawTracks.length) {
            const reason = html.includes('class="g-recaptcha"')
                ? 'YouTube richiede un captcha. Riprova tra qualche minuto.'
                : 'Questo video non ha sottotitoli disponibili. Attiva i sottotitoli automatici sul video YouTube.'
            return NextResponse.json({ error: reason }, { status: 404 })
        }

        const track = pickBestTrack(rawTracks)
        if (!track?.baseUrl) {
            return NextResponse.json({ error: 'Nessuna traccia sottotitoli valida trovata.' }, { status: 404 })
        }

        // Scarica la trascrizione server-side (stesso IP che ha fetchato la pagina)
        const segments = await fetchSegments(track.baseUrl)

        if (!segments.length) {
            return NextResponse.json({ error: 'Trascrizione vuota. Il video potrebbe avere i sottotitoli disabilitati.' }, { status: 404 })
        }

        return NextResponse.json({
            success: true,
            segments,
            languageCode: track.languageCode,
            kind: track.kind,
            availableTracks: rawTracks.map((t: any) => ({
                languageCode: t.languageCode,
                kind: t.kind,
                name: t.name?.simpleText ?? t.name?.runs?.[0]?.text ?? '',
            })),
        })
    } catch (err: any) {
        console.error('[Transcript GET]', err.message)
        return NextResponse.json({ error: err.message || 'Errore interno' }, { status: 500 })
    }
}

// ── Traduzione via Groq ────────────────────────────────────────────────────────
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

// ── POST: riceve segmenti → traduce → salva su Supabase ──────────────────────
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
