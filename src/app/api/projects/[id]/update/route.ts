/**
 * PATCH /api/projects/[id]/update
 * Aggiorna campi specifici di un progetto (usato dai tool AI del chatbot).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { vectorizeProject } from '@/lib/rag'

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

        const body = await req.json() as Record<string, unknown>

        // Whitelist dei campi aggiornabili via AI
        const allowed = ['title', 'notes_html', 'secs', 'sections', 'video_id', 'thumb_url', 'type', 'transcript_data']
        const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
        for (const key of allowed) {
            if (key in body) updates[key] = body[key]
        }

        const db = createServiceClient()
        const { data, error } = await db.from('projects')
            .update(updates)
            .eq('id', id)
            .eq('user_id', user.id)
            .select()
            .single()

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })

        // Re-vettorizza se ci sono note o sezioni aggiornate
        if (data && (updates.notes_html || updates.sections || updates.secs)) {
            vectorizeProject({
                id,
                title: data.title,
                type: data.type,
                notesHtml: data.notes_html,
                sections: data.sections as never,
                secs: data.secs as never,
            }, user.id).catch(() => {})
        }

        return NextResponse.json({ success: true, project: data })
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Errore server'
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}
