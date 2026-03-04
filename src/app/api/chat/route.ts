import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'
import { checkAndDeductCredits } from '@/lib/ai-credits'
import { checkRateLimit } from '@/lib/rate-limit'
import { isAiEnabled, autoDisableIfOverBudget } from '@/lib/ai-status'

// ── Client Groq (chat testuale — gratuito) ────────────────────────────────────
function getGroqClient() {
    if (!process.env.GROQ_API_KEY) {
        throw new Error('GROQ_API_KEY non configurato nel file .env.local')
    }
    return new OpenAI({
        apiKey: process.env.GROQ_API_KEY,
        baseURL: 'https://api.groq.com/openai/v1',
    })
}

// ── Client OpenAI (vision con immagini — a pagamento) ─────────────────────────
function getOpenAIClient() {
    if (!process.env.OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY non configurato nel file .env.local')
    }
    return new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
}

const SYSTEM_PROMPT = `Sei Lurumi, un assistente esperto e appassionato di uncinetto, amigurumi e maglia.
Rispondi sempre nella lingua dell'utente (italiano se scrive in italiano, inglese se in inglese, ecc.).
Dai risposte tecniche e pratiche: abbreviazioni dei punti, schemi, materiali, misure degli uncinetti, consigli su filati.
Sii amichevole, incoraggiante e preciso.`

const MAX_MESSAGE_LENGTH = 2000
const MAX_IMAGE_SIZE = 10 * 1024 * 1024 // 10 MB in caratteri base64

export async function POST(req: NextRequest) {
    try {
        const { message, imageBase64, toolType } = await req.json()

        // Validazione input
        if (message && typeof message === 'string' && message.length > MAX_MESSAGE_LENGTH) {
            return NextResponse.json(
                { success: false, error: `Il messaggio non può superare ${MAX_MESSAGE_LENGTH} caratteri.` },
                { status: 400 }
            )
        }
        if (imageBase64 !== undefined && imageBase64 !== null) {
            if (typeof imageBase64 !== 'string') {
                return NextResponse.json({ success: false, error: 'Formato immagine non valido.' }, { status: 400 })
            }
            if (imageBase64.length > MAX_IMAGE_SIZE) {
                return NextResponse.json({ success: false, error: 'Immagine troppo grande (max 7 MB).' }, { status: 400 })
            }
            const validPrefix = imageBase64.startsWith('data:image/jpeg;base64,')
                || imageBase64.startsWith('data:image/png;base64,')
                || imageBase64.startsWith('data:image/webp;base64,')
                || imageBase64.startsWith('data:image/gif;base64,')
                || imageBase64.startsWith('data:image/heic;base64,')
            if (!validPrefix) {
                return NextResponse.json({ success: false, error: 'Formato immagine non supportato.' }, { status: 400 })
            }
        }

        // Auth check — obbligatorio
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json(
                { success: false, error: 'Devi accedere per usare i servizi AI.' },
                { status: 401 }
            )
        }

        // Check AI abilitata
        if (!await isAiEnabled()) {
            return NextResponse.json(
                { success: false, error: 'Il servizio AI è temporaneamente sospeso. Riprova più tardi.' },
                { status: 503 }
            )
        }

        const action = imageBase64 ? 'vision' : 'chat'

        // Rate limiting
        const rateResult = checkRateLimit(user.id, action)
        if (!rateResult.ok) {
            return NextResponse.json(
                { success: false, error: `Troppe richieste. Riprova tra ${rateResult.retryAfterSec} secondi.` },
                { status: 429, headers: { 'Retry-After': String(rateResult.retryAfterSec) } }
            )
        }

        // Crediti: solo per vision (chat è gratuita via Groq)
        if (action === 'vision') {
            const creditResult = await checkAndDeductCredits(user.id, action)
            if (!creditResult.ok) {
                return NextResponse.json(
                    { success: false, error: creditResult.error, creditsExhausted: true },
                    { status: 402 }
                )
            }
        }

        let text: string
        let provider: string

        if (imageBase64) {
            // ── GPT-4o Vision per analisi immagini (OpenAI, a pagamento) ────────
            const openai = getOpenAIClient()
            const userContent: OpenAI.Chat.ChatCompletionContentPart[] = [
                {
                    type: 'image_url',
                    image_url: { url: imageBase64, detail: 'high' },
                },
            ]
            if (message?.trim()) {
                userContent.push({ type: 'text', text: message })
            } else {
                userContent.push({
                    type: 'text',
                    text: "Analizza questa immagine e descrivi come potrebbe essere realizzata all'uncinetto, o usala come ispirazione per un progetto amigurumi. Sii tecnico e pratico.",
                })
            }
            const completion = await openai.chat.completions.create({
                model: 'gpt-4o',
                max_tokens: 800,
                messages: [
                    { role: 'system', content: SYSTEM_PROMPT },
                    { role: 'user', content: userContent },
                ],
            })
            text = completion.choices[0]?.message?.content ?? 'Nessuna risposta ricevuta.'
            provider = 'openai-gpt4o-vision'
        } else {
            // ── Llama 3.3 70B via Groq per chat testuale (gratuito) ─────────────
            const groq = getGroqClient()
            const completion = await groq.chat.completions.create({
                model: 'llama-3.3-70b-versatile',
                max_tokens: 600,
                messages: [
                    { role: 'system', content: `${SYSTEM_PROMPT}\nContesto attuale: ${toolType || 'assistente generale'}` },
                    { role: 'user', content: message },
                ],
            })
            text = completion.choices[0]?.message?.content ?? 'Nessuna risposta ricevuta.'
            provider = 'groq-llama-3.3-70b'
        }

        // Log + auto-disable check — non bloccanti
        void (async () => {
            try {
                await supabase.from('ai_generations').insert({
                    user_id: user.id,
                    tool_type: toolType,
                    provider,
                    cost_usd: imageBase64 ? 0.02 : 0,
                    output_data: { message, response: text },
                })
            } catch {}
            autoDisableIfOverBudget().catch(() => {})
        })()

        return NextResponse.json({ success: true, text })
    } catch (error: any) {
        console.error('Chat API error:', error)
        return NextResponse.json(
            { success: false, error: error.message || 'Servizio AI non disponibile.' },
            { status: 500 }
        )
    }
}
