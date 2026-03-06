'use client'

import { usePushNotifications } from '@/hooks/usePushNotifications'

/** Registers web-push subscription silently in the background. No UI. */
export function PushSetup() {
    usePushNotifications()
    return null
}
