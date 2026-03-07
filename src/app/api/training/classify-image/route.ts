import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'
import { isAiEnabled } from '@/lib/ai-status'

const CLASSIFICATION_PROMPT = `Sei un esperto di amigurumi e uncinetto. Devi classificare questa immagine come REALE (un amigurumi fatto a mano e fotografato) oppure IA (generata da intelligenza artificiale).

Criteri per classificare come REALE:
- Maglie regolari e distinguibili, disposte in file ordinate
- Ombre coerenti con la forma 3D dell'oggetto
- Texture del filo visibile (fibre, torsione del cotone)
- Effetto dell'aumento visibile ai bordi della forma
- Piccole imprecisioni naturali tra una maglia e l'altra
- Imbottitura coerente con la geometria (peso, distribuzione)
- Sfondo reale (tavolo, mano, ambiente)

Criteri per classificare come IA:
- Superficie liscia o texture generica non reale
- Ombre piatte o contraddittorie
- Maglie confuse, sfocate o non distinguibili singolarmente
- Geometria troppo perfetta o al contrario troppo caotica
- Saturazione digitale innaturale dei colori
- Bordi troppo netti o effetto pittura digitale
- Filo che scompare o è incoerente

Rispondi SOLO in JSON con questa struttura esatta:
{
  "label": "REALE" oppure "IA",
  "confidence": "high" oppure "medium" oppure "low",
  "reasons": ["motivo 1", "motivo 2", "motivo 3"]
}
`

export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return NextResponse.json({ success: false, error: 'Non autenticato' }, { status: 401 })

        const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
        if (!profile?.is_admin) return NextResponse.json({ success: false, error: 'Accesso negato' }, { status: 403 })

        if (!await isAiEnabled()) {
            return NextResponse.json({ success: false, error: 'Servizio AI sospeso.' }, { status: 503 })
        }

        if (!process.env.OPENAI_API_KEY) {
            return NextResponse.json({ success: false, error: 'OPENAI_API_KEY non configurata.' }, { status: 500 })
        }

        const { imageUrl } = await req.json() as { imageUrl: string }
        if (!imageUrl) return NextResponse.json({ success: false, error: 'imageUrl mancante' }, { status: 400 })

        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

        const completion = await openai.chat.completions.create({
            model: 'gpt-4o',
            max_tokens: 300,
            messages: [
                {
                    role: 'user',
                    content: [
                        { type: 'text', text: CLASSIFICATION_PROMPT },
                        { type: 'image_url', image_url: { url: imageUrl, detail: 'high' } },
                    ],
                },
            ],
        })

        const raw = completion.choices[0]?.message?.content?.trim() ?? ''
        const jsonMatch = raw.match(/\{[\s\S]*\}/)
        const parsed = JSON.parse(jsonMatch?.[0] ?? raw)

        return NextResponse.json({
            success: true,
            label: parsed.label === 'REALE' ? 'REALE' : 'IA',
            confidence: parsed.confidence ?? 'medium',
            reasons: Array.isArray(parsed.reasons) ? parsed.reasons : [],
            isReal: parsed.label === 'REALE',
        })
    } catch (error: any) {
        console.error('[classify-image]', error)
        return NextResponse.json({ success: false, error: error.message || 'Errore classificazione.' }, { status: 500 })
    }
}
