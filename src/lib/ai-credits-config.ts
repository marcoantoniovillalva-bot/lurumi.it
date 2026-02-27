// Costanti AI crediti — usabili sia client che server (nessun import server-only)

export const MONTHLY_CREDITS = {
    free: 50,
    premium: 300,
} as const

export const CREDIT_COSTS = {
    chat: 2,
    vision: 5,
    image_fast: 8,
    image_hd: 20,
} as const

export type AiAction = keyof typeof CREDIT_COSTS
