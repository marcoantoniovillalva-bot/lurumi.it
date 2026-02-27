/**
 * AI status helper — controlla se l'AI è abilitata (check admin_settings).
 * Cache in-memory 60s per evitare un DB round-trip ad ogni richiesta.
 * Supporta auto-disable quando la spesa mensile supera il budget.
 */

import { createServiceClient } from '@/lib/supabase/server'

let _disabled: boolean | null = null
let _expiry = 0

export async function isAiEnabled(): Promise<boolean> {
    if (_disabled !== null && Date.now() < _expiry) return !_disabled
    const db = createServiceClient()
    const { data } = await db
        .from('admin_settings')
        .select('value')
        .eq('key', 'ai_disabled')
        .single()
    _disabled = data?.value === 'true'
    _expiry = Date.now() + 60_000
    return !_disabled
}

export function invalidateAiStatusCache() {
    _disabled = null
    _expiry = 0
}

/**
 * Chiamata in modo non-bloccante dopo ogni generazione AI.
 * Se auto_disable_ai=true e la spesa mensile >= budget, disabilita l'AI.
 */
export async function autoDisableIfOverBudget(): Promise<void> {
    const db = createServiceClient()

    const { data: rows } = await db
        .from('admin_settings')
        .select('key, value')
        .in('key', ['monthly_budget_usd', 'auto_disable_ai', 'ai_disabled'])

    const s: Record<string, string> = Object.fromEntries(
        (rows ?? []).map((r: { key: string; value: string }) => [r.key, r.value])
    )

    if (s.auto_disable_ai !== 'true' || s.ai_disabled === 'true') return

    const budget = parseFloat(s.monthly_budget_usd ?? '50')
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const { data: agg } = await db
        .from('ai_generations')
        .select('cost_usd')
        .gte('created_at', startOfMonth.toISOString())

    const total = (agg ?? []).reduce(
        (sum: number, r: { cost_usd: number | null }) => sum + Number(r.cost_usd ?? 0),
        0
    )

    if (total >= budget) {
        await db
            .from('admin_settings')
            .upsert({ key: 'ai_disabled', value: 'true', updated_at: new Date().toISOString() })
        invalidateAiStatusCache()
    }
}
