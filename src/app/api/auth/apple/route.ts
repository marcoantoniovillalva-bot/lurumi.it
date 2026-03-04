import { NextResponse } from 'next/server'
import crypto from 'crypto'

export async function GET() {
    const clientId = process.env.APPLE_CLIENT_ID
    if (!clientId) {
        return NextResponse.json({ error: 'APPLE_CLIENT_ID non configurato' }, { status: 500 })
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3010'
    const redirectUri = `${appUrl}/api/auth/apple/callback`

    // State token per protezione CSRF
    const state = crypto.randomBytes(16).toString('hex')

    const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code id_token',
        response_mode: 'form_post',   // Apple manda il callback come POST
        scope: 'name email',
        state,
    })

    const authUrl = `https://appleid.apple.com/auth/authorize?${params.toString()}`

    const response = NextResponse.redirect(authUrl)
    response.cookies.set('a_oauth_state', state, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 600,
        path: '/',
        sameSite: 'lax',
    })
    return response
}
