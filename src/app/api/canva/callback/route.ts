import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const error = searchParams.get('error')

    console.log('[Canva Callback] params:', { code: !!code, error })

    if (error || !code) {
        console.error('[Canva Callback] No code or error from Canva:', { error })
        return NextResponse.redirect(new URL(`/profilo?canva=error&reason=canva_denied&detail=${encodeURIComponent(error ?? 'no_code')}`, request.url))
    }

    const clientId = process.env.CANVA_CLIENT_ID
    const clientSecret = process.env.CANVA_CLIENT_SECRET
    const redirectUri = process.env.CANVA_REDIRECT_URI ?? 'https://lurumi.it/api/canva/callback'
    const codeVerifier = request.cookies.get('canva_cv')?.value

    console.log('[Canva Callback] env check:', { hasClientId: !!clientId, hasSecret: !!clientSecret, hasVerifier: !!codeVerifier, redirectUri })

    if (!clientId || !clientSecret || !codeVerifier) {
        const reason = !clientId ? 'no_client_id' : !clientSecret ? 'no_client_secret' : 'no_cookie'
        console.error('[Canva Callback] Missing env or cookie:', { clientId: !!clientId, clientSecret: !!clientSecret, codeVerifier: !!codeVerifier })
        return NextResponse.redirect(new URL(`/profilo?canva=error&reason=${reason}`, request.url))
    }

    // Exchange code for token
    const tokenRes = await fetch('https://api.canva.com/rest/v1/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'authorization_code',
            code,
            redirect_uri: redirectUri,
            client_id: clientId,
            client_secret: clientSecret,
            code_verifier: codeVerifier,
        }),
    })

    if (!tokenRes.ok) {
        const body = await tokenRes.text()
        console.error('[Canva Callback] Token exchange failed:', tokenRes.status, body)
        return NextResponse.redirect(new URL(`/profilo?canva=error&reason=token_exchange&status=${tokenRes.status}&detail=${encodeURIComponent(body.slice(0, 200))}`, request.url))
    }

    const { access_token } = await tokenRes.json()

    // Save token to profiles table
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
        await supabase.from('profiles').update({ canva_token: access_token }).eq('id', user.id)
    }

    const response = NextResponse.redirect(new URL('/profilo?canva=success', request.url))
    response.cookies.delete('canva_cv')
    return response
}
