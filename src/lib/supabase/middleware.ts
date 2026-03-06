import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

type CookieToSet = {
    name: string
    value: string
    options: CookieOptions
}

export async function updateSession(request: NextRequest) {
    let supabaseResponse = NextResponse.next({ request })

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet: CookieToSet[]) {
                    cookiesToSet.forEach(({ name, value }) =>
                        request.cookies.set(name, value)
                    )
                    supabaseResponse = NextResponse.next({ request })
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    )
                },
            },
        }
    )

    const { data: { user } } = await supabase.auth.getUser()

    // Protected routes
    const isProtectedRoute = request.nextUrl.pathname.startsWith('/dashboard') ||
        request.nextUrl.pathname.startsWith('/projects') ||
        request.nextUrl.pathname.startsWith('/tools') ||
        request.nextUrl.pathname.startsWith('/profilo') ||
        request.nextUrl.pathname.startsWith('/tutorials')
    const isAuthRoute = request.nextUrl.pathname.startsWith('/login')

    if (isProtectedRoute && !user) {
        return NextResponse.redirect(new URL('/login', request.url))
    }

    if (isAuthRoute && user) {
        return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    return supabaseResponse
}
