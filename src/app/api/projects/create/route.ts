/**
 * POST /api/projects/create
 * Crea un nuovo progetto su Supabase (usato dai tool AI del chatbot).
 * Il client riceve il progetto creato e lo può aggiungere allo store.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { vectorizeProject } from '@/lib/rag'

export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

        const body = await req.json()
        const {
            id,
            title,
            type = 'blank',
            notes_html = '',
            secs = [],
            sections = [],
        } = body as {
            id: string
            title: string
            type?: string
            notes_html?: string
            secs?: unknown[]
            sections?: unknown[]
        }

        if (!id || !title) {
            return NextResponse.json({ error: 'id e title sono obbligatori' }, { status: 400 })
        }

        const db = createServiceClient()
        const now = new Date().toISOString()

        const { data, error } = await db.from('projects').insert({
            id,
            user_id: user.id,
            title,
            type,
            size: 0,
            counter: 0,
            timer_seconds: 0,
            notes_html,
            secs,
            sections,
            images: [],
            created_at: now,
            updated_at: now,
        }).select().single()

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })

        // Vettorizza async
        vectorizeProject({ id, title, type, notesHtml: notes_html, sections: sections as never, secs: secs as never }, user.id).catch(() => {})

        return NextResponse.json({ success: true, project: data })
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Errore server'
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}
