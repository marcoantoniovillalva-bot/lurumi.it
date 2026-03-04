import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendNewsletterEmail } from '@/lib/resend'

/**
 * POST /api/email/newsletter
 * Admin-only: invia una newsletter a tutti gli utenti con newsletter_opt_in = true.
 * Body: { subject: string, bodyHtml: string, target: 'newsletter' | 'marketing' | 'all' }
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()

  // Auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Admin check
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { subject, bodyHtml, target = 'newsletter' } = await req.json() as {
    subject: string
    bodyHtml: string
    target?: 'newsletter' | 'marketing' | 'all'
  }

  if (!subject || !bodyHtml) {
    return NextResponse.json({ error: 'subject e bodyHtml sono obbligatori' }, { status: 400 })
  }

  // Fetch destinatari in base al target
  let query = supabase.from('profiles').select('id')
  if (target === 'newsletter') query = query.eq('newsletter_opt_in', true)
  else if (target === 'marketing') query = query.eq('marketing_opt_in', true)
  // 'all' → nessun filtro (solo chi ha almeno newsletter o marketing)
  else query = query.or('newsletter_opt_in.eq.true,marketing_opt_in.eq.true')

  const { data: profiles, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (!profiles?.length) {
    return NextResponse.json({ sent: 0, message: 'Nessun destinatario trovato' })
  }

  // Recupera le email da auth.users via service role
  const { data: authUsers } = await supabase.auth.admin.listUsers({ perPage: 1000 })
  const profileIds = new Set(profiles.map(p => p.id))
  const recipients = authUsers?.users?.filter(u => profileIds.has(u.id) && u.email) ?? []

  // Invio batch (Resend consente max 100 per chiamata — qui inviamo singolarmente)
  let sent = 0
  const errors: string[] = []

  for (const recipient of recipients) {
    if (!recipient.email) continue
    try {
      await sendNewsletterEmail(recipient.email, subject, bodyHtml)
      sent++
    } catch (e) {
      errors.push(recipient.email)
    }
  }

  return NextResponse.json({ sent, total: recipients.length, errors })
}
