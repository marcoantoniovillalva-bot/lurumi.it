import { NextRequest, NextResponse } from 'next/server'

// Fallback server-side handler for PWA Web Share Target.
// The Service Worker handles this normally (buffers files + redirect),
// but if the SW is inactive/outdated this route catches the POST to avoid 405.
export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData()
        const title = formData.get('title')?.toString() ?? ''
        const text = formData.get('text')?.toString() ?? ''
        const url = formData.get('url')?.toString() ?? ''

        const combined = url || text
        const ytMatch = combined.match(/https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)\/\S+/)

        if (ytMatch) {
            const params = new URLSearchParams({ title, text, url: ytMatch[0] })
            return NextResponse.redirect(new URL(`/tutorials/share?${params}`, req.url), 303)
        }

        // Generic URL share — redirect to /share page with params
        const params = new URLSearchParams({ title, text, url: combined })
        return NextResponse.redirect(new URL(`/share?${params}`, req.url), 303)
    } catch {
        return NextResponse.redirect(new URL('/share?error=parse', req.url), 303)
    }
}
