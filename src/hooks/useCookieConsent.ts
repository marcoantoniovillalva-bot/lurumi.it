'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

const CONSENT_KEY = 'lurumi_consent_v1'

export interface CookieConsentData {
    decision: 'all' | 'necessary' | 'custom'
    timestamp: string
    categories: {
        functional: boolean
        analytics: boolean
        marketing: boolean
    }
}

export function useCookieConsent() {
    const [consent, setConsent] = useState<CookieConsentData | null>(null)
    const [loaded, setLoaded] = useState(false)

    useEffect(() => {
        const load = async () => {
            try {
                // 1. Prima leggi da localStorage (veloce, offline-first)
                const stored = localStorage.getItem(CONSENT_KEY)
                if (stored) {
                    setConsent(JSON.parse(stored))
                    setLoaded(true)
                    return
                }

                // 2. Se non c'è nulla in locale e l'utente è loggato, prova da Supabase
                const supabase = createClient()
                const { data: { user } } = await supabase.auth.getUser()
                if (user) {
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('cookie_consent')
                        .eq('id', user.id)
                        .single()
                    if (profile?.cookie_consent) {
                        const remote = profile.cookie_consent as CookieConsentData
                        localStorage.setItem(CONSENT_KEY, JSON.stringify(remote))
                        setConsent(remote)
                    }
                }
            } catch { /* ignore */ }
            setLoaded(true)
        }
        load()
    }, [])

    const save = (data: CookieConsentData) => {
        localStorage.setItem(CONSENT_KEY, JSON.stringify(data))
        setConsent(data)

        // Sync su Supabase in background (best-effort)
        try {
            const supabase = createClient()
            supabase.auth.getUser().then(({ data: { user } }) => {
                if (user) {
                    supabase
                        .from('profiles')
                        .update({ cookie_consent: data })
                        .eq('id', user.id)
                        .then(() => {}) // fire and forget
                }
            })
        } catch { /* localStorage rimane la fonte primaria */ }
    }

    const acceptAll = () =>
        save({
            decision: 'all',
            timestamp: new Date().toISOString(),
            categories: { functional: true, analytics: true, marketing: true },
        })

    const rejectAll = () =>
        save({
            decision: 'necessary',
            timestamp: new Date().toISOString(),
            categories: { functional: false, analytics: false, marketing: false },
        })

    const saveCustom = (categories: CookieConsentData['categories']) =>
        save({
            decision: 'custom',
            timestamp: new Date().toISOString(),
            categories,
        })

    const resetConsent = () => {
        localStorage.removeItem(CONSENT_KEY)
        setConsent(null)
    }

    return {
        consent,
        loaded,
        hasDecided: consent !== null,
        acceptAll,
        rejectAll,
        saveCustom,
        resetConsent,
    }
}
