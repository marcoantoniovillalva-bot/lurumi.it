'use client'

import { usePathname } from 'next/navigation'
import { Header } from '@/features/navigation/components/Header'
import { Tabbar } from '@/features/navigation/components/Tabbar'
import { CookieBanner } from '@/components/CookieBanner'
import { SyncOnLogin } from '@/components/SyncOnLogin'

const AUTH_PATHS = ['/login']

export function LayoutShell({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()
    const isAuthPage = AUTH_PATHS.some(p => pathname?.startsWith(p))

    if (isAuthPage) {
        return (
            <>
                {children}
                <CookieBanner />
            </>
        )
    }

    return (
        <>
            <SyncOnLogin />
            <Header />
            <main className="min-h-screen pb-32">
                {children}
            </main>
            <Tabbar />
            <CookieBanner />
        </>
    )
}
