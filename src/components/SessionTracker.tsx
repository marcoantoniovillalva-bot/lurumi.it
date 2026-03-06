'use client'

import { useAuth } from '@/hooks/useAuth'
import { useSessionTracker } from '@/hooks/useSessionTracker'

export function SessionTracker() {
    const { user } = useAuth()
    useSessionTracker(user)
    return null
}
