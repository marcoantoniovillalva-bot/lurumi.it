import { NextRequest, NextResponse } from 'next/server'
import Replicate from 'replicate'
import { createClient } from '@/lib/supabase/server'

function getReplicateClient() {
    if (!process.env.REPLICATE_API_TOKEN) {
        throw new Error('REPLICATE_API_TOKEN non configurato nel file .env.local')
    }
    return new Replicate({ auth: process.env.REPLICATE_API_TOKEN })
}

export async function POST(req: NextRequest) {
    try {
        const { message, imageBase64, toolType } = await req.json()

        const replicate = getReplicateClient()
        let text: string

        if (imageBase64) {
            // Convert data URL to Blob — Replicate SDK uploads it automatically
            const base64Data = imageBase64.replace(/^data:[^;]+;base64,/, '')
            const mimeType = imageBase64.match(/^data:([^;]+);/)?.[1] ?? 'image/jpeg'
            const imageBlob = new Blob([Buffer.from(base64Data, 'base64')], { type: mimeType })

            const userPrompt = message || "Analizza questa immagine e descrivi come potrebbe essere realizzata all'uncinetto o come ispirazione per un progetto di amigurumi."
            const output = await replicate.run(
                'yorickvp/llava-v1.6-mistral-7b:19be067b589d0c46689ffa7cc3ff321447a441986a7694c01225973c2eafc874',
                {
                    input: {
                        image: imageBlob,
                        prompt: `You are Lurumi, an expert in crochet, amigurumi and knitting. Always reply in the same language the user used. ${userPrompt}`,
                        max_tokens: 512,
                        temperature: 0.5,
                        top_p: 0.9,
                    }
                }
            )
            text = Array.isArray(output) ? output.join('') : String(output)
        } else {
            const output = await replicate.run(
                'meta/meta-llama-3-8b-instruct',
                {
                    input: {
                        prompt: message,
                        system_prompt: `You are Lurumi, a friendly and knowledgeable assistant specialized in crochet, amigurumi and knitting. Help the user with: ${toolType}. Always reply in the same language the user writes in.`,
                        max_new_tokens: 512,
                        temperature: 0.7,
                    }
                }
            )
            text = Array.isArray(output) ? output.join('') : String(output)
        }

        // Log to Supabase (non-blocking)
        try {
            const supabase = await createClient()
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
                await supabase.from('ai_generations').insert({
                    user_id: user.id,
                    tool_type: toolType,
                    provider: imageBase64 ? 'replicate-llama-vision' : 'replicate-llama',
                    cost_usd: imageBase64 ? 0.001 : 0.0001,
                    output_data: { message, response: text }
                })
            }
        } catch { /* log failure is non-blocking */ }

        return NextResponse.json({ success: true, text })
    } catch (error: any) {
        console.error('Chat API error:', error)
        return NextResponse.json(
            { success: false, error: error.message || 'Servizio AI non disponibile.' },
            { status: 500 }
        )
    }
}
