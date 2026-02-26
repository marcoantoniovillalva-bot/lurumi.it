'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useProjectStore } from '@/features/projects/store/useProjectStore'
import type { User } from '@supabase/supabase-js'

export function useSyncOnLogin(user: User | null) {
    const syncedRef = useRef<string | null>(null)

    useEffect(() => {
        if (!user || syncedRef.current === user.id) return
        syncedRef.current = user.id

        const supabase = createClient()

        // --- Projects ---
        supabase
            .from('projects')
            .select('*')
            .eq('user_id', user.id)
            .then(({ data, error }) => {
                if (error) {
                    console.error('[SyncOnLogin] projects error:', error.message)
                    return
                }
                if (!data || data.length === 0) {
                    console.log('[SyncOnLogin] nessun progetto su Supabase')
                    return
                }
                console.log(`[SyncOnLogin] ${data.length} progetti trovati su Supabase`)

                // Legge lo stato corrente dello store al momento della callback (evita stale closure)
                const { projects, addProject, updateProject } = useProjectStore.getState()
                const localIds = new Set(projects.map(p => p.id))

                data.forEach(p => {
                    const mapped = {
                        id: p.id,
                        title: p.title,
                        type: (p.type ?? 'pdf') as 'pdf' | 'images',
                        kind: (p.type === 'pdf' ? 'pdf' : 'image') as 'pdf' | 'image',
                        createdAt: p.created_at ? new Date(p.created_at).getTime() : Date.now(),
                        size: p.size ?? 0,
                        counter: p.counter ?? 0,
                        timer: p.timer_seconds ?? 0,
                        secs: p.secs ?? [],
                        notesHtml: p.notes_html ?? '',
                        thumbDataURL: p.thumb_url ?? undefined,
                        images: (p.images ?? []).map((img: { id?: string } | string) =>
                            ({ id: typeof img === 'string' ? img : (img.id ?? '') })
                        ),
                    }
                    if (localIds.has(p.id)) {
                        updateProject(p.id, mapped)
                    } else {
                        addProject(mapped)
                    }
                })
            })

        // --- Tutorials ---
        supabase
            .from('tutorials')
            .select('*')
            .eq('user_id', user.id)
            .then(({ data, error }) => {
                if (error) {
                    console.error('[SyncOnLogin] tutorials error:', error.message)
                    return
                }
                if (!data || data.length === 0) {
                    console.log('[SyncOnLogin] nessun tutorial su Supabase')
                    return
                }
                console.log(`[SyncOnLogin] ${data.length} tutorial trovati su Supabase`)

                const { tutorials, addTutorial, updateTutorial } = useProjectStore.getState()
                const localIds = new Set(tutorials.map(t => t.id))

                data.forEach(t => {
                    const mapped = {
                        id: t.id,
                        title: t.title ?? '',
                        url: t.url ?? '',
                        videoId: t.video_id ?? '',
                        playlistId: t.playlist_id ?? '',
                        thumbUrl: t.thumb_url ?? '',
                        createdAt: t.created_at ? new Date(t.created_at).getTime() : Date.now(),
                        counter: t.counter ?? 0,
                        timer: t.timer_seconds ?? 0,
                        secs: t.secs ?? [],
                        notesHtml: t.notes_html ?? '',
                    }
                    if (localIds.has(t.id)) {
                        updateTutorial(t.id, mapped)
                    } else {
                        addTutorial(mapped)
                    }
                })
            })
    }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps
}
