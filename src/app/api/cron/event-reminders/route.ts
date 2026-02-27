import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { pushToUser } from '@/lib/webpush'

/**
 * Cron job — eseguito ogni ora da Vercel.
 * Invia un promemoria push a tutti gli utenti che hanno un evento prenotato
 * che inizia tra 23.5h e 24.5h.
 */
export async function GET(req: Request) {
    // Verifica il secret del cron
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const db = createServiceClient()
    const now = Date.now()
    const from = new Date(now + 23.5 * 3_600_000).toISOString()
    const to = new Date(now + 24.5 * 3_600_000).toISOString()

    // Trova tutti gli eventi che iniziano nella finestra 23.5h–24.5h
    const { data: events } = await db
        .from('events')
        .select('id, title, event_date')
        .gte('event_date', from)
        .lte('event_date', to)
        .eq('is_active', true)

    if (!events || events.length === 0) {
        return NextResponse.json({ sent: 0 })
    }

    let sent = 0

    for (const event of events) {
        // Trova tutti i prenotati confermati
        const { data: bookings } = await db
            .from('event_bookings')
            .select('user_id')
            .eq('event_id', event.id)
            .eq('status', 'confirmed')

        if (!bookings || bookings.length === 0) continue

        const userIds = [...new Set(bookings.map(b => b.user_id as string))]
        const eventDate = new Date(event.event_date)
        const dateStr = eventDate.toLocaleDateString('it-IT', {
            weekday: 'long', day: 'numeric', month: 'long',
            hour: '2-digit', minute: '2-digit',
        })

        await Promise.allSettled(
            userIds.map(uid =>
                pushToUser(uid, {
                    title: 'Lurumi — Promemoria corso',
                    body: `"${event.title}" inizia domani ${dateStr}`,
                    url: '/eventi',
                    tag: `reminder-${event.id}`,
                })
            )
        )

        sent += userIds.length
    }

    return NextResponse.json({ sent, events: events.length })
}
