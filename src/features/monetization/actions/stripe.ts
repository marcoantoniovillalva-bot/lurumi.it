'use server'

import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

function initStripe() {
    if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY non configurato')
    return new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2025-01-27.acacia' as any })
}

export async function createCheckoutSession(priceId: string) {
    const stripe = initStripe()

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
        success_url: `${appUrl}/pricing?success=true&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${appUrl}/pricing?canceled=true`,
    })

    if (session.url) {
        redirect(session.url)
    }
}

export async function createBillingPortalSession() {
    const stripe = initStripe()
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    const { data: profile } = await supabase
        .from('profiles')
        .select('stripe_customer_id')
        .eq('id', user.id)
        .single()

    if (!profile?.stripe_customer_id) {
        throw new Error('Nessun abbonamento Stripe trovato')
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3010'

    const portalSession = await stripe.billingPortal.sessions.create({
        customer: profile.stripe_customer_id,
        return_url: `${appUrl}/pricing?portal_return=true`,
    })

    redirect(portalSession.url)
}
