// Costanti AI crediti — usabili sia client che server (nessun import server-only)

export const MONTHLY_CREDITS = {
    free: 50,
    premium: 300,
} as const

export const CREDIT_COSTS = {
    chat: 0,   // Groq Llama 3.3 70B — gratuito, nessun credito scalato
    vision: 5,
    image_fast: 8,
    image_hd: 20,
    bg_removal: 10,
    bg_generation: 15,
} as const

export type AiAction = keyof typeof CREDIT_COSTS
