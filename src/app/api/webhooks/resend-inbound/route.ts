import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { pushToAdmins } from '@/lib/webpush'

/**
 * POST /api/webhooks/resend-inbound
 * Riceve email in entrata da Resend Inbound (utenti che scrivono a supporto@lurumi.it).
 *
 * Setup richiesto (da fare manualmente):
 * 1. Resend Dashboard → Inbound → Add domain → lurumi.it
 * 2. Webhook URL: https://www.lurumi.it/api/webhooks/resend-inbound
 * 3. IONOS: aggiungere record MX → inbound.resend.com (priorità 10)
 */
export async function POST(req: NextRequest) {
    try {
        const payload = await req.json()

        // Resend Inbound payload structure
        const fromEmail: string = payload.from?.email ?? payload.sender?.email ?? payload.headers?.from ?? ''
        const fromName: string = payload.from?.name ?? payload.sender?.name ?? ''
        const subject: string = payload.subject ?? payload.headers?.subject ?? '(Nessun oggetto)'
        const bodyText: string = payload.text ?? payload.plain ?? ''
        const bodyHtml: string = payload.html ?? ''

        if (!fromEmail) {
            return NextResponse.json({ error: 'Missing from email' }, { status: 400 })
        }

        const db = createServiceClient()

        await db.from('received_emails').insert({
            from_email: fromEmail,
            from_name: fromName || null,
            subject,
            body_text: bodyText || null,
            body_html: bodyHtml || null,
            is_read: false,
        })

        // Push notification agli admin
        pushToAdmins({
            title: 'Lurumi — Nuova email ricevuta',
            body: `Da: ${fromName || fromEmail} — ${subject}`,
            url: '/admin',
            tag: `inbound-${Date.now()}`,
        }).catch(() => {})

        return NextResponse.json({ received: true })
    } catch (error: any) {
        console.error('[Resend Inbound]', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
