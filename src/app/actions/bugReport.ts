'use server'

import { createServiceClient } from '@/lib/supabase/server'
import { pushToAdmins } from '@/lib/webpush'
import { enrollUserInSequence } from '@/lib/email-triggers'

export async function submitBugReport(
    userId: string | null,
    description: string,
    steps: string | null,
    userAgent: string,
    userEmail?: string | null,
): Promise<string | null> {
    const db = createServiceClient()
    const { data, error } = await db.from('bug_reports').insert({
        user_id: userId,
        description,
        steps,
        user_agent: userAgent,
        user_email: userEmail ?? null,
        status: 'open',
    }).select('id').single()

    if (error) throw new Error(error.message)

    pushToAdmins({
        title: 'Lurumi — Nuova segnalazione',
        body: description.slice(0, 100),
        url: '/admin',
        tag: 'bug-report',
    }).catch(() => {})

    // Enrollment sequenza bug_reported
    if (userId && userEmail) {
        enrollUserInSequence(userId, userEmail, 'bug_reported').catch(() => {})
    }

    return data?.id ?? null
}
