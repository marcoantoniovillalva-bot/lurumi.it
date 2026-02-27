// Custom Service Worker code — merged by next-pwa into the generated SW

self.addEventListener('push', (event) => {
    if (!event.data) return

    let payload
    try {
        payload = event.data.json()
    } catch {
        payload = { title: 'Lurumi', body: event.data.text() }
    }

    const title = payload.title || 'Lurumi'
    const options = {
        body: payload.body || '',
        icon: '/images/logo/isotipo.png',
        badge: '/images/logo/isotipo.png',
        tag: payload.tag || 'lurumi-chat',
        data: { url: payload.url || '/eventi' },
        renotify: true,
    }

    event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
    event.notification.close()
    const url = event.notification.data?.url || '/eventi'
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            for (const client of clientList) {
                if (client.url.includes(url) && 'focus' in client) {
                    return client.focus()
                }
            }
            if (clients.openWindow) return clients.openWindow(url)
        })
    )
})
