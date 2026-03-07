'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useProjectStore, Project, ProjectImage } from '@/features/projects/store/useProjectStore'
import { useAuth } from '@/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'
import { luDB } from '@/lib/db'
import { loadPdfjs } from '@/lib/pdfjs'
import { Loader2, AlertCircle, FileText, ImageIcon, Plus, Check, FolderOpen } from 'lucide-react'

type Step = 'loading' | 'pdf-name' | 'image-choice' | 'image-pick-project' | 'processing' | 'error'

function parseYouTubeUrl(url: string): { videoId: string; playlistId: string } | null {
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

function generateThumbnail(file: File): Promise<string> {
    return new Promise((resolve) => {
        const img = new window.Image()
        const url = URL.createObjectURL(file)
        img.onload = () => {
            URL.revokeObjectURL(url)
            const maxDim = 120
            const scale = Math.min(maxDim / img.width, maxDim / img.height, 1)
            const canvas = document.createElement('canvas')
            canvas.width = Math.round(img.width * scale)
            canvas.height = Math.round(img.height * scale)
            canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
            resolve(canvas.toDataURL('image/jpeg', 0.7))
        }
        img.onerror = () => { URL.revokeObjectURL(url); resolve('') }
        img.src = url
    })
}

async function generatePdfThumbnail(file: File): Promise<string> {
    try {
        const pdfjsLib = await loadPdfjs()
        const arrayBuffer = await file.arrayBuffer()
        const doc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
        const page = await doc.getPage(1)
        const maxDim = 120
        const viewport = page.getViewport({ scale: 1 })
        const scale = Math.min(maxDim / viewport.width, maxDim / viewport.height)
        const scaled = page.getViewport({ scale })
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(scaled.width)
        canvas.height = Math.round(scaled.height)
        await page.render({ canvasContext: canvas.getContext('2d')!, viewport: scaled }).promise
        return canvas.toDataURL('image/jpeg', 0.7)
    } catch { return '' }
}

export default function SharePage() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const { projects, addProject, updateProject } = useProjectStore()
    const { user } = useAuth()
    const supabase = createClient()

    const [step, setStep] = useState<Step>('loading')
    const [errorMsg, setErrorMsg] = useState('')
    const [sharedFiles, setSharedFiles] = useState<File[]>([])
    const [pdfName, setPdfName] = useState('')
    const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
    const loadedRef = useRef(false)

    // Read files from SW cache
    useEffect(() => {
        if (loadedRef.current) return
        loadedRef.current = true

        const type = searchParams.get('type')
        const count = parseInt(searchParams.get('count') || '0', 10)
        const titleParam = searchParams.get('title') || ''
        const urlParam = searchParams.get('url') || ''
        const textParam = searchParams.get('text') || ''

        // Gestisci link YouTube — crea direttamente un progetto tipo tutorial
        if (type === 'youtube' || (type !== 'file' && (urlParam || textParam).match(/https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)\/\S+/))) {
            const rawUrl = urlParam || textParam
            const ytMatch = rawUrl.match(/https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)\/\S+/)
            const url = ytMatch ? ytMatch[0] : rawUrl
            if (url) {
                const parsed = parseYouTubeUrl(url)
                if (parsed) {
                    const { videoId, playlistId } = parsed
                    const newId = Math.random().toString(36).slice(2, 9)
                    const thumbUrl = videoId
                        ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
                        : 'https://placehold.co/120x120?text=Playlist'
                    const newProject: Project = {
                        id: newId,
                        title: titleParam || 'Tutorial YouTube',
                        type: 'tutorial',
                        kind: 'tutorial',
                        createdAt: Date.now(),
                        size: 0,
                        counter: 0,
                        timer: 0,
                        secs: [],
                        notesHtml: '',
                        images: [],
                        videoId,
                        playlistId,
                        thumbUrl,
                        thumbDataURL: thumbUrl,
                    }
                    addProject(newProject)
                    if (user) {
                        const supabase = createClient()
                        supabase.from('projects').upsert({
                            id: newId,
                            user_id: user.id,
                            title: newProject.title,
                            type: 'tutorial',
                            video_id: videoId,
                            playlist_id: playlistId,
                            thumb_url: thumbUrl,
                            counter: 0,
                            timer_seconds: 0,
                            notes_html: '',
                            secs: [],
                            images: [],
                        }).then(({ error }) => { if (error) console.warn('YouTube project sync failed:', error.message) })
                    }
                    router.replace(`/projects/${newId}`)
                    return
                }
            }
            setErrorMsg('Link YouTube non riconosciuto. Condividi il link direttamente dal menu del video.')
            setStep('error')
            return
        }

        if (type !== 'file' || count === 0) {
            setErrorMsg('Nessun file ricevuto dalla condivisione.')
            setStep('error')
            return
        }

        // Read files from the SW cache
        ;(async () => {
            try {
                if (!('caches' in window)) throw new Error('Cache API non disponibile')
                const cache = await caches.open('lurumi-share-files-v1')
                const files: File[] = []

                for (let i = 0; i < count; i++) {
                    const res = await cache.match(`/share-file-${i}`)
                    if (!res) continue
                    const buf = await res.arrayBuffer()
                    const contentType = res.headers.get('Content-Type') || 'application/octet-stream'
                    const rawName = res.headers.get('X-File-Name') || `file-${i}`
                    const fileName = decodeURIComponent(rawName)
                    files.push(new File([buf], fileName, { type: contentType }))
                }

                if (!files.length) throw new Error('File non trovati nella cache. Riprova la condivisione.')
                setSharedFiles(files)

                const allPdf = files.every(f => f.type === 'application/pdf')
                const allImg = files.every(f => f.type.startsWith('image/'))

                if (allPdf) {
                    setPdfName(files[0].name.replace(/\.[^/.]+$/, '') || titleParam || 'Nuovo schema')
                    setStep('pdf-name')
                } else if (allImg) {
                    setStep('image-choice')
                } else {
                    // Mixed or unknown — treat as image if any image
                    if (files.some(f => f.type.startsWith('image/'))) {
                        setSharedFiles(files.filter(f => f.type.startsWith('image/')))
                        setStep('image-choice')
                    } else {
                        throw new Error(`Tipo di file non supportato: ${files[0].type}`)
                    }
                }
            } catch (e: any) {
                setErrorMsg(e.message || 'Errore nel caricamento del file')
                setStep('error')
            }
        })()
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    // Create new project from PDF
    const handleCreatePdfProject = async () => {
        if (!pdfName.trim() || !sharedFiles.length) return
        setStep('processing')
        try {
            const file = sharedFiles[0]
            const id = Math.random().toString(36).slice(2, 9)
            const thumb = await generatePdfThumbnail(file)

            const newProject: Project = {
                id, title: pdfName.trim(), type: 'pdf', kind: 'pdf',
                createdAt: Date.now(), size: file.size,
                counter: 0, timer: 0, secs: [], notesHtml: '',
                thumbDataURL: thumb, images: [],
            }
            await luDB.saveFile({ id, blob: file })
            addProject(newProject)

            if (user) {
                const storagePath = `${user.id}/${id}/main`
                const { error: storageErr } = await supabase.storage.from('project-files').upload(storagePath, file, { upsert: true })
                if (!storageErr) {
                    const { data: { publicUrl } } = supabase.storage.from('project-files').getPublicUrl(storagePath)
                    await supabase.from('projects').upsert({
                        id, user_id: user.id, title: newProject.title, type: 'pdf',
                        file_url: publicUrl, thumb_url: thumb, size: file.size,
                        counter: 0, timer_seconds: 0, notes_html: '', secs: [], images: [],
                    })
                }
            }
            router.replace(`/projects/${id}`)
        } catch (e: any) {
            setErrorMsg(e.message || 'Errore nella creazione del progetto')
            setStep('error')
        }
    }

    // Create new project from images
    const handleCreateImageProject = async () => {
        setStep('processing')
        try {
            const id = Math.random().toString(36).slice(2, 9)
            const file = sharedFiles[0]
            const thumb = await generateThumbnail(file)
            const imgIds = sharedFiles.map((_, i) => i === 0 ? id : Math.random().toString(36).slice(2, 9))

            const newProject: Project = {
                id, title: file.name.replace(/\.[^/.]+$/, '') || 'Nuove immagini',
                type: 'images', kind: 'image', createdAt: Date.now(),
                size: sharedFiles.reduce((s, f) => s + f.size, 0),
                counter: 0, timer: 0, secs: [], notesHtml: '',
                thumbDataURL: thumb, images: imgIds.map(iid => ({ id: iid })),
            }

            for (let i = 0; i < sharedFiles.length; i++) {
                await luDB.saveFile({ id: imgIds[i], blob: sharedFiles[i] })
            }
            addProject(newProject)

            if (user) {
                const storagePath = `${user.id}/${id}/main`
                const { error: storageErr } = await supabase.storage.from('project-files').upload(storagePath, file, { upsert: true })
                if (!storageErr) {
                    const { data: { publicUrl } } = supabase.storage.from('project-files').getPublicUrl(storagePath)
                    await supabase.from('projects').upsert({
                        id, user_id: user.id, title: newProject.title, type: 'images',
                        file_url: publicUrl, thumb_url: thumb, size: newProject.size,
                        counter: 0, timer_seconds: 0, notes_html: '', secs: [],
                        images: imgIds.map(iid => ({ id: iid })),
                    })
                }
            }
            router.replace(`/projects/${id}`)
        } catch (e: any) {
            setErrorMsg(e.message || 'Errore nella creazione del progetto')
            setStep('error')
        }
    }

    // Add images to existing project
    const handleAddToProject = async () => {
        if (!selectedProjectId) return
        setStep('processing')
        try {
            const project = projects.find(p => p.id === selectedProjectId)
            if (!project) throw new Error('Progetto non trovato')

            const newImgIds = sharedFiles.map(() => Math.random().toString(36).slice(2, 9))
            for (let i = 0; i < sharedFiles.length; i++) {
                await luDB.saveFile({ id: newImgIds[i], blob: sharedFiles[i] })
            }

            const updatedImages: ProjectImage[] = [
                ...(project.images ?? []),
                ...newImgIds.map(iid => ({ id: iid })),
            ]
            updateProject(selectedProjectId, { images: updatedImages })

            if (user) {
                await supabase.from('projects').update({ images: updatedImages }).eq('id', selectedProjectId).eq('user_id', user.id)
            }

            router.replace(`/projects/${selectedProjectId}`)
        } catch (e: any) {
            setErrorMsg(e.message || 'Errore nell\'aggiunta delle immagini')
            setStep('error')
        }
    }

    // ── UI ────────────────────────────────────────────────────────────────────

    if (step === 'loading' || step === 'processing') {
        return (
            <div className="min-h-screen flex items-center justify-center p-6">
                <div className="text-center">
                    <div className="flex items-center gap-2 justify-center text-[#9AA2B1]">
                        <Loader2 size={24} className="animate-spin" />
                        <span className="font-bold">{step === 'processing' ? 'Salvataggio in corso…' : 'Caricamento file…'}</span>
                    </div>
                </div>
            </div>
        )
    }

    if (step === 'error') {
        return (
            <div className="min-h-screen flex items-center justify-center p-6">
                <div className="max-w-sm w-full bg-white rounded-[32px] p-8 shadow-xl border border-[#EEF0F4] text-center">
                    <AlertCircle size={48} className="mx-auto mb-4 text-red-400" />
                    <h2 className="text-xl font-black text-[#1C1C1E] mb-2">Errore condivisione</h2>
                    <p className="text-sm text-[#9AA2B1] font-medium mb-6">{errorMsg}</p>
                    <button onClick={() => router.replace('/')} className="w-full h-12 bg-[#7B5CF6] text-white rounded-2xl font-bold">
                        Vai ai Progetti
                    </button>
                </div>
            </div>
        )
    }

    if (step === 'pdf-name') {
        return (
            <div className="min-h-screen flex items-center justify-center p-6">
                <div className="max-w-sm w-full bg-white rounded-[32px] p-8 shadow-xl border border-[#EEF0F4]">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center">
                            <FileText size={24} className="text-red-500" />
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-[#1C1C1E]">Nuovo schema PDF</h2>
                            <p className="text-xs text-[#9AA2B1] font-medium">{sharedFiles[0]?.name}</p>
                        </div>
                    </div>
                    <label className="block text-xs font-bold text-[#9AA2B1] uppercase tracking-wider mb-2">Nome progetto</label>
                    <input
                        autoFocus
                        value={pdfName}
                        onChange={e => setPdfName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleCreatePdfProject() }}
                        placeholder="Nome del progetto"
                        className="w-full h-12 px-4 border border-[#EEF0F4] rounded-2xl text-sm font-bold outline-none focus:border-[#7B5CF6] mb-4"
                    />
                    <button
                        onClick={handleCreatePdfProject}
                        disabled={!pdfName.trim()}
                        className="w-full h-12 bg-[#7B5CF6] text-white rounded-2xl font-bold disabled:opacity-40"
                    >
                        Crea Progetto
                    </button>
                </div>
            </div>
        )
    }

    if (step === 'image-choice') {
        return (
            <div className="min-h-screen flex items-center justify-center p-6">
                <div className="max-w-sm w-full bg-white rounded-[32px] p-8 shadow-xl border border-[#EEF0F4]">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-12 h-12 bg-purple-50 rounded-2xl flex items-center justify-center">
                            <ImageIcon size={24} className="text-[#7B5CF6]" />
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-[#1C1C1E]">
                                {sharedFiles.length === 1 ? '1 immagine condivisa' : `${sharedFiles.length} immagini condivise`}
                            </h2>
                            <p className="text-xs text-[#9AA2B1] font-medium">Come vuoi aggiungerla?</p>
                        </div>
                    </div>
                    <div className="grid gap-3">
                        <button
                            onClick={handleCreateImageProject}
                            className="w-full h-14 bg-[#7B5CF6] text-white rounded-2xl font-bold flex items-center gap-3 px-5"
                        >
                            <Plus size={20} />
                            <span>Crea nuovo progetto</span>
                        </button>
                        <button
                            onClick={() => setStep('image-pick-project')}
                            disabled={projects.length === 0}
                            className="w-full h-14 bg-[#F4EEFF] text-[#7B5CF6] rounded-2xl font-bold flex items-center gap-3 px-5 disabled:opacity-40"
                        >
                            <FolderOpen size={20} />
                            <span>Aggiungi a progetto esistente</span>
                        </button>
                    </div>
                    {projects.length === 0 && (
                        <p className="text-xs text-[#9AA2B1] text-center mt-3 font-medium">Non hai ancora nessun progetto</p>
                    )}
                </div>
            </div>
        )
    }

    if (step === 'image-pick-project') {
        const imageProjects = projects.filter(p => p.type === 'images' || p.type === 'tutorial' || p.type === 'blank')
        return (
            <div className="min-h-screen flex flex-col p-6 pt-10 max-w-md mx-auto">
                <h2 className="text-2xl font-black text-[#1C1C1E] mb-1">Scegli il progetto</h2>
                <p className="text-sm text-[#9AA2B1] font-medium mb-6">Seleziona dove aggiungere {sharedFiles.length === 1 ? "l'immagine" : `le ${sharedFiles.length} immagini`}</p>
                {imageProjects.length === 0 ? (
                    <div className="text-center py-10">
                        <p className="text-[#9AA2B1] font-medium mb-4">Nessun progetto immagine trovato</p>
                        <button onClick={() => setStep('image-choice')} className="text-[#7B5CF6] font-bold text-sm">← Indietro</button>
                    </div>
                ) : (
                    <div className="grid gap-2 flex-1 overflow-auto mb-4">
                        {imageProjects.map(p => (
                            <button
                                key={p.id}
                                onClick={() => setSelectedProjectId(prev => prev === p.id ? null : p.id)}
                                className={`w-full flex items-center gap-3 p-3.5 rounded-2xl border transition-all text-left ${selectedProjectId === p.id ? 'border-[#7B5CF6] bg-[#F4EEFF]' : 'border-[#EEF0F4] bg-white'}`}
                            >
                                {p.thumbDataURL ? (
                                    <img src={p.thumbDataURL} alt={p.title} className="w-12 h-12 rounded-xl object-cover flex-shrink-0" />
                                ) : (
                                    <div className="w-12 h-12 rounded-xl bg-[#F4F4F8] flex items-center justify-center flex-shrink-0">
                                        <ImageIcon size={20} className="text-[#9AA2B1]" />
                                    </div>
                                )}
                                <div className="min-w-0 flex-1">
                                    <p className="font-bold text-[#1C1C1E] truncate">{p.title}</p>
                                    <p className="text-xs text-[#9AA2B1] font-medium">{p.images?.length ?? 0} immagini</p>
                                </div>
                                {selectedProjectId === p.id && <Check size={18} className="text-[#7B5CF6] flex-shrink-0" />}
                            </button>
                        ))}
                    </div>
                )}
                <div className="grid gap-2">
                    <button
                        onClick={handleAddToProject}
                        disabled={!selectedProjectId}
                        className="w-full h-12 bg-[#7B5CF6] text-white rounded-2xl font-bold disabled:opacity-40"
                    >
                        Aggiungi al progetto
                    </button>
                    <button onClick={() => setStep('image-choice')} className="w-full h-12 text-[#9AA2B1] font-bold text-sm">
                        ← Indietro
                    </button>
                </div>
            </div>
        )
    }

    return null
}
