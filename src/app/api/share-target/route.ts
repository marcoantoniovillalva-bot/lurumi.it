import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData()
        const title = formData.get('title')?.toString() ?? ''
        const text = formData.get('text')?.toString() ?? ''
        const url = formData.get('url')?.toString() ?? ''
        const files = formData.getAll('media')

        const combined = url || text
        const ytMatch = combined.match(/https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)\/\S+/)

        if (ytMatch) {
            const params = new URLSearchParams({ type: 'youtube', title, url: ytMatch[0] })
            return NextResponse.redirect(new URL(`/share?${params}`, req.url), 303)
        }

        if (files.length > 0) {
            if (typeof window !== 'undefined' && 'caches' in window) {
                const cache = await caches.open('lurumi-share-files-v1')
                const oldKeys = await cache.keys()
                await Promise.all(oldKeys.map(k => cache.delete(k)))
                await cache.put('/share-meta', new Response(JSON.stringify({
                    title: String(title),
                    count: files.length,
                    ts: Date.now(),
                }), { headers: { 'Content-Type': 'application/json' } }))
                for (let i = 0; i < files.length; i++) {
                    const file = files[i] as File
                    const buf = await file.arrayBuffer()
                    await cache.put(`/share-file-${i}`, new Response(buf, {
                        headers: {
                            'Content-Type': file.type || 'application/octet-stream',
                            'X-File-Name': encodeURIComponent(file.name || `file-${i}`),
                            'X-File-Size': String(file.size || 0),
                        }
                    }))
                }
            }
            const params = new URLSearchParams({ type: 'file', count: String(files.length), title: String(title), auto: 'true' })
            return NextResponse.redirect(new URL(`/share?${params}`, req.url), 303)
        }

        const params = new URLSearchParams({ title, text, url: combined })
        return NextResponse.redirect(new URL(`/share?${params}`, req.url), 303)
    } catch {
        return NextResponse.redirect(new URL('/share?error=parse', req.url), 303)
    }
}
