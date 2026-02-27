import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

/** POST — save a push subscription for the authenticated user */
export async function POST(req: Request) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

    const sub: PushSubscriptionJSON = await req.json()
    if (!sub.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
        return NextResponse.json({ error: 'Sottoscrizione non valida' }, { status: 400 })
    }

    const db = createServiceClient()
    const { error } = await db.from('push_subscriptions').upsert({
        user_id: user.id,
        endpoint: sub.endpoint,
        p256dh: sub.keys.p256dh,
        auth: sub.keys.auth,
    }, { onConflict: 'user_id,endpoint' })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
}

/** DELETE — remove a push subscription */
export async function DELETE(req: Request) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

    const { endpoint } = await req.json()
    const db = createServiceClient()
    await db.from('push_subscriptions')
        .delete()
        .eq('user_id', user.id)
        .eq('endpoint', endpoint)

    return NextResponse.json({ ok: true })
}
