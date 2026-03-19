/**
 * embeddings.ts — Helper per generare vettori con OpenAI text-embedding-3-small.
 * Costo: $0.02 / 1M token (~trascurabile per uso normale).
 */

import OpenAI from 'openai'

let _openai: OpenAI | null = null
function getOpenAI(): OpenAI {
    if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY non configurato')
    if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    return _openai
}

export const EMBEDDING_MODEL = 'text-embedding-3-small'
export const EMBEDDING_DIMENSIONS = 1536

/**
 * Genera un vettore embedding per un testo.
 * Restituisce null se OPENAI_API_KEY non è configurata (RAG disabilitato silenziosamente).
 */
export async function createEmbedding(text: string): Promise<number[] | null> {
    if (!process.env.OPENAI_API_KEY) return null
    try {
        const openai = getOpenAI()
        const response = await openai.embeddings.create({
            model: EMBEDDING_MODEL,
            input: text.slice(0, 8000), // max sicuro per evitare errori token
        })
        return response.data[0].embedding
    } catch (err) {
        console.error('[embeddings] Errore generazione embedding:', err)
        return null
    }
}

/**
 * Prepara il testo di un progetto per l'embedding.
 * Concatena titolo + tipo + sezioni + note (senza HTML) + nomi contatori.
 */
export function buildProjectEmbeddingText(project: {
    title: string
    type?: string
    notesHtml?: string
    sections?: Array<{ title: string; description?: string }>
    secs?: Array<{ name: string }>
}): string {
    const parts: string[] = [`Progetto: ${project.title}`]
    if (project.type) parts.push(`Tipo: ${project.type}`)
    if (project.sections?.length) {
        parts.push(`Sezioni: ${project.sections.map(s => s.title + (s.description ? ` (${s.description})` : '')).join(', ')}`)
    }
    if (project.secs?.length) {
        parts.push(`Contatori: ${project.secs.map(s => s.name).join(', ')}`)
    }
    if (project.notesHtml) {
        // Rimuovi HTML tags — includi fino a 3000 char per catturare schemi completi
        const text = project.notesHtml.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
        if (text) parts.push(`Schema/Note:\n${text.slice(0, 3000)}`)
    }
    return parts.join('\n')
}
