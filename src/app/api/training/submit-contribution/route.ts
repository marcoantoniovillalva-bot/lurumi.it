import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
    const supabaseAuth = await createServerClient()
    const { data: { user } } = await supabaseAuth.auth.getUser()
    if (!user) return NextResponse.json({ success: false, error: 'Non autenticato' }, { status: 401 })

    const body = await req.json()
    const { title, difficulty, admin_notes, project_id, parts } = body

    if (!title || !parts || !Array.isArray(parts) || parts.length === 0) {
        return NextResponse.json({ success: false, error: 'Dati mancanti' }, { status: 400 })
    }

    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data, error } = await supabaseAdmin.from('training_patterns').insert({
        user_id: user.id,
        project_id: project_id || null,
        title,
        difficulty: difficulty || 'beginner',
        parts,
        admin_notes: admin_notes || null,
        status: 'pending',
        submitted_at: new Date().toISOString(),
    }).select('id').single()

    if (error) {
        console.error('[submit-contribution]', error)
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, id: data.id })
}
