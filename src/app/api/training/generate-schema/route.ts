import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'
import { isAiEnabled } from '@/lib/ai-status'

const SYSTEM_PROMPT = `Sei un esperto di schemi amigurumi con 20 anni di esperienza nella tecnica dell'uncinetto.
Il tuo compito è generare schemi amigurumi tecnici, giro per giro, matematicamente corretti.

REGOLE MATEMATICHE ASSOLUTE (non possono essere violate):
1. AUMENTO (inc/aum): stitch_count_nuovo = stitch_count_precedente + numero_aumenti
2. DIMINUZIONE (dec/dim): stitch_count_nuovo = stitch_count_precedente - numero_diminuzioni
3. GIRO DRITTO (Nsc): stitch_count_nuovo = stitch_count_precedente (invariato)
4. Formula distributiva: da M a M+6 → "((M/6-1)pb, aum) ×6"
5. La sfera standard inizia sempre con AM 6pb (anello magico 6 punti)

VOCABOLARIO (usa sempre le abbreviazioni italiane):
- pb = punto basso (single crochet)
- aum = aumento (2pb nella stessa maglia)
- dim = diminuzione invisibile
- AM = anello magico
- cat = catenella
- pbss = punto bassissimo
- BLO = solo asole posteriori

REGOLE SINTASSI ISTRUZIONI (OBBLIGATORIE):
- Le ripetizioni usano SEMPRE il simbolo × (Unicode U+00D7), MAI la lettera x
- I gruppi ripetuti vanno tra parentesi tonde: "(pb, aum) ×6" non "pb, aum ×6"
- Un singolo punto ripetuto non ha parentesi: "aum ×6" oppure "pb ×12"
- Giro 1 da anello magico: "AM 6pb" con stitch_count: 6
- Giro 1 da catenella: "N cat, 1pb in ogni cat" con stitch_count: N

FORMATO OUTPUT — rispondi SOLO con un array JSON valido, senza testo aggiuntivo:
[
  {
    "name": "NomeParte",
    "color": "colore",
    "start_type": "magic_ring" oppure "chain",
    "rounds": [
      {"round": 1, "instruction": "AM 6pb", "stitch_count": 6},
      {"round": 2, "instruction": "aum ×6", "stitch_count": 12},
      {"round": 3, "instruction": "(pb, aum) ×6", "stitch_count": 18},
      {"round": "4-6", "instruction": "18pb", "stitch_count": 18},
      {"round": 7, "instruction": "(pb, dim) ×6", "stitch_count": 12}
    ]
  }
]

Usa "round": "N-M" per giri consecutivi identici (es. "round": "8-10").
Includi SEMPRE stitch_count per ogni giro.
Verifica mentalmente i conti prima di rispondere.`

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

        const { prompt } = await req.json() as { prompt: string }
        if (!prompt?.trim()) return NextResponse.json({ success: false, error: 'Prompt mancante' }, { status: 400 })

        // Carica le ultime correzioni umane dal DB come few-shot examples
        // Così GPT-4o impara subito dai tuoi feedback senza aspettare il fine-tuning
        const { data: recentFeedback } = await supabase
            .from('model_feedback')
            .select('prompt, model_response, corrected_response')
            .eq('is_correct', false)
            .not('corrected_response', 'is', null)
            .order('created_at', { ascending: false })
            .limit(5)

        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

        // Costruisce i messaggi: system + few-shot da feedback + prompt utente
        type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string }
        const messages: ChatMessage[] = [
            { role: 'system', content: SYSTEM_PROMPT },
        ]

        // Aggiunge le correzioni recenti come esempi few-shot
        if (recentFeedback && recentFeedback.length > 0) {
            for (const fb of recentFeedback.slice().reverse()) { // dal più vecchio al più recente
                if (fb.prompt && fb.corrected_response) {
                    messages.push({ role: 'user', content: fb.prompt })
                    messages.push({ role: 'assistant', content: JSON.stringify(fb.corrected_response) })
                }
            }
        }

        messages.push({ role: 'user', content: prompt })

        const completion = await openai.chat.completions.create({
            model: 'gpt-4o',
            max_tokens: 2000,
            temperature: 0.3,
            messages,
        })

        const raw = completion.choices[0]?.message?.content?.trim() ?? ''
        const jsonMatch = raw.match(/\[[\s\S]*\]/)
        const parts = JSON.parse(jsonMatch?.[0] ?? raw)

        if (!Array.isArray(parts)) {
            return NextResponse.json({ success: false, error: 'Il modello non ha restituito un array valido' }, { status: 500 })
        }

        return NextResponse.json({ success: true, parts, raw })
    } catch (error: any) {
        console.error('[generate-schema]', error)
        return NextResponse.json({ success: false, error: error.message || 'Errore generazione schema.' }, { status: 500 })
    }
}
