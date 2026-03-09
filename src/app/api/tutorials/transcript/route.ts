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
// Scarica l'audio (max 24 MB ≈ 20-30 min) e lo trascrive con whisper-large-v3.
async function transcribeViaWhisper(videoId: string): Promise<TranscriptSegment[]> {
    if (!process.env.GROQ_API_KEY) throw new Error('GROQ_API_KEY non configurato')

    // Ottieni info video e URL audio diretto
    const ytdl = (await import('@distube/ytdl-core')).default
    const url = `https://www.youtube.com/watch?v=${videoId}`

    let info: Awaited<ReturnType<typeof ytdl.getInfo>>
    try {
        info = await ytdl.getInfo(url)
    } catch (e: any) {
        throw new Error('Impossibile accedere al video YouTube. Potrebbe essere privato o non disponibile.')
    }

    // Scegliamo il formato audio di qualità più bassa (meno MB da scaricare)
    const audioFormat = ytdl.chooseFormat(info.formats, {
        quality: 'lowestaudio',
        filter: 'audioonly',
    })
    if (!audioFormat?.url) throw new Error('Nessun formato audio disponibile per questo video.')

    // Scarica audio con limite di 24 MB (≈ 20-30 min a bassa qualità)
    const MAX_BYTES = 24 * 1024 * 1024
    const audioRes = await fetch(audioFormat.url, { signal: AbortSignal.timeout(40_000) })
    if (!audioRes.ok) throw new Error('Errore nel download dell\'audio.')

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
    const ext = audioFormat.container || 'webm'
    const mimeType = audioFormat.mimeType?.split(';')[0] || 'audio/webm'

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
            // Errore Supadata generico (non "no captions") → restituisci l'errore
            console.error('[Transcript GET] Supadata error:', err.message)
            return NextResponse.json({ error: err.message || 'Errore interno' }, { status: 500 })
        }
        // Nessun sottotitolo → fallback Whisper AI
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
            { error: 'Trascrizione vuota. Il video potrebbe avere i sottotitoli disabilitati.' },
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
