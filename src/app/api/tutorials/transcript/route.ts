import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient, createServiceClient } from '@/lib/supabase/server'

interface TranscriptSegment { text: string; start: number; duration: number }

// ── Supadata API (affidabile da server, free tier 100 req/mese) ───────────────
async function fetchViaSupadata(videoId: string): Promise<TranscriptSegment[]> {
    const apiKey = process.env.SUPADATA_API_KEY
    if (!apiKey) throw new Error('SUPADATA_API_KEY non configurata')

    const res = await fetch(
        `https://api.supadata.ai/v1/youtube/transcript?videoId=${encodeURIComponent(videoId)}`,
        { headers: { 'x-api-key': apiKey } }
    )

    if (res.status === 404) throw new Error('Questo video non ha sottotitoli disponibili.')
    if (!res.ok) throw new Error(`Supadata error ${res.status}`)

    const data = await res.json()
    // Supadata restituisce { content: [{ text, offset, duration }] }
    const items: any[] = data?.content ?? []
    return items.map((item: any) => ({
        text: item.text?.replace(/\n/g, ' ').trim() ?? '',
        start: (item.offset ?? 0) / 1000,
        duration: (item.duration ?? 0) / 1000,
    })).filter(s => s.text)
}

// ── GET: restituisce i segmenti al client ─────────────────────────────────────
export async function GET(req: NextRequest) {
    const videoId = req.nextUrl.searchParams.get('videoId')
    if (!videoId) return NextResponse.json({ error: 'videoId mancante' }, { status: 400 })

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

    try {
        const segments = await fetchViaSupadata(videoId)
        if (!segments.length) {
            return NextResponse.json({ error: 'Trascrizione vuota. Verifica che il video abbia i sottotitoli attivi.' }, { status: 404 })
        }
        return NextResponse.json({ success: true, segments })
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
