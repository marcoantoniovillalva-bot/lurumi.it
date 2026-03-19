/**
 * chat-tools.ts — Definizioni e esecutori dei tool use del chatbot Lurumi.
 * Usato da /api/chat/route.ts con Groq function calling.
 */

import type OpenAI from 'openai'
import { createServiceClient } from './supabase/server'
import { vectorizeProject } from './rag'

// ── Tipi ─────────────────────────────────────────────────────────────────────

export interface ToolResult {
    type:
    | 'project_created'
    | 'project_cloned'
    | 'sections_added'
    | 'counters_added'
    | 'youtube_updated'
    | 'notes_updated'
    | 'project_from_youtube'
    | 'profile_cleared'
    projectId: string
    projectTitle: string
    summary?: string
}

// ── Definizioni tool (formato OpenAI function calling) ────────────────────────

export const CHAT_TOOLS: OpenAI.Chat.ChatCompletionTool[] = [
    {
        type: 'function',
        function: {
            name: 'create_project',
            description: 'Crea un nuovo progetto amigurumi nella sezione Progetti dell\'utente. Usalo quando l\'utente chiede di creare, iniziare o strutturare un nuovo progetto.',
            parameters: {
                type: 'object',
                properties: {
                    title: { type: 'string', description: 'Nome del progetto (es. "Pecorella Bianca")' },
                    type: { type: 'string', enum: ['blank', 'tutorial'], description: '"blank" per schema generico, "tutorial" se c\'è un video YouTube' },
                    notes_html: { type: 'string', description: 'Note iniziali in testo semplice (no HTML necessario)' },
                    sections: {
                        type: 'array',
                        description: 'Sezioni del progetto (es. Testa, Corpo, Gambe)',
                        items: {
                            type: 'object',
                            properties: {
                                title: { type: 'string' },
                                description: { type: 'string' },
                            },
                            required: ['title'],
                        },
                    },
                    counters: {
                        type: 'array',
                        description: 'Contatori secondari. SINTASSI OBBLIGATORIA: usa parentesi () non asterischi, scrivi il numero prima di ogni abbreviazione, NON includere il totale nel nome (è già initial_value). Esempi corretti: "G1: AM, 6mb", "G2: (1aum)×6", "G3: (1mb, 1aum)×6", "G4: (2mb, 1aum)×6", "G7: 30mb" (giro dritto). ERRORI da evitare: "G2: *pb, aum*×6 (12mb)" — sbagliato perché usa asterischi e ha il totale nel nome.',
                        items: {
                            type: 'object',
                            properties: {
                                name: { type: 'string', description: 'Nome con sintassi corretta. Giro aumenti: "G{n}: ({K}mb, 1aum)×6". Solo aumenti: "G2: (1aum)×6". Giro dritto: "G{n}: {tot}mb". G1: "G1: AM, 6mb". Parte anatomica: "Testa", "Zampa DX". NON mettere mai "(Xmb)" alla fine del nome.' },
                                section_title: { type: 'string', description: 'Titolo sezione di appartenenza (opzionale)' },
                                initial_value: { type: 'number', description: 'Totale maglie del giro. G1=6, G2=12, G3=18, G4=24, G5=30, G6=36. Giro dritto: stesso totale del giro precedente. Parte anatomica: 0.' },
                            },
                            required: ['name'],
                        },
                    },
                },
                required: ['title'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'clone_project',
            description: 'Clona un progetto esistente dell\'utente con eventuali modifiche. Usalo quando l\'utente chiede di duplicare, clonare o creare una versione modificata di un suo progetto.',
            parameters: {
                type: 'object',
                properties: {
                    source_title: { type: 'string', description: 'Titolo esatto o approssimativo del progetto da clonare' },
                    new_title: { type: 'string', description: 'Nome del nuovo progetto clonato' },
                    modification_notes: { type: 'string', description: 'Descrizione delle modifiche da applicare (aggiunta alle note)' },
                },
                required: ['source_title', 'new_title'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'add_sections_to_project',
            description: 'Aggiunge sezioni a un progetto esistente dell\'utente.',
            parameters: {
                type: 'object',
                properties: {
                    project_title: { type: 'string', description: 'Titolo del progetto da modificare' },
                    sections: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                title: { type: 'string' },
                                description: { type: 'string' },
                            },
                            required: ['title'],
                        },
                    },
                },
                required: ['project_title', 'sections'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'add_counters_to_project',
            description: 'Aggiunge contatori secondari a un progetto esistente. SINTASSI OBBLIGATORIA: parentesi () non asterischi, numero prima di ogni abbreviazione, NON includere totale nel nome. Esempi: "G1: AM, 6mb", "G2: (1aum)×6", "G3: (1mb, 1aum)×6", "G5: 30mb" (giro dritto). initial_value = totale maglie del giro.',
            parameters: {
                type: 'object',
                properties: {
                    project_title: { type: 'string', description: 'Titolo del progetto da modificare' },
                    counters: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                name: { type: 'string', description: 'Nome con sintassi corretta: parentesi () non asterischi, numero prima di ogni abbreviazione, NON mettere totale nel nome. Es: "G2: (1aum)×6", "G3: (1mb, 1aum)×6", "G6: 30mb".' },
                                section_title: { type: 'string', description: 'Titolo sezione di appartenenza (opzionale)' },
                                initial_value: { type: 'number', description: 'Totale maglie del giro: G1=6, G2=12, G3=18, G4=24, G5=30, G6=36. Giro dritto = stesso del precedente.' },
                            },
                            required: ['name'],
                        },
                    },
                },
                required: ['project_title', 'counters'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'update_project_youtube',
            description: 'Aggiorna il link YouTube associato a un progetto. Usalo quando l\'utente vuole cambiare o aggiungere un video tutorial a un suo progetto.',
            parameters: {
                type: 'object',
                properties: {
                    project_title: { type: 'string' },
                    youtube_url: { type: 'string', description: 'URL YouTube completo (es. https://youtube.com/watch?v=xxx)' },
                },
                required: ['project_title', 'youtube_url'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'update_project_notes',
            description: 'Aggiorna o aggiunge testo alle note di un progetto esistente.',
            parameters: {
                type: 'object',
                properties: {
                    project_title: { type: 'string' },
                    content: { type: 'string', description: 'Testo da aggiungere/sostituire nelle note' },
                    mode: { type: 'string', enum: ['append', 'replace'], description: '"append" per aggiungere, "replace" per sovrascrivere' },
                },
                required: ['project_title', 'content', 'mode'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'create_project_from_youtube',
            description: 'Crea un nuovo progetto partendo da un link YouTube: trascrive il video e struttura il progetto con le parti identificate.',
            parameters: {
                type: 'object',
                properties: {
                    youtube_url: { type: 'string', description: 'URL YouTube completo' },
                    title: { type: 'string', description: 'Nome del progetto (se non specificato, usa il titolo del video)' },
                },
                required: ['youtube_url'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'clear_my_profile',
            description: 'Cancella tutte le informazioni personali memorizzate nel profilo AI dell\'utente. Usalo SOLO quando l\'utente chiede esplicitamente di dimenticare/cancellare i suoi dati personali dalla memoria AI (es. "dimentica tutto su di me", "cancella le mie informazioni", "resetta il mio profilo AI").',
            parameters: {
                type: 'object',
                properties: {
                    confirm: {
                        type: 'boolean',
                        description: 'Deve essere true — conferma che l\'utente ha chiesto esplicitamente la cancellazione.',
                    },
                },
                required: ['confirm'],
            },
        },
    },
]

// ── Helper: trova progetto per titolo (cerca su Supabase) ────────────────────

async function findProjectByTitle(userId: string, title: string) {
    const db = createServiceClient()
    try {
        const { data, error } = await db
            .from('projects')
            .select('id, title, type, notes_html, secs, sections')
            .eq('user_id', userId)
            .ilike('title', `%${title}%`)
            .order('created_at', { ascending: false })
            .limit(1)
            .single()
        if (error || !data) return null
        return data
    } catch {
        return null
    }
}

// ── Helper: estrae videoId da URL YouTube ────────────────────────────────────

function extractVideoId(url: string): string | null {
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/,
        /youtube\.com\/shorts\/([^&\n?#]+)/,
    ]
    for (const p of patterns) {
        const m = url.match(p)
        if (m) return m[1]
    }
    return null
}

// ── Esecutori tool ────────────────────────────────────────────────────────────

export async function executeTool(
    toolName: string,
    args: Record<string, unknown>,
    userId: string,
    requestUrl: string // per chiamare altri endpoint interni
): Promise<{ result: ToolResult; confirmationText: string } | { error: string }> {
    const db = createServiceClient()

    // ── create_project ────────────────────────────────────────────────────────
    if (toolName === 'create_project') {
        const { title, type = 'blank', notes_html, sections = [], counters = [] } = args as {
            title: string; type?: string; notes_html?: string
            sections?: Array<{ title: string; description?: string }>
            counters?: Array<{ name: string; section_title?: string; initial_value?: number }>
        }

        const projectId = `proj_ai_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
        const now = new Date().toISOString()

        // Costruisci sezioni con ID
        const sectionsData = sections.map((s, i) => ({
            id: `sec_${Date.now()}_${i}`,
            title: s.title,
            description: s.description ?? '',
            order: i,
        }))

        // Costruisci contatori con ID, associa alla sezione se specificata
        const countersData = counters.map((c, i) => {
            const matchSection = sectionsData.find(s => s.title === c.section_title)
            return {
                id: `ctr_${Date.now()}_${i}`,
                name: c.name,
                value: typeof c.initial_value === 'number' ? c.initial_value : 0,
                sectionId: matchSection?.id,
            }
        })

        const { error } = await db.from('projects').insert({
            id: projectId,
            user_id: userId,
            title,
            type,
            size: 0,
            counter: 0,
            timer_seconds: 0,
            notes_html: notes_html ? `<p>${notes_html}</p>` : '',
            secs: countersData,
            sections: sectionsData,
            images: [],
            created_at: now,
            updated_at: now,
        })

        if (error) return { error: `Impossibile creare il progetto: ${error.message}` }

        // Vettorizza il progetto (async, non bloccante)
        vectorizeProject({
            id: projectId, title, type, notesHtml: notes_html,
            sections: sectionsData, secs: countersData,
        }, userId).catch(() => {})

        const summary = [
            sections.length ? `${sections.length} sezioni (${sections.map(s => s.title).join(', ')})` : '',
            counters.length ? `${counters.length} contatori (${counters.map(c => c.name).join(', ')})` : '',
        ].filter(Boolean).join(' · ')

        return {
            result: { type: 'project_created', projectId, projectTitle: title, summary },
            confirmationText: `Progetto "${title}" creato${summary ? ` con ${summary}` : ''}.`,
        }
    }

    // ── clone_project ─────────────────────────────────────────────────────────
    if (toolName === 'clone_project') {
        const { source_title, new_title, modification_notes } = args as {
            source_title: string; new_title: string; modification_notes?: string
        }

        const source = await findProjectByTitle(userId, source_title)
        if (!source) return { error: `Progetto "${source_title}" non trovato nei tuoi progetti.` }

        const newId = `proj_ai_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
        const existingSecs: Array<{ id: string; name: string; value: number; sectionId?: string }> =
            Array.isArray(source.secs) ? source.secs : []
        const existingSections: Array<{ id: string; title: string; description?: string; order: number }> =
            Array.isArray(source.sections) ? source.sections : []

        // Ricrea IDs per evitare duplicati
        const newSections = existingSections.map((s, i) => ({ ...s, id: `sec_${newId}_${i}` }))
        const newSecs = existingSecs.map((c, i) => ({
            ...c, id: `ctr_${newId}_${i}`, value: 0,
            sectionId: newSections[existingSections.findIndex(s => s.id === c.sectionId)]?.id,
        }))

        const modNote = modification_notes
            ? `\n<p><strong>Modifiche da apportare:</strong> ${modification_notes}</p>`
            : ''
        const clonedNotes = (source.notes_html ?? '') + modNote

        const { error } = await db.from('projects').insert({
            id: newId,
            user_id: userId,
            title: new_title,
            type: source.type ?? 'blank',
            size: 0,
            counter: 0,
            timer_seconds: 0,
            notes_html: clonedNotes,
            secs: newSecs,
            sections: newSections,
            images: [],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        })

        if (error) return { error: `Impossibile clonare: ${error.message}` }

        vectorizeProject({ id: newId, title: new_title, type: source.type, notesHtml: clonedNotes, sections: newSections, secs: newSecs }, userId).catch(() => {})

        return {
            result: { type: 'project_cloned', projectId: newId, projectTitle: new_title, summary: `Clonato da "${source.title}"` },
            confirmationText: `Progetto "${new_title}" creato come clone di "${source.title}"${modification_notes ? ` con note di modifica` : ''}.`,
        }
    }

    // ── add_sections_to_project ───────────────────────────────────────────────
    if (toolName === 'add_sections_to_project') {
        const { project_title, sections } = args as {
            project_title: string; sections: Array<{ title: string; description?: string }>
        }

        const project = await findProjectByTitle(userId, project_title)
        if (!project) return { error: `Progetto "${project_title}" non trovato.` }

        const existing: Array<{ id: string; title: string; order: number }> =
            Array.isArray(project.sections) ? project.sections : []
        const newSections = [
            ...existing,
            ...sections.map((s, i) => ({
                id: `sec_${Date.now()}_${i}`,
                title: s.title,
                description: s.description ?? '',
                order: existing.length + i,
            })),
        ]

        const { error } = await db.from('projects')
            .update({ sections: newSections, updated_at: new Date().toISOString() })
            .eq('id', project.id).eq('user_id', userId)

        if (error) return { error: `Impossibile aggiornare: ${error.message}` }

        return {
            result: { type: 'sections_added', projectId: project.id, projectTitle: project.title, summary: sections.map(s => s.title).join(', ') },
            confirmationText: `Aggiunto ${sections.length} sezioni a "${project.title}": ${sections.map(s => s.title).join(', ')}.`,
        }
    }

    // ── add_counters_to_project ───────────────────────────────────────────────
    if (toolName === 'add_counters_to_project') {
        const { project_title, counters } = args as {
            project_title: string; counters: Array<{ name: string; section_title?: string; initial_value?: number }>
        }

        const project = await findProjectByTitle(userId, project_title)
        if (!project) return { error: `Progetto "${project_title}" non trovato.` }

        const existingSecs: Array<{ id: string; name: string; value: number }> =
            Array.isArray(project.secs) ? project.secs : []
        const sections: Array<{ id: string; title: string }> =
            Array.isArray(project.sections) ? project.sections : []

        const newSecs = [
            ...existingSecs,
            ...counters.map((c, i) => {
                const matchSection = sections.find(s => s.title === c.section_title)
                return {
                    id: `ctr_${Date.now()}_${i}`,
                    name: c.name,
                    value: typeof c.initial_value === 'number' ? c.initial_value : 0,
                    ...(matchSection ? { sectionId: matchSection.id } : {}),
                }
            }),
        ]

        const { error } = await db.from('projects')
            .update({ secs: newSecs, updated_at: new Date().toISOString() })
            .eq('id', project.id).eq('user_id', userId)

        if (error) return { error: `Impossibile aggiornare: ${error.message}` }

        return {
            result: { type: 'counters_added', projectId: project.id, projectTitle: project.title, summary: counters.map(c => c.name).join(', ') },
            confirmationText: `Aggiunti ${counters.length} contatori a "${project.title}": ${counters.map(c => c.name).join(', ')}.`,
        }
    }

    // ── update_project_youtube ────────────────────────────────────────────────
    if (toolName === 'update_project_youtube') {
        const { project_title, youtube_url } = args as { project_title: string; youtube_url: string }

        const project = await findProjectByTitle(userId, project_title)
        if (!project) return { error: `Progetto "${project_title}" non trovato.` }

        const videoId = extractVideoId(youtube_url)
        if (!videoId) return { error: 'URL YouTube non valido. Usa un link del tipo youtube.com/watch?v=...' }

        const thumbUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`

        const { error } = await db.from('projects')
            .update({ video_id: videoId, thumb_url: thumbUrl, type: 'tutorial', updated_at: new Date().toISOString() })
            .eq('id', project.id).eq('user_id', userId)

        if (error) return { error: `Impossibile aggiornare: ${error.message}` }

        return {
            result: { type: 'youtube_updated', projectId: project.id, projectTitle: project.title, summary: youtube_url },
            confirmationText: `Link YouTube aggiornato per "${project.title}". Apri il progetto per trascrivere il video.`,
        }
    }

    // ── update_project_notes ──────────────────────────────────────────────────
    if (toolName === 'update_project_notes') {
        const { project_title, content, mode } = args as {
            project_title: string; content: string; mode: 'append' | 'replace'
        }

        const project = await findProjectByTitle(userId, project_title)
        if (!project) return { error: `Progetto "${project_title}" non trovato.` }

        const newHtml = mode === 'append'
            ? (project.notes_html ?? '') + `\n<p>${content}</p>`
            : `<p>${content}</p>`

        const { error } = await db.from('projects')
            .update({ notes_html: newHtml, updated_at: new Date().toISOString() })
            .eq('id', project.id).eq('user_id', userId)

        if (error) return { error: `Impossibile aggiornare: ${error.message}` }

        vectorizeProject({ id: project.id, title: project.title, notesHtml: newHtml }, userId).catch(() => {})

        return {
            result: { type: 'notes_updated', projectId: project.id, projectTitle: project.title },
            confirmationText: `Note ${mode === 'append' ? 'aggiornate' : 'sostituite'} per "${project.title}".`,
        }
    }

    // ── create_project_from_youtube ───────────────────────────────────────────
    if (toolName === 'create_project_from_youtube') {
        const { youtube_url, title: customTitle } = args as { youtube_url: string; title?: string }

        const videoId = extractVideoId(youtube_url)
        if (!videoId) return { error: 'URL YouTube non valido.' }

        // Recupera trascrizione via endpoint interno (già esistente nell'app)
        let transcriptSegments: Array<{ text: string; start: number; duration: number }> = []
        try {
            const transcriptRes = await fetch(`${requestUrl.replace(/\/api\/chat.*/, '')}/api/tutorials/transcript?videoId=${videoId}`, {
                headers: { 'Cookie': '' }, // auth via service client, no cookie needed per transcript
            })
            if (transcriptRes.ok) {
                const data = await transcriptRes.json()
                transcriptSegments = data.segments ?? []
            }
        } catch {
            // trascrizione non disponibile — crea progetto senza
        }

        // Usa il titolo custom o genera uno dal videoId
        const projectTitle = customTitle ?? `Tutorial ${videoId}`
        const projectId = `proj_ai_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
        const thumbUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`

        const transcriptData = transcriptSegments.length ? {
            transcript: transcriptSegments,
            translated: null,
            generated_at: new Date().toISOString(),
            has_translation: false,
            source: 'captions' as const,
        } : null

        // Note con i primi punti chiave della trascrizione
        const notesHtml = transcriptSegments.length
            ? `<p>Tutorial caricato automaticamente. Trascrizione disponibile nel progetto.</p>`
            : `<p>Tutorial creato dal link: ${youtube_url}</p>`

        const { error } = await db.from('projects').insert({
            id: projectId,
            user_id: userId,
            title: projectTitle,
            type: 'tutorial',
            size: 0,
            counter: 0,
            timer_seconds: 0,
            notes_html: notesHtml,
            secs: [],
            sections: [],
            images: [],
            video_id: videoId,
            thumb_url: thumbUrl,
            transcript_data: transcriptData,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        })

        if (error) return { error: `Impossibile creare il progetto: ${error.message}` }

        vectorizeProject({ id: projectId, title: projectTitle, type: 'tutorial', notesHtml }, userId).catch(() => {})

        const summary = transcriptSegments.length
            ? `${transcriptSegments.length} segmenti di trascrizione caricati`
            : 'Senza trascrizione (video potrebbe non avere sottotitoli)'

        return {
            result: { type: 'project_from_youtube', projectId, projectTitle, summary },
            confirmationText: `Progetto "${projectTitle}" creato dal tutorial YouTube. ${summary}.`,
        }
    }

    // ── clear_my_profile ──────────────────────────────────────────────────────
    if (toolName === 'clear_my_profile') {
        const { confirm } = args as { confirm: boolean }
        if (!confirm) return { error: 'Cancellazione annullata — conferma richiesta.' }

        const { error } = await db
            .from('profiles')
            .update({ ai_profile: null })
            .eq('id', userId)

        if (error) return { error: `Impossibile cancellare il profilo: ${error.message}` }

        return {
            result: { type: 'profile_cleared', projectId: '', projectTitle: '' },
            confirmationText: 'Ho cancellato tutte le informazioni che avevo memorizzato su di te. Ricominciamo da zero!',
        }
    }

    return { error: `Tool "${toolName}" non riconosciuto.` }
}
