import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createServiceClient } from '@/lib/supabase/server'
import { pushToUser, pushToAdmins, checkAndNotifyAlmostFull } from '@/lib/webpush'

export async function POST(req: Request) {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
        apiVersion: '2025-01-27.acacia' as any,
    })
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!
    const body = await req.text()
    const sig = req.headers.get('stripe-signature')!

    let event: Stripe.Event

    try {
        event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
    } catch (err: any) {
        return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 })
    }

    const supabase = createServiceClient()

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object as Stripe.Checkout.Session

        if (session.payment_status !== 'paid') {
            return NextResponse.json({ received: true })
        }

        const metadata = session.metadata ?? {}

        // ── Pagamento evento ──────────────────────────────────
        if (metadata.type === 'event') {
            const eventId = metadata.event_id
            const userId = metadata.user_id
            const userEmail = metadata.user_email ?? ''
            const creditUsed = Number(metadata.credit_used ?? 0)
            const amountPaid = (session.amount_total ?? 0) / 100

            // Guard idempotenza — evita doppio booking su retry webhook
            const { data: existing } = await supabase
                .from('event_bookings')
                .select('id')
                .eq('stripe_session_id', session.id)
                .single()

            if (!existing) {
                const { data: evData } = await supabase
                    .from('events').select('title').eq('id', eventId).single()

                const { error: bookingErr } = await supabase
                    .from('event_bookings')
                    .insert({
                        event_id: eventId,
                        user_id: userId,
                        user_email: userEmail,
                        amount_paid: amountPaid,
                        credit_used: creditUsed,
                        status: 'confirmed',
                        stripe_session_id: session.id,
                    })

                if (!bookingErr) {
                    if (creditUsed > 0) {
                        const { data: profileData } = await supabase
                            .from('profiles').select('event_credit').eq('id', userId).single()
                        const currentCredit = Number(profileData?.event_credit ?? 0)
                        await supabase
                            .from('profiles')
                            .update({ event_credit: Math.max(0, currentCredit - creditUsed) })
                            .eq('id', userId)
                    }
                    // Notifica admin
                    pushToAdmins({
                        title: 'Lurumi — Nuova prenotazione (Stripe)',
                        body: `${userEmail || 'Un utente'} ha prenotato "${evData?.title ?? eventId}"`,
                        url: '/admin',
                        tag: `booking-${eventId}`,
                    }).catch(() => {})
                    // Controlla posti quasi esauriti
                    checkAndNotifyAlmostFull(eventId).catch(() => {})
                }
            }

            return NextResponse.json({ received: true })
        }

        // ── Abbonamento premium ──────────────────────────────
        const customerId = session.customer as string

        const { data: profile } = await supabase
            .from('profiles')
            .select('id')
            .eq('stripe_customer_id', customerId)
            .single()

        if (profile) {
            await supabase
                .from('profiles')
                .update({ tier: 'premium' })
                .eq('id', profile.id)
            // Notifica l'utente dell'attivazione premium
            pushToUser(profile.id, {
                title: 'Lurumi — Benvenuto nel Premium!',
                body: 'Il tuo piano Premium è attivo. Goditi tutte le funzionalità!',
                url: '/profilo',
                tag: 'premium-activated',
            }).catch(() => {})
        }
    }

    // Subscription cancellata → torna a free
    if (event.type === 'customer.subscription.deleted') {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = subscription.customer as string

        const { data: profile } = await supabase
            .from('profiles')
            .select('id')
            .eq('stripe_customer_id', customerId)
            .single()

        if (profile) {
            await supabase
                .from('profiles')
                .update({ tier: 'free' })
                .eq('id', profile.id)
            // Notifica l'utente della scadenza/cancellazione
            pushToUser(profile.id, {
                title: 'Lurumi — Abbonamento scaduto',
                body: 'Il tuo piano Premium è terminato. Sei passata al piano Free.',
                url: '/pricing',
                tag: 'premium-expired',
            }).catch(() => {})
        }
    }

    // Subscription aggiornata (es. cancel_at_period_end → notifica utente)
    if (event.type === 'customer.subscription.updated') {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = subscription.customer as string

        const { data: profile } = await supabase
            .from('profiles')
            .select('id')
            .eq('stripe_customer_id', customerId)
            .single()

        if (profile && subscription.cancel_at_period_end) {
            const periodEnd = subscription.current_period_end
            const dateStr = new Date(periodEnd * 1000).toLocaleDateString('it-IT', {
                day: 'numeric', month: 'long', year: 'numeric',
            })
            pushToUser(profile.id, {
                title: 'Lurumi — Cancellazione pianificata',
                body: `Il tuo Premium rimarrà attivo fino al ${dateStr}, poi passerà al piano Free.`,
                url: '/pricing',
                tag: 'premium-canceling',
            }).catch(() => {})
        }
    }

    // Pagamento rinnovo fallito → avvisa l'utente
    if (event.type === 'invoice.payment_failed') {
        const invoice = event.data.object as Stripe.Invoice
        const customerId = invoice.customer as string

        const { data: profile } = await supabase
            .from('profiles')
            .select('id')
            .eq('stripe_customer_id', customerId)
            .single()

        if (profile) {
            pushToUser(profile.id, {
                title: 'Lurumi — Pagamento fallito',
                body: 'Il rinnovo del tuo abbonamento non è andato a buon fine. Aggiorna il metodo di pagamento.',
                url: '/pricing',
                tag: 'payment-failed',
            }).catch(() => {})
        }
    }

    return NextResponse.json({ received: true })
}
