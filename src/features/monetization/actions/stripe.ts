'use server'

import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function createCheckoutSession(priceId: string) {
    if (!process.env.STRIPE_SECRET_KEY) {
        throw new Error('STRIPE_SECRET_KEY non configurato nel file .env.local')
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
        apiVersion: '2025-01-27.acacia' as any,
    })

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect('/login')
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3010'

    // Recupera o crea customer Stripe
    const { data: profile } = await supabase
        .from('profiles')
        .select('stripe_customer_id')
        .eq('id', user.id)
        .single()

    let customerId = profile?.stripe_customer_id

    if (!customerId) {
        const customer = await stripe.customers.create({
            email: user.email,
            metadata: { supabase_user_id: user.id },
        })
        customerId = customer.id
        await supabase
            .from('profiles')
            .upsert({ id: user.id, stripe_customer_id: customerId })
    }

    const session = await stripe.checkout.sessions.create({
        customer: customerId,
        line_items: [{ price: priceId, quantity: 1 }],
        mode: 'subscription',
        success_url: `${appUrl}/dashboard?success=true`,
        cancel_url: `${appUrl}/pricing?canceled=true`,
    })

    if (session.url) {
        redirect(session.url)
    }
}
