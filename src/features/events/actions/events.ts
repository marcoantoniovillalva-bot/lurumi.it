'use server'

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { pushToAdmins, checkAndNotifyAlmostFull } from '@/lib/webpush'
import { enrollUserInSequence } from '@/lib/email-triggers'

export async function bookEventWithCredit(eventId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    const serviceSupabase = createServiceClient()

    const [eventRes, profileRes] = await Promise.all([
        serviceSupabase.from('events').select('*').eq('id', eventId).single(),
        serviceSupabase.from('profiles').select('event_credit').eq('id', user.id).single(),
    ])

    const event = eventRes.data
    const profile = profileRes.data
    if (!event || !event.is_active) throw new Error('Evento non trovato o non disponibile')
    if (!profile) throw new Error('Profilo non trovato')

    const credit = Number(profile.event_credit ?? 0)
    const cost = Number(event.cost ?? 0)

    if (credit < cost) throw new Error('Credito insufficiente')

    // Controlla posti disponibili
    if (event.max_participants) {
        const { count } = await serviceSupabase
            .from('event_bookings')
            .select('*', { count: 'exact', head: true })
            .eq('event_id', eventId)
            .eq('status', 'confirmed')
        if (count !== null && count >= event.max_participants) throw new Error('Posti esauriti')
    }

    const { error: bookingErr } = await serviceSupabase
        .from('event_bookings')
        .insert({
            event_id: eventId,
            user_id: user.id,
            user_email: user.email,
            amount_paid: 0,
            credit_used: cost,
            status: 'confirmed',
            stripe_session_id: null,
        })

    if (bookingErr) {
        if (bookingErr.code === '23505') throw new Error('Hai già prenotato questo evento')
        throw new Error('Errore durante la prenotazione')
    }

    const { error: creditErr } = await serviceSupabase
        .from('profiles')
        .update({ event_credit: credit - cost })
        .eq('id', user.id)

    if (creditErr) {
        // Rollback booking
        await serviceSupabase.from('event_bookings')
            .delete().eq('event_id', eventId).eq('user_id', user.id)
        throw new Error('Errore aggiornamento credito')
    }

    // Notifica admin della nuova prenotazione
    pushToAdmins({
        title: 'Lurumi — Nuova prenotazione',
        body: `${user.email ?? 'Un utente'} ha prenotato "${event.title}"`,
        url: '/admin',
        tag: `booking-${eventId}`,
    }).catch(() => {})

    // Controlla e notifica se i posti sono quasi esauriti
    checkAndNotifyAlmostFull(eventId).catch(() => {})

    // Enrollment nella sequenza nurturing event_booked
    if (user.email) {
        enrollUserInSequence(user.id, user.email, 'event_booked', { event_id: eventId }).catch(() => {})
    }

    return { success: true }
}

export async function cancelBooking(bookingId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    const serviceSupabase = createServiceClient()

    const { data: booking } = await serviceSupabase
        .from('event_bookings')
        .select('*, events(event_date)')
        .eq('id', bookingId)
        .eq('user_id', user.id)
        .single()

    if (!booking) throw new Error('Prenotazione non trovata')
    if (booking.status !== 'confirmed') throw new Error('Prenotazione già cancellata')

    const eventDate = new Date((booking.events as any).event_date)
    const hoursUntil = (eventDate.getTime() - Date.now()) / 3_600_000
    if (hoursUntil < 24) throw new Error('Non puoi cancellare entro 24 ore dall\'evento')

    const refundCredit = Number(booking.amount_paid) + Number(booking.credit_used)

    const { error } = await serviceSupabase
        .from('event_bookings')
        .update({ status: 'cancelled' })
        .eq('id', bookingId)

    if (error) throw new Error('Errore cancellazione')

    const { data: profileData } = await serviceSupabase
        .from('profiles').select('event_credit').eq('id', user.id).single()

    const currentCredit = Number(profileData?.event_credit ?? 0)
    await serviceSupabase
        .from('profiles')
        .update({ event_credit: currentCredit + refundCredit })
        .eq('id', user.id)

    return { success: true, creditAdded: refundCredit }
}

export async function submitEventInterest(eventId: string, preferredDate: string, message: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const serviceSupabase = createServiceClient()
    const { data, error } = await serviceSupabase
        .from('event_interests')
        .insert({
            event_id: eventId,
            user_id: user?.id ?? null,
            user_email: user?.email ?? null,
            preferred_date: preferredDate.trim() || null,
            message: message.trim() || null,
        })
        .select('id')
        .single()

    if (error) throw new Error('Errore nel salvataggio dell\'interesse')
    return { success: true, interestId: data.id as string }
}

export async function getMyEventInterests() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []
    const { data } = await supabase
        .from('event_interests')
        .select('id, event_id, preferred_date, message, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
    return (data ?? []) as { id: string; event_id: string; preferred_date: string | null; message: string | null; created_at: string }[]
}

export async function getUserInterestMessages(interestId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Non autenticato')
    // RLS garantisce che l'utente veda solo i messaggi del suo interesse
    const { data } = await supabase
        .from('interest_messages')
        .select('id, sender_role, content, created_at')
        .eq('interest_id', interestId)
        .order('created_at', { ascending: true })
    return (data ?? []) as { id: string; sender_role: string; content: string; created_at: string }[]
}

export async function sendUserMessage(interestId: string, content: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Non autenticato')

    const serviceSupabase = createServiceClient()
    // Verifica ownership dell'interesse
    const { data: interest } = await serviceSupabase
        .from('event_interests')
        .select('id')
        .eq('id', interestId)
        .eq('user_id', user.id)
        .single()
    if (!interest) throw new Error('Non autorizzato')

    const { error } = await serviceSupabase.from('interest_messages').insert({
        interest_id: interestId,
        sender_id: user.id,
        sender_role: 'user',
        content: content.trim(),
    })
    if (error) throw new Error(error.message)

    // Push notification to all admins
    pushToAdmins({
        title: 'Lurumi — Nuovo messaggio utente',
        body: content.trim().slice(0, 100),
        url: '/admin',
        tag: `interest-${interestId}`,
    }).catch(() => {})

    return { success: true }
}
