import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient, createServiceClient } from '@/lib/supabase/server'

/**
 * GET /api/stripe/sync-subscription
 *
 * Sincronizza lo stato reale dell'abbonamento Stripe con il DB.
 * Restituisce:
 *   { tier: 'free' | 'premium', cancelAtPeriodEnd: boolean, currentPeriodEnd: number | null }
 */
export async function GET() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
    }

    const db = createServiceClient()

    const { data: profile } = await db
        .from('profiles')
        .select('id, tier, stripe_customer_id')
        .eq('id', user.id)
        .single()

    // Nessun customer Stripe → nessun abbonamento possibile
    if (!profile?.stripe_customer_id) {
        if (profile?.tier !== 'free') {
            await db.from('profiles').update({ tier: 'free' }).eq('id', user.id)
        }
        return NextResponse.json({ tier: 'free', cancelAtPeriodEnd: false, currentPeriodEnd: null })
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
        apiVersion: '2025-01-27.acacia' as any,
    })

    let activeTier: 'free' | 'premium' = 'free'
    let cancelAtPeriodEnd = false
    let currentPeriodEnd: number | null = null

    try {
        const subscriptions = await stripe.subscriptions.list({
            customer: profile.stripe_customer_id,
            status: 'active',
            limit: 5,
        })

        if (subscriptions.data.length > 0) {
            const sub = subscriptions.data[0]
            activeTier = 'premium'
            cancelAtPeriodEnd = sub.cancel_at_period_end
            currentPeriodEnd = sub.current_period_end ?? null
        }
    } catch (err: any) {
        console.error('[sync-subscription] Stripe error:', err.message)
        return NextResponse.json(
            { error: 'Errore Stripe', tier: profile.tier, cancelAtPeriodEnd: false, currentPeriodEnd: null },
            { status: 500 }
        )
    }

    // Aggiorna il DB se il tier è cambiato
    if (profile.tier !== activeTier) {
        const { error } = await db
            .from('profiles')
            .update({ tier: activeTier })
            .eq('id', user.id)
        if (error) {
            console.error('[sync-subscription] DB error:', error.message)
            return NextResponse.json({ error: 'Errore aggiornamento profilo' }, { status: 500 })
        }
    }

    return NextResponse.json({ tier: activeTier, cancelAtPeriodEnd, currentPeriodEnd })
}
