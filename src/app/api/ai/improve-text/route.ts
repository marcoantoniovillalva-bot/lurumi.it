import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'
import { isAiEnabled } from '@/lib/ai-status'

function getGroqClient() {
    if (!process.env.GROQ_API_KEY) throw new Error('GROQ_API_KEY non configurato')
    return new OpenAI({ apiKey: process.env.GROQ_API_KEY, baseURL: 'https://api.groq.com/openai/v1' })
}

export async function POST(req: NextRequest) {
    try {
        const { text, type, context } = await req.json() as {
            text: string
            type: 'title' | 'description'
            context?: string
        }

        if (!text?.trim()) {
            return NextResponse.json({ success: false, error: 'Testo mancante.' }, { status: 400 })
        }

        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return NextResponse.json({ success: false, error: 'Non autenticato.' }, { status: 401 })

        const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
        if (!profile?.is_admin) return NextResponse.json({ success: false, error: 'Non autorizzato.' }, { status: 403 })

        if (!await isAiEnabled()) {
            return NextResponse.json({ success: false, error: 'Servizio AI sospeso.' }, { status: 503 })
        }

        const groq = getGroqClient()

        const systemPrompt = type === 'title'
            ? `Sei un copywriter esperto in corsi di uncinetto, maglia e amigurumi. Migliora il titolo fornito rendendolo pi\u00f9 accattivante, emozionale e persuasivo. Usa emoji se appropriato. Il titolo deve essere breve (max 60 caratteri). Rispondi SOLO con il titolo migliorato, senza spiegazioni, senza virgolette.`
            : `Sei un copywriter esperto in corsi di uncinetto, maglia e amigurumi. Migliora la descrizione fornita rendendola pi\u00f9 ricca, emozionale e persuasiva. Usa la gerarchia dei bisogni di Maslow (appartenenza, stima, realizzazione personale), concentrati sui benefici pi\u00f9 che sulle caratteristiche. Aggiungi emoji appropriati per rendere il testo vivace. Lunghezza: 2-4 frasi. Rispondi SOLO con la descrizione migliorata, senza spiegazioni, senza virgolette.`

        const userMsg = context
            ? `Testo: ${text}\nContesto: ${context}`
            : `Testo: ${text}`

        const completion = await groq.chat.completions.create({
            model: 'llama-3.3-70b-versatile',
            max_tokens: type === 'title' ? 80 : 350,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userMsg },
            ],
        })

        const improved = completion.choices[0]?.message?.content?.trim() ?? text
        return NextResponse.json({ success: true, text: improved })
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message || 'Errore AI.' }, { status: 500 })
    }
}
