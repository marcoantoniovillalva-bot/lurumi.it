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

        // --- Fetch projects + tutorials legacy in parallelo ---
        // Le due query vengono aspettate insieme prima di fare qualsiasi cleanup,
        // così lo step 3 conosce gli ID da ENTRAMBE le tabelle ed evita il flicker.
        Promise.all([
            supabase.from('projects').select('*').eq('user_id', user.id),
            supabase.from('tutorials').select('*').eq('user_id', user.id),
        ]).then(async ([projectsRes, tutorialsRes]) => {
            if (!isMounted) return

            if (projectsRes.error) console.error('[SyncOnLogin] projects error:', projectsRes.error.message)
            if (tutorialsRes.error) console.error('[SyncOnLogin] tutorials error:', tutorialsRes.error.message)

            const remoteProjects = projectsRes.data ?? []
            const remoteTutorials = tutorialsRes.data ?? []

            console.log(`[SyncOnLogin] ${remoteProjects.length} progetti · ${remoteTutorials.length} tutorial legacy`)

            const { projects, addProject, updateProject, deleteProject } = useProjectStore.getState()
            const localIds = new Set(projects.map(p => p.id))
            const remoteProjectIds = new Set(remoteProjects.map(p => p.id))
            const remoteTutorialIds = new Set(remoteTutorials.map(t => t.id))
            // ID combinati da entrambe le tabelle — usato per il cleanup locale
            const allRemoteIds = new Set([...remoteProjectIds, ...remoteTutorialIds])

            // 1. Merge projects remoti → store locale
            // Per progetti già presenti localmente usiamo un merge selettivo:
            // i campi mutabili (secs, images, counter, timer, note, videoId) potrebbero
            // essere stati modificati localmente ma non ancora sincronizzati su Supabase
            // (es. refresh immediato dopo una modifica). In quel caso preferiamo il dato
            // locale più ricco/recente per non perdere il lavoro dell'utente.
            remoteProjects.forEach(p => {
                const pType = (p.type ?? 'pdf') as 'pdf' | 'images' | 'tutorial' | 'blank'
                const remoteSecs = p.secs ?? []
                const remoteImages = (p.images ?? []).map((img: { id?: string } | string) =>
                    ({ id: typeof img === 'string' ? img : (img.id ?? '') })
                )
                const mapped = {
                    id: p.id,
                    title: p.title,
                    type: pType,
                    kind: (pType === 'pdf' ? 'pdf' : pType === 'tutorial' ? 'tutorial' : pType === 'blank' ? 'blank' : 'image') as 'pdf' | 'image' | 'tutorial' | 'blank',
                    createdAt: p.created_at ? new Date(p.created_at).getTime() : Date.now(),
                    size: p.size ?? 0,
                    counter: p.counter ?? 0,
                    timer: p.timer_seconds ?? 0,
                    secs: remoteSecs,
                    notesHtml: p.notes_html ?? '',
                    thumbDataURL: p.thumb_url ?? undefined,
                    thumbUrl: p.thumb_url ?? undefined,
                    url: p.file_url ?? undefined,
                    videoId: p.video_id ?? undefined,
                    playlistId: p.playlist_id ?? undefined,
                    transcriptData: p.transcript_data ?? undefined,
                    images: remoteImages,
                    coverImageId: p.cover_image_id ?? undefined,
                }
                if (localIds.has(p.id)) {
                    // Merge selettivo: per i campi mutabili preferisce il valore locale
                    // se è più ricco di quello remoto (stantio), altrimenti usa il remoto
                    // (che porta modifiche da altri dispositivi).
                    const loc = projects.find(lp => lp.id === p.id)!
                    updateProject(p.id, {
                        // Campi strutturali: sempre da Supabase
                        title: mapped.title,
                        type: mapped.type,
                        kind: mapped.kind,
                        url: mapped.url ?? loc.url,
                        thumbDataURL: mapped.thumbDataURL ?? loc.thumbDataURL,
                        thumbUrl: mapped.thumbUrl ?? loc.thumbUrl,
                        coverImageId: mapped.coverImageId ?? loc.coverImageId,
                        transcriptData: mapped.transcriptData ?? loc.transcriptData,
                        // Link YouTube: preferisce locale se già presente, altrimenti usa remoto
                        videoId: loc.videoId ?? mapped.videoId,
                        playlistId: loc.playlistId ?? mapped.playlistId,
                        // Campi mutabili: preferisce sempre il locale.
                        // syncProject scrive su Supabase ad ogni modifica, quindi il locale
                        // è sempre almeno aggiornato quanto il remoto sullo stesso dispositivo.
                        // Se il refresh è immediato (sync ancora in volo), il locale ha lo
                        // stato più recente (incluse eliminazioni di secs). Il sync realtime
                        // sulla project page gestisce il multi-device aggiornando il locale
                        // appena arriva la notifica PostgreSQL.
                        secs: loc.secs,
                        images: loc.images.length >= remoteImages.length ? loc.images : remoteImages,
                        counter: loc.counter,
                        timer: loc.timer,
                        notesHtml: loc.notesHtml || mapped.notesHtml,
                    })
                } else {
                    addProject(mapped)
                }
            })

            // 2. Merge tutorial legacy → store locale come type='tutorial'
            // SKIP se il tutorial è già gestito da remoteProjects (tabella projects più aggiornata):
            // la tabella tutorials non ha il campo images, quindi sovrascrivere con images:[]
            // cancellerebbe le immagini aggiunte dall'utente dopo la migrazione.
            if (remoteTutorials.length > 0) {
                const { projects: currentProjects } = useProjectStore.getState()
                const localProjectIds = new Set(currentProjects.map(p => p.id))
                remoteTutorials.forEach(t => {
                    if (remoteProjectIds.has(t.id)) return // già aggiornato da step 1 con dati completi
                    const thumbUrl = t.thumb_url ?? (t.video_id ? `https://img.youtube.com/vi/${t.video_id}/hqdefault.jpg` : '')
                    const mapped = {
                        id: t.id,
                        title: t.title ?? '',
                        type: 'tutorial' as const,
                        kind: 'tutorial' as const,
                        createdAt: t.created_at ? new Date(t.created_at).getTime() : Date.now(),
                        size: 0,
                        counter: t.counter ?? 0,
                        timer: t.timer_seconds ?? 0,
                        secs: t.secs ?? [],
                        notesHtml: t.notes_html ?? '',
                        images: [] as { id: string }[],
                        videoId: t.video_id ?? '',
                        playlistId: t.playlist_id ?? '',
                        thumbUrl,
                        thumbDataURL: thumbUrl,
                        transcriptData: t.transcript_data ?? null,
                    }
                    if (localProjectIds.has(t.id)) {
                        // La tabella `tutorials` NON viene mai aggiornata da syncProject:
                        // contiene solo lo stato iniziale del tutorial (niente secs, niente note).
                        // Se il progetto esiste già localmente, la versione locale è SEMPRE
                        // più recente di quella in tutorials → non sovrascrivere mai.
                        // (sovrascriverla è il bug che fa perdere secs/note al refresh immediato)
                        return
                    } else {
                        addProject(mapped)
                    }
                })
            }

            // 3. Carica su Supabase i progetti creati prima del login (non ancora sincronizzati)
            // syncedInStep3 traccia gli ID appena upsertati: lo step 4 non deve eliminarli.
            const syncedInStep3 = new Set<string>()
            const preLoginProjects = projects.filter(p => !allRemoteIds.has(p.id) && (p.type === 'tutorial' || p.type === 'blank' || !p.url))
            for (const p of preLoginProjects) {
                if (!isMounted) break
                try {
                    const storagePath = `${user.id}/${p.id}/main`
                    let fileUrl: string | null = null

                    if (p.type !== 'tutorial' && p.type !== 'blank') {
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
                    }

                    const { error: dbErr } = await supabase.from('projects').upsert({
                        id: p.id,
                        user_id: user.id,
                        title: p.title,
                        type: p.type,
                        file_url: fileUrl,
                        thumb_url: p.thumbDataURL ?? p.thumbUrl ?? null,
                        size: p.size,
                        counter: p.counter,
                        timer_seconds: p.timer,
                        notes_html: p.notesHtml,
                        secs: p.secs,
                        images: (p.images ?? []).map(img => ({ id: img.id })),
                        video_id: p.videoId ?? null,
                        playlist_id: p.playlistId ?? null,
                    })
                    if (!dbErr) {
                        // Segna come sincronizzato — step 4 non deve eliminarlo dal store locale
                        syncedInStep3.add(p.id)
                        if (fileUrl && isMounted) {
                            useProjectStore.getState().updateProject(p.id, { url: fileUrl })
                        }
                    }

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

            // 4. Rimuove localmente i progetti eliminati da Supabase
            // Usa allRemoteIds (projects + tutorials) così i tutorial legacy non vengono mai toccati.
            // Skip i progetti appena sincronizzati in step 3: allRemoteIds era costruita prima,
            // quindi non li include ancora, ma sono stati appena upsertati e NON vanno eliminati.
            // Skip i progetti creati di recente (< 10 min): evita falsi positivi per i progetti
            // condivisi via YouTube share target il cui upsert potrebbe non aver ancora completato.
            const RECENT_MS = 10 * 60 * 1000 // 10 minuti
            projects.forEach(p => {
                if (syncedInStep3.has(p.id)) return
                const recentlyCreated = (Date.now() - p.createdAt) < RECENT_MS
                if (recentlyCreated) return
                const wasSynced = p.url?.startsWith('https://') ||
                    (p.type === 'tutorial' && p.videoId) ||
                    (p.type === 'blank' && allRemoteIds.has(p.id))
                if (!allRemoteIds.has(p.id) && wasSynced) {
                    deleteProject(p.id)
                }
            })
        })

        return () => { isMounted = false }
    }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps
}
