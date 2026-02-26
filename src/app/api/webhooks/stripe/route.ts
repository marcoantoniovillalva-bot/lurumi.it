import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
        apiVersion: '2025-01-27-acacia' as any,
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

        // Aggiorna a premium solo se il pagamento è confermato
        if (session.payment_status !== 'paid') {
            return NextResponse.json({ received: true })
        }

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
        }
    }

    return NextResponse.json({ received: true })
}
