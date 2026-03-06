'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useProjectStore, Tutorial } from '@/features/projects/store/useProjectStore'
import { useAuth } from '@/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'
import { Youtube, Loader2, AlertCircle } from 'lucide-react'

function parseYouTube(url: string): { videoId: string; playlistId: string } | null {
    try {
        const u = new URL(url)
        let videoId = ''
        let playlistId = u.searchParams.get('list') || ''
        if (u.hostname.includes('youtu.be')) {
            videoId = u.pathname.slice(1).split('/')[0]
        } else if (u.hostname.includes('youtube.com')) {
            if (u.pathname.startsWith('/watch')) videoId = u.searchParams.get('v') || ''
            else if (u.pathname.startsWith('/shorts/')) videoId = u.pathname.split('/')[2]
        }
        if (!videoId && !playlistId) return null
        return { videoId, playlistId }
    } catch { return null }
}

export default function TutorialSharePage() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const { addTutorial } = useProjectStore()
    const { user } = useAuth()
    const [status, setStatus] = useState<'loading' | 'error'>('loading')
    const [errorMsg, setErrorMsg] = useState('')

    useEffect(() => {
        const title = searchParams.get('title') || ''
        const text = searchParams.get('text') || ''
        // YouTube share sends the URL in 'url' param, sometimes in 'text'
        const rawUrl = searchParams.get('url') || text || ''

        // Extract YouTube URL from text (may be mixed with other text)
        const urlMatch = rawUrl.match(/https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)\/\S+/)
        const url = urlMatch ? urlMatch[0] : rawUrl

        if (!url) {
            setErrorMsg('Nessun link YouTube ricevuto. Condividi il link dal menu del video.')
            setStatus('error')
            return
        }

        const parsed = parseYouTube(url)
        if (!parsed) {
            setErrorMsg(`Link non riconosciuto come YouTube: ${url.slice(0, 60)}`)
            setStatus('error')
            return
        }

        const { videoId, playlistId } = parsed
        const tutorial: Tutorial = {
            id: Math.random().toString(36).slice(2, 9),
            title: title || 'Tutorial YouTube',
            url,
            videoId,
            playlistId,
            thumbUrl: videoId
                ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
                : 'https://placehold.co/120x120?text=Playlist',
            createdAt: Date.now(),
            counter: 0,
            timer: 0,
            secs: [],
            notesHtml: '',
        }

        addTutorial(tutorial)

        if (user) {
            const supabase = createClient()
            supabase.from('tutorials').upsert({
                id: tutorial.id,
                user_id: user.id,
                title: tutorial.title,
                url: tutorial.url,
                video_id: tutorial.videoId,
                playlist_id: tutorial.playlistId,
                thumb_url: tutorial.thumbUrl,
                counter: 0,
                timer_seconds: 0,
                notes_html: '',
            }).then(({ error }) => { if (error) console.warn('Share tutorial sync failed:', error.message) })
        }

        router.replace(`/tutorials/${tutorial.id}`)
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    if (status === 'error') {
        return (
            <div className="min-h-screen flex items-center justify-center p-6">
                <div className="max-w-sm w-full bg-white rounded-[32px] p-8 shadow-xl border border-[#EEF0F4] text-center">
                    <AlertCircle size={48} className="mx-auto mb-4 text-red-400" />
                    <h2 className="text-xl font-black text-[#1C1C1E] mb-2">Link non valido</h2>
                    <p className="text-sm text-[#9AA2B1] font-medium mb-6">{errorMsg}</p>
                    <button
                        onClick={() => router.replace('/tutorials')}
                        className="w-full h-12 bg-[#7B5CF6] text-white rounded-2xl font-bold"
                    >
                        Vai ai Tutorial
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-6">
            <div className="text-center">
                <Youtube size={48} className="mx-auto mb-4 text-red-500" />
                <div className="flex items-center gap-2 justify-center text-[#9AA2B1]">
                    <Loader2 size={20} className="animate-spin" />
                    <span className="font-bold">Aggiungendo tutorial...</span>
                </div>
            </div>
        </div>
    )
}
