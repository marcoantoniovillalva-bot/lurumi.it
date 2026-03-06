import { NextResponse } from 'next/server'
import crypto from 'crypto'

// Endpoint di debug: mostra la URL OAuth che verrebbe costruita, SENZA redirect.
// Visitare /api/canva/debug per vedere i parametri esatti e confrontarli con il Canva Developer Portal.
export async function GET() {
    const clientId = process.env.CANVA_CLIENT_ID
    const redirectUri = process.env.CANVA_REDIRECT_URI ?? 'https://lurumi.it/api/canva/callback'

    if (!clientId) {
        return NextResponse.json({ error: 'CANVA_CLIENT_ID non configurato' }, { status: 500 })
    }

    const codeVerifier = 'debug-verifier-placeholder'
    const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url')
    const scope = 'asset:read asset:write app:read app:write design:content:read design:content:write'.replace(/ /g, '%20')

    const authUrl = 'https://www.canva.com/api/oauth/authorize' +
        `?code_challenge_method=s256` +
        `&response_type=code` +
        `&client_id=${encodeURIComponent(clientId)}` +
        `&scope=${scope}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&state=debug-state` +
        `&code_challenge=${encodeURIComponent(codeChallenge)}`

    return NextResponse.json({
        authUrl,
        params: {
            client_id: clientId,
            redirect_uri: redirectUri,
            scope: decodeURIComponent(scope),
            code_challenge_method: 's256',
            response_type: 'code',
        },
        checklist: [
            `✅ Client ID: ${clientId} — verificare che corrisponda al valore in Canva Developer Portal → "Integration Key"`,
            `✅ Redirect URI: ${redirectUri} — deve essere aggiunta in Canva Developer Portal → OAuth → "Redirect URLs"`,
            `✅ Scope: asset:read asset:write — deve essere abilitato nel portale Canva per questa integrazione`,
            `ℹ️  Se vedi "Client ID non valido" su Canva, il problema è nel portale, NON nel codice.`,
        ],
        canvaPortalUrl: 'https://www.canva.com/developers/apps',
    })
}
