import webpush from 'web-push'
import { createServiceClient } from '@/lib/supabase/server'

webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
)

export interface PushPayload {
    title: string
    body: string
    url?: string
    tag?: string
}

/** Send a push notification to all subscriptions of a user. */
export async function pushToUser(userId: string, payload: PushPayload) {
    const db = createServiceClient()
    const { data: subs } = await db
        .from('push_subscriptions')
        .select('endpoint, p256dh, auth')
        .eq('user_id', userId)

    if (!subs || subs.length === 0) return

    const message = JSON.stringify(payload)
    await Promise.allSettled(
        subs.map(sub =>
            webpush.sendNotification(
                { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
                message,
            ).catch(async (err: any) => {
                if (err.statusCode === 410 || err.statusCode === 404) {
                    await db.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
                }
            })
        )
    )
}

/** Send a push notification to all admin users. */
export async function pushToAdmins(payload: PushPayload) {
    const db = createServiceClient()
    const { data: admins } = await db
        .from('profiles')
        .select('id')
        .eq('is_admin', true)

    if (!admins || admins.length === 0) return
    await Promise.allSettled(admins.map(a => pushToUser(a.id, payload)))
}

/** Send a push notification to all users that have a subscription (new event published). */
export async function pushToAllUsers(payload: PushPayload) {
    const db = createServiceClient()
    const { data: subs } = await db
        .from('push_subscriptions')
        .select('user_id, endpoint, p256dh, auth')

    if (!subs || subs.length === 0) return

    const message = JSON.stringify(payload)
    await Promise.allSettled(
        subs.map(sub =>
            webpush.sendNotification(
                { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
                message,
            ).catch(async (err: any) => {
                if (err.statusCode === 410 || err.statusCode === 404) {
                    await db.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
                }
            })
        )
    )
}

/** Send a push notification to all confirmed bookers of an event. */
export async function pushToConfirmedBookers(eventId: string, payload: PushPayload) {
    const db = createServiceClient()
    const { data: bookings } = await db
        .from('event_bookings')
        .select('user_id')
        .eq('event_id', eventId)
        .eq('status', 'confirmed')

    if (!bookings || bookings.length === 0) return

    const userIds = [...new Set(bookings.map(b => b.user_id as string))]
    await Promise.allSettled(userIds.map(id => pushToUser(id, payload)))
}

/** Send a push notification to all users who expressed interest in an event. */
export async function pushToEventInterested(eventId: string, payload: PushPayload) {
    const db = createServiceClient()
    const { data: interests } = await db
        .from('event_interests')
        .select('user_id')
        .eq('event_id', eventId)
        .not('user_id', 'is', null)

    if (!interests || interests.length === 0) return

    const userIds = [...new Set(interests.map(i => i.user_id as string))]
    await Promise.allSettled(userIds.map(id => pushToUser(id, payload)))
}

/**
 * After a new confirmed booking, check if spots are almost full.
 * Fires exactly once when remaining spots cross the 20% threshold (min 1, max 3).
 */
export async function checkAndNotifyAlmostFull(eventId: string) {
    const db = createServiceClient()
    const { data: event } = await db
        .from('events')
        .select('max_participants, title')
        .eq('id', eventId)
        .single()

    if (!event?.max_participants) return

    const { count } = await db
        .from('event_bookings')
        .select('*', { count: 'exact', head: true })
        .eq('event_id', eventId)
        .eq('status', 'confirmed')

    const remaining = event.max_participants - (count ?? 0)
    const threshold = Math.max(1, Math.min(3, Math.floor(event.max_participants * 0.2)))

    if (remaining !== threshold) return

    await pushToEventInterested(eventId, {
        title: 'Lurumi — Posti quasi esauriti!',
        body: `Rimangono solo ${remaining} ${remaining === 1 ? 'posto' : 'posti'} per "${event.title}"`,
        url: '/eventi',
        tag: `almost-full-${eventId}`,
    })
}
