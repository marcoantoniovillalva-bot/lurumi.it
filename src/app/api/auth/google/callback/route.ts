import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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

    // ── Step 2: Crea la sessione Supabase con il Google id_token ──
    // Il client SSR scrive automaticamente i cookie di sessione nella risposta
    const supabase = await createClient()
    const { error: signInError } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: id_token,
        access_token,
    })

    if (signInError) {
        console.error('[Google OAuth] Supabase signInWithIdToken failed:', signInError.message)
        return clearStateAndRedirect(failUrl)
    }

    // ── Step 3: Crea profilo se è il primo accesso ──
    const { data: { user: authedUser } } = await supabase.auth.getUser()
    if (authedUser) {
        await supabase.from('profiles').upsert(
            { id: authedUser.id, tier: 'free' },
            { onConflict: 'id', ignoreDuplicates: true }
        )
    }

    // ── Step 4: Redirect all'app — i cookie di sessione sono già impostati ──
    const response = NextResponse.redirect(origin)
    response.cookies.delete('g_oauth_state')
    return response
}

function clearStateAndRedirect(url: string) {
    const response = NextResponse.redirect(url)
    response.cookies.delete('g_oauth_state')
    return response
}
