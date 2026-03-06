import { createServiceClient } from '@/lib/supabase/server'

/**
 * Enrolla un singolo utente nella sequenza email attiva per il trigger specificato.
 * Se non esiste una sequenza attiva con quel trigger_type → silenzioso.
 * Il constraint UNIQUE(user_id, sequence_id) previene enrollment duplicati.
 */
export async function enrollUserInSequence(
    userId: string,
    userEmail: string,
    triggerType: string,
    metadata?: Record<string, unknown>,
): Promise<void> {
    try {
        const db = createServiceClient()

        // Cerca sequenza attiva per questo trigger
        const { data: seq } = await db
            .from('email_sequences')
            .select('id')
            .eq('trigger_type', triggerType)
            .eq('is_active', true)
            .limit(1)
            .single()

        if (!seq) return

        // Fetch primo step per calcolare next_send_at
        const { data: firstStep } = await db
            .from('email_sequence_steps')
            .select('delay_days')
            .eq('sequence_id', seq.id)
            .eq('is_active', true)
            .order('step_order', { ascending: true })
            .limit(1)
            .single()

        const delayDays = firstStep?.delay_days ?? 0
        const nextSendAt = new Date(Date.now() + delayDays * 86_400_000).toISOString()

        await db.from('email_sequence_enrollments').upsert(
            {
                user_id: userId,
                user_email: userEmail,
                sequence_id: seq.id,
                current_step: 0,
                next_send_at: nextSendAt,
                status: 'active',
                metadata: metadata ?? null,
            },
            { onConflict: 'user_id,sequence_id', ignoreDuplicates: true },
        )
    } catch {
        // Fire-and-forget: errori ignorati per non bloccare il flusso principale
    }
}

/**
 * Enrolla tutti gli utenti con newsletter_opt_in = true nella sequenza attiva
 * per il trigger specificato. Usato per trigger globali (new_event, new_library_item,
 * manual_youtube, manual_update).
 */
export async function enrollAllActiveUsersInSequence(
    triggerType: string,
    metadata?: Record<string, unknown>,
): Promise<void> {
    try {
        const db = createServiceClient()

        const { data: seq } = await db
            .from('email_sequences')
            .select('id')
            .eq('trigger_type', triggerType)
            .eq('is_active', true)
            .limit(1)
            .single()

        if (!seq) return

        const { data: firstStep } = await db
            .from('email_sequence_steps')
            .select('delay_days')
            .eq('sequence_id', seq.id)
            .eq('is_active', true)
            .order('step_order', { ascending: true })
            .limit(1)
            .single()

        const delayDays = firstStep?.delay_days ?? 0
        const nextSendAt = new Date(Date.now() + delayDays * 86_400_000).toISOString()

        // Fetch utenti opt-in con email da auth
        const { data: profiles } = await db
            .from('profiles')
            .select('id')
            .eq('newsletter_opt_in', true)

        if (!profiles?.length) return

        const { data: authUsers } = await db.auth.admin.listUsers({ perPage: 1000 })
        const emailMap = new Map<string, string>()
        ;(authUsers?.users ?? []).forEach(u => { if (u.email) emailMap.set(u.id, u.email) })

        const enrollments = profiles
            .filter(p => emailMap.has(p.id))
            .map(p => ({
                user_id: p.id,
                user_email: emailMap.get(p.id)!,
                sequence_id: seq.id,
                current_step: 0,
                next_send_at: nextSendAt,
                status: 'active',
                metadata: metadata ?? null,
            }))

        if (!enrollments.length) return

        // Batch insert, duplicati ignorati grazie al UNIQUE constraint
        await db.from('email_sequence_enrollments').upsert(
            enrollments,
            { onConflict: 'user_id,sequence_id', ignoreDuplicates: true },
        )
    } catch {
        // Fire-and-forget
    }
}
