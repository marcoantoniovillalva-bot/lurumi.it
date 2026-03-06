'use server'

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { sendNewsletterEmail } from '@/lib/resend'

async function assertAdmin() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Non autenticato')
    const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
    if (!profile?.is_admin) throw new Error('Non autorizzato')
    return createServiceClient()
}

/* ─── Types ─────────────────────────────────────────────────── */

export interface EmailCampaign {
    id: string
    name: string
    subject: string
    body_html: string
    status: 'draft' | 'approved' | 'sending' | 'sent'
    target: 'newsletter' | 'marketing' | 'all'
    recipient_count: number | null
    sent_count: number
    approved_at: string | null
    sent_at: string | null
    created_at: string
    updated_at: string
}

export interface EmailSequence {
    id: string
    name: string
    trigger_type: string
    is_active: boolean
    linked_event_id: string | null
    linked_library_item_id: string | null
    linked_youtube_url: string | null
    linked_entity_title: string | null
    linked_entity_description: string | null
    created_at: string
    updated_at: string
}

export interface EmailSequenceStep {
    id: string
    sequence_id: string
    step_order: number
    delay_days: number
    subject: string
    body_html: string
    is_active: boolean
    created_at: string
}

export interface EmailSendLog {
    id: string
    campaign_id: string | null
    sequence_step_id: string | null
    user_id: string | null
    user_email: string
    subject: string
    status: 'sent' | 'failed'
    error: string | null
    sent_at: string
}

export interface ReceivedEmail {
    id: string
    from_email: string
    from_name: string | null
    subject: string
    body_text: string | null
    body_html: string | null
    is_read: boolean
    received_at: string
}

/* ─── Campagne ──────────────────────────────────────────────── */

export async function getCampaigns(): Promise<EmailCampaign[]> {
    const db = await assertAdmin()
    const { data } = await db
        .from('email_campaigns')
        .select('*')
        .order('created_at', { ascending: false })
    return (data ?? []) as EmailCampaign[]
}

export async function createCampaign(data: { name: string; subject: string; body_html: string; target: string }): Promise<EmailCampaign> {
    const db = await assertAdmin()
    const { data: campaign, error } = await db
        .from('email_campaigns')
        .insert({ ...data, status: 'draft' })
        .select()
        .single()
    if (error) throw new Error(error.message)
    return campaign as EmailCampaign
}

export async function updateCampaign(id: string, data: Partial<{ name: string; subject: string; body_html: string; target: string }>): Promise<void> {
    const db = await assertAdmin()
    const { error } = await db
        .from('email_campaigns')
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq('id', id)
    if (error) throw new Error(error.message)
}

export async function deleteCampaign(id: string): Promise<void> {
    const db = await assertAdmin()
    const { error } = await db.from('email_campaigns').delete().eq('id', id)
    if (error) throw new Error(error.message)
}

export async function approveCampaign(id: string): Promise<{ recipientCount: number }> {
    const db = await assertAdmin()

    // Fetch campaign to know target
    const { data: campaign } = await db.from('email_campaigns').select('target').eq('id', id).single()
    if (!campaign) throw new Error('Campagna non trovata')

    // Count recipients
    let query = db.from('profiles').select('id', { count: 'exact', head: true })
    if (campaign.target === 'newsletter') query = query.eq('newsletter_opt_in', true)
    else if (campaign.target === 'marketing') query = query.eq('marketing_opt_in', true)
    else query = query.or('newsletter_opt_in.eq.true,marketing_opt_in.eq.true')

    const { count } = await query
    const recipientCount = count ?? 0

    await db
        .from('email_campaigns')
        .update({ status: 'approved', recipient_count: recipientCount, updated_at: new Date().toISOString() })
        .eq('id', id)

    return { recipientCount }
}

export async function sendCampaignNow(id: string): Promise<{ sent: number; errors: number }> {
    const db = await assertAdmin()

    const { data: campaign } = await db.from('email_campaigns').select('*').eq('id', id).single()
    if (!campaign) throw new Error('Campagna non trovata')
    if (campaign.status !== 'approved') throw new Error('La campagna deve essere approvata prima dell\'invio')

    await db.from('email_campaigns').update({ status: 'sending', updated_at: new Date().toISOString() }).eq('id', id)

    // Fetch recipients
    let query = db.from('profiles').select('id')
    if (campaign.target === 'newsletter') query = query.eq('newsletter_opt_in', true)
    else if (campaign.target === 'marketing') query = query.eq('marketing_opt_in', true)
    else query = query.or('newsletter_opt_in.eq.true,marketing_opt_in.eq.true')

    const { data: profiles } = await query
    const { data: authUsers } = await db.auth.admin.listUsers({ perPage: 1000 })
    const profileIds = new Set((profiles ?? []).map((p: any) => p.id))
    const recipients = (authUsers?.users ?? []).filter(u => profileIds.has(u.id) && u.email)

    // Fetch gender per personalizzazione
    const { data: genderData } = await db.from('profiles').select('id, gender').in('id', Array.from(profileIds))
    const genderMap = new Map<string, string>()
    ;(genderData ?? []).forEach((p: any) => { if (p.gender) genderMap.set(p.id, p.gender) })

    let sent = 0
    let errors = 0
    const logs: any[] = []

    for (const recipient of recipients) {
        if (!recipient.email) continue
        const firstName = (recipient.user_metadata?.full_name as string | undefined)?.split(' ')[0]
            || (recipient.user_metadata?.name as string | undefined)?.split(' ')[0]
        const gender = genderMap.get(recipient.id)
        try {
            await sendNewsletterEmail(recipient.email, campaign.subject, campaign.body_html, firstName, gender)
            sent++
            logs.push({ campaign_id: id, user_id: recipient.id, user_email: recipient.email, subject: campaign.subject, status: 'sent' })
        } catch (e: any) {
            errors++
            logs.push({ campaign_id: id, user_id: recipient.id, user_email: recipient.email, subject: campaign.subject, status: 'failed', error: e.message })
        }
    }

    // Log batch insert
    if (logs.length) await db.from('email_send_logs').insert(logs)

    await db
        .from('email_campaigns')
        .update({ status: 'sent', sent_count: sent, sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', id)

    return { sent, errors }
}

/* ─── Sequenze ──────────────────────────────────────────────── */

export async function getSequences(): Promise<EmailSequence[]> {
    const db = await assertAdmin()
    const { data } = await db.from('email_sequences').select('*').order('created_at', { ascending: false })
    return (data ?? []) as EmailSequence[]
}

export async function createSequence(data: {
    name: string; trigger_type: string;
    linked_event_id?: string | null; linked_library_item_id?: string | null;
    linked_youtube_url?: string | null; linked_entity_title?: string | null;
    linked_entity_description?: string | null;
}): Promise<EmailSequence> {
    const db = await assertAdmin()
    const { data: seq, error } = await db.from('email_sequences').insert(data).select().single()
    if (error) throw new Error(error.message)
    return seq as EmailSequence
}

export async function updateSequence(id: string, data: Partial<{
    name: string; trigger_type: string;
    linked_event_id: string | null; linked_library_item_id: string | null;
    linked_youtube_url: string | null; linked_entity_title: string | null;
    linked_entity_description: string | null;
}>): Promise<void> {
    const db = await assertAdmin()
    const { error } = await db.from('email_sequences').update({ ...data, updated_at: new Date().toISOString() }).eq('id', id)
    if (error) throw new Error(error.message)
}

export async function deleteSequence(id: string): Promise<void> {
    const db = await assertAdmin()
    const { error } = await db.from('email_sequences').delete().eq('id', id)
    if (error) throw new Error(error.message)
}

export async function toggleSequenceActive(id: string, isActive: boolean): Promise<void> {
    const db = await assertAdmin()
    const { error } = await db
        .from('email_sequences')
        .update({ is_active: isActive, updated_at: new Date().toISOString() })
        .eq('id', id)
    if (error) throw new Error(error.message)
}

export async function getSequenceSteps(sequenceId: string): Promise<EmailSequenceStep[]> {
    const db = await assertAdmin()
    const { data } = await db
        .from('email_sequence_steps')
        .select('*')
        .eq('sequence_id', sequenceId)
        .order('step_order', { ascending: true })
    return (data ?? []) as EmailSequenceStep[]
}

export async function createSequenceStep(sequenceId: string, data: { step_order: number; delay_days: number; subject: string; body_html: string }): Promise<EmailSequenceStep> {
    const db = await assertAdmin()
    const { data: step, error } = await db
        .from('email_sequence_steps')
        .insert({ ...data, sequence_id: sequenceId })
        .select()
        .single()
    if (error) throw new Error(error.message)
    return step as EmailSequenceStep
}

export async function updateSequenceStep(id: string, data: Partial<{ step_order: number; delay_days: number; subject: string; body_html: string; is_active: boolean }>): Promise<void> {
    const db = await assertAdmin()
    const { error } = await db.from('email_sequence_steps').update(data).eq('id', id)
    if (error) throw new Error(error.message)
}

export async function deleteSequenceStep(id: string): Promise<void> {
    const db = await assertAdmin()
    const { error } = await db.from('email_sequence_steps').delete().eq('id', id)
    if (error) throw new Error(error.message)
}

export async function sendManualSequenceToAll(sequenceId: string): Promise<{ sent: number }> {
    const db = await assertAdmin()

    const { data: steps } = await db
        .from('email_sequence_steps')
        .select('*')
        .eq('sequence_id', sequenceId)
        .eq('is_active', true)
        .order('step_order', { ascending: true })
        .limit(1)

    const step = steps?.[0]
    if (!step) throw new Error('Nessuno step attivo nella sequenza')

    const { data: profiles } = await db.from('profiles').select('id').eq('newsletter_opt_in', true)
    const { data: authUsers } = await db.auth.admin.listUsers({ perPage: 1000 })
    const profileIds = new Set((profiles ?? []).map((p: any) => p.id))
    const recipients = (authUsers?.users ?? []).filter(u => profileIds.has(u.id) && u.email)

    const { data: genderData } = await db.from('profiles').select('id, gender').in('id', Array.from(profileIds))
    const genderMap = new Map<string, string>()
    ;(genderData ?? []).forEach((p: any) => { if (p.gender) genderMap.set(p.id, p.gender) })

    let sent = 0
    const logs: any[] = []

    for (const recipient of recipients) {
        if (!recipient.email) continue
        const firstName = (recipient.user_metadata?.full_name as string | undefined)?.split(' ')[0]
        const gender = genderMap.get(recipient.id)
        try {
            await sendNewsletterEmail(recipient.email, step.subject, step.body_html, firstName, gender)
            sent++
            logs.push({ sequence_step_id: step.id, user_id: recipient.id, user_email: recipient.email, subject: step.subject, status: 'sent' })
        } catch (e: any) {
            logs.push({ sequence_step_id: step.id, user_id: recipient.id, user_email: recipient.email, subject: step.subject, status: 'failed', error: e.message })
        }
    }

    if (logs.length) await db.from('email_send_logs').insert(logs)
    return { sent }
}

/* ─── Log e Ricevute ────────────────────────────────────────── */

export async function getEmailLogs(limit = 200): Promise<EmailSendLog[]> {
    const db = await assertAdmin()
    const { data } = await db
        .from('email_send_logs')
        .select('*')
        .order('sent_at', { ascending: false })
        .limit(limit)
    return (data ?? []) as EmailSendLog[]
}

export async function getReceivedEmails(): Promise<ReceivedEmail[]> {
    const db = await assertAdmin()
    const { data } = await db
        .from('received_emails')
        .select('*')
        .order('received_at', { ascending: false })
        .limit(100)
    return (data ?? []) as ReceivedEmail[]
}

export async function markEmailRead(id: string): Promise<void> {
    const db = await assertAdmin()
    await db.from('received_emails').update({ is_read: true }).eq('id', id)
}

/* ─── Audience Counts ───────────────────────────────────────── */

export async function getAudienceCounts(): Promise<{ newsletter: number; marketing: number; all: number }> {
    const db = await assertAdmin()
    const [{ count: newsletter }, { count: marketing }, { count: all }] = await Promise.all([
        db.from('profiles').select('id', { count: 'exact', head: true }).eq('newsletter_opt_in', true),
        db.from('profiles').select('id', { count: 'exact', head: true }).eq('marketing_opt_in', true),
        db.from('profiles').select('id', { count: 'exact', head: true }),
    ])
    return { newsletter: newsletter ?? 0, marketing: marketing ?? 0, all: all ?? 0 }
}
