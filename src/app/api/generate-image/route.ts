import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import Replicate from 'replicate'
import { createClient } from '@/lib/supabase/server'
import { checkAndDeductCredits } from '@/lib/ai-credits'
import { checkRateLimit } from '@/lib/rate-limit'
import { isAiEnabled, autoDisableIfOverBudget } from '@/lib/ai-status'

function getOpenAIClient() {
    if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY non configurato')
    return new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
}

function getReplicateClient() {
    if (!process.env.REPLICATE_API_TOKEN) throw new Error('REPLICATE_API_TOKEN non configurato')
    return new Replicate({ auth: process.env.REPLICATE_API_TOKEN })
}

async function extractReplicateUrl(output: unknown): Promise<string> {
    if (Array.isArray(output) && output.length > 0) {
        const item = output[0]
        if (typeof item === 'string') return item
        if (item && typeof (item as any).url === 'function') return (item as any).url().toString()
        if (item && typeof (item as any).href === 'string') return (item as any).href
        if (item && typeof (item as any).blob === 'function') {
            const blob = await (item as any).blob()
            const buffer = Buffer.from(await blob.arrayBuffer())
            return `data:${blob.type};base64,${buffer.toString('base64')}`
        }
        const str = String(item)
        if (str.startsWith('http') || str.startsWith('data:')) return str
    }
    if (typeof output === 'string' && (output.startsWith('http') || output.startsWith('data:'))) return output
    if (output && typeof (output as any).url === 'function') return (output as any).url().toString()
    throw new Error('Formato output non riconosciuto. Riprova.')
}

// DALL-E 3 accetta solo 1024x1024, 1792x1024, 1024x1792
// Mappiamo i ratio usati dall'UI al più vicino supportato
function toDalleSize(aspectRatio: string): '1024x1024' | '1792x1024' | '1024x1792' {
    if (aspectRatio === '16:9' || aspectRatio === '3:2') return '1792x1024'  // orizzontale
    if (aspectRatio === '9:16' || aspectRatio === '2:3') return '1024x1792'  // verticale
    return '1024x1024'  // quadrato (1:1)
}

const MAX_PROMPT_LENGTH = 1000
const MAX_REF_IMAGE_SIZE = 10 * 1024 * 1024 // 10 MB in caratteri base64

export async function POST(req: NextRequest) {
    try {
        const { prompt, aspectRatio, referenceImageBase64, hd } = await req.json()

        if (!prompt?.trim()) {
            return NextResponse.json({ success: false, error: 'Prompt mancante.' }, { status: 400 })
        }
        if (typeof prompt === 'string' && prompt.length > MAX_PROMPT_LENGTH) {
            return NextResponse.json(
                { success: false, error: `Il prompt non può superare ${MAX_PROMPT_LENGTH} caratteri.` },
                { status: 400 }
            )
        }
        if (referenceImageBase64 !== undefined && referenceImageBase64 !== null) {
            if (typeof referenceImageBase64 !== 'string' || referenceImageBase64.length > MAX_REF_IMAGE_SIZE) {
                return NextResponse.json({ success: false, error: 'Immagine di riferimento non valida o troppo grande.' }, { status: 400 })
            }
        }

        // Auth obbligatoria
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json(
                { success: false, error: 'Devi accedere per usare i servizi AI.' },
                { status: 401 }
            )
        }

        // Check AI abilitata
        if (!await isAiEnabled()) {
            return NextResponse.json(
                { success: false, error: 'Il servizio AI è temporaneamente sospeso. Riprova più tardi.' },
                { status: 503 }
            )
        }

        // Rate limiting — prevenzione burst abuse
        const action = hd ? 'image_hd' : 'image_fast'
        const rateResult = checkRateLimit(user.id, action)
        if (!rateResult.ok) {
            return NextResponse.json(
                { success: false, error: `Troppe richieste. Riprova tra ${rateResult.retryAfterSec} secondi.` },
                { status: 429, headers: { 'Retry-After': String(rateResult.retryAfterSec) } }
            )
        }

        // Verifica e scala crediti
        const creditResult = await checkAndDeductCredits(user.id, action)
        if (!creditResult.ok) {
            return NextResponse.json(
                { success: false, error: creditResult.error, creditsExhausted: true },
                { status: 402 }
            )
        }

        let imageUrl: string
        let provider: string
        let costUsd: number

        if (hd && !referenceImageBase64) {
            // DALL-E 3 HD — solo testo, nessuna immagine di riferimento
            const openai = getOpenAIClient()
            const enrichedPrompt = `High quality crochet and amigurumi art: ${prompt}. Handcrafted look, detailed yarn texture, studio lighting, soft background.`
            const response = await openai.images.generate({
                model: 'dall-e-3',
                prompt: enrichedPrompt,
                n: 1,
                size: toDalleSize(aspectRatio),
                quality: 'hd',
                response_format: 'url',
            })
            const dalleUrl = response.data?.[0]?.url ?? ''
            provider = 'openai-dalle3'
            costUsd = 0.08

            // Fetch server-side per evitare CORS sul client (URL OpenAI scade e non è CORS-safe)
            try {
                const imgRes = await fetch(dalleUrl)
                const imgBuffer = Buffer.from(await imgRes.arrayBuffer())
                const contentType = imgRes.headers.get('content-type') || 'image/png'
                imageUrl = `data:${contentType};base64,${imgBuffer.toString('base64')}`
            } catch {
                imageUrl = dalleUrl // fallback: URL diretto
            }
        } else if (referenceImageBase64) {
            // Usa GPT-4o Vision per analizzare l'immagine di riferimento
            // poi flux-dev per generare nel stile richiesto dall'utente
            const openai = getOpenAIClient()

            // Estrai la parte base64 pura (rimuovi eventuale data URL prefix)
            const base64Data = referenceImageBase64.includes(',')
                ? referenceImageBase64.split(',')[1]
                : referenceImageBase64
            const mimeMatch = referenceImageBase64.match(/^data:(image\/\w+);base64,/)
            const mimeType = (mimeMatch?.[1] ?? 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'

            const visionRes = await openai.chat.completions.create({
                model: 'gpt-4o',
                max_tokens: 300,
                messages: [
                    {
                        role: 'system',
                        content: 'Describe the subject in this image concisely in English. Focus on: physical features (hair color/style, eye color, skin tone, face shape, age range), distinctive traits, clothing colors, accessories. Be specific but brief. No greetings, no preamble.',
                    },
                    {
                        role: 'user',
                        content: [
                            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Data}`, detail: 'low' } },
                        ],
                    },
                ],
            })
            const subjectDescription = visionRes.choices[0]?.message?.content?.trim() ?? ''

            // Rileva lo stile richiesto e costruisci il prompt appropriato
            const lowerPrompt = prompt.toLowerCase()
            const isAmigurumi = /amigurumi|crochet|uncinetto|pupazzetto|peluche|stuffed|knit/i.test(lowerPrompt)
            const isManga = /manga|anime|cartoon|illustrazione|disegno|illustrated/i.test(lowerPrompt)

            let stylePrefix: string
            let styleSuffix: string
            if (isAmigurumi) {
                stylePrefix = `Amigurumi crochet doll of: ${subjectDescription}.`
                styleSuffix = 'Cute kawaii amigurumi stuffed toy, hand-crocheted yarn texture, visible crochet stitches, round simplified chibi features, soft plush toy aesthetic. Clean studio background, soft lighting.'
            } else if (isManga) {
                stylePrefix = `Manga/anime illustration of: ${subjectDescription}.`
                styleSuffix = 'Japanese manga art style, clean line art, anime character design, expressive eyes, detailed shading. Clean background.'
            } else {
                // Stile generico: rispetta il prompt dell'utente come guida principale
                stylePrefix = `${subjectDescription}.`
                styleSuffix = 'High quality, detailed, professional lighting.'
            }

            const enrichedRefPrompt = `${stylePrefix} ${prompt}. ${styleSuffix}`

            const replicate = getReplicateClient()
            const output = await replicate.run(
                'black-forest-labs/flux-dev' as any,
                {
                    input: {
                        prompt: enrichedRefPrompt,
                        image: referenceImageBase64,
                        prompt_strength: isAmigurumi ? 0.90 : 0.82,
                        aspect_ratio: aspectRatio,
                        output_format: 'webp',
                        num_outputs: 1,
                        num_inference_steps: hd ? 40 : 28,
                    }
                }
            )
            imageUrl = await extractReplicateUrl(output)
            provider = hd ? 'replicate-flux-dev-hd' : 'replicate-flux-dev'
            costUsd = hd ? 0.040 : 0.030
        } else {
            // flux-schnell fast (Replicate) — solo testo
            const replicate = getReplicateClient()

            // Prompt migliorato: rilevamento amigurumi/uncinetto per prompt più fedele
            const lowerPrompt = prompt.toLowerCase()
            const isAmigurumi = /amigurumi|pupazzetto|peluche|stuffed/i.test(lowerPrompt)
            const isCrochetItem = /uncinetto|crochet|granny|maglia|knit/i.test(lowerPrompt)

            let enrichedPrompt: string
            if (isAmigurumi) {
                enrichedPrompt = `Single amigurumi crochet toy: ${prompt}. One individual handcrafted amigurumi doll centered in frame, kawaii style, clearly visible yarn crochet stitches, soft plush texture, clean white studio background, professional product photography, no duplicate objects, no multiple copies.`
            } else if (isCrochetItem) {
                enrichedPrompt = `Handcrafted crochet item: ${prompt}. Single item centered in frame, detailed yarn texture, professional studio lighting, clean white background, no duplicate objects.`
            } else {
                enrichedPrompt = `${prompt}. Single subject centered in frame, studio lighting, professional craft photography, no duplicate objects.`
            }

            const output = await replicate.run(
                'black-forest-labs/flux-schnell',
                {
                    input: {
                        prompt: enrichedPrompt,
                        aspect_ratio: aspectRatio,
                        output_format: 'webp',
                        num_outputs: 1,
                    }
                }
            )
            imageUrl = await extractReplicateUrl(output)
            provider = 'replicate-flux-schnell'
            costUsd = 0.003
        }

        // Log + auto-disable check — non bloccanti
        void (async () => {
            try {
                await supabase.from('ai_generations').insert({
                    user_id: user.id,
                    tool_type: 'designer',
                    provider,
                    cost_usd: costUsd,
                    output_data: { prompt, imageUrl, aspectRatio, hd: !!hd },
                })
            } catch {}
            autoDisableIfOverBudget().catch(() => {})
        })()

        return NextResponse.json({ success: true, imageUrl })
    } catch (error: any) {
        console.error('Generate image error:', error)
        return NextResponse.json(
            { success: false, error: error.message || 'Errore durante la generazione. Riprova.' },
            { status: 500 }
        )
    }
}
