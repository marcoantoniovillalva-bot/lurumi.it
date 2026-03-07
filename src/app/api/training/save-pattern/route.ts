import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
    // Verifica che l'utente sia admin
    const supabaseAuth = await createServerClient()
    const { data: { user } } = await supabaseAuth.auth.getUser()
    if (!user) return NextResponse.json({ success: false, error: 'Non autenticato' }, { status: 401 })

    const { data: profile } = await supabaseAuth.from('profiles').select('is_admin').eq('id', user.id).single()
    if (!profile?.is_admin) return NextResponse.json({ success: false, error: 'Accesso negato' }, { status: 403 })

    const body = await req.json()
    const { title, difficulty, category, yarn_weight, hook_size, finished_size_cm, admin_notes, parts } = body

    if (!title || !parts || !Array.isArray(parts) || parts.length === 0) {
        return NextResponse.json({ success: false, error: 'Dati mancanti: title e parts sono obbligatori' }, { status: 400 })
    }

    // Usa service role per bypassare RLS
    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data, error } = await supabaseAdmin.from('training_patterns').insert({
        user_id: user.id,
        validated_by: user.id,
        title,
        difficulty: difficulty || 'beginner',
        category: category || null,
        yarn_weight: yarn_weight || null,
        hook_size: hook_size || null,
        finished_size_cm: finished_size_cm || null,
        admin_notes: admin_notes || null,
        parts,
        status: 'ground_truth',
        validated_at: new Date().toISOString(),
    }).select('id').single()

    if (error) {
        console.error('[save-pattern]', error)
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, id: data.id })
}
