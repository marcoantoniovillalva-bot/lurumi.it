'use server'

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { pushToUser, pushToAdmins, pushToAllUsers, pushToConfirmedBookers } from '@/lib/webpush'
import { invalidateAiStatusCache } from '@/lib/ai-status'
import { enrollAllActiveUsersInSequence } from '@/lib/email-triggers'

async function assertAdmin() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Non autenticato')
    const { data: profile } = await supabase
        .from('profiles').select('is_admin').eq('id', user.id).single()
    if (!profile?.is_admin) throw new Error('Non autorizzato')
    return { user, db: createServiceClient() }
}

export interface EventFormData {
    title: string
    description: string
    image_url: string
    image_urls: string[]
    cost: number
    event_date: string
    access_link: string
    max_participants: number | null
    is_active: boolean
    duration_minutes: number | null
}

export async function createEvent(data: EventFormData) {
    const { db } = await assertAdmin()
    const { data: event, error } = await db.from('events').insert(data).select().single()
    if (error) throw new Error(error.message)

    // Notifica tutti gli utenti del nuovo evento
    pushToAllUsers({
        title: 'Lurumi — Nuovo corso disponibile!',
        body: `"${data.title}" è stato appena pubblicato`,
        url: '/eventi',
        tag: `new-event-${event.id}`,
    }).catch(() => {})

    // Enrollment sequenza email new_event
    enrollAllActiveUsersInSequence('new_event', { title: data.title }).catch(() => {})

    return event
}

export async function updateEvent(id: string, data: Partial<EventFormData> & { is_active?: boolean }) {
    const { db } = await assertAdmin()

    // Se l'evento viene disattivato, notifica i prenotati
    if (data.is_active === false) {
        const { data: ev } = await db.from('events').select('title').eq('id', id).single()
        if (ev) {
            pushToConfirmedBookers(id, {
                title: 'Lurumi — Evento cancellato',
                body: `Il corso "${ev.title}" è stato cancellato. Il tuo credito verrà rimborsato.`,
                url: '/eventi',
                tag: `event-cancelled-${id}`,
            }).catch(() => {})
        }
    }

    const { error } = await db.from('events').update(data).eq('id', id)
    if (error) throw new Error(error.message)
}

export async function deleteEvent(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
    try {
        const { db } = await assertAdmin()

        // Fetch event to check date and title
        const { data: ev } = await db.from('events').select('title, event_date').eq('id', id).single()

        // Only block deletion if event is in the future AND has confirmed bookings
        const isPast = ev ? new Date(ev.event_date) < new Date() : false
        if (!isPast) {
            const { count } = await db
                .from('event_bookings')
                .select('*', { count: 'exact', head: true })
                .eq('event_id', id)
                .eq('status', 'confirmed')
            if (count && count > 0) {
                return { ok: false, error: `Ci sono ${count} prenotazioni attive. Cancella prima le prenotazioni o attendi che l'evento si svolga.` }
            }
        }

        if (ev) {
            pushToConfirmedBookers(id, {
                title: 'Lurumi — Evento eliminato',
                body: `Il corso "${ev.title}" è stato rimosso.`,
                url: '/eventi',
                tag: `event-deleted-${id}`,
            }).catch(() => {})
        }

        // Elimina prima le righe figlie per evitare conflitto con il trigger sync_event_booking_count:
        // durante CASCADE delete, il trigger tenta UPDATE sulla riga evento già bloccata.
        await db.from('event_interests').delete().eq('event_id', id)
        await db.from('event_bookings').delete().eq('event_id', id)

        const { error } = await db.from('events').delete().eq('id', id)
        if (error) return { ok: false, error: error.message }

        return { ok: true }
    } catch (e: any) {
        return { ok: false, error: e?.message ?? 'Errore sconosciuto durante l\'eliminazione.' }
    }
}

export async function getEventBookers(eventId: string) {
    const { db } = await assertAdmin()
    const { data } = await db
        .from('event_bookings')
        .select('id, user_email, amount_paid, credit_used, status, created_at')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false })
    return data ?? []
}

export async function getEventInterests(eventId: string) {
    const { db } = await assertAdmin()
    const { data } = await db
        .from('event_interests')
        .select('id, user_email, preferred_date, message, created_at')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false })
    return data ?? []
}

export async function getAdminStats() {
    const { db } = await assertAdmin()

    const [usersRes, premiumRes, todayRes, avgRes, peakRes] = await Promise.all([
        db.from('profiles').select('*', { count: 'exact', head: true }),
        db.from('profiles').select('*', { count: 'exact', head: true }).eq('tier', 'premium'),
        db.from('user_sessions').select('*', { count: 'exact', head: true })
            .gte('started_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
        db.from('user_sessions').select('duration_seconds').not('duration_seconds', 'is', null).limit(2000),
        db.from('user_sessions').select('started_at')
            .gte('started_at', new Date(Date.now() - 7 * 86_400_000).toISOString()),
    ])

    const durations = (avgRes.data ?? []).map(r => r.duration_seconds as number)
    const avgSeconds = durations.length > 0
        ? Math.round(durations.reduce((s, d) => s + d, 0) / durations.length)
        : 0

    const hours = Array(24).fill(0) as number[]
    ;(peakRes.data ?? []).forEach(r => {
        const h = new Date(r.started_at).getHours()
        hours[h]++
    })

    return {
        totalUsers: usersRes.count ?? 0,
        premiumCount: premiumRes.count ?? 0,
        todaySessions: todayRes.count ?? 0,
        avgMinutes: Math.round(avgSeconds / 60),
        peakHours: hours,
    }
}

export async function getAdminEvents() {
    const { db } = await assertAdmin()
    const { data: events } = await db
        .from('events')
        .select('*')
        .order('event_date', { ascending: false })

    if (!events || events.length === 0) return []

    // Conta SOLO le prenotazioni confermate (esclude le disdette)
    const countResults = await Promise.all(
        events.map(ev =>
            db.from('event_bookings')
                .select('*', { count: 'exact', head: true })
                .eq('event_id', ev.id)
                .eq('status', 'confirmed')
                .then(({ count }) => ({ id: ev.id, count: count ?? 0 }))
        )
    )

    return events.map(ev => ({
        ...ev,
        confirmed_count: countResults.find(c => c.id === ev.id)?.count ?? 0,
    }))
}

/* ─── Gestione Admin Utenti ──────────────────────────────────── */

export interface UserProfile {
    id: string
    email: string | null
    tier: string
    is_admin: boolean
    event_credit: number
    ai_credits_used: number
    ai_credits_reset_at: string | null
    created_at: string
}

export async function listAllUsers(): Promise<UserProfile[]> {
    const { db } = await assertAdmin()
    // Leggo profiles + email da auth.users via service role
    const { data: profiles } = await db
        .from('profiles')
        .select('id, tier, is_admin, event_credit, ai_credits_used, ai_credits_reset_at, created_at')
        .order('created_at', { ascending: false })
        .limit(200)

    if (!profiles || profiles.length === 0) return []

    // Prendo le email in batch tramite admin API
    const { data: authUsers } = await db.auth.admin.listUsers({ perPage: 1000 })
    const emailMap = new Map<string, string>()
    ;(authUsers?.users ?? []).forEach(u => emailMap.set(u.id, u.email ?? ''))

    return profiles.map(p => ({
        id: p.id,
        email: emailMap.get(p.id) ?? null,
        tier: p.tier ?? 'free',
        is_admin: p.is_admin ?? false,
        event_credit: Number(p.event_credit ?? 0),
        ai_credits_used: Number(p.ai_credits_used ?? 0),
        ai_credits_reset_at: p.ai_credits_reset_at ?? null,
        created_at: p.created_at,
    }))
}

export async function setUserEventCredit(userId: string, amount: number) {
    const { db } = await assertAdmin()
    const { data: current } = await db
        .from('profiles').select('event_credit').eq('id', userId).single()
    const { error } = await db
        .from('profiles')
        .update({ event_credit: amount })
        .eq('id', userId)
    if (error) throw new Error(error.message)

    const prev = Number(current?.event_credit ?? 0)
    const diff = amount - prev
    if (diff > 0) {
        pushToUser(userId, {
            title: 'Lurumi — Credito ricevuto!',
            body: `Hai ricevuto €${diff.toFixed(2)} di credito per i corsi`,
            url: '/eventi',
            tag: 'credit-received',
        }).catch(() => {})
    }
}

/* ─── Gestione Crediti AI ────────────────────────────────────── */

export async function resetUserAiCredits(userId: string) {
    const { db } = await assertAdmin()
    const { error } = await db
        .from('profiles')
        .update({ ai_credits_used: 0, ai_credits_reset_at: new Date().toISOString() })
        .eq('id', userId)
    if (error) throw new Error(error.message)
    pushToUser(userId, {
        title: 'Lurumi — Crediti AI ripristinati!',
        body: 'I tuoi crediti AI mensili sono stati resettati dall\'admin.',
        url: '/profilo',
        tag: 'ai-credits-reset',
    }).catch(() => {})
}

export async function grantBonusAiCredits(userId: string, bonusCredits: number) {
    const { db } = await assertAdmin()
    const { data: current } = await db
        .from('profiles')
        .select('ai_credits_used')
        .eq('id', userId)
        .single()
    const currentUsed = Number(current?.ai_credits_used ?? 0)
    const newUsed = Math.max(0, currentUsed - bonusCredits)
    const { error } = await db
        .from('profiles')
        .update({ ai_credits_used: newUsed })
        .eq('id', userId)
    if (error) throw new Error(error.message)
    pushToUser(userId, {
        title: 'Lurumi — Crediti AI bonus!',
        body: `Hai ricevuto ${bonusCredits} crediti AI extra dall'admin.`,
        url: '/profilo',
        tag: 'ai-credits-bonus',
    }).catch(() => {})
}

/* ─── Messaggi interesse (chat admin↔utente) ─────────────────── */

export async function getInterestMessages(interestId: string) {
    const { db } = await assertAdmin()
    const { data } = await db
        .from('interest_messages')
        .select('id, sender_role, content, created_at')
        .eq('interest_id', interestId)
        .order('created_at', { ascending: true })
    return data ?? []
}

export async function sendAdminMessage(interestId: string, content: string) {
    const { user, db } = await assertAdmin()
    const { error } = await db.from('interest_messages').insert({
        interest_id: interestId,
        sender_id: user.id,
        sender_role: 'admin',
        content: content.trim(),
    })
    if (error) throw new Error(error.message)

    // Push notification to the interest owner
    const { data: interest } = await db
        .from('event_interests')
        .select('user_id')
        .eq('id', interestId)
        .single()
    if (interest?.user_id) {
        pushToUser(interest.user_id, {
            title: 'Lurumi — Risposta organizzatore',
            body: content.trim().slice(0, 100),
            url: '/eventi',
            tag: `interest-${interestId}`,
        }).catch(() => {})
    }

    return { success: true }
}

export async function setUserAdmin(userId: string, isAdmin: boolean) {
    const { db } = await assertAdmin()
    const { error } = await db
        .from('profiles')
        .update({ is_admin: isAdmin })
        .eq('id', userId)
    if (error) throw new Error(error.message)
}

/* ─── Costi AI ───────────────────────────────────────────────── */

export interface AiSpendingSummary {
    today: number
    thisMonth: number
    allTime: number
    byProvider: Array<{ provider: string; total: number; count: number }>
}

export interface AiDeposit {
    id: string
    amount_usd: number
    provider: string
    note: string | null
    created_at: string
}

export async function getAiSpendingSummary(): Promise<AiSpendingSummary> {
    const { db } = await assertAdmin()

    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)

    const [{ data: monthly }, { data: todayData }, { data: allTimeData }] = await Promise.all([
        db.from('ai_generations').select('provider, cost_usd').gte('created_at', startOfMonth.toISOString()),
        db.from('ai_generations').select('cost_usd').gte('created_at', startOfDay.toISOString()),
        db.from('ai_generations').select('cost_usd'),
    ])

    const byProvider: Record<string, { total: number; count: number }> = {}
    for (const row of monthly ?? []) {
        if (!byProvider[row.provider]) byProvider[row.provider] = { total: 0, count: 0 }
        byProvider[row.provider].total += Number(row.cost_usd ?? 0)
        byProvider[row.provider].count++
    }

    return {
        today: (todayData ?? []).reduce((s: number, r: any) => s + Number(r.cost_usd ?? 0), 0),
        thisMonth: (monthly ?? []).reduce((s: number, r: any) => s + Number(r.cost_usd ?? 0), 0),
        allTime: (allTimeData ?? []).reduce((s: number, r: any) => s + Number(r.cost_usd ?? 0), 0),
        byProvider: Object.entries(byProvider)
            .map(([provider, v]) => ({ provider, total: v.total, count: v.count }))
            .sort((a, b) => b.total - a.total),
    }
}

export async function getAdminSettings(): Promise<Record<string, string>> {
    const { db } = await assertAdmin()
    const { data } = await db.from('admin_settings').select('key, value')
    return Object.fromEntries((data ?? []).map((r: any) => [r.key, r.value]))
}

export async function setAdminSetting(key: string, value: string): Promise<void> {
    const { db } = await assertAdmin()
    const { error } = await db
        .from('admin_settings')
        .upsert({ key, value, updated_at: new Date().toISOString() })
    if (error) throw new Error(error.message)
    if (key === 'ai_disabled') invalidateAiStatusCache()
}

export async function getAiDeposits(): Promise<AiDeposit[]> {
    const { db } = await assertAdmin()
    const { data } = await db
        .from('ai_deposits')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10)
    return (data ?? []) as AiDeposit[]
}

export async function addAiDeposit(amount_usd: number, provider: string, note: string): Promise<void> {
    const { db } = await assertAdmin()
    const { error } = await db.from('ai_deposits').insert({ amount_usd, provider, note })
    if (error) throw new Error(error.message)
    // Dopo una ricarica, riabilita l'AI se era stata disabilitata
    await db
        .from('admin_settings')
        .upsert({ key: 'ai_disabled', value: 'false', updated_at: new Date().toISOString() })
    invalidateAiStatusCache()
}

// ── Sistema di supporto ticket ────────────────────────────────────────────────

export interface BugReport {
    id: string
    user_id: string | null
    user_email: string | null
    description: string
    steps: string | null
    status: string
    created_at: string
}

export interface SupportMessage {
    id: string
    bug_report_id: string
    sender_type: 'user' | 'admin'
    sender_id: string | null
    content: string
    created_at: string
}

/** Restituisce tutte le segnalazioni bug (admin) */
export async function getAllBugReports(): Promise<BugReport[]> {
    const { db } = await assertAdmin()
    const { data } = await db
        .from('bug_reports')
        .select('id, user_id, user_email, description, steps, status, created_at')
        .order('status', { ascending: true })   // 'closed' dopo 'open'
        .order('created_at', { ascending: false })
    return (data ?? []) as BugReport[]
}

/** Restituisce i messaggi di una segnalazione (admin) */
export async function getAdminSupportMessages(bugReportId: string): Promise<SupportMessage[]> {
    const { db } = await assertAdmin()
    const { data } = await db
        .from('support_messages')
        .select('*')
        .eq('bug_report_id', bugReportId)
        .order('created_at', { ascending: true })
    return (data ?? []) as SupportMessage[]
}

/** Admin invia un messaggio di risposta */
export async function sendAdminSupportReply(bugReportId: string, content: string) {
    const { user, db } = await assertAdmin()

    const { data: report } = await db
        .from('bug_reports')
        .select('user_id')
        .eq('id', bugReportId)
        .single()

    const { error } = await db.from('support_messages').insert({
        bug_report_id: bugReportId,
        sender_type: 'admin',
        sender_id: user.id,
        content,
    })
    if (error) throw new Error(error.message)

    if (report?.user_id) {
        pushToUser(report.user_id, {
            title: 'Lurumi — Risposta dal supporto',
            body: content.slice(0, 100),
            url: '/support',
            tag: `support-admin-${bugReportId}`,
        }).catch(() => {})
    }
}

/** Cambia lo stato di una segnalazione (open/closed) */
export async function updateBugReportStatus(bugReportId: string, status: 'open' | 'closed') {
    const { db } = await assertAdmin()
    const { error } = await db
        .from('bug_reports')
        .update({ status })
        .eq('id', bugReportId)
    if (error) throw new Error(error.message)
}

