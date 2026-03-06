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

    // I due punti nei scope NON vanno codificati (Canva li rifiuta se sono %3A)
    // code_challenge è già base64url (URL-safe), non serve re-codificarlo
    const scope = 'asset:read asset:write design:content:read design:content:write'
    const authUrl = 'https://www.canva.com/api/oauth/authorize' +
        '?response_type=code' +
        `&client_id=${encodeURIComponent(clientId)}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&scope=${scope.replace(/ /g, '%20')}` +
        `&code_challenge_method=S256` +
        `&code_challenge=${codeChallenge}`

    // Store verifier in a short-lived cookie so callback can use it
    const response = NextResponse.redirect(authUrl)
    response.cookies.set('canva_cv', codeVerifier, { httpOnly: true, maxAge: 600, path: '/' })
    return response
}
