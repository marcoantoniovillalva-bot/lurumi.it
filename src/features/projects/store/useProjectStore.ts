import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export interface RoundCounter {
    id: string
    name: string
    value: number
    imageId?: string
}

export interface ProjectImage {
    id: string
    url?: string
    blob?: Blob
    dataURL?: string
    thumbDataURL?: string
}

export interface Project {
    id: string
    title: string
    type: 'pdf' | 'images'
    kind: 'pdf' | 'image'
    createdAt: number
    size: number
    blob?: Blob
    url?: string
    thumbDataURL?: string
    counter: number
    timer: number
    secs: RoundCounter[]
    notesHtml: string
    images: ProjectImage[]
    coverImageId?: string
}

export interface TranscriptSegment {
    text: string
    start: number
    duration: number
}

export interface TranscriptData {
    transcript: TranscriptSegment[]
    translated: TranscriptSegment[] | null
    generated_at: string
    has_translation: boolean
}

export interface Tutorial {
    id: string
    title: string
    url: string
    videoId: string
    playlistId: string
    thumbUrl: string
    createdAt: number
    counter: number
    timer: number
    secs: RoundCounter[]
    notesHtml: string
    transcriptData?: TranscriptData | null
}

interface ProjectState {
    projects: Project[]
    tutorials: Tutorial[]

    // Project Actions
    addProject: (project: Project) => void
    updateProject: (id: string, updates: Partial<Project>) => void
    deleteProject: (id: string) => void

    // Tutorial Actions
    addTutorial: (tutorial: Tutorial) => void
    updateTutorial: (id: string, updates: Partial<Tutorial>) => void
    deleteTutorial: (id: string) => void

    // Utility
    getProject: (id: string) => Project | undefined
    getTutorial: (id: string) => Tutorial | undefined
}

// Safe localStorage wrapper — gestisce QuotaExceededError senza crashare
const safeLocalStorage = {
    getItem: (name: string): string | null => {
        try { return localStorage.getItem(name) } catch { return null }
    },
    setItem: (name: string, value: string): void => {
        try {
            localStorage.setItem(name, value)
        } catch (err: any) {
            // QuotaExceededError (codice 22 su tutti i browser, 1014 su Firefox)
            if (err?.name === 'QuotaExceededError' || err?.code === 22 || err?.code === 1014) {
                console.warn('[Store] localStorage quota superata — riprovo senza thumbnail...')
                try {
                    const parsed = JSON.parse(value)
                    if (parsed?.state?.projects) {
                        parsed.state.projects = parsed.state.projects.map((p: any) => ({
                            ...p, thumbDataURL: undefined,
                        }))
                    }
                    localStorage.setItem(name, JSON.stringify(parsed))
                } catch {
                    console.error('[Store] localStorage write fallito anche dopo aver rimosso le thumbnail')
                }
            }
        }
    },
    removeItem: (name: string): void => {
        try { localStorage.removeItem(name) } catch {}
    },
}

export const useProjectStore = create<ProjectState>()(
    persist(
        (set, get) => ({
            projects: [],
            tutorials: [],

            addProject: (project) => set((state) => ({
                projects: [project, ...state.projects]
            })),

            updateProject: (id, updates) => set((state) => ({
                projects: state.projects.map((p) => p.id === id ? { ...p, ...updates } : p)
            })),

            deleteProject: (id) => set((state) => ({
                projects: state.projects.filter((p) => p.id !== id)
            })),

            addTutorial: (tutorial) => set((state) => ({
                tutorials: [tutorial, ...state.tutorials]
            })),

            updateTutorial: (id, updates) => set((state) => ({
                tutorials: state.tutorials.map((t) => t.id === id ? { ...t, ...updates } : t)
            })),

            deleteTutorial: (id) => set((state) => ({
                tutorials: state.tutorials.filter((t) => t.id !== id)
            })),

            getProject: (id) => get().projects.find((p) => p.id === id),
            getTutorial: (id) => get().tutorials.find((t) => t.id === id),
        }),
        {
            name: 'lurumi-project-storage',
            storage: createJSONStorage(() => safeLocalStorage),
            // Strip image dataURLs — they go in IndexedDB, not localStorage (5MB limit)
            partialize: (state) => ({
                projects: state.projects.map(p => ({
                    ...p,
                    images: (p.images ?? []).map(img => ({ id: img.id })),
                    blob: undefined,
                })),
                tutorials: state.tutorials,
            }),
        }
    )
)
