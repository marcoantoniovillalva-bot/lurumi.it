import { NextRequest, NextResponse } from 'next/server'
import Replicate from 'replicate'
import { createClient } from '@/lib/supabase/server'
import { checkAndDeductCredits } from '@/lib/ai-credits'
import { checkRateLimit } from '@/lib/rate-limit'
import { isAiEnabled, autoDisableIfOverBudget } from '@/lib/ai-status'

function getReplicateClient() {
    if (!process.env.REPLICATE_API_TOKEN) throw new Error('REPLICATE_API_TOKEN non configurato')
    return new Replicate({ auth: process.env.REPLICATE_API_TOKEN })
}

const MAX_PROMPT_LENGTH = 800

export async function POST(req: NextRequest) {
    try {
        const { prompt, aspectRatio } = await req.json()

        if (!prompt?.trim()) {
            return NextResponse.json({ success: false, error: 'Prompt mancante.' }, { status: 400 })
        }
        if (prompt.length > MAX_PROMPT_LENGTH) {
            return NextResponse.json(
                { success: false, error: `Il prompt non può superare ${MAX_PROMPT_LENGTH} caratteri.` },
                { status: 400 }
            )
        }

        // Auth
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            return NextResponse.json({ success: false, error: 'Devi accedere per usare i servizi AI.' }, { status: 401 })
        }

        // AI status check
        if (!await isAiEnabled()) {
            return NextResponse.json({ success: false, error: 'Il servizio AI è temporaneamente sospeso.' }, { status: 503 })
        }

        // Rate limit
        const rateResult = checkRateLimit(user.id, 'bg_generation')
        if (!rateResult.ok) {
            return NextResponse.json(
                { success: false, error: `Troppe richieste. Riprova tra ${rateResult.retryAfterSec} secondi.` },
                { status: 429, headers: { 'Retry-After': String(rateResult.retryAfterSec) } }
            )
        }

        // Crediti: 15 cr
        const creditResult = await checkAndDeductCredits(user.id, 'bg_generation')
        if (!creditResult.ok) {
            return NextResponse.json(
                { success: false, error: creditResult.error, creditsExhausted: true },
                { status: 402 }
            )
        }

        // Genera sfondo con flux-schnell — prompt focalizzato solo sullo sfondo, senza soggetto
        const enrichedPrompt = `Background only, no subject, no people, no objects in foreground: ${prompt}. Clean background, high quality, seamless.`
        const ratio = aspectRatio || '1:1'

        const replicate = getReplicateClient()
        const output = await replicate.run(
            'black-forest-labs/flux-schnell',
            {
                input: {
                    prompt: enrichedPrompt,
                    aspect_ratio: ratio,
                    output_format: 'webp',
                    num_outputs: 1,
                }
            }
        )

        // Estrai URL e converti in base64 per risposta
        let resultBase64: string
        const extractFromItem = async (item: any): Promise<string> => {
            if (typeof item === 'string' && item.startsWith('http')) {
                const res = await fetch(item)
                const buf = Buffer.from(await res.arrayBuffer())
                return `data:image/webp;base64,${buf.toString('base64')}`
            }
            if (typeof item === 'string' && item.startsWith('data:')) return item
            if (item && typeof item.blob === 'function') {
                const blob = await item.blob()
                const buf = Buffer.from(await blob.arrayBuffer())
                return `data:image/webp;base64,${buf.toString('base64')}`
            }
            if (item && typeof item.url === 'function') {
                const url = item.url().toString()
                const res = await fetch(url)
                const buf = Buffer.from(await res.arrayBuffer())
                return `data:image/webp;base64,${buf.toString('base64')}`
            }
            throw new Error('Formato output non riconosciuto.')
        }

        if (Array.isArray(output) && output.length > 0) {
            resultBase64 = await extractFromItem(output[0])
        } else {
            resultBase64 = await extractFromItem(output)
        }

        // Log asincrono
        void (async () => {
            try {
                await supabase.from('ai_generations').insert({
                    user_id: user.id,
                    tool_type: 'image_editor',
                    provider: 'replicate-flux-schnell',
                    cost_usd: 0.003,
                    output_data: { action: 'bg_generation', prompt, aspectRatio: ratio },
                })
            } catch {}
            autoDisableIfOverBudget().catch(() => {})
        })()

        return NextResponse.json({ success: true, imageBase64: resultBase64 })
    } catch (error: any) {
        console.error('Generate background error:', error)
        return NextResponse.json(
            { success: false, error: error.message || 'Errore durante la generazione sfondo. Riprova.' },
            { status: 500 }
        )
    }
}
