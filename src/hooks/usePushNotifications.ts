'use client'

import { useEffect, useRef } from 'react'
import { useAuth } from '@/hooks/useAuth'

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!

function urlBase64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
    const rawData = window.atob(base64)
    return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}

export function usePushNotifications() {
    const { user } = useAuth()
    const attempted = useRef(false)

    useEffect(() => {
        if (!user) return
        if (attempted.current) return
        attempted.current = true

        if (typeof window === 'undefined') return
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) return

        const subscribe = async () => {
            try {
                // Wait for SW to be ready
                const registration = await navigator.serviceWorker.ready

                // Check existing subscription
                const existing = await registration.pushManager.getSubscription()
                if (existing) {
                    // Re-register in case the server lost it (e.g. after login on a new device)
                    await fetch('/api/push/subscribe', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(existing.toJSON()),
                    })
                    return
                }

                // Request permission
                const permission = await Notification.requestPermission()
                if (permission !== 'granted') return

                // Subscribe
                const subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
                })

                await fetch('/api/push/subscribe', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(subscription.toJSON()),
                })
            } catch (err) {
                // Non-fatal: user may have denied notifications or SW not ready
                console.warn('[push] subscribe error:', err)
            }
        }

        subscribe()
    }, [user])
}
