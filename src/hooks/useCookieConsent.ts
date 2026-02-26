'use client'

import { useState, useEffect } from 'react'

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
        try {
            const stored = localStorage.getItem(CONSENT_KEY)
            if (stored) setConsent(JSON.parse(stored))
        } catch { /* ignore */ }
        setLoaded(true)
    }, [])

    const save = (data: CookieConsentData) => {
        localStorage.setItem(CONSENT_KEY, JSON.stringify(data))
        setConsent(data)
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
