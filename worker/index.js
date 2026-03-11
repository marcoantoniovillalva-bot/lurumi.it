// Custom Service Worker code — merged by next-pwa into the generated SW

// ── Web Share Target: intercetta POST /share ─────────────────────────────────
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url)
    if ((url.pathname !== '/share' && url.pathname !== '/api/share-target') || event.request.method !== 'POST') return

    event.respondWith((async () => {
        const formData = await event.request.formData()
        const title = formData.get('title') || ''
        const text = formData.get('text') || ''
        const urlParam = formData.get('url') || ''
        const files = formData.getAll('media')

        // Se arrivano file (PDF o immagini) → salviamo nel client tramite broadcast o storage
        if (files.length > 0) {
            // Salva nel localStorage del client (più affidabile della cache)
            const fileDataArray = []
            for (let i = 0; i < files.length; i++) {
                const file = files[i]
                const buf = await file.arrayBuffer()
                const base64 = btoa(String.fromCharCode(...new Uint8Array(buf)))
                fileDataArray.push({
                    name: file.name,
                    type: file.type,
                    size: file.size,
                    data: base64
                })
            }
            
            // Salva nel localStorage
            const storageData = {
                files: fileDataArray,
                title: String(title),
                count: files.length,
                ts: Date.now()
            }
            
            // Prova a salvare, se fallisce (quota exceeded) continua con cache
            try {
                localStorage.setItem('lurumi-shared-files', JSON.stringify(storageData))
            } catch (e) {
                console.warn('localStorage quota exceeded, using cache fallback')
            }
            
            const params = new URLSearchParams({ type: 'file', count: String(files.length), title: String(title), auto: 'true', source: 'sw' })
            return Response.redirect(`/share?${params}`, 303)
        }

        // Nessun file: controlla se è un URL YouTube → crea progetto tipo tutorial
        const ytMatch = String(urlParam || text).match(/https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)\/\S+/)
        if (ytMatch) {
            const params = new URLSearchParams({ type: 'youtube', title: String(title), url: ytMatch[0] })
            return Response.redirect(`/share?${params}`, 303)
        }

        // Fallback generico
        const params = new URLSearchParams({ title: String(title), text: String(text), url: String(urlParam) })
        return Response.redirect(`/share?${params}`, 303)
    })()
})

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
