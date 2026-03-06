import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient, createServiceClient } from '@/lib/supabase/server'

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

        const { eventId, creditToUse } = await req.json() as { eventId: string; creditToUse: number }

        const serviceSupabase = createServiceClient()

        const [eventRes, profileRes] = await Promise.all([
            serviceSupabase.from('events').select('*').eq('id', eventId).single(),
            serviceSupabase.from('profiles').select('event_credit, stripe_customer_id').eq('id', user.id).single(),
        ])

        const event = eventRes.data
        const profile = profileRes.data

        if (!event || !event.is_active) {
            return NextResponse.json({ error: 'Evento non trovato' }, { status: 404 })
        }

        // Controlla posti disponibili
        if (event.max_participants) {
            const { count } = await serviceSupabase
                .from('event_bookings')
                .select('*', { count: 'exact', head: true })
                .eq('event_id', eventId)
                .eq('status', 'confirmed')
            if (count !== null && count >= event.max_participants) {
                return NextResponse.json({ error: 'Posti esauriti' }, { status: 400 })
            }
        }

        const availableCredit = Number(profile?.event_credit ?? 0)
        const cost = Number(event.cost ?? 0)
        const actualCreditToUse = Math.min(creditToUse ?? 0, availableCredit, cost)
        const amountToCharge = Math.max(0, cost - actualCreditToUse)

        if (amountToCharge <= 0) {
            return NextResponse.json({ error: 'Usa la prenotazione con credito' }, { status: 400 })
        }

        const amountCents = Math.round(amountToCharge * 100)

        // Ensure Stripe customer exists
        let customerId = profile?.stripe_customer_id
        if (!customerId) {
            const customer = await stripe.customers.create({
                email: user.email,
                metadata: { supabase_user_id: user.id },
            })
            customerId = customer.id
            await serviceSupabase
                .from('profiles')
                .update({ stripe_customer_id: customerId })
                .eq('id', user.id)
        }

        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3010'

        const session = await stripe.checkout.sessions.create({
            customer: customerId,
            payment_method_types: ['card'],
            line_items: [{
                price_data: {
                    currency: 'eur',
                    product_data: {
                        name: event.title,
                        description: `Prenotazione evento: ${event.title}`,
                    },
                    unit_amount: amountCents,
                },
                quantity: 1,
            }],
            mode: 'payment',
            metadata: {
                type: 'event',
                event_id: eventId,
                user_id: user.id,
                user_email: user.email ?? '',
                credit_used: String(actualCreditToUse),
            },
            success_url: `${appUrl}/eventi?success=true&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${appUrl}/eventi?canceled=true`,
        })

        return NextResponse.json({ url: session.url })
    } catch (err: any) {
        console.error('[event-checkout]', err.message)
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
