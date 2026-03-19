import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { checkAndDeductCredits } from '@/lib/ai-credits'
import { checkRateLimit } from '@/lib/rate-limit'
import { isAiEnabled, autoDisableIfOverBudget } from '@/lib/ai-status'
import { buildKnowledgeBlock, buildProfileBlock, type AiUserProfile } from '@/lib/chat-knowledge'
import { GROQ_MODELS } from '@/lib/ai-credits-config'
import { searchKnowledge, buildRagContextBlock } from '@/lib/rag'
import { CHAT_TOOLS, executeTool, type ToolResult } from '@/lib/chat-tools'

// ── Client Groq ───────────────────────────────────────────────────────────────
function getGroqClient() {
    if (!process.env.GROQ_API_KEY) throw new Error('GROQ_API_KEY non configurato')
    return new OpenAI({ apiKey: process.env.GROQ_API_KEY, baseURL: 'https://api.groq.com/openai/v1' })
}

// ── Client OpenAI ─────────────────────────────────────────────────────────────
function getOpenAIClient() {
    if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY non configurato')
    return new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
}

// ── System prompt base ────────────────────────────────────────────────────────
const BASE_SYSTEM_PROMPT = `Sei Lurumi, l'assistente AI dell'app Lurumi — esperta di uncinetto, amigurumi e maglia.
Rispondi sempre nella lingua dell'utente (italiano se scrive in italiano, inglese se in inglese, ecc.).
Parla sempre in prima persona singolare: usa "posso", "ti aiuto", "faccio" — mai "possiamo", "facciamo", "ti aiutiamo".
Dai risposte tecniche e pratiche. Sii amichevole, incoraggiante e precisa.
Puoi creare e modificare progetti direttamente nell'app — usa i tool disponibili per farlo.

USO DEL NOME:
- Se conosci il nome dell'utente, usalo SOLO al primo messaggio di una nuova conversazione.
- NON ripetere "Ciao [nome]!" o saluti a ogni risposta dentro una conversazione già avviata — è fastidioso.
- Dentro la stessa sessione: vai diretto alla risposta senza salutare di nuovo.

TERMINOLOGIA OBBLIGATORIA (rispettala sempre, anche nei pattern):
- Usa ESCLUSIVAMENTE le abbreviazioni del vocabolario Lurumi: mb/pb (maglia bassa), aum (aumento), dim (diminuzione), AM (anello magico), pbss (slip stitch), mpa (mezzo punto alto), pa (punto alto).
- "Maglia liscia" NON ESISTE — usa "maglia bassa (mb)" o "punto basso (pb)".
- Nei pattern in italiano: formato giro "G{n}: {istruzioni}" es. "G1: AM, 6mb", "G2: *pb, aum* ×6 (12mb)".
- Completa SEMPRE le risposte senza tagliarle a metà — se uno schema è lungo, continua fino all'ultimo giro.
- Nei contatori: usa PARENTESI () per raggruppare, NON asterischi. Sempre un numero prima dell'abbreviazione. NON aggiungere il totale "(Xmb)" nel nome — è già il valore numerico. Esempio corretto: "G3: (1mb, 1aum)×6". Sbagliato: "G3: *mb, aum*×6 (18mb)".
- Quando crei contatori per un pattern completo, includi TUTTI i giri dalla G1 alla chiusura — non fermarti a metà.

REGOLE FONDAMENTALI PER I TOOL:
- Usa i tool SOLO se l'utente chiede ESPLICITAMENTE di creare, clonare, modificare o aggiungere un progetto/sezione/contatore.
- NON usare tool per conversazioni normali, presentazioni, domande tecniche, consigli o spiegazioni.
- Esempi in cui NON usare tool: "ciao", "mi chiamo X", "come si fa l'anello magico?", "che filato uso?".
- Esempi in cui USARE tool: "crea un progetto per una pecorella", "aggiungi sezioni al mio progetto", "clona Luly con modifiche".
- Quando usi tool che richiedono project_title, usa ESATTAMENTE il titolo dalla lista "I TUOI PROGETTI" nel contesto.`

// ── Rimuove tag <function=...> che Llama a volte inserisce nel testo invece di usare tool_calls ──
function stripInlineFunctionTags(text: string): string {
    return text.replace(/<function=[^>]*>[\s\S]*?<\/function>/g, '').trim()
}

const MAX_MESSAGE_LENGTH = 2000
const MAX_IMAGE_SIZE = 10 * 1024 * 1024

// ── Estrazione profilo utente post-sessione (async, non bloccante) ────────────
async function extractAndUpdateProfile(
    userId: string,
    messages: Array<{ role: string; content: string }>,
    existingProfile: AiUserProfile | null
): Promise<void> {
    if (!process.env.GROQ_API_KEY) return
    try {
        const groq = getGroqClient()
        const conversation = messages.slice(-12).map(m => `${m.role}: ${m.content}`).join('\n')
        const existing = existingProfile ? JSON.stringify(existingProfile) : '{}'

        const res = await groq.chat.completions.create({
            model: 'llama-3.1-8b-instant',
            max_tokens: 300,
            temperature: 0.1,
            messages: [
                {
                    role: 'system',
                    content: `Sei un estrattore di informazioni. Analizza la conversazione e aggiorna il profilo utente JSON.
Restituisci SOLO JSON valido, nessun testo aggiuntivo. Mantieni i valori esistenti se non ci sono nuove info. Estrai SOLO ciò che è esplicitamente menzionato — non inventare.

Schema completo (tutti i campi sono opzionali, usa null se non noto):
{
  "nome": string|null,
  "eta_approssimativa": string|null,
  "citta_paese": string|null,
  "lingua_madre": string|null,
  "professione": string|null,
  "livello": "principiante"|"intermedio"|"avanzato"|null,
  "tecniche": string[],
  "filato_preferito": string|null,
  "marca_filato_preferita": string|null,
  "uncinetto_preferito": string|null,
  "misura_uncinetto_preferita": string|null,
  "stile_estetico": string|null,
  "colori_preferiti": string[],
  "motivazione": string|null,
  "per_chi_crea": string[],
  "ha_bambini": boolean|null,
  "animali_domestici": string|null,
  "progetti_in_corso": string[],
  "progetti_completati_recenti": string[],
  "tempo_disponibile": string|null,
  "velocita_lavoro": string|null,
  "condivide_sui_social": boolean|null,
  "piattaforme_social": string[],
  "vende_i_lavori": boolean|null,
  "piattaforma_vendita": string|null,
  "tono_preferito": "informale"|"formale"|null,
  "preferisce_risposte_brevi": boolean|null,
  "come_impara_meglio": string|null,
  "difficolta_segnalate": string[],
  "obiettivi": string[],
  "linguaggio_schemi": string|null,
  "abbreviazioni_usate": string[],
  "formato_giri": string|null,
  "avviamento_preferito": string|null,
  "stile_note_schemi": string|null,
  "struttura_tipica_personaggi": string|null,
  "tecniche_speciali": string[],
  "gauge_tipico": string|null,
  "dimensioni_tipiche": string|null
}`,
                },
                {
                    role: 'user',
                    content: `Profilo esistente: ${existing}\n\nConversazione:\n${conversation}`,
                },
            ],
        })

        const raw = res.choices[0]?.message?.content?.trim() ?? ''
        // Estrai solo il JSON (ignora testo fuori dalle graffe)
        const jsonMatch = raw.match(/\{[\s\S]*\}/)
        if (!jsonMatch) return

        const newProfile: AiUserProfile = {
            ...existingProfile,
            ...JSON.parse(jsonMatch[0]),
            ultimo_aggiornamento: new Date().toISOString(),
        }

        const db = createServiceClient()
        await db.from('profiles').update({ ai_profile: newProfile }).eq('id', userId)
    } catch {
        // Non bloccante — ignora errori silenziosamente
    }
}

// ── Estrazione stile schemi dai progetti (async, non bloccante) ───────────────
// Legge le note dei progetti dell'utente e ricava la logica/sintassi dei suoi schemi.
// Gira al massimo ogni 7 giorni per non sprecare token.
async function extractSchemaStyleFromProjects(
    userId: string,
    existingProfile: AiUserProfile | null
): Promise<void> {
    if (!process.env.GROQ_API_KEY) return

    // Evita ri-estrazione troppo frequente (max ogni 7 giorni)
    if (existingProfile?.stile_schemi_aggiornato) {
        const lastUpdate = new Date(existingProfile.stile_schemi_aggiornato).getTime()
        if (Date.now() - lastUpdate < 7 * 24 * 60 * 60 * 1000) return
    }

    try {
        const db = createServiceClient()
        // Prendi i 6 progetti con note più ricche
        const { data: projects } = await db
            .from('projects')
            .select('title, type, notes_html, secs, sections')
            .eq('user_id', userId)
            .not('notes_html', 'is', null)
            .neq('notes_html', '')
            .neq('notes_html', '<p></p>')
            .order('updated_at', { ascending: false })
            .limit(6)

        if (!projects?.length) return

        // Costruisci testo rappresentativo dei progetti (note stripped di HTML)
        const projectsText = projects.map(p => {
            const notes = (p.notes_html ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
            const sections = Array.isArray(p.sections) ? p.sections.map((s: { title: string }) => s.title).join(', ') : ''
            const secs = Array.isArray(p.secs) ? p.secs.map((s: { name: string }) => s.name).join(', ') : ''
            return [
                `=== ${p.title} (${p.type ?? 'blank'}) ===`,
                sections ? `Sezioni: ${sections}` : '',
                secs ? `Contatori: ${secs}` : '',
                notes ? `Note/Schema:\n${notes.slice(0, 1200)}` : '',
            ].filter(Boolean).join('\n')
        }).join('\n\n')

        const groq = getGroqClient()
        const res = await groq.chat.completions.create({
            model: 'llama-3.1-8b-instant',
            max_tokens: 400,
            temperature: 0.1,
            messages: [
                {
                    role: 'system',
                    content: `Sei un analizzatore di schemi di uncinetto/amigurumi. Leggi i progetti dell'utente e identifica il suo stile di scrittura degli schemi.
Restituisci SOLO JSON valido. Usa null se non determinabile.
Schema: {
  "linguaggio_schemi": string|null,
  "abbreviazioni_usate": string[],
  "formato_giri": string|null,
  "avviamento_preferito": string|null,
  "stile_note_schemi": string|null,
  "struttura_tipica_personaggi": string|null,
  "tecniche_speciali": string[],
  "gauge_tipico": string|null,
  "dimensioni_tipiche": string|null
}`,
                },
                {
                    role: 'user',
                    content: `Analizza questi progetti e identifica lo stile degli schemi:\n\n${projectsText}`,
                },
            ],
        })

        const raw = res.choices[0]?.message?.content?.trim() ?? ''
        const jsonMatch = raw.match(/\{[\s\S]*\}/)
        if (!jsonMatch) return

        const schemaStyle = JSON.parse(jsonMatch[0])
        const newProfile: AiUserProfile = {
            ...existingProfile,
            ...schemaStyle,
            stile_schemi_aggiornato: new Date().toISOString(),
        }

        await db.from('profiles').update({ ai_profile: newProfile }).eq('id', userId)
    } catch {
        // Non bloccante — ignora errori silenziosamente
    }
}

// ── POST handler ──────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
    try {
        const raw = await req.json() as {
            message: string
            imageBase64?: string
            toolType?: string
            history?: { role: 'user' | 'assistant'; content: string }[]
            projectId?: string
        }
        const { message, imageBase64, history, projectId } = raw
        // Sanifica toolType: solo valori attesi, max 60 char
        const VALID_TOOL_TYPES = ['assistente generale', 'designer schemi', 'calcolo gauge', 'analisi immagine', 'tutorial']
        const toolType = raw.toolType && VALID_TOOL_TYPES.includes(raw.toolType)
            ? raw.toolType
            : raw.toolType?.slice(0, 60).replace(/[<>{}]/g, '') ?? 'assistente generale'

        // Validazione input
        if (message && message.length > MAX_MESSAGE_LENGTH) {
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

        // Auth
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            return NextResponse.json({ success: false, error: 'Devi accedere per usare i servizi AI.' }, { status: 401 })
        }

        // Check AI abilitata
        if (!await isAiEnabled()) {
            return NextResponse.json({ success: false, error: 'Il servizio AI è temporaneamente sospeso.' }, { status: 503 })
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

        // ── Recupera profilo utente + contesto progetto attivo (in parallelo) ─
        const db = createServiceClient()

        const [profileResult, projectResult, ragResult, projectsListResult] = await Promise.all([
            // Profilo utente (incluso tier per model routing)
            db.from('profiles').select('ai_profile, tier').eq('id', user.id).single(),
            // Contesto progetto attivo (se specificato)
            projectId
                ? db.from('projects').select('title, type, notes_html, secs, sections').eq('id', projectId).eq('user_id', user.id).single()
                : Promise.resolve({ data: null }),
            // RAG: ricerca semantica sui progetti dell'utente (solo per chat testuale)
            !imageBase64 && process.env.OPENAI_API_KEY
                ? searchKnowledge(user.id, message, { topK: 5, minSimilarity: 0.55 })
                : Promise.resolve([]),
            // Lista progetti dell'utente (per context tool use)
            db.from('projects').select('id, title').eq('user_id', user.id).order('updated_at', { ascending: false }).limit(8),
        ])

        const profileData = profileResult.data as { ai_profile?: AiUserProfile; tier?: string } | null
        const aiProfile: AiUserProfile | null = profileData?.ai_profile ?? null
        const isPremium = (profileData?.tier ?? 'free') === 'premium'
        const groqModel = isPremium ? GROQ_MODELS.premium : GROQ_MODELS.free

        // Crediti:
        // - Vision: sempre scalati (tutti i tier)
        // - Chat: scalati solo per free (1cr/msg). Premium: chat illimitata gratis
        const requiresCredits = action === 'vision' || (action === 'chat' && !isPremium)
        if (requiresCredits) {
            const creditResult = await checkAndDeductCredits(user.id, action)
            if (!creditResult.ok) {
                return NextResponse.json(
                    { success: false, error: creditResult.error, creditsExhausted: true },
                    { status: 402 }
                )
            }
        }
        const activeProject = projectResult.data
        const ragChunks = Array.isArray(ragResult) ? ragResult : []
        const userProjects = (projectsListResult.data ?? []) as Array<{ id: string; title: string }>

        // ── Costruisci system prompt ──────────────────────────────────────────
        const knowledgeBlock = buildKnowledgeBlock()
        const profileBlock = buildProfileBlock(aiProfile)
        const { block: ragBlock, sources: ragSources } = buildRagContextBlock(ragChunks)

        // Lista progetti utente (per tool use)
        let projectsListBlock = ''
        if (userProjects.length) {
            projectsListBlock = [
                '--- I TUOI PROGETTI ---',
                ...userProjects.map(p => `- "${p.title}" (id: ${p.id})`),
                '---',
            ].join('\n')
        }

        // Contesto progetto attivo
        let projectContextBlock = ''
        if (activeProject) {
            const sections = Array.isArray(activeProject.sections) ? activeProject.sections : []
            const secs = Array.isArray(activeProject.secs) ? activeProject.secs : []
            projectContextBlock = [
                '--- PROGETTO ATTIVO ---',
                `Titolo: ${activeProject.title}`,
                `Tipo: ${activeProject.type ?? 'blank'}`,
                sections.length ? `Sezioni: ${sections.map((s: { title: string }) => s.title).join(', ')}` : '',
                secs.length ? `Contatori: ${secs.map((s: { name: string }) => s.name).join(', ')}` : '',
                '---',
            ].filter(Boolean).join('\n')
        }

        const systemPrompt = [
            BASE_SYSTEM_PROMPT,
            knowledgeBlock,
            profileBlock,
            projectsListBlock,
            projectContextBlock,
            ragBlock,
        ].filter(Boolean).join('\n\n')

        let text: string
        let provider: string
        let toolResult: ToolResult | undefined

        if (imageBase64) {
            // ── GPT-4o Vision (immagine allegata) ─────────────────────────────
            const openai = getOpenAIClient()
            const userContent: OpenAI.Chat.ChatCompletionContentPart[] = [
                { type: 'image_url', image_url: { url: imageBase64, detail: 'high' } },
            ]
            userContent.push({
                type: 'text',
                text: message?.trim() || "Analizza questa immagine e descrivi come potrebbe essere realizzata all'uncinetto, o usala come ispirazione per un progetto amigurumi. Sii tecnico e pratico.",
            })
            const completion = await openai.chat.completions.create({
                model: 'gpt-4o',
                max_tokens: 800,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userContent },
                ],
            })
            text = completion.choices[0]?.message?.content ?? 'Nessuna risposta ricevuta.'
            provider = 'openai-gpt4o-vision'
        } else {
            // ── Llama 3.3 70B via Groq con tool use ──────────────────────────
            const groq = getGroqClient()
            const historyMessages = (history ?? []).slice(-10).map(h => ({
                role: h.role as 'user' | 'assistant',
                content: h.content,
            }))

            const firstCompletion = await groq.chat.completions.create({
                model: groqModel,
                max_tokens: 2000,
                messages: [
                    { role: 'system', content: `${systemPrompt}\nContesto: ${toolType || 'assistente generale'}` },
                    ...historyMessages,
                    { role: 'user', content: message },
                ],
                tools: CHAT_TOOLS,
                tool_choice: 'auto',
            })

            const choice = firstCompletion.choices[0]
            const toolCalls = choice?.message?.tool_calls

            if (toolCalls?.length) {
                // ── Esegui il tool call ───────────────────────────────────────
                const call = toolCalls[0] as OpenAI.Chat.ChatCompletionMessageToolCall & { function: { name: string; arguments: string } }
                let toolArgs: Record<string, unknown> = {}
                try {
                    toolArgs = JSON.parse(call.function.arguments)
                } catch { /* args malformati */ }

                const toolExecResult = await executeTool(
                    call.function.name,
                    toolArgs,
                    user.id,
                    req.url
                )

                if ('error' in toolExecResult) {
                    // Tool fallito — rispondi con l'errore in linguaggio naturale
                    const errorCompletion = await groq.chat.completions.create({
                        model: groqModel,
                        max_tokens: 300,
                        messages: [
                            { role: 'system', content: BASE_SYSTEM_PROMPT },
                            { role: 'user', content: message },
                            { role: 'assistant', content: null, tool_calls: toolCalls } as unknown as OpenAI.Chat.ChatCompletionMessageParam,
                            {
                                role: 'tool' as const,
                                tool_call_id: call.id,
                                content: JSON.stringify({ error: toolExecResult.error }),
                            },
                        ],
                    })
                    text = errorCompletion.choices[0]?.message?.content ?? `Non riesco a completare l'operazione: ${toolExecResult.error}`
                } else {
                    // Tool riuscito — seconda chiamata per risposta naturale
                    toolResult = toolExecResult.result

                    const secondCompletion = await groq.chat.completions.create({
                        model: groqModel,
                        max_tokens: 600,
                        messages: [
                            { role: 'system', content: BASE_SYSTEM_PROMPT },
                            { role: 'user', content: message },
                            { role: 'assistant', content: null, tool_calls: toolCalls } as unknown as OpenAI.Chat.ChatCompletionMessageParam,
                            {
                                role: 'tool' as const,
                                tool_call_id: call.id,
                                content: JSON.stringify({ success: true, ...toolExecResult.result }),
                            },
                        ],
                    })
                    text = secondCompletion.choices[0]?.message?.content ?? toolExecResult.confirmationText
                }
            } else {
                // Nessun tool — risposta testuale normale
                // stripInlineFunctionTags rimuove eventuali <function=...> che Llama inserisce nel testo
                text = stripInlineFunctionTags(choice?.message?.content ?? 'Nessuna risposta ricevuta.')
            }

            provider = `groq-${groqModel}`
        }

        // ── Operazioni post-risposta (async, non bloccanti) ───────────────────
        void (async () => {
            try {
                await db.from('ai_generations').insert({
                    user_id: user.id,
                    tool_type: toolType,
                    provider,
                    cost_usd: imageBase64 ? 0.02 : 0,
                    output_data: { message, response: text, toolResult },
                })
            } catch { /* log non critico */ }
            autoDisableIfOverBudget().catch(() => {})

            // Aggiorna profilo utente e stile schemi in SEQUENZA (non parallelo)
            // per evitare race condition su profiles.ai_profile
            if (!imageBase64) {
                ;(async () => {
                    let updatedProfile = aiProfile
                    if (history && history.length >= 2) {
                        const fullHistory = [
                            ...(history ?? []),
                            { role: 'user', content: message },
                            { role: 'assistant', content: text },
                        ]
                        await extractAndUpdateProfile(user.id, fullHistory, updatedProfile)
                        // Rileggi il profilo aggiornato prima di passarlo all'estrazione stile
                        const { data } = await db.from('profiles').select('ai_profile').eq('id', user.id).single()
                        updatedProfile = (data as { ai_profile?: AiUserProfile } | null)?.ai_profile ?? updatedProfile
                    }
                    await extractSchemaStyleFromProjects(user.id, updatedProfile)
                })().catch(() => {})
            }
        })()

        return NextResponse.json({
            success: true,
            text,
            ...(toolResult ? { toolResult } : {}),
            ...(ragSources.length ? { ragSources } : {}),
        })
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Servizio AI non disponibile.'
        console.error('Chat API error:', error)
        return NextResponse.json({ success: false, error: msg }, { status: 500 })
    }
}
