/**
 * In-memory sliding window rate limiter — zero dependencies.
 *
 * Funziona come singleton nel processo Node.js: persiste tra richieste
 * sulla stessa istanza "calda". Sufficiente per prevenire burst abuse
 * (es. 50 richieste in 1 secondo). Il limite mensile è già garantito
 * dal sistema crediti AI.
 *
 * Limiti per azione:
 *   chat        → 15 req / 60 s
 *   vision      →  5 req / 60 s
 *   image_fast  →  4 req / 60 s
 *   image_hd    →  2 req / 60 s
 */

interface Window {
    count: number
    windowStart: number
}

const LIMITS: Record<string, { requests: number; windowMs: number }> = {
    chat:          { requests: 15, windowMs: 60_000 },
    vision:        { requests:  5, windowMs: 60_000 },
    image_fast:    { requests:  4, windowMs: 60_000 },
    image_hd:      { requests:  2, windowMs: 60_000 },
    bg_removal:    { requests:  3, windowMs: 60_000 },
    bg_generation: { requests:  4, windowMs: 60_000 },
}

// Mappa chiave → finestra corrente
const store = new Map<string, Window>()

// Pulizia periodica: rimuove entry scadute da più di 5 minuti
setInterval(() => {
    const cutoff = Date.now() - 5 * 60_000
    for (const [key, w] of store) {
        if (w.windowStart < cutoff) store.delete(key)
    }
}, 5 * 60_000).unref() // .unref() evita che questo timer blocchi lo shutdown del processo

export function checkRateLimit(
    userId: string,
    action: string
): { ok: true } | { ok: false; retryAfterSec: number } {
    const limit = LIMITS[action]
    if (!limit) return { ok: true } // azione sconosciuta: non bloccare

    const key = `${userId}:${action}`
    const now = Date.now()
    const entry = store.get(key)

    if (!entry || now - entry.windowStart > limit.windowMs) {
        // Nuova finestra
        store.set(key, { count: 1, windowStart: now })
        return { ok: true }
    }

    if (entry.count >= limit.requests) {
        const retryAfterMs = limit.windowMs - (now - entry.windowStart)
        return { ok: false, retryAfterSec: Math.ceil(retryAfterMs / 1000) }
    }

    entry.count++
    return { ok: true }
}
