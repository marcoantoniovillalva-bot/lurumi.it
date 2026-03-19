// Costanti AI crediti — usabili sia client che server (nessun import server-only)

export const MONTHLY_CREDITS = {
    free: 100,      // 100 chat/mese con llama-3.1-8b (1cr/msg) o mix con vision
    premium: 300,   // Chat illimitata (gratis) + crediti per vision/immagini
} as const

export const CREDIT_COSTS = {
    chat: 1,        // Free: 1cr/msg con llama-3.1-8b. Premium: GRATIS (gestito nel route)
    vision: 5,      // GPT-4o Vision — entrambi i tier
    image_fast: 8,  // Replicate flux-schnell
    image_hd: 20,   // DALL-E 3 HD
    bg_removal: 10, // Replicate BRIA RMBG
    bg_generation: 15, // Replicate flux sfondo
    transcript: 0,  // Supadata — gratuito (100 req/mese free tier)
} as const

export type AiAction = keyof typeof CREDIT_COSTS

// Modello Groq per tier
export const GROQ_MODELS = {
    free: 'llama-3.1-8b-instant',       // economico, veloce, supporta tool use
    premium: 'llama-3.3-70b-versatile', // massima qualità per schemi complessi
} as const
