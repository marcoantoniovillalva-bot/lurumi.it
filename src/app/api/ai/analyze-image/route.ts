import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'
import { isAiEnabled } from '@/lib/ai-status'

export async function POST(req: NextRequest) {
    try {
        const { imageUrl, context } = await req.json() as { imageUrl: string; context?: string }

        if (!imageUrl) return NextResponse.json({ success: false, error: 'imageUrl mancante' }, { status: 400 })

        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return NextResponse.json({ success: false, error: 'Non autenticato.' }, { status: 401 })

        const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
        if (!profile?.is_admin) return NextResponse.json({ success: false, error: 'Non autorizzato.' }, { status: 403 })

        if (!await isAiEnabled()) {
            return NextResponse.json({ success: false, error: 'Servizio AI sospeso.' }, { status: 503 })
        }

        if (!process.env.OPENAI_API_KEY) {
            return NextResponse.json({ success: false, error: 'OPENAI_API_KEY non configurata.' }, { status: 500 })
        }

        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

        const contextHint = context === 'event'
            ? 'È la copertina di un corso o workshop di uncinetto/amigurumi.'
            : context === 'library'
            ? 'È la copertina di uno schema o libro di uncinetto/amigurumi.'
            : 'È un contenuto dell\'app Lurumi, dedicata a uncinetto e amigurumi.'

        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            max_tokens: 300,
            messages: [
                {
                    role: 'user',
                    content: [
                        {
                            type: 'text',
                            text: `Analizza questa immagine. ${contextHint}
Suggerisci un titolo accattivante (max 60 caratteri, con emoji iniziale) e una descrizione persuasiva (2-3 frasi, max 200 caratteri) in italiano.
Rispondi SOLO in JSON: { "title": "...", "description": "..." }`,
                        },
                        { type: 'image_url', image_url: { url: imageUrl, detail: 'low' } },
                    ],
                },
            ],
        })

        const raw = completion.choices[0]?.message?.content?.trim() ?? ''
        const jsonMatch = raw.match(/\{[\s\S]*\}/)
        const parsed = JSON.parse(jsonMatch?.[0] ?? raw)

        return NextResponse.json({ success: true, title: parsed.title ?? '', description: parsed.description ?? '' })
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message || 'Errore analisi immagine.' }, { status: 500 })
    }
}
