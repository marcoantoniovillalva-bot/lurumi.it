import OpenAI from 'openai'

// Cache in-memory per evitare chiamate Groq duplicate per lo stesso nome
const cache = new Map<string, 'f' | 'm' | 'n'>()

function getGroqClient() {
    if (!process.env.GROQ_API_KEY) return null
    return new OpenAI({ apiKey: process.env.GROQ_API_KEY, baseURL: 'https://api.groq.com/openai/v1' })
}

// Euristica fallback per nomi italiani
function italianGenderHeuristic(firstName: string): 'f' | 'm' | 'n' {
    const n = firstName.trim().toLowerCase()
    const maleExceptions = ['andrea', 'luca', 'nicola', 'mattia', 'enea', 'elia', 'beniamino']
    if (maleExceptions.includes(n)) return 'm'
    if (n.endsWith('a')) return 'f'
    if (n.endsWith('o') || n.endsWith('e') || n.endsWith('i')) return 'm'
    return 'n'
}

/**
 * Rileva il genere di un nome proprio usando Groq AI.
 * Fallback sull'euristica italiana se Groq non è disponibile.
 * Risultato salvato in cache in-memory per la durata del processo.
 */
export async function detectGender(firstName?: string): Promise<'f' | 'm' | 'n'> {
    if (!firstName?.trim()) return 'n'
    const key = firstName.trim().toLowerCase()

    if (cache.has(key)) return cache.get(key)!

    const groq = getGroqClient()
    if (!groq) {
        const result = italianGenderHeuristic(firstName)
        cache.set(key, result)
        return result
    }

    try {
        const completion = await groq.chat.completions.create({
            model: 'llama-3.3-70b-versatile',
            max_tokens: 3,
            temperature: 0,
            messages: [
                {
                    role: 'system',
                    content: 'You detect the grammatical gender of a first name for Italian text. Reply ONLY with: "f" (feminine), "m" (masculine), or "n" (unknown/neutral). No other text.',
                },
                { role: 'user', content: firstName.trim() },
            ],
        })
        const raw = completion.choices[0]?.message?.content?.trim().toLowerCase()
        const result: 'f' | 'm' | 'n' = (raw === 'f' || raw === 'm' || raw === 'n') ? raw : italianGenderHeuristic(firstName)
        cache.set(key, result)
        return result
    } catch {
        const result = italianGenderHeuristic(firstName)
        cache.set(key, result)
        return result
    }
}
