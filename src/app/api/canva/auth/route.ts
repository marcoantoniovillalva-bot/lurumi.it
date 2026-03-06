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

    // Scope: solo spazi codificati come %20, colons letterali (come da template portale Canva)
    const scope = 'asset:read asset:write app:read app:write design:content:read design:content:write'.replace(/ /g, '%20')

    // URL IDENTICA al template del portale Canva — nessun parametro extra (no redirect_uri, no state)
    // Il portale usa URL 1 (https://lurumi.it/api/canva/callback) come redirect di default
    const authUrl = 'https://www.canva.com/api/oauth/authorize' +
        `?code_challenge_method=s256` +
        `&response_type=code` +
        `&client_id=${clientId}` +
        `&scope=${scope}` +
        `&code_challenge=${codeChallenge}`

    console.log('[Canva Auth] URL:', authUrl)

    const response = NextResponse.redirect(authUrl)
    response.cookies.set('canva_cv', codeVerifier, { httpOnly: true, maxAge: 600, path: '/' })
    return response
}
