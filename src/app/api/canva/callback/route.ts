import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const error = searchParams.get('error')

    if (error || !code) {
        return NextResponse.redirect(new URL('/profilo?canva=error', request.url))
    }

    const clientId = process.env.CANVA_CLIENT_ID
    const clientSecret = process.env.CANVA_CLIENT_SECRET
    const redirectUri = process.env.CANVA_REDIRECT_URI ?? 'https://lurumi.it/api/canva/callback'
    const codeVerifier = request.cookies.get('canva_cv')?.value

    if (!clientId || !clientSecret || !codeVerifier) {
        return NextResponse.redirect(new URL('/profilo?canva=error', request.url))
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
        return NextResponse.redirect(new URL('/profilo?canva=error', request.url))
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
