import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
    const supabaseAuth = await createServerClient()
    const { data: { user } } = await supabaseAuth.auth.getUser()
    if (!user) return NextResponse.json({ success: false, error: 'Non autenticato' }, { status: 401 })

    const { data: profile } = await supabaseAuth.from('profiles').select('is_admin').eq('id', user.id).single()
    if (!profile?.is_admin) return NextResponse.json({ success: false, error: 'Accesso negato' }, { status: 403 })

    const body = await req.json()
    const { prompt, model_response, is_correct, corrected_response, math_check_passed, math_errors } = body

    if (!prompt || model_response === undefined) {
        return NextResponse.json({ success: false, error: 'Dati mancanti: prompt e model_response obbligatori' }, { status: 400 })
    }

    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data, error } = await supabaseAdmin.from('model_feedback').insert({
        prompt,
        model_response,
        is_correct: is_correct ?? null,
        corrected_response: corrected_response ?? null,
        math_check_passed: math_check_passed ?? null,
        math_errors: math_errors ?? null,
        admin_id: user.id,
        created_at: new Date().toISOString(),
    }).select('id').single()

    if (error) {
        console.error('[save-feedback]', error)
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, id: data.id })
}
