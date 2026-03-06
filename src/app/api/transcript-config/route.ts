import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

// Soglie Supadata free tier (100 req/mese)
export const TRANSCRIPT_THRESHOLDS = [
    { upTo: 74, cost: 0 },   // zona sicura — gratuito
    { upTo: 89, cost: 3 },   // zona attenzione — 3 crediti
    { upTo: Infinity, cost: 5 }, // limite superato — 5 crediti
]

export function computeTranscriptCost(monthlyCount: number): number {
    for (const t of TRANSCRIPT_THRESHOLDS) {
        if (monthlyCount <= t.upTo) return t.cost
    }
    return 5
}

export async function GET() {
    try {
        const db = createServiceClient()
        const { data } = await db
            .from('system_usage')
            .select('count, reset_at')
            .eq('key', 'transcript')
            .single()

        const count = data?.count ?? 0
        const resetAt = data?.reset_at ? new Date(data.reset_at) : new Date(0)
        const daysSince = (Date.now() - resetAt.getTime()) / 86400000
        const effectiveCount = daysSince >= 30 ? 0 : count
        const cost = computeTranscriptCost(effectiveCount)

        return NextResponse.json({
            cost,
            monthlyCount: effectiveCount,
            isFree: cost === 0,
            resetAt: resetAt.toISOString(),
        })
    } catch {
        // Se la tabella non esiste ancora, restituisci gratuito
        return NextResponse.json({ cost: 0, monthlyCount: 0, isFree: true })
    }
}
