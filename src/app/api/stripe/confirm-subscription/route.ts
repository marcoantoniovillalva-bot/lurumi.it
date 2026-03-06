import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient, createServiceClient } from '@/lib/supabase/server'

/**
 * GET /api/stripe/confirm-subscription?session_id=xxx
 *
 * Verifica direttamente con Stripe che la sessione di checkout sia pagata
 * e aggiorna il tier dell'utente a 'premium' nel DB.
 * Serve come fallback immediato al webhook (che arriva in modo asincrono).
 * È idempotente: se tier è già 'premium' risponde subito con activated=true.
 */
export async function GET(req: NextRequest) {
    const sessionId = req.nextUrl.searchParams.get('session_id')
    if (!sessionId) {
        return NextResponse.json({ error: 'session_id mancante' }, { status: 400 })
    }

    // Auth obbligatoria
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
    }

    const db = createServiceClient()

    // Controllo idempotente: se già premium, non serve chiamare Stripe
    const { data: profile } = await db
        .from('profiles')
        .select('id, tier, stripe_customer_id')
        .eq('id', user.id)
        .single()

    if (profile?.tier === 'premium') {
        return NextResponse.json({ activated: true })
    }

    // Verifica la sessione Stripe
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
        apiVersion: '2025-01-27.acacia' as any,
    })

    let session: Stripe.Checkout.Session
    try {
        session = await stripe.checkout.sessions.retrieve(sessionId)
    } catch (err: any) {
        return NextResponse.json({ activated: false, reason: 'Sessione Stripe non trovata' }, { status: 404 })
    }

    // Deve essere un abbonamento pagato
    if (session.mode !== 'subscription' || session.payment_status !== 'paid') {
        return NextResponse.json({ activated: false, reason: 'Pagamento non completato' })
    }

    // Sicurezza: il customer della sessione deve corrispondere all'utente loggato
    const sessionCustomerId = session.customer as string
    if (profile?.stripe_customer_id && profile.stripe_customer_id !== sessionCustomerId) {
        return NextResponse.json({ activated: false, reason: 'Sessione non valida per questo utente' }, { status: 403 })
    }

    // Aggiorna il tier + salva stripe_customer_id se mancante
    const updateData: Record<string, unknown> = { tier: 'premium' }
    if (!profile?.stripe_customer_id) {
        updateData.stripe_customer_id = sessionCustomerId
    }

    const { error } = await db
        .from('profiles')
        .update(updateData)
        .eq('id', user.id)

    if (error) {
        console.error('[confirm-subscription] DB update error:', error.message)
        return NextResponse.json({ activated: false, reason: 'Errore aggiornamento profilo' }, { status: 500 })
    }

    return NextResponse.json({ activated: true })
}
