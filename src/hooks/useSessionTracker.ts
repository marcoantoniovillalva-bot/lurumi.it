'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'

export function useSessionTracker(user: User | null) {
    const sessionIdRef = useRef<string | null>(null)

    useEffect(() => {
        // Logout — chiudi la sessione aperta
        if (!user) {
            if (sessionIdRef.current) {
                const sid = sessionIdRef.current
                sessionIdRef.current = null
                const payload = JSON.stringify({ session_id: sid, ended_at: new Date().toISOString() })
                navigator.sendBeacon('/api/sessions/end', new Blob([payload], { type: 'application/json' }))
            }
            return
        }

        const supabase = createClient()

        // Apri nuova sessione
        supabase
            .from('user_sessions')
            .insert({ user_id: user.id, started_at: new Date().toISOString() })
            .select('id')
            .single()
            .then(({ data }) => {
                if (data?.id) sessionIdRef.current = data.id
            })

        const handleUnload = () => {
            if (!sessionIdRef.current) return
            const payload = JSON.stringify({ session_id: sessionIdRef.current, ended_at: new Date().toISOString() })
            navigator.sendBeacon('/api/sessions/end', new Blob([payload], { type: 'application/json' }))
        }

        window.addEventListener('beforeunload', handleUnload)
        return () => {
            window.removeEventListener('beforeunload', handleUnload)
        }
    }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps
}
