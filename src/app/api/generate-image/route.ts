import { NextRequest, NextResponse } from 'next/server'
import Replicate from 'replicate'
import { createClient } from '@/lib/supabase/server'

function getReplicateClient() {
    if (!process.env.REPLICATE_API_TOKEN) {
        throw new Error('REPLICATE_API_TOKEN non configurato nel file .env.local')
    }
    return new Replicate({ auth: process.env.REPLICATE_API_TOKEN })
}

async function extractImageUrl(output: unknown): Promise<string> {
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
    if (typeof output === 'string' && (output.startsWith('http') || output.startsWith('data:'))) {
        return output
    }
    if (output && typeof (output as any).url === 'function') {
        return (output as any).url().toString()
    }
    if (output && typeof (output as any).blob === 'function') {
        const blob = await (output as any).blob()
        const buffer = Buffer.from(await blob.arrayBuffer())
        return `data:${blob.type};base64,${buffer.toString('base64')}`
    }
    throw new Error('Formato output non riconosciuto. Riprova.')
}

export async function POST(req: NextRequest) {
    try {
        const { prompt, aspectRatio, referenceImageBase64 } = await req.json()

        if (!prompt?.trim()) {
            return NextResponse.json({ success: false, error: 'Prompt mancante.' }, { status: 400 })
        }

        const replicate = getReplicateClient()

        let output: unknown
        if (referenceImageBase64) {
            output = await replicate.run(
                'black-forest-labs/flux-dev' as any,
                {
                    input: {
                        prompt,
                        image: referenceImageBase64,
                        prompt_strength: 0.8,
                        aspect_ratio: aspectRatio,
                        output_format: 'webp',
                        num_outputs: 1,
                    }
                }
            )
        } else {
            output = await replicate.run(
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
        }

        const imageUrl = await extractImageUrl(output)

        // Log to Supabase if user is authenticated
        try {
            const supabase = await createClient()
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
                await supabase.from('ai_generations').insert({
                    user_id: user.id,
                    tool_type: 'designer',
                    provider: 'replicate',
                    cost_usd: 0.003,
                    output_data: { prompt, imageUrl, aspectRatio }
                })
            }
        } catch { /* log failure is non-blocking */ }

        return NextResponse.json({ success: true, imageUrl })
    } catch (error: any) {
        console.error('Generate image error:', error)
        return NextResponse.json({ success: false, error: error.message || 'Errore durante la generazione. Riprova.' }, { status: 500 })
    }
}
