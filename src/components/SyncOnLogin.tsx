'use client'

import { useAuth } from '@/hooks/useAuth'
import { useSyncOnLogin } from '@/hooks/useSyncOnLogin'

export function SyncOnLogin() {
    const { user } = useAuth()
    useSyncOnLogin(user)
    return null
}
