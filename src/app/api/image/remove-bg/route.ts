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

const MAX_IMAGE_SIZE = 10 * 1024 * 1024 // 10 MB in caratteri base64

export async function POST(req: NextRequest) {
    try {
        const { imageBase64 } = await req.json()

        if (!imageBase64 || typeof imageBase64 !== 'string') {
            return NextResponse.json({ success: false, error: 'Immagine mancante.' }, { status: 400 })
        }
        if (imageBase64.length > MAX_IMAGE_SIZE) {
            return NextResponse.json({ success: false, error: 'Immagine troppo grande (max 10 MB).' }, { status: 400 })
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
        const rateResult = checkRateLimit(user.id, 'bg_removal')
        if (!rateResult.ok) {
            return NextResponse.json(
                { success: false, error: `Troppe richieste. Riprova tra ${rateResult.retryAfterSec} secondi.` },
                { status: 429, headers: { 'Retry-After': String(rateResult.retryAfterSec) } }
            )
        }

        // Crediti: 10 cr
        const creditResult = await checkAndDeductCredits(user.id, 'bg_removal')
        if (!creditResult.ok) {
            return NextResponse.json(
                { success: false, error: creditResult.error, creditsExhausted: true },
                { status: 402 }
            )
        }

        // Chiama bria/remove-background su Replicate (RMBG 2.0 — stato dell'arte)
        const replicate = getReplicateClient()
        const output = await replicate.run(
            'bria/remove-background' as any,
            { input: { image: imageBase64 } }
        )

        // L'output è un oggetto ReadableStream / FileOutput — estraiamo come base64
        let resultBase64: string
        const out = output as any
        if (out && typeof out.blob === 'function') {
            const blob = await out.blob()
            const buffer = Buffer.from(await blob.arrayBuffer())
            resultBase64 = `data:image/png;base64,${buffer.toString('base64')}`
        } else if (typeof out === 'string' && out.startsWith('data:')) {
            resultBase64 = out
        } else if (typeof out === 'string' && out.startsWith('http')) {
            // Scarica l'immagine e convertila in base64
            const res = await fetch(out)
            const arrayBuffer = await res.arrayBuffer()
            const buffer = Buffer.from(arrayBuffer)
            resultBase64 = `data:image/png;base64,${buffer.toString('base64')}`
        } else if (Array.isArray(out) && out.length > 0) {
            const item = out[0]
            if (typeof item === 'string' && item.startsWith('http')) {
                const res = await fetch(item)
                const arrayBuffer = await res.arrayBuffer()
                const buffer = Buffer.from(arrayBuffer)
                resultBase64 = `data:image/png;base64,${buffer.toString('base64')}`
            } else if (item && typeof (item as any).blob === 'function') {
                const blob = await (item as any).blob()
                const buffer = Buffer.from(await blob.arrayBuffer())
                resultBase64 = `data:image/png;base64,${buffer.toString('base64')}`
            } else {
                resultBase64 = String(item)
            }
        } else {
            throw new Error('Formato output Replicate non riconosciuto.')
        }

        // Log asincrono
        void (async () => {
            try {
                await supabase.from('ai_generations').insert({
                    user_id: user.id,
                    tool_type: 'image_editor',
                    provider: 'replicate-bria-remove-background',
                    cost_usd: 0.006,
                    output_data: { action: 'bg_removal' },
                })
            } catch {}
            autoDisableIfOverBudget().catch(() => {})
        })()

        return NextResponse.json({ success: true, imageBase64: resultBase64 })
    } catch (error: any) {
        console.error('Remove background error:', error)
        return NextResponse.json(
            { success: false, error: error.message || 'Errore durante la rimozione sfondo. Riprova.' },
            { status: 500 }
        )
    }
}
