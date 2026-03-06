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
            imageUrl = response.data?.[0]?.url ?? ''
            provider = 'openai-dalle3'
            costUsd = 0.08
        } else if (referenceImageBase64) {
            // flux-dev con immagine di riferimento (Replicate)
            // HD = più inference steps per qualità superiore mantenendo la somiglianza
            const replicate = getReplicateClient()
            const enrichedRefPrompt = `Amigurumi crochet doll version of the subject in the reference image. ${prompt}. Cute kawaii amigurumi stuffed toy, hand-crocheted yarn texture, visible crochet stitches, round simplified chibi features, soft plush toy aesthetic, maintain color palette and recognizable traits from reference. Clean studio background, soft lighting.`
            const output = await replicate.run(
                'black-forest-labs/flux-dev' as any,
                {
                    input: {
                        prompt: enrichedRefPrompt,
                        image: referenceImageBase64,
                        prompt_strength: 0.78,
                        aspect_ratio: aspectRatio,
                        output_format: 'webp',
                        num_outputs: 1,
                        num_inference_steps: hd ? 40 : 28,
                    }
                }
            )
            imageUrl = await extractReplicateUrl(output)
            provider = hd ? 'replicate-flux-dev-hd' : 'replicate-flux-dev'
            costUsd = hd ? 0.035 : 0.025
        } else {
            // flux-schnell fast (Replicate) — solo testo
            const replicate = getReplicateClient()
            const output = await replicate.run(
                'black-forest-labs/flux-schnell',
                {
                    input: {
                        prompt: `Beautiful high-quality crochet/knitting pattern visualization: ${prompt}. Studio lighting, professional craft photography.`,
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
