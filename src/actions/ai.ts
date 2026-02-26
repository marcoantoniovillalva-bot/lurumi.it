'use server'

import Replicate from 'replicate'
import { createClient } from '@/lib/supabase/server'

function getReplicateClient() {
    if (!process.env.REPLICATE_API_TOKEN) {
        throw new Error('REPLICATE_API_TOKEN non configurato nel file .env.local')
    }
    return new Replicate({ auth: process.env.REPLICATE_API_TOKEN })
}

/** Estrae una stringa URL da qualsiasi formato di output del SDK Replicate v1 */
async function extractImageUrl(output: unknown): Promise<string> {
    // Array di FileOutput (formato più comune di flux-schnell)
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
    // Stringa diretta
    if (typeof output === 'string' && (output.startsWith('http') || output.startsWith('data:'))) {
        return output
    }
    // Oggetto FileOutput singolo
    if (output && typeof (output as any).url === 'function') {
        return (output as any).url().toString()
    }
    if (output && typeof (output as any).blob === 'function') {
        const blob = await (output as any).blob()
        const buffer = Buffer.from(await blob.arrayBuffer())
        return `data:${blob.type};base64,${buffer.toString('base64')}`
    }
    // ReadableStream
    if (output && (typeof (output as any).getReader === 'function' || output instanceof ReadableStream)) {
        const reader = (output as any).getReader()
        const chunks: ArrayBuffer[] = []
        while (true) {
            const { done, value } = await reader.read()
            if (done) break
            chunks.push(value.buffer as ArrayBuffer)
        }
        const blob = new Blob(chunks, { type: 'image/webp' })
        const buffer = Buffer.from(await blob.arrayBuffer())
        return `data:image/webp;base64,${buffer.toString('base64')}`
    }
    throw new Error('Formato output non riconosciuto. Riprova.')
}

export async function generatePatternImage(prompt: string, aspectRatio: string, referenceImageBase64?: string) {
    try {
        const replicate = getReplicateClient()
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

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

        if (user) {
            const { error: dbError } = await supabase.from('ai_generations').insert({
                user_id: user.id,
                tool_type: 'designer',
                provider: 'replicate',
                cost_usd: 0.003,
                output_data: { prompt, imageUrl, aspectRatio }
            })
            if (dbError) console.error('DB logging failed:', dbError)
        }

        return { success: true, imageUrl }
    } catch (error: any) {
        console.error('AI Generation Error:', error)
        return { success: false, error: error.message || 'Errore durante la generazione. Riprova.' }
    }
}

export async function chatWithVisionAI(message: string, imageBase64: string, toolType: string) {
    try {
        const replicate = getReplicateClient()
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        const imageBlob = await fetch(imageBase64).then(r => r.blob())
        const output = await replicate.run(
            'yorickvp/llava-13b' as any,
            {
                input: {
                    image: imageBlob,
                    prompt: `Sei Lurumi, un assistente esperto in uncinetto, amigurumi e maglia. ${message || "Analizza questa immagine e descrivi come potrebbe essere realizzata all'uncinetto o come ispirazione per un progetto di amigurumi."}. Rispondi in italiano in modo tecnico e utile.`,
                    max_tokens: 512,
                    temperature: 0.6,
                }
            }
        )

        const text = Array.isArray(output) ? output.join('') : String(output)

        if (user) {
            const { error: dbError } = await supabase.from('ai_generations').insert({
                user_id: user.id,
                tool_type: toolType,
                provider: 'replicate-llama-vision',
                cost_usd: 0.001,
                output_data: { message, response: text }
            })
            if (dbError) console.error('DB logging failed:', dbError)
        }

        return { success: true, text }
    } catch (error: any) {
        console.error('AI Vision Chat Error:', error)
        return { success: false, error: error.message || 'Servizio AI non disponibile.' }
    }
}

export async function chatWithCrochetAI(message: string, toolType: string) {
    try {
        const replicate = getReplicateClient()
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        // meta-llama-3-8b-instruct è più stabile e veloce
        const output = await replicate.run(
            'meta/meta-llama-3-8b-instruct',
            {
                input: {
                    prompt: message,
                    system_prompt: `Sei Lurumi, un assistente esperto in uncinetto, amigurumi e maglia. Aiuta l'utente con: ${toolType}. Rispondi in italiano, in modo amichevole, tecnico e preciso.`,
                    max_new_tokens: 512,
                    temperature: 0.7,
                }
            }
        )

        const text = Array.isArray(output) ? output.join('') : String(output)

        if (user) {
            const { error: dbError } = await supabase.from('ai_generations').insert({
                user_id: user.id,
                tool_type: toolType,
                provider: 'replicate-llama',
                cost_usd: 0.0001,
                output_data: { message, response: text }
            })
            if (dbError) console.error('DB logging failed:', dbError)
        }

        return { success: true, text }
    } catch (error: any) {
        console.error('AI Chat Error:', error)
        return { success: false, error: error.message || 'Servizio AI non disponibile. Riprova più tardi.' }
    }
}
