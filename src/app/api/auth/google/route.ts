import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

export async function GET(request: NextRequest) {
    const clientId = process.env.GOOGLE_CLIENT_ID
    if (!clientId) {
        return NextResponse.json(
            { error: 'GOOGLE_CLIENT_ID non configurato in .env.local' },
            { status: 500 }
        )
    }

    // Normalizza sempre a www in produzione per corrispondere all'URI registrata su Google Cloud
    const rawOrigin = new URL(request.url).origin
    const origin = rawOrigin.replace('https://lurumi.it', 'https://www.lurumi.it')
    const redirectUri = `${origin}/api/auth/google/callback`

    // State token per protezione CSRF
    const state = crypto.randomBytes(16).toString('hex')

    const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'openid email profile',
        access_type: 'offline',
        state,
        prompt: 'select_account',
    })

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`

    const response = NextResponse.redirect(authUrl)
    response.cookies.set('g_oauth_state', state, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 600,
        path: '/',
        sameSite: 'lax',
    })
    return response
}
