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
            const params = new URLSearchParams({ type: 'file', count: String(files.length), title: String(title), auto: 'true' })
            return NextResponse.redirect(new URL(`/share?${params}`, req.url), 303)
        }

        const params = new URLSearchParams({ title, text, url: combined })
        return NextResponse.redirect(new URL(`/share?${params}`, req.url), 303)
    } catch {
        return NextResponse.redirect(new URL('/share?error=parse', req.url), 303)
    }
}
