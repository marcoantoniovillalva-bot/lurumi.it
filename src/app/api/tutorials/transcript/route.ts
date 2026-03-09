import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { computeTranscriptCost } from '@/app/api/transcript-config/route'
import { pushToAdmins } from '@/lib/webpush'

// Aumenta il timeout Vercel a 60s per supportare il download audio + Whisper
export const maxDuration = 60

interface TranscriptSegment { text: string; start: number; duration: number }

// ── Supadata API (sottotitoli YouTube esistenti) ───────────────────────────────
async function fetchViaSupadata(videoId: string): Promise<TranscriptSegment[]> {
    const apiKey = process.env.SUPADATA_API_KEY
    if (!apiKey) throw new Error('SUPADATA_API_KEY non configurata')

    const res = await fetch(
        `https://api.supadata.ai/v1/youtube/transcript?videoId=${encodeURIComponent(videoId)}`,
        { headers: { 'x-api-key': apiKey } }
    )

    // 404 = nessun sottotitolo disponibile → segnale per il fallback Whisper
    if (res.status === 404) {
        const err = new Error('NO_CAPTIONS') as any
        err.noCaption = true
        throw err
    }
    if (!res.ok) {
        const body = await res.text().catch(() => '')
        throw new Error(`Supadata error ${res.status}: ${body}`)
    }

    const data = await res.json()
    const items: any[] = data?.content ?? []
    return items
        .map((item: any) => ({
            text: item.text?.replace(/\n/g, ' ').trim() ?? '',
            start: (item.offset ?? 0) / 1000,
            duration: (item.duration ?? 0) / 1000,
        }))
        .filter(s => s.text)
}

// ── Fallback: trascrizione AI via Groq Whisper ────────────────────────────────
// Usato quando il video non ha sottotitoli YouTube.
// Usa youtubei.js (InnerTube API — stessa usata dall'app YouTube ufficiale)
// per ottenere l'URL audio, poi lo trascrive con Groq whisper-large-v3.
async function transcribeViaWhisper(videoId: string): Promise<TranscriptSegment[]> {
    if (!process.env.GROQ_API_KEY) throw new Error('GROQ_API_KEY non configurato')

    const { Innertube } = await import('youtubei.js')

    let yt: InstanceType<typeof Innertube>
    let audioUrl: string
    let mimeType = 'audio/webm'
    let ext = 'webm'

    try {
        yt = await Innertube.create({ retrieve_player: true, generate_session_locally: true })
        const info = await yt.getBasicInfo(videoId, 'TV_EMBEDDED')

        if (!info.streaming_data?.adaptive_formats?.length) {
            throw new Error('Nessun formato disponibile')
        }

        // Trova il formato audio-only a qualità minima (meno dati da scaricare)
        const audioFormats = info.streaming_data.adaptive_formats
            .filter((f: any) => f.has_audio && !f.has_video)
            .sort((a: any, b: any) => (a.bitrate ?? 0) - (b.bitrate ?? 0))

        if (!audioFormats.length) throw new Error('Nessun formato audio disponibile')

        const fmt = audioFormats[0] as any
        // Decifra l'URL con la chiave del player
        audioUrl = fmt.decipher(yt.session.player)
        const mime = (fmt.mime_type as string) ?? 'audio/webm'
        mimeType = mime.split(';')[0]
        ext = mimeType.split('/')[1]?.split('+')[0] ?? 'webm'
    } catch (e: any) {
        throw new Error(`Impossibile accedere all'audio del video YouTube: ${e.message}`)
    }

    // Scarica audio con limite di 24 MB (≈ 20-30 min a bassa qualità)
    const MAX_BYTES = 24 * 1024 * 1024
    const audioRes = await fetch(audioUrl, { signal: AbortSignal.timeout(40_000) })
    if (!audioRes.ok) throw new Error(`Errore download audio: ${audioRes.status}`)

    const reader = audioRes.body!.getReader()
    const chunks: Uint8Array[] = []
    let totalBytes = 0
    while (true) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(value)
        totalBytes += value.length
        if (totalBytes >= MAX_BYTES) {
            await reader.cancel()
            break
        }
    }

    const audioBuffer = Buffer.concat(chunks.map(c => Buffer.from(c)))

    // Invia a Groq Whisper tramite multipart form
    const formData = new FormData()
    const blob = new Blob([audioBuffer], { type: mimeType })
    formData.append('file', blob, `audio.${ext}`)
    formData.append('model', 'whisper-large-v3')
    formData.append('response_format', 'verbose_json')
    formData.append('timestamp_granularities[]', 'segment')

    const whisperRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` },
        body: formData,
    })

    if (!whisperRes.ok) {
        const errBody = await whisperRes.text().catch(() => '')
        throw new Error(`Groq Whisper error ${whisperRes.status}: ${errBody}`)
    }

    const result = await whisperRes.json()

    if (!result.segments?.length) {
        throw new Error('Whisper non ha restituito segmenti. Il video potrebbe essere muto o non supportato.')
    }

    return result.segments.map((seg: any) => ({
        text: (seg.text as string).trim(),
        start: seg.start ?? 0,
        duration: (seg.end ?? seg.start ?? 0) - (seg.start ?? 0),
    }))
}

// ── Contatore mensile (auto-scaling crediti) ──────────────────────────────────
async function incrementTranscriptUsage(): Promise<number> {
    try {
        const db = createServiceClient()
        const { data } = await db
            .from('system_usage')
            .select('count, reset_at')
            .eq('key', 'transcript')
            .single()

        const now = new Date()
        const resetAt = data?.reset_at ? new Date(data.reset_at) : new Date(0)
        const needsReset = (now.getTime() - resetAt.getTime()) / 86400000 >= 30

        if (needsReset || !data) {
            await db.from('system_usage').upsert({
                key: 'transcript',
                count: 1,
                reset_at: now.toISOString(),
                updated_at: now.toISOString(),
            })
            return 1
        }

        const newCount = (data.count ?? 0) + 1
        await db.from('system_usage')
            .update({ count: newCount, updated_at: now.toISOString() })
            .eq('key', 'transcript')
        return newCount
    } catch {
        return 0
    }
}

// ── GET: restituisce i segmenti al client ─────────────────────────────────────
export async function GET(req: NextRequest) {
    const videoId = req.nextUrl.searchParams.get('videoId')
    if (!videoId) return NextResponse.json({ error: 'videoId mancante' }, { status: 400 })

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

    let segments: TranscriptSegment[]
    let source: 'captions' | 'whisper' = 'captions'

    try {
        segments = await fetchViaSupadata(videoId)
    } catch (err: any) {
        if (!err.noCaption) {
            console.error('[Transcript GET] Supadata error:', err.message)
            return NextResponse.json({ error: err.message || 'Errore interno' }, { status: 500 })
        }
        segments = [] // noCaption → forza fallback Whisper sotto
    }

    // Fallback Whisper: scatta se Supadata non aveva sottotitoli (404) O array vuoto
    if (!segments.length) {
        console.log(`[Transcript GET] Nessun sottotitolo per ${videoId}, uso Whisper AI`)
        try {
            segments = await transcribeViaWhisper(videoId)
            source = 'whisper'
        } catch (whisperErr: any) {
            console.error('[Transcript GET] Whisper fallback error:', whisperErr.message)
            return NextResponse.json(
                { error: whisperErr.message || 'Impossibile generare la trascrizione AI.' },
                { status: 500 }
            )
        }
    }

    if (!segments.length) {
        return NextResponse.json(
            { error: 'Nessuna trascrizione disponibile per questo video.' },
            { status: 404 }
        )
    }

    const newCount = await incrementTranscriptUsage()
    const nextCost = computeTranscriptCost(newCount)

    if (newCount === 80 || newCount === 90 || newCount === 100) {
        pushToAdmins({
            title: `Lurumi — Supadata: ${newCount}/100 trascrizioni`,
            body: newCount === 100
                ? '🔴 Limite free tier raggiunto! Le trascrizioni ora costano crediti agli utenti.'
                : `⚠️ Hai usato ${newCount}% del free tier mensile Supadata.`,
            url: '/admin',
            tag: `supadata-alert-${newCount}`,
        }).catch(() => {})
    }

    return NextResponse.json({ success: true, segments, source, nextCost })
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
        const { tutorialId, transcript, translate = false, table = 'tutorials' } = await req.json() as {
            tutorialId: string
            transcript: TranscriptSegment[]
            translate?: boolean
            table?: 'tutorials' | 'projects'
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
        await db.from(table).update({ transcript_data: transcriptData })
            .eq('id', tutorialId).eq('user_id', user.id)

        return NextResponse.json({ success: true, translated: translated ?? null })
    } catch (error: any) {
        console.error('[Transcript POST]', error)
        return NextResponse.json({ success: false, error: error.message || 'Errore trascrizione.' }, { status: 500 })
    }
}
