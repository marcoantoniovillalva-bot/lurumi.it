import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendNewsletterEmail } from '@/lib/resend'

/**
 * GET /api/cron/email-sequences
 * Cron giornaliero (09:00 UTC) — gestisce le sequenze nurturing email:
 * 1. Processa enrollment attivi con next_send_at <= NOW()
 * 2. Rileva utenti inattivi 14 giorni → enrolla in sequenza inactive_14d
 * 3. Rileva utenti mai prenotati dopo 7 giorni → enrolla in sequenza never_booked_7d
 */
export async function GET(req: NextRequest) {
    // Vercel Cron invia automaticamente Authorization: Bearer <CRON_SECRET>
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret) {
        const authHeader = req.headers.get('authorization')
        if (authHeader !== `Bearer ${cronSecret}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
    }

    const db = createServiceClient()
    const now = new Date().toISOString()
    const results = { processed: 0, sent: 0, errors: 0, enrolled_inactive: 0, enrolled_never_booked: 0 }

    try {
        // ── 1. Processa enrollment attivi ───────────────────────────
        const { data: enrollments } = await db
            .from('email_sequence_enrollments')
            .select('*, email_sequences(id, name, trigger_type)')
            .eq('status', 'active')
            .lte('next_send_at', now)
            .limit(500)

        for (const enrollment of enrollments ?? []) {
            results.processed++

            // Fetch step corrente
            const { data: steps } = await db
                .from('email_sequence_steps')
                .select('*')
                .eq('sequence_id', enrollment.sequence_id)
                .eq('is_active', true)
                .order('step_order', { ascending: true })

            const step = steps?.[enrollment.current_step]

            if (!step) {
                // Nessuno step → sequenza completata
                await db
                    .from('email_sequence_enrollments')
                    .update({ status: 'completed' })
                    .eq('id', enrollment.id)
                continue
            }

            // Fetch profilo per gender e opt-in
            const { data: profile } = await db
                .from('profiles')
                .select('gender, newsletter_opt_in')
                .eq('id', enrollment.user_id)
                .single()

            // Rispetta preferenze email
            if (!profile?.newsletter_opt_in) {
                await db
                    .from('email_sequence_enrollments')
                    .update({ status: 'unsubscribed' })
                    .eq('id', enrollment.id)
                continue
            }

            // Invia email
            try {
                // Estrai firstName dalla email come fallback
                const emailParts = enrollment.user_email.split('@')[0]
                await sendNewsletterEmail(
                    enrollment.user_email,
                    step.subject,
                    step.body_html,
                    emailParts || undefined,
                    profile?.gender ?? undefined,
                )
                results.sent++
                await db.from('email_send_logs').insert({
                    sequence_step_id: step.id,
                    user_id: enrollment.user_id,
                    user_email: enrollment.user_email,
                    subject: step.subject,
                    status: 'sent',
                })
            } catch (e: any) {
                results.errors++
                await db.from('email_send_logs').insert({
                    sequence_step_id: step.id,
                    user_id: enrollment.user_id,
                    user_email: enrollment.user_email,
                    subject: step.subject,
                    status: 'failed',
                    error: e.message,
                })
            }

            // Avanza al prossimo step
            const nextStep = steps?.[enrollment.current_step + 1]
            if (nextStep) {
                const nextSendAt = new Date(Date.now() + nextStep.delay_days * 86_400_000).toISOString()
                await db
                    .from('email_sequence_enrollments')
                    .update({ current_step: enrollment.current_step + 1, next_send_at: nextSendAt })
                    .eq('id', enrollment.id)
            } else {
                await db
                    .from('email_sequence_enrollments')
                    .update({ status: 'completed' })
                    .eq('id', enrollment.id)
            }
        }

        // ── 2. Utenti inattivi da 14 giorni ─────────────────────────
        const { data: inactiveSeq } = await db
            .from('email_sequences')
            .select('id')
            .eq('trigger_type', 'inactive_14d')
            .eq('is_active', true)
            .limit(1)
            .single()

        if (inactiveSeq) {
            const cutoff14d = new Date(Date.now() - 14 * 86_400_000).toISOString()
            // Trova utenti la cui ultima sessione è > 14 giorni fa
            const { data: recentSessions } = await db
                .from('user_sessions')
                .select('user_id')
                .gte('started_at', cutoff14d)
            const activeUserIds = new Set((recentSessions ?? []).map((s: any) => s.user_id))

            const { data: allProfiles } = await db
                .from('profiles')
                .select('id')
                .eq('newsletter_opt_in', true)

            const { data: authUsers } = await db.auth.admin.listUsers({ perPage: 1000 })
            const emailMap = new Map<string, string>()
            ;(authUsers?.users ?? []).forEach((u: any) => { if (u.email) emailMap.set(u.id, u.email) })

            const { data: firstStepData } = await db
                .from('email_sequence_steps')
                .select('delay_days')
                .eq('sequence_id', inactiveSeq.id)
                .eq('is_active', true)
                .order('step_order', { ascending: true })
                .limit(1)
                .single()

            const delayDays = firstStepData?.delay_days ?? 0
            const nextSendAt = new Date(Date.now() + delayDays * 86_400_000).toISOString()

            const enrollments = (allProfiles ?? [])
                .filter((p: any) => !activeUserIds.has(p.id) && emailMap.has(p.id))
                .map((p: any) => ({
                    user_id: p.id,
                    user_email: emailMap.get(p.id)!,
                    sequence_id: inactiveSeq.id,
                    current_step: 0,
                    next_send_at: nextSendAt,
                    status: 'active',
                }))

            if (enrollments.length) {
                const { error } = await db
                    .from('email_sequence_enrollments')
                    .upsert(enrollments, { onConflict: 'user_id,sequence_id', ignoreDuplicates: true })
                if (!error) results.enrolled_inactive = enrollments.length
            }
        }

        // ── 3. Utenti mai prenotati dopo 7 giorni ───────────────────
        const { data: neverBookedSeq } = await db
            .from('email_sequences')
            .select('id')
            .eq('trigger_type', 'never_booked_7d')
            .eq('is_active', true)
            .limit(1)
            .single()

        if (neverBookedSeq) {
            const cutoff7d = new Date(Date.now() - 7 * 86_400_000).toISOString()

            // Profili creati > 7 giorni fa
            const { data: oldProfiles } = await db
                .from('profiles')
                .select('id')
                .eq('newsletter_opt_in', true)
                .lt('created_at', cutoff7d)

            if (oldProfiles?.length) {
                // Trova chi ha già prenotato
                const { data: bookers } = await db
                    .from('event_bookings')
                    .select('user_id')
                    .eq('status', 'confirmed')
                    .in('user_id', oldProfiles.map((p: any) => p.id))

                const bookerIds = new Set((bookers ?? []).map((b: any) => b.user_id))

                const { data: authUsers } = await db.auth.admin.listUsers({ perPage: 1000 })
                const emailMap = new Map<string, string>()
                ;(authUsers?.users ?? []).forEach((u: any) => { if (u.email) emailMap.set(u.id, u.email) })

                const { data: firstStepData } = await db
                    .from('email_sequence_steps')
                    .select('delay_days')
                    .eq('sequence_id', neverBookedSeq.id)
                    .eq('is_active', true)
                    .order('step_order', { ascending: true })
                    .limit(1)
                    .single()

                const delayDays = firstStepData?.delay_days ?? 0
                const nextSendAt = new Date(Date.now() + delayDays * 86_400_000).toISOString()

                const enrollments = oldProfiles
                    .filter((p: any) => !bookerIds.has(p.id) && emailMap.has(p.id))
                    .map((p: any) => ({
                        user_id: p.id,
                        user_email: emailMap.get(p.id)!,
                        sequence_id: neverBookedSeq.id,
                        current_step: 0,
                        next_send_at: nextSendAt,
                        status: 'active',
                    }))

                if (enrollments.length) {
                    const { error } = await db
                        .from('email_sequence_enrollments')
                        .upsert(enrollments, { onConflict: 'user_id,sequence_id', ignoreDuplicates: true })
                    if (!error) results.enrolled_never_booked = enrollments.length
                }
            }
        }

        return NextResponse.json({ ok: true, ...results })
    } catch (error: any) {
        console.error('[Cron email-sequences]', error)
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }
}
