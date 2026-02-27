import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { pushToAdmins, checkAndNotifyAlmostFull } from '@/lib/webpush'

/**
 * Conferma una prenotazione evento verificando direttamente la sessione Stripe.
 * Usato come alternativa al webhook (che non funziona in localhost).
 * È idempotente: se il webhook ha già creato la prenotazione, la restituisce.
 */
export async function POST(req: Request) {
    try {
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
            apiVersion: '2025-01-27.acacia' as any,
        })

        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
        }

        const { sessionId } = await req.json() as { sessionId: string }
        if (!sessionId) {
            return NextResponse.json({ error: 'session_id mancante' }, { status: 400 })
        }

        // Recupera la sessione direttamente da Stripe
        const session = await stripe.checkout.sessions.retrieve(sessionId)

        if (session.payment_status !== 'paid') {
            return NextResponse.json(
                { error: 'Pagamento non ancora completato', payment_status: session.payment_status },
                { status: 402 }
            )
        }

        const metadata = session.metadata ?? {}

        if (metadata.type !== 'event') {
            return NextResponse.json({ error: 'Sessione non relativa a un evento' }, { status: 400 })
        }

        // Sicurezza: la sessione deve appartenere all'utente autenticato
        if (metadata.user_id !== user.id) {
            return NextResponse.json({ error: 'Accesso non autorizzato' }, { status: 403 })
        }

        const serviceSupabase = createServiceClient()

        // Idempotenza: restituisce la prenotazione esistente se già creata (dal webhook o da una chiamata precedente)
        const { data: existing } = await serviceSupabase
            .from('event_bookings')
            .select('id, event_id, amount_paid, credit_used, status')
            .eq('stripe_session_id', session.id)
            .maybeSingle()

        if (existing) {
            return NextResponse.json({ booking: existing })
        }

        // Crea la prenotazione
        const eventId = metadata.event_id
        const creditUsed = Number(metadata.credit_used ?? 0)
        const amountPaid = (session.amount_total ?? 0) / 100
        const userEmail = metadata.user_email ?? ''

        const { data: booking, error: bookingErr } = await serviceSupabase
            .from('event_bookings')
            .insert({
                event_id: eventId,
                user_id: user.id,
                user_email: userEmail,
                amount_paid: amountPaid,
                credit_used: creditUsed,
                status: 'confirmed',
                stripe_session_id: session.id,
            })
            .select('id, event_id, amount_paid, credit_used, status')
            .single()

        if (bookingErr) {
            console.error('[confirm-booking] insert error:', bookingErr.message)
            return NextResponse.json({ error: bookingErr.message }, { status: 500 })
        }

        // Scala il credito usato dal profilo utente
        if (creditUsed > 0) {
            const { data: profileData } = await serviceSupabase
                .from('profiles')
                .select('event_credit')
                .eq('id', user.id)
                .single()
            const currentCredit = Number(profileData?.event_credit ?? 0)
            await serviceSupabase
                .from('profiles')
                .update({ event_credit: Math.max(0, currentCredit - creditUsed) })
                .eq('id', user.id)
        }

        // Notifica admin + controlla posti quasi esauriti
        const { data: evData } = await serviceSupabase
            .from('events').select('title').eq('id', eventId).single()
        pushToAdmins({
            title: 'Lurumi — Nuova prenotazione (Stripe)',
            body: `${metadata.user_email || 'Un utente'} ha prenotato "${evData?.title ?? eventId}"`,
            url: '/admin',
            tag: `booking-${eventId}`,
        }).catch(() => {})
        checkAndNotifyAlmostFull(eventId).catch(() => {})

        return NextResponse.json({ booking })
    } catch (err: any) {
        console.error('[confirm-booking]', err.message)
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
