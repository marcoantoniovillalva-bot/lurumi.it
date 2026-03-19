/**
 * rag.ts — Retrieval-Augmented Generation su Supabase pgvector.
 * Gestisce indicizzazione e ricerca semantica di progetti e contenuti.
 */

import { createEmbedding, buildProjectEmbeddingText } from './embeddings'
import { createServiceClient } from './supabase/server'

export type KnowledgeSourceType = 'project' | 'libro' | 'fatti_chat'

export interface KnowledgeChunk {
    id: string
    source_type: KnowledgeSourceType
    source_id?: string
    content: string
    metadata?: Record<string, unknown>
    similarity?: number
}

// ── Ricerca semantica ─────────────────────────────────────────────────────────

/**
 * Cerca i chunk più rilevanti per una query testuale.
 * Restituisce array vuoto se embeddings non disponibili o errore.
 */
export async function searchKnowledge(
    userId: string,
    query: string,
    options: {
        topK?: number
        minSimilarity?: number
        sourceFilter?: KnowledgeSourceType
    } = {}
): Promise<KnowledgeChunk[]> {
    const { topK = 3, minSimilarity = 0.65, sourceFilter } = options

    const embedding = await createEmbedding(query)
    if (!embedding) return [] // OPENAI_API_KEY non disponibile

    try {
        const db = createServiceClient()
        const { data, error } = await db.rpc('match_knowledge', {
            query_embedding: embedding,
            match_user_id: userId,
            match_count: topK,
            source_filter: sourceFilter ?? null,
        })
        if (error) {
            console.error('[rag] match_knowledge error:', error.message)
            return []
        }
        return (data as KnowledgeChunk[]).filter(c => (c.similarity ?? 0) >= minSimilarity)
    } catch (err) {
        console.error('[rag] searchKnowledge error:', err)
        return []
    }
}

/**
 * Costruisce il blocco di contesto RAG da iniettare nel prompt.
 */
export function buildRagContextBlock(chunks: KnowledgeChunk[]): { block: string; sources: string[] } {
    if (!chunks.length) return { block: '', sources: [] }

    const sources: string[] = []
    const lines: string[] = ['--- CONTESTO DAI TUOI PROGETTI ---']

    for (const chunk of chunks) {
        const label = chunk.source_type === 'libro'
            ? 'Libro Lurumi'
            : (chunk.metadata?.title as string) ?? chunk.source_id ?? 'Progetto'
        if (!sources.includes(label)) sources.push(label)
        lines.push(`[${label}]\n${chunk.content}`)
    }
    lines.push('---')
    return { block: lines.join('\n'), sources }
}

// ── Indicizzazione progetti ───────────────────────────────────────────────────

/**
 * Vettorizza un progetto e lo salva in knowledge_chunks.
 * Chiamato alla creazione/aggiornamento progetto via AI tools.
 */
export async function vectorizeProject(project: {
    id: string
    title: string
    type?: string
    notesHtml?: string
    sections?: Array<{ title: string; description?: string }>
    secs?: Array<{ name: string }>
}, userId: string): Promise<void> {
    const text = buildProjectEmbeddingText(project)
    const embedding = await createEmbedding(text)
    if (!embedding) return

    try {
        const db = createServiceClient()
        // Upsert: sostituisce il chunk esistente per lo stesso source_id
        // delete + insert per evitare problemi con partial unique index
        await db.from('knowledge_chunks')
            .delete()
            .eq('user_id', userId)
            .eq('source_type', 'project')
            .eq('source_id', project.id)
        await db.from('knowledge_chunks').insert({
            user_id: userId,
            source_type: 'project',
            source_id: project.id,
            content: text,
            embedding,
            metadata: { title: project.title, type: project.type },
        })
    } catch (err) {
        console.error('[rag] vectorizeProject error:', err)
    }
}

/**
 * Rimuove i chunk di un progetto eliminato.
 */
export async function deleteProjectChunks(projectId: string, userId: string): Promise<void> {
    try {
        const db = createServiceClient()
        await db.from('knowledge_chunks')
            .delete()
            .eq('source_id', projectId)
            .eq('user_id', userId)
            .eq('source_type', 'project')
    } catch (err) {
        console.error('[rag] deleteProjectChunks error:', err)
    }
}

// ── Indicizzazione libro ──────────────────────────────────────────────────────

/**
 * Vettorizza un chunk del libro (user_id = NULL = condiviso tra tutti).
 * Usato dallo script di backfill.
 */
export async function vectorizeBookChunk(chunk: {
    content: string
    sourceId: string // es. "libro_lurumi/abbreviazioni"
    metadata?: Record<string, unknown>
}): Promise<void> {
    const embedding = await createEmbedding(chunk.content)
    if (!embedding) return

    try {
        const db = createServiceClient()
        await db.from('knowledge_chunks')
            .delete()
            .is('user_id', null)
            .eq('source_type', 'libro')
            .eq('source_id', chunk.sourceId)
        await db.from('knowledge_chunks').insert({
            user_id: null,
            source_type: 'libro',
            source_id: chunk.sourceId,
            content: chunk.content,
            embedding,
            metadata: chunk.metadata ?? {},
        })
    } catch (err) {
        console.error('[rag] vectorizeBookChunk error:', err)
    }
}
