import { NextResponse } from 'next/server'
import crypto from 'crypto'

export async function GET() {
    const clientId = process.env.CANVA_CLIENT_ID
    const redirectUri = process.env.CANVA_REDIRECT_URI ?? 'https://lurumi.it/api/canva/callback'

    if (!clientId) {
        return NextResponse.json({ error: 'CANVA_CLIENT_ID non configurato' }, { status: 500 })
    }

    // PKCE code verifier + challenge
    const codeVerifier = crypto.randomBytes(64).toString('base64url')
    const codeChallenge = crypto
        .createHash('sha256')
        .update(codeVerifier)
        .digest('base64url')

    // State per CSRF protection
    const state = crypto.randomBytes(16).toString('hex')

    // Scopes abilitati nel portale Canva: app:read/write, asset:read/write, design:content:read/write
    const scope = encodeURIComponent('asset:read asset:write app:read app:write design:content:read design:content:write')

    // Ordine parametri e formato IDENTICO al template mostrato dal portale Canva Developer:
    // code_challenge_method=s256 (minuscolo — Canva non usa S256 standard RFC)
    // code_challenge va in FONDO come mostrato dal portale
    const authUrl = 'https://www.canva.com/api/oauth/authorize' +
        `?code_challenge_method=s256` +
        `&response_type=code` +
        `&client_id=${encodeURIComponent(clientId)}` +
        `&scope=${scope}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&state=${state}` +
        `&code_challenge=${encodeURIComponent(codeChallenge)}`

    console.log('[Canva Auth] Redirect URL:', authUrl)
    console.log('[Canva Auth] client_id:', clientId)
    console.log('[Canva Auth] redirect_uri:', redirectUri)
    console.log('[Canva Auth] scope:', decodeURIComponent(scope))

    // Store verifier and state in a short-lived cookie so callback can use it
    const response = NextResponse.redirect(authUrl)
    response.cookies.set('canva_cv', codeVerifier, { httpOnly: true, maxAge: 600, path: '/' })
    response.cookies.set('canva_state', state, { httpOnly: true, maxAge: 600, path: '/' })
    return response
}
