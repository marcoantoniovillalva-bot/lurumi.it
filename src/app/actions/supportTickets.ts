'use server'

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { pushToAdmins } from '@/lib/webpush'

/** Invia un messaggio di follow-up su una segnalazione già aperta */
export async function sendUserSupportMessage(bugReportId: string, content: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Non autenticato')

    // Verifica che il ticket appartenga all'utente
    const { data: report } = await supabase
        .from('bug_reports')
        .select('id')
        .eq('id', bugReportId)
        .eq('user_id', user.id)
        .single()
    if (!report) throw new Error('Ticket non trovato')

    const db = createServiceClient()
    const { error } = await db.from('support_messages').insert({
        bug_report_id: bugReportId,
        sender_type: 'user',
        sender_id: user.id,
        content,
    })
    if (error) throw new Error(error.message)

    pushToAdmins({
        title: 'Lurumi — Risposta utente a ticket',
        body: content.slice(0, 100),
        url: '/admin',
        tag: `support-user-${bugReportId}`,
    }).catch(() => {})
}
