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

    // Scope: solo asset:read+asset:write (scopri dai Canva Developer docs).
    // Canva usa %3A per i due punti e %20 per gli spazi nella loro documentazione.
    // design:content:* richiede permessi extra nell'app Canva — rimossi per evitare rejected client.
    const scope = encodeURIComponent('asset:read asset:write')

    // Rispettiamo esattamente l'ordine dei parametri dalla documentazione ufficiale Canva:
    // https://www.canva.com/developers/docs/connect/authentication/
    const authUrl = 'https://www.canva.com/api/oauth/authorize' +
        `?code_challenge=${encodeURIComponent(codeChallenge)}` +
        `&code_challenge_method=S256` +
        `&response_type=code` +
        `&client_id=${encodeURIComponent(clientId)}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&scope=${scope}` +
        `&state=${state}`

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
