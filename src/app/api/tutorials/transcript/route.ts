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

    // 404 or 206 with error = nessun sottotitolo disponibile → segnale per il fallback Whisper
    if (res.status === 404 || res.status === 206) {
        const body = await res.json().catch(() => ({}))
        if (body?.error === 'transcript-unavailable' || res.status === 404) {
            const err = new Error('NO_CAPTIONS') as any
            err.noCaption = true
            throw err
        }
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

// ── Fallback 1: youtube-transcript (sottotitoli auto-generati YouTube) ────────
async function fetchViaYoutubeTranscript(videoId: string): Promise<TranscriptSegment[]> {
    const { YoutubeTranscript } = await import('youtube-transcript')
    // Prova prima in italiano, poi in inglese, poi qualsiasi lingua
    for (const lang of ['it', 'en', undefined]) {
        try {
            const items = await YoutubeTranscript.fetchTranscript(videoId, lang ? { lang } : {})
            if (items?.length) {
                return items.map((item: any) => ({
                    text: (item.text as string).replace(/\n/g, ' ').trim(),
                    start: item.offset ?? 0,     // già in secondi
                    duration: item.duration ?? 0, // già in secondi
                })).filter((s: TranscriptSegment) => s.text)
            }
        } catch {
            // lingua non disponibile → prova la prossima
        }
    }
    const err = new Error('NO_CAPTIONS') as any
    err.noCaption = true
    throw err
}

// ── Fallback 2: trascrizione AI via Groq Whisper ─────────────────────────────
// Ultimo resort: scarica l'audio e lo trascrive con Whisper.
// Solo per video senza sottotitoli di nessun tipo.
async function transcribeViaWhisper(videoId: string): Promise<TranscriptSegment[]> {
    if (!process.env.GROQ_API_KEY) throw new Error('GROQ_API_KEY non configurato')

    const { Innertube } = await import('youtubei.js')
    const MAX_BYTES = 24 * 1024 * 1024 // 24 MB ≈ 20-30 min a bassa qualità

    let audioBuffer: Buffer
    const mimeType = 'audio/webm'

    try {
        const yt = await Innertube.create({ retrieve_player: true, generate_session_locally: true })

        // TV_EMBEDDED bypassa il requisito di login per video age-restricted su IP server
        // Fallback: IOS → ANDROID per massima compatibilità
        let stream: ReadableStream<Uint8Array> | undefined
        for (const client of ['TV_EMBEDDED', 'IOS', 'ANDROID'] as const) {
            try {
                stream = await yt.download(videoId, {
                    type: 'audio',
                    quality: 'bestefficiency',
                    format: 'any',
                    client,
                })
                break
            } catch (clientErr: any) {
                const msg = (clientErr?.message ?? '').toLowerCase()
                if (msg.includes('login') || msg.includes('not available') || msg.includes('unavailable') || msg.includes('400')) {
                    console.warn(`[Whisper] client ${client} fallito (${clientErr.message}), provo il prossimo…`)
                    continue
                }
                throw clientErr
            }
        }
        if (!stream) throw new Error('nessun client disponibile')

        const chunks: Uint8Array[] = []
        let totalBytes = 0
        const reader = stream.getReader()
        while (true) {
            const { done, value } = await reader.read()
            if (done) break
            chunks.push(value)
            totalBytes += value.length
            if (totalBytes >= MAX_BYTES) { await reader.cancel(); break }
        }
        audioBuffer = Buffer.concat(chunks.map(c => Buffer.from(c)))
    } catch (e: any) {
        throw new Error(`Impossibile scaricare l'audio del video: ${e.message}`)
    }

    // Invia a Groq Whisper tramite multipart form
    const formData = new FormData()
    const blob = new Blob([audioBuffer.buffer as ArrayBuffer], { type: mimeType })
    formData.append('file', blob, 'audio.webm')
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

    let segments: TranscriptSegment[] = []
    let source: 'captions' | 'whisper' = 'captions'

    // ── Step 1: Supadata (sottotitoli manuali YouTube) ─────────────────────────
    try {
        segments = await fetchViaSupadata(videoId)
    } catch (err: any) {
        // Qualsiasi errore Supadata (noCaption o generico) → prova i fallback
        console.warn('[Transcript GET] Supadata fallback:', err.message)
    }

    // ── Step 2: youtube-transcript (sottotitoli auto-generati YouTube) ──────────
    if (!segments.length) {
        console.log(`[Transcript GET] Supadata vuoto per ${videoId}, provo youtube-transcript`)
        try {
            segments = await fetchViaYoutubeTranscript(videoId)
        } catch (ytErr: any) {
            if (!ytErr.noCaption) {
                console.error('[Transcript GET] youtube-transcript error:', ytErr.message)
            }
            // noCaption o errore generico → prova Whisper
        }
    }

    // ── Step 3: Groq Whisper (download audio + AI transcription) ───────────────
    if (!segments.length) {
        console.log(`[Transcript GET] Nessun sottotitolo per ${videoId}, uso Whisper AI`)
        try {
            segments = await transcribeViaWhisper(videoId)
            source = 'whisper'
        } catch (whisperErr: any) {
            console.error('[Transcript GET] Whisper fallback error:', whisperErr.message)
            return NextResponse.json(
                {
                    error: 'YouTube non ha reso disponibili i sottotitoli per questo video dal server. Prova a caricare manualmente un file audio dalla pagina del tutorial.',
                },
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

// ── Trascrizione audio caricato dall'utente ───────────────────────────────
async function transcribeUploadedAudio(formData: FormData): Promise<TranscriptSegment[]> {
    if (!process.env.GROQ_API_KEY) throw new Error('GROQ_API_KEY non configurato')

    const file = formData.get('file') as File
    if (!file) throw new Error('File audio mancante')

    const validTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/aac', 'audio/x-m4a']
    if (!validTypes.includes(file.type) && !file.name.match(/\.(mp3|wav|ogg|webm|m4a|aac)$/i)) {
        throw new Error('Tipo file non supportato. Carica un file audio (MP3, WAV, OGG, WebM, M4A)')
    }

    const MAX_SIZE = 25 * 1024 * 1024 // 25 MB
    if (file.size > MAX_SIZE) {
        throw new Error('File troppo grande. Max 25 MB.')
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const formDataUpload = new FormData()
    const blob = new Blob([buffer], { type: file.type || 'audio/mpeg' })
    formDataUpload.append('file', blob, file.name)
    formDataUpload.append('model', 'whisper-large-v3')
    formDataUpload.append('response_format', 'verbose_json')
    formDataUpload.append('timestamp_granularities[]', 'segment')

    const whisperRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` },
        body: formDataUpload,
    })

    if (!whisperRes.ok) {
        const errBody = await whisperRes.text().catch(() => '')
        throw new Error(`Errore trascrizione: ${whisperRes.status}. Riprova con un file audio più chiaro.`)
    }

    const result = await whisperRes.json()

    if (!result.segments?.length) {
        throw new Error('Nessun testo rilevato nel file audio.')
    }

    return result.segments.map((seg: any) => ({
        text: (seg.text as string).trim(),
        start: seg.start ?? 0,
        duration: (seg.end ?? seg.start ?? 0) - (seg.start ?? 0),
    }))
}

// ── POST: riceve segmenti → traduce → salva su Supabase ──────────────────────
export async function POST(req: NextRequest) {
    // Check if multipart/form-data (audio upload)
    const contentType = req.headers.get('content-type') || ''
    
    if (contentType.includes('multipart/form-data')) {
        try {
            const formData = await req.formData()
            
            const tutorialId = formData.get('tutorialId') as string
            const translate = formData.get('translate') === 'true'
            const table = (formData.get('table') as string) || 'tutorials'
            
            if (!tutorialId) {
                return NextResponse.json({ success: false, error: 'ID tutorial mancante' }, { status: 400 })
            }

            const supabase = await createClient()
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return NextResponse.json({ success: false, error: 'Non autenticato.' }, { status: 401 })

            // Transcribe the uploaded audio
            const segments = await transcribeUploadedAudio(formData)
            
            // Translate if requested
            let translated: TranscriptSegment[] | undefined
            if (translate && segments.length) {
                const groq = getGroqClient()
                const CHUNK = 80
                const allTexts = segments.map(s => s.text)
                const translatedTexts: string[] = []
                for (let i = 0; i < allTexts.length; i += CHUNK) {
                    const chunk = allTexts.slice(i, i + CHUNK)
                    translatedTexts.push(...(await translateChunk(groq, chunk)))
                }
                translated = segments.map((s, i) => ({ ...s, text: translatedTexts[i] || s.text }))
            }

            const transcriptData = {
                transcript: segments,
                translated: translated ?? null,
                generated_at: new Date().toISOString(),
                has_translation: !!translated,
                source: 'whisper' as const,
            }

            const db = createServiceClient()
            await db.from(table).update({ transcript_data: transcriptData })
                .eq('id', tutorialId).eq('user_id', user.id)

            return NextResponse.json({ success: true, translated: translated ?? null, segments })
        } catch (error: any) {
            console.error('[Audio Upload POST]', error)
            return NextResponse.json({ success: false, error: error.message || 'Errore trascrizione audio.' }, { status: 500 })
        }
    }

    // Original JSON POST handling
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
