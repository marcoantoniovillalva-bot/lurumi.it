import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Apple manda il callback come POST con body application/x-www-form-urlencoded.
 * - code      : authorization code
 * - id_token  : JWT firmato da Apple — lo passiamo direttamente a Supabase
 * - state     : CSRF token
 * - user      : JSON con { name, email } — solo al PRIMO login
 */
export async function POST(request: NextRequest) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3010'
    const failUrl = `${appUrl}/login?auth_error=apple`

    const formData = await request.formData()
    const code    = formData.get('code')     as string | null
    const state   = formData.get('state')    as string | null
    const idToken = formData.get('id_token') as string | null

    const storedState = request.cookies.get('a_oauth_state')?.value

    // Validazione CSRF
    if (!code || !storedState || state !== storedState) {
        console.error('[Apple OAuth] CSRF mismatch o parametri mancanti')
        return clearStateAndRedirect(failUrl)
    }

    if (!idToken) {
        console.error('[Apple OAuth] id_token assente nella risposta Apple')
        return clearStateAndRedirect(failUrl)
    }

    // Crea sessione Supabase con l'id_token Apple
    const supabase = await createClient()
    const { error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: idToken,
    })

    if (error) {
        console.error('[Apple OAuth] signInWithIdToken fallito:', error.message)
        return clearStateAndRedirect(failUrl)
    }

    // Crea profilo se è il primo accesso
    const { data: { user: authedUser } } = await supabase.auth.getUser()
    if (authedUser) {
        await supabase.from('profiles').upsert(
            { id: authedUser.id, tier: 'free' },
            { onConflict: 'id', ignoreDuplicates: true }
        )
    }

    const response = NextResponse.redirect(appUrl)
    response.cookies.delete('a_oauth_state')
    return response
}

function clearStateAndRedirect(url: string) {
    const response = NextResponse.redirect(url)
    response.cookies.delete('a_oauth_state')
    return response
}
