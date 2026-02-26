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

    const params = new URLSearchParams({
        response_type: 'code',
        client_id: clientId,
        redirect_uri: redirectUri,
        scope: 'asset:read asset:write design:content:read design:content:write',
        code_challenge_method: 'S256',
        code_challenge: codeChallenge,
    })

    const authUrl = `https://www.canva.com/api/oauth/v2/authorize?${params.toString()}`

    // Store verifier in a short-lived cookie so callback can use it
    const response = NextResponse.redirect(authUrl)
    response.cookies.set('canva_cv', codeVerifier, { httpOnly: true, maxAge: 600, path: '/' })
    return response
}
