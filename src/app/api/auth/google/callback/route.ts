import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { sendWelcomeEmail } from '@/lib/resend'
import { enrollUserInSequence } from '@/lib/email-triggers'

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const oauthError = searchParams.get('error')

    const storedState = request.cookies.get('g_oauth_state')?.value
    // Normalizza sempre a www in produzione
    const rawOrigin = new URL(request.url).origin
    const origin = rawOrigin.replace('https://lurumi.it', 'https://www.lurumi.it')
    const failUrl = `${origin}/?auth_error=1`

    // Validazione CSRF state
    if (oauthError || !code || !storedState || state !== storedState) {
        console.error('[Google OAuth] Invalid state or error:', { oauthError, hasCode: !!code, stateMatch: state === storedState })
        return clearStateAndRedirect(failUrl)
    }

    const clientId = process.env.GOOGLE_CLIENT_ID
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET
    if (!clientId || !clientSecret) {
        console.error('[Google OAuth] Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET')
        return clearStateAndRedirect(failUrl)
    }

    const redirectUri = `${origin}/api/auth/google/callback`

    // ── Step 1: Scambia il code con Google per ottenere id_token ──
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri,
            grant_type: 'authorization_code',
        }),
    })

    if (!tokenRes.ok) {
        const body = await tokenRes.text()
        console.error('[Google OAuth] Token exchange failed:', body)
        return clearStateAndRedirect(failUrl)
    }

    const { id_token, access_token } = (await tokenRes.json()) as {
        id_token?: string
        access_token?: string
    }

    if (!id_token) {
        console.error('[Google OAuth] No id_token in Google response')
        return clearStateAndRedirect(failUrl)
    }

    // ── Step 2: Prepara il redirect e crea il client Supabase che scrive
    //            i cookie di sessione DIRETTAMENTE sulla response del redirect.
    //            Questo è il pattern corretto per Route Handlers che restituiscono
    //            NextResponse custom (redirect/json) invece di usare cookies() di Next.js.
    const response = NextResponse.redirect(origin)
    response.cookies.delete('g_oauth_state')

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
                    cookiesToSet.forEach(({ name, value, options }) => {
                        response.cookies.set(name, value, options)
                    })
                },
            },
        }
    )

    const { error: signInError } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: id_token,
        access_token,
    })

    if (signInError) {
        console.error('[Google OAuth] Supabase signInWithIdToken failed:', signInError.message)
        return clearStateAndRedirect(failUrl)
    }

    // ── Step 3: Crea profilo e invia welcome email se è il primo accesso ──
    const { data: { user: authedUser } } = await supabase.auth.getUser()
    if (authedUser) {
        await supabase.from('profiles').upsert(
            { id: authedUser.id, tier: 'free' },
            { onConflict: 'id', ignoreDuplicates: true }
        )

        // Welcome email + enrollment solo al primo accesso (created_at < 60s fa)
        const isNewUser = Date.now() - new Date(authedUser.created_at).getTime() < 60_000
        if (isNewUser && authedUser.email) {
            const firstName = authedUser.user_metadata?.full_name?.split(' ')[0] as string | undefined
            sendWelcomeEmail(authedUser.email, firstName).catch(() => {})
            enrollUserInSequence(authedUser.id, authedUser.email, 'first_login').catch(() => {})
        }
    }

    return response
}

function clearStateAndRedirect(url: string) {
    const response = NextResponse.redirect(url)
    response.cookies.delete('g_oauth_state')
    return response
}
