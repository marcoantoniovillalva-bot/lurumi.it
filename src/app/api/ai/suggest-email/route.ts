import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'
import { isAiEnabled } from '@/lib/ai-status'

function getGroqClient() {
    if (!process.env.GROQ_API_KEY) throw new Error('GROQ_API_KEY non configurato')
    return new OpenAI({ apiKey: process.env.GROQ_API_KEY, baseURL: 'https://api.groq.com/openai/v1' })
}

/* ── AIDA mapping: step position → phase ── */
function aidaPhase(stepNumber: number, totalSteps: number): string {
    if (totalSteps <= 1) return 'Azione — invita direttamente a compiere un\'azione concreta.'
    const ratio = (stepNumber - 1) / Math.max(totalSteps - 1, 1)
    if (ratio === 0) return 'Consapevolezza — introduci il tema, incuriosisci, fai sentire che qualcosa di bello esiste.'
    if (ratio <= 0.3) return 'Interesse — approfondisci i benefici, racconta la storia, aggancia l\'emozione.'
    if (ratio <= 0.6) return 'Desiderio — crea urgenza, testimonial, FOMO gentile, visualizza la trasformazione.'
    if (ratio <= 0.85) return 'Azione — invita a compiere un\'azione concreta (prenota, acquista, guarda, apri).'
    return 'Fidelizzazione — ringrazia, celebra il risultato, invita a condividere, proponi il passo successivo.'
}

const TRIGGER_PROMPTS: Record<string, string> = {
    first_login: 'L\'utente si è appena registrato per la prima volta.',
    event_booked: 'L\'utente ha appena prenotato il suo primo corso di uncinetto/amigurumi.',
    premium_purchased: 'L\'utente ha appena sottoscritto il piano Premium.',
    inactive_14d: 'L\'utente non usa l\'app da 14 giorni.',
    never_booked_7d: 'L\'utente è registrato da più di 7 giorni ma non ha mai prenotato un corso.',
    bug_reported: 'L\'utente ha appena segnalato un problema nell\'app.',
    manual_youtube: 'Erika ha pubblicato un nuovo tutorial YouTube.',
    manual_update: 'È stato rilasciato un aggiornamento importante dell\'app Lurumi.',
    new_event: 'È stato pubblicato un nuovo corso/evento su Lurumi.',
    new_library_item: 'È stato aggiunto un nuovo schema o libro alla libreria di Lurumi.',
}

export async function POST(req: NextRequest) {
    try {
        const {
            triggerType, stepNumber = 1, delayDays = 0, sequenceName,
            context, totalSteps = 1,
            linkedEntityTitle, linkedEntityDescription, linkedYoutubeUrl,
            forcedPhase,
        } = await req.json() as {
            triggerType: string
            stepNumber?: number
            delayDays?: number
            sequenceName?: string
            context?: string
            totalSteps?: number
            linkedEntityTitle?: string
            linkedEntityDescription?: string
            linkedYoutubeUrl?: string
            forcedPhase?: string
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
        const triggerBase = TRIGGER_PROMPTS[triggerType] ?? `Trigger: ${triggerType}.`

        const FORCED_PHASES: Record<string, string> = {
            awareness: 'Consapevolezza — introduci il tema, incuriosisci, fai sentire che qualcosa di bello esiste.',
            interest: 'Interesse — approfondisci i benefici, racconta la storia, aggancia l\'emozione.',
            desire: 'Desiderio — crea urgenza, usa storytelling, FOMO gentile, visualizza la trasformazione.',
            action: 'Azione — invita a compiere un\'azione concreta (prenota, acquista, guarda, apri).',
            retention: 'Fidelizzazione — ringrazia, celebra il risultato, invita a condividere, proponi il passo successivo.',
        }
        const phase = forcedPhase && FORCED_PHASES[forcedPhase]
            ? FORCED_PHASES[forcedPhase]
            : aidaPhase(stepNumber, totalSteps)
        const delayDesc = delayDays === 0 ? 'da inviare immediatamente (giorno 0)' : `da inviare dopo ${delayDays} giorn${delayDays === 1 ? 'o' : 'i'}`

        // Build entity context block
        let entityBlock = ''
        if (linkedEntityTitle) {
            entityBlock += `\nContenuto specifico: "${linkedEntityTitle}"`
            if (linkedEntityDescription) entityBlock += `\nDescrizione: ${linkedEntityDescription}`
        }
        if (linkedYoutubeUrl) entityBlock += `\nLink YouTube: ${linkedYoutubeUrl}`

        const systemPrompt = `Sei un copywriter esperto di email marketing per Lurumi, app italiana di uncinetto e amigurumi guidata da Erika.
Scrivi email in italiano usando la psicologia persuasiva (Maslow: appartenenza, stima, realizzazione).
Usa emoji appropriate per rendere il testo vivace.
Merge tag disponibili: {{nome}} (nome utente), {{cara}} (caro/cara), {{benvenut}} (benvenuto/a).
Il corpo deve essere HTML con stile inline minimo (<p>, <strong>, <br>). NON usare classi CSS.
Oggetto: max 50 caratteri, accattivante, con emoji.
Rispondi SOLO in JSON: { "subject": "...", "bodyHtml": "..." }`

        const userMsg = `Scenario: ${triggerBase}${entityBlock}
Sequenza: ${sequenceName ? `"${sequenceName}"` : 'senza nome'} · ${totalSteps} email totali
Step: ${stepNumber} di ${totalSteps} · ${delayDesc}
Fase AIDA da applicare: ${phase}
${context ? `Contesto extra: ${context}` : ''}

Scrivi l'email per questo preciso step, rispettando la fase AIDA indicata.`

        const completion = await groq.chat.completions.create({
            model: 'llama-3.3-70b-versatile',
            max_tokens: 700,
            temperature: 0.8,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userMsg },
            ],
        })

        const raw = completion.choices[0]?.message?.content?.trim() ?? ''
        let parsed: { subject: string; bodyHtml: string }
        try {
            const jsonMatch = raw.match(/\{[\s\S]*\}/)
            parsed = JSON.parse(jsonMatch?.[0] ?? raw)
        } catch {
            parsed = {
                subject: `✨ Email automatica — Step ${stepNumber}`,
                bodyHtml: `<p>${raw}</p>`,
            }
        }

        return NextResponse.json({ success: true, subject: parsed.subject, bodyHtml: parsed.bodyHtml })
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message || 'Errore AI.' }, { status: 500 })
    }
}
