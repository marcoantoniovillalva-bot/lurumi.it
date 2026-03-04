import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendWelcomeEmail } from '@/lib/resend'

/**
 * GET /auth/callback
 * Gestisce il redirect dopo la conferma email di Supabase.
 * Invia la welcome email al primo accesso.
 */
export async function GET(request: NextRequest) {
    const { searchParams, origin } = new URL(request.url)
    const code = searchParams.get('code')
    const next = searchParams.get('next') ?? '/'

    if (code) {
        const supabase = await createClient()
        const { data, error } = await supabase.auth.exchangeCodeForSession(code)
        if (!error && data.user?.email) {
            // Invia welcome email solo al primo accesso (created_at ≈ confirmed_at)
            const user = data.user
            const createdAt = new Date(user.created_at).getTime()
            const confirmedAt = user.email_confirmed_at ? new Date(user.email_confirmed_at).getTime() : 0
            const isFirstConfirm = Math.abs(confirmedAt - createdAt) < 60_000 // entro 1 min

            if (isFirstConfirm && user.email) {
                const firstName = user.user_metadata?.full_name?.split(' ')[0] as string | undefined
                sendWelcomeEmail(user.email, firstName).catch(() => {}) // fire-and-forget
            }

            return NextResponse.redirect(`${origin}${next}`)
        }
    }

    return NextResponse.redirect(`${origin}/login?error=email_confirmation_failed`)
}
