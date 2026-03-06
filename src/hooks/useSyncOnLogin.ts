'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useProjectStore } from '@/features/projects/store/useProjectStore'
import { luDB } from '@/lib/db'
import type { User } from '@supabase/supabase-js'

export function useSyncOnLogin(user: User | null) {
    const syncedRef = useRef<string | null>(null)

    useEffect(() => {
        // Reset alla logout — permette di ri-sincronizzare al prossimo login
        if (!user) {
            syncedRef.current = null
            return
        }
        if (syncedRef.current === user.id) return
        syncedRef.current = user.id

        let isMounted = true
        const supabase = createClient()

        // --- Projects ---
        supabase
            .from('projects')
            .select('*')
            .eq('user_id', user.id)
            .then(async ({ data, error }) => {
                if (!isMounted) return
                if (error) {
                    console.error('[SyncOnLogin] projects error:', error.message)
                    return
                }

                const remote = data ?? []
                console.log(`[SyncOnLogin] ${remote.length} progetti su Supabase`)

                const { projects, addProject, updateProject, deleteProject } = useProjectStore.getState()
                const localIds = new Set(projects.map(p => p.id))
                const remoteIds = new Set(remote.map(p => p.id))

                // 1. Merge remote → store locale
                remote.forEach(p => {
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
                        url: p.file_url ?? undefined,
                        images: (p.images ?? []).map((img: { id?: string } | string) =>
                            ({ id: typeof img === 'string' ? img : (img.id ?? '') })
                        ),
                        coverImageId: p.cover_image_id ?? undefined,
                    }
                    if (localIds.has(p.id)) updateProject(p.id, mapped)
                    else addProject(mapped)
                })

                // 2. Carica su Supabase i progetti creati prima del login (non ancora sincronizzati)
                // Un progetto è pre-login se non è in Supabase E non ha url Supabase Storage
                const preLoginProjects = projects.filter(p => !remoteIds.has(p.id) && !p.url)
                for (const p of preLoginProjects) {
                    if (!isMounted) break
                    try {
                        const storagePath = `${user.id}/${p.id}/main`
                        let fileUrl: string | null = null

                        const dbRecord = await luDB.getFile(p.id)
                        if (dbRecord?.blob) {
                            const { error: upErr } = await supabase.storage
                                .from('project-files')
                                .upload(storagePath, dbRecord.blob, { upsert: true })
                            if (!upErr) {
                                fileUrl = supabase.storage.from('project-files')
                                    .getPublicUrl(storagePath).data.publicUrl
                            }
                        }

                        const { error: dbErr } = await supabase.from('projects').upsert({
                            id: p.id,
                            user_id: user.id,
                            title: p.title,
                            type: p.type,
                            file_url: fileUrl,
                            thumb_url: p.thumbDataURL ?? null,
                            size: p.size,
                            counter: p.counter,
                            timer_seconds: p.timer,
                            notes_html: p.notesHtml,
                            secs: p.secs,
                            images: (p.images ?? []).map(img => ({ id: img.id })),
                        })
                        if (!dbErr && fileUrl && isMounted) {
                            useProjectStore.getState().updateProject(p.id, { url: fileUrl })
                        }

                        // Carica anche le immagini aggiuntive (oltre a quella principale)
                        const extraImgs = (p.images ?? []).filter(img => img.id !== p.id)
                        for (const img of extraImgs) {
                            if (!isMounted) break
                            const imgRec = await luDB.getFile(img.id)
                            if (imgRec?.blob) {
                                await supabase.storage.from('project-files')
                                    .upload(`${user.id}/${p.id}/${img.id}`, imgRec.blob, { upsert: true })
                                    .catch(() => {})
                            }
                        }
                    } catch (err) {
                        console.error('[SyncOnLogin] upload progetto pre-login fallito:', err)
                    }
                }

                // 3. Rimuove localmente i progetti eliminati da Supabase
                // Usa p.url come marcatore affidabile di "già sincronizzato in passato"
                // (i progetti pre-login non hanno url, quindi non vengono toccati)
                projects.forEach(p => {
                    if (!remoteIds.has(p.id) && p.url?.startsWith('https://')) {
                        deleteProject(p.id)
                    }
                })
            })

        // --- Tutorials ---
        supabase
            .from('tutorials')
            .select('*')
            .eq('user_id', user.id)
            .then(async ({ data, error }) => {
                if (!isMounted) return
                if (error) {
                    console.error('[SyncOnLogin] tutorials error:', error.message)
                    return
                }

                const remote = data ?? []
                console.log(`[SyncOnLogin] ${remote.length} tutorial su Supabase`)

                const { tutorials, addTutorial, updateTutorial } = useProjectStore.getState()
                const localIds = new Set(tutorials.map(t => t.id))
                const remoteIds = new Set(remote.map(t => t.id))

                // 1. Merge remote → store locale
                remote.forEach(t => {
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
                        transcriptData: t.transcript_data ?? null,
                    }
                    if (localIds.has(t.id)) updateTutorial(t.id, mapped)
                    else addTutorial(mapped)
                })

                // 2. Carica su Supabase i tutorial creati prima del login
                const preLoginTutorials = tutorials.filter(t => !remoteIds.has(t.id))
                for (const t of preLoginTutorials) {
                    if (!isMounted) break
                    supabase.from('tutorials').upsert({
                        id: t.id,
                        user_id: user.id,
                        title: t.title,
                        url: t.url,
                        video_id: t.videoId,
                        playlist_id: t.playlistId,
                        thumb_url: t.thumbUrl,
                        counter: t.counter,
                        timer_seconds: t.timer,
                        secs: t.secs,
                        notes_html: t.notesHtml,
                    }).then(({ error: e }) => {
                        if (e) console.warn('[SyncOnLogin] tutorial upload fallito:', e.message)
                    })
                }

                // Nota: non eliminiamo tutorial locali basandoci sulla lista Supabase perché
                // i tutorial YouTube hanno thumbUrl 'https://...' anche se pre-login
                // (impossibile distinguerli da quelli già sincronizzati).
                // Le eliminazioni remote sono gestite dal Realtime in tempo reale.
            })

        return () => { isMounted = false }
    }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps
}
