'use server'

import { createServiceClient } from '@/lib/supabase/server'
import { pushToAdmins } from '@/lib/webpush'

export async function submitBugReport(
    userId: string | null,
    description: string,
    steps: string | null,
    userAgent: string,
) {
    const db = createServiceClient()
    const { error } = await db.from('bug_reports').insert({
        user_id: userId,
        description,
        steps,
        user_agent: userAgent,
    })
    if (error) throw new Error(error.message)

    pushToAdmins({
        title: 'Lurumi — Nuova segnalazione bug',
        body: description.slice(0, 100),
        url: '/admin',
        tag: 'bug-report',
    }).catch(() => {})
}
