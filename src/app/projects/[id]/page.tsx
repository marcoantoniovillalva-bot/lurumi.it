"use client";

import React, { useState, useEffect, useRef } from "react";
import {
    ArrowLeft, Minus, Plus, RotateCcw, Timer, Share2,
    ChevronLeft, ChevronRight, StickyNote, Trash2,
    Plus as PlusIcon, Camera, Save, Maximize2, Archive, Pencil,
    GripVertical, ChevronUp, ChevronDown, FileDown, X, Sparkles, CheckCircle2,
    Youtube, Languages, Loader2, Copy, Check, FileText, ExternalLink,
    MoreVertical, FolderPlus, AlertTriangle
} from "lucide-react";
import { useProjectStore, Project, RoundCounter as RoundCounterType, ProjectImage, TranscriptData, TranscriptSegment, Section } from "@/features/projects/store/useProjectStore";
import { luDB } from "@/lib/db";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { RoundCounter } from "@/features/projects/components/RoundCounter";
import { CounterImagePicker } from "@/features/projects/components/CounterImagePicker";
import { FullscreenViewer } from "@/components/FullscreenViewer";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { loadPdfjs } from "@/lib/pdfjs";
import { compressImage } from "@/lib/compress-image";



export default function ProjectDetail() {
    const { id } = useParams();
    const router = useRouter();
    const { projects, updateProject, migrateIfNeeded } = useProjectStore();
    const { user } = useAuth();

    // Garantisce la migrazione tutorials→projects anche se l'utente apre direttamente /projects/[id]
    useEffect(() => { migrateIfNeeded(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
    const project = projects.find(p => p.id === id);

    const syncProject = (fields: Record<string, unknown>) => {
        if (!user || !id) return;
        // Legge lo stato CORRENTE dallo store per evitare il bug di stale closure:
        // il timer (setInterval) cattura la versione di syncProject al momento della sua creazione,
        // quindi senza questa lettura fresca invierebbe a Supabase i valori vecchi (es. secs:[])
        // sovrascrivendo le modifiche fatte dopo l'avvio del timer.
        const currentProject = useProjectStore.getState().projects.find(p => p.id === (id as string));
        if (!currentProject) return;
        const supabase = createClient();
        // Upsert anziché update: garantisce che i tutorial legacy (solo in tabella tutorials)
        // vengano migrati automaticamente in projects al primo salvataggio di qualsiasi campo.
        supabase.from('projects')
            .upsert({
                id,
                user_id: user.id,
                title: currentProject.title,
                type: currentProject.type,
                video_id: currentProject.videoId ?? null,
                playlist_id: currentProject.playlistId ?? null,
                thumb_url: currentProject.thumbUrl ?? currentProject.thumbDataURL ?? null,
                counter: currentProject.counter,
                timer_seconds: currentProject.timer,
                notes_html: currentProject.notesHtml,
                secs: currentProject.secs,
                sections: currentProject.sections ?? [],
                images: (currentProject.images ?? []).map(img => ({ id: img.id })),
                ...fields, // sovrascrive i campi aggiornati
            })
            .then(({ error }) => { if (error) console.warn('project sync failed:', error.message); });
    };

    const syncSecs = (newSecs: RoundCounterType[]) => syncProject({ secs: newSecs });
    const syncSections = (newSections: Section[], newSecs?: RoundCounterType[]) => {
        const update: Record<string, unknown> = { sections: newSections };
        if (newSecs !== undefined) update.secs = newSecs;
        syncProject(update);
    };

    const [pdfDoc, setPdfDoc] = useState<any>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(0);
    const [isTimerRunning, setIsTimerRunning] = useState(false);
    // Inizializzazione diretta da project (in localStorage al mount) — evita il flash a 0
    // e previene che il debounce delle note scatti falsamente al primo render.
    const [elapsedTime, setElapsedTime] = useState(() => project?.timer ?? 0);
    const [isEditingNotes, setIsEditingNotes] = useState(false);
    const [notes, setNotes] = useState(() => project?.notesHtml || '');
    const [showNewCounterModal, setShowNewCounterModal] = useState(false);
    const [newCounterName, setNewCounterName] = useState("");
    const [pickerCounterId, setPickerCounterId] = useState<string | null>(null);
    const [fullscreen, setFullscreen] = useState(false);
    const [hintVisible, setHintVisible] = useState(true);
    // Image data URLs loaded from IndexedDB (NOT stored in Zustand/localStorage)
    const [imageUrls, setImageUrls] = useState<string[]>([]);

    // Reorder states (counters — ungrouped backward compat)
    const [reorderMode, setReorderMode] = useState(false);
    const [dragIdx, setDragIdx] = useState<number | null>(null);
    const [overIdx, setOverIdx] = useState<number | null>(null);
    // Section management
    const [showNewSectionModal, setShowNewSectionModal] = useState(false);
    const [newSectionTitle, setNewSectionTitle] = useState("");
    const [newSectionDescription, setNewSectionDescription] = useState("");
    const [reorderSectionsMode, setReorderSectionsMode] = useState(false);
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
    const [reorderInSectionId, setReorderInSectionId] = useState<string | null>(null);
    const [sectionMenuId, setSectionMenuId] = useState<string | null>(null);
    const [editSectionModal, setEditSectionModal] = useState<{ id: string; title: string; description: string } | null>(null);
    const [deleteSectionId, setDeleteSectionId] = useState<string | null>(null);
    const [newCounterSectionId, setNewCounterSectionId] = useState<string | null>(null);
    const [assignCounterToSectionId, setAssignCounterToSectionId] = useState<string | null>(null);
    // Image manager states
    const [showImageManager, setShowImageManager] = useState(false);
    const [imgDragIdx, setImgDragIdx] = useState<number | null>(null);
    const [imgOverIdx, setImgOverIdx] = useState<number | null>(null);
    const [exportingPdf, setExportingPdf] = useState(false);
    const [showContribuisci, setShowContribuisci] = useState(false);
    const [contribTitle, setContribTitle] = useState('');
    const [contribDifficulty, setContribDifficulty] = useState<'beginner' | 'intermediate' | 'advanced'>('beginner');
    const [contribNotes, setContribNotes] = useState('');
    const [contribSubmitting, setContribSubmitting] = useState(false);
    const [contribDone, setContribDone] = useState(false);

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const renderTaskRef = useRef<any>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    // Inizializzato da project.timer per evitare che il timer riparta da 0 al refresh
    const elapsedRef = useRef(project?.timer ?? 0);
    const blobUrlsRef = useRef<string[]>([]);
    const isTimerRunningRef = useRef(false);
    const isEditingNotesRef = useRef(false);
    const hasLoadedRef = useRef(false);
    const wasTimerRunningRef = useRef(false);
    const lastTapRef = useRef(0);
    const longPressRef = useRef<NodeJS.Timeout | null>(null);

    // Transcript + YouTube state (per progetti con videoId)
    const [transcriptOpen, setTranscriptOpen] = useState(false);
    const [transcriptView, setTranscriptView] = useState<'original' | 'translated'>('original');
    const [transcriptAction, setTranscriptAction] = useState<'original' | 'translate' | null>(null);
    const [transcriptError, setTranscriptError] = useState('');
    const [transcriptData, setTranscriptData] = useState<TranscriptData | null>(() => project?.transcriptData ?? null);
    const [transcriptCost, setTranscriptCost] = useState(0);
    const [showAudioUpload, setShowAudioUpload] = useState(false);
    const [audioFile, setAudioFile] = useState<File | null>(null);
    const [audioUploadError, setAudioUploadError] = useState('');
    const [audioUploading, setAudioUploading] = useState(false);
    const [copySuccess, setCopySuccess] = useState(false);
    const [copyChunkIdx, setCopyChunkIdx] = useState<number | null>(null);
    const [currentVideoTime, setCurrentVideoTime] = useState(0);
    // D3 — Aggiungi YouTube a progetto esistente
    const [showAddYouTubeModal, setShowAddYouTubeModal] = useState(false);
    const [addYouTubeUrl, setAddYouTubeUrl] = useState('');
    const [addYouTubeError, setAddYouTubeError] = useState('');
    const timePollerRef = useRef<NodeJS.Timeout | null>(null);
    const activeSegmentRef = useRef<HTMLDivElement | null>(null);
    const ytPlayerRef = useRef<any>(null);
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const lpStartPos = useRef<{ x: number; y: number } | null>(null);
    const imgDragState = useRef<{ from: number; over: number | null } | null>(null);

    // Init timer + notes dallo store al cambio progetto (navigazione tra progetti)
    useEffect(() => {
        if (!project) return;
        setElapsedTime(project.timer || 0);
        elapsedRef.current = project.timer || 0;
        setNotes(project.notesHtml || "");
        setHintVisible(true);
        if (project.transcriptData) setTranscriptData(project.transcriptData);
        const t = setTimeout(() => setHintVisible(false), 4000);
        return () => clearTimeout(t);
    }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

    // Sincronizza timer display quando lo store aggiorna project.timer senza che il timer sia in corso.
    // Necessario quando useSyncOnLogin ripristina un valore corretto da Supabase
    // (es. localStorage aveva timer=0 stantio, Supabase aveva timer=120 dal sync precedente).
    useEffect(() => {
        if (isTimerRunning) return;
        const storeTimer = project?.timer ?? 0;
        if (storeTimer > elapsedRef.current) {
            elapsedRef.current = storeTimer;
            setElapsedTime(storeTimer);
        }
    }, [project?.timer]); // eslint-disable-line react-hooks/exhaustive-deps

    // PDF loading — con fallback da Supabase Storage se non in IndexedDB
    useEffect(() => {
        if (!project || project.type !== 'pdf') return;
        const loadPdf = async () => {
            try {
                let blob: Blob | null = null;
                const dbRecord = await luDB.getFile(id as string);
                if (dbRecord?.blob) {
                    blob = dbRecord.blob;
                } else if (user) {
                    // Secondo dispositivo: scarica da Supabase Storage
                    const supabase = createClient();
                    const { data } = await supabase.storage.from('project-files').download(`${user.id}/${id}/main`);
                    if (data) {
                        blob = data;
                        luDB.saveFile({ id: id as string, blob }).catch(() => {});
                    }
                }
                if (blob) {
                    const pdfjsLib = await loadPdfjs();
                    const doc = await pdfjsLib.getDocument({ data: await blob.arrayBuffer() }).promise;
                    setPdfDoc(doc);
                    setTotalPages(doc.numPages);
                }
            } catch (err) {
                console.error("Failed to load PDF", err);
            }
        };
        loadPdf();
    }, [id, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

    // Immagini — con fallback da Supabase Storage; si riattiva quando arrivano nuove immagini via Realtime
    // Gira per TUTTI i tipi di progetto che hanno immagini (incluso 'pdf' — serve per copertina/export)
    useEffect(() => {
        if (!project || (project.images ?? []).length === 0) return;
        const loadImages = async () => {
            try {
                const imgs = project.images ?? [];
                const urls: string[] = [];
                const supabase = user ? createClient() : null;
                for (const img of imgs) {
                    const record = await luDB.getFile(img.id);
                    if (record?.blob) {
                        urls.push(URL.createObjectURL(record.blob));
                    } else if (supabase && user) {
                        // Deriva il path: l'immagine iniziale sta in /main, le altre in /{imgId}
                        const storagePath = img.id === (id as string)
                            ? `${user.id}/${id}/main`
                            : `${user.id}/${id}/${img.id}`;
                        const { data: blob } = await supabase.storage.from('project-files').download(storagePath);
                        if (blob) {
                            await luDB.saveFile({ id: img.id, blob });
                            urls.push(URL.createObjectURL(blob));
                        }
                    } else if ((img as any).dataURL) {
                        urls.push((img as any).dataURL); // legacy fallback
                    }
                }
                blobUrlsRef.current.forEach(u => URL.revokeObjectURL(u));
                blobUrlsRef.current = urls.filter(u => u.startsWith('blob:'));
                setImageUrls(urls);
                // Per progetti pdf il totalPages è gestito dal PDF viewer — non sovrascrivere
                if (project.type !== 'pdf') setTotalPages(urls.length);
            } catch (err) {
                console.error("Failed to load images", err);
            }
        };
        loadImages();
        return () => {
            blobUrlsRef.current.forEach(u => URL.revokeObjectURL(u));
            blobUrlsRef.current = [];
        };
    }, [id, project?.images?.length, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (!pdfDoc || !canvasRef.current || project?.type !== 'pdf' || fullscreen) return;
        const renderPage = async () => {
            // Cancella render in corso prima di iniziarne uno nuovo
            if (renderTaskRef.current) {
                try { renderTaskRef.current.cancel(); } catch {}
                renderTaskRef.current = null;
            }
            try {
                const page = await pdfDoc.getPage(currentPage);
                const canvas = canvasRef.current;
                if (!canvas) return;
                const viewport = page.getViewport({ scale: 1.3 });
                const context = canvas.getContext('2d');
                canvas.height = viewport.height;
                canvas.width = viewport.width;
                const task = page.render({ canvasContext: context!, viewport });
                renderTaskRef.current = task;
                await task.promise;
                renderTaskRef.current = null;
            } catch (e: any) {
                if (e?.name !== 'RenderingCancelledException') {
                    console.error('Failed to render PDF page', e);
                }
            }
        };
        renderPage();
        return () => {
            if (renderTaskRef.current) {
                try { renderTaskRef.current.cancel(); } catch {}
                renderTaskRef.current = null;
            }
        };
    }, [pdfDoc, currentPage, project?.type, fullscreen]);

    // Keep refs in sync for Realtime callback (avoids stale closures)
    useEffect(() => { isTimerRunningRef.current = isTimerRunning; }, [isTimerRunning]);
    useEffect(() => { isEditingNotesRef.current = isEditingNotes; }, [isEditingNotes]);

    // Realtime: sincronizza counter, secs, timer e note da altri dispositivi/tab
    useEffect(() => {
        if (!user || !id) return;
        const supabase = createClient();
        const channel = supabase
            .channel(`project-counter-${id}`)
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'projects',
                filter: `id=eq.${id}`,
            }, (payload) => {
                if (!payload.new) return;
                const remote = payload.new as Record<string, any>;
                const updates: Partial<Project> = {
                    counter: remote.counter ?? 0,
                    secs: remote.secs ?? [],
                    sections: remote.sections ?? [],
                    images: (remote.images ?? []).map((img: any) =>
                        typeof img === 'string' ? { id: img } : { id: img.id ?? '' }
                    ),
                    coverImageId: remote.cover_image_id ?? undefined,
                };
                if (!isTimerRunningRef.current) {
                    updates.timer = remote.timer_seconds ?? 0;
                    elapsedRef.current = remote.timer_seconds ?? 0;
                    setElapsedTime(remote.timer_seconds ?? 0);
                }
                if (!isEditingNotesRef.current) {
                    updates.notesHtml = remote.notes_html ?? '';
                    setNotes(remote.notes_html ?? '');
                }
                if (remote.transcript_data) {
                    updates.transcriptData = remote.transcript_data;
                    setTranscriptData(remote.transcript_data);
                }
                updateProject(id as string, updates);
            })
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [id, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

    // Fetch iniziale da Supabase al mount — sovrascrive localStorage stale per sync cross-device.
    // Il realtime gestisce i cambiamenti live; questo copre il caso "pagina aperta dopo le modifiche".
    useEffect(() => {
        if (!user || !id) return;
        const supabase = createClient();
        supabase.from('projects')
            .select('counter, timer_seconds, secs, sections, notes_html, images, cover_image_id, transcript_data, video_id, playlist_id, title, file_url, thumb_url')
            .eq('id', id as string)
            .single()
            .then(({ data, error }) => {
                if (error || !data) return;
                const updates: Partial<Project> = {
                    counter: data.counter ?? 0,
                    secs: data.secs ?? [],
                    sections: data.sections ?? [],
                    images: (data.images ?? []).map((img: any) =>
                        typeof img === 'string' ? { id: img } : { id: img.id ?? '' }
                    ),
                    coverImageId: data.cover_image_id ?? undefined,
                    transcriptData: data.transcript_data ?? undefined,
                    videoId: data.video_id ?? undefined,
                    playlistId: data.playlist_id ?? undefined,
                    title: data.title ?? undefined,
                    url: data.file_url ?? undefined,
                    thumbDataURL: data.thumb_url ?? undefined,
                };
                if (!isTimerRunningRef.current) {
                    updates.timer = data.timer_seconds ?? 0;
                    elapsedRef.current = data.timer_seconds ?? 0;
                    setElapsedTime(data.timer_seconds ?? 0);
                }
                if (!isEditingNotesRef.current) {
                    updates.notesHtml = data.notes_html ?? '';
                    setNotes(data.notes_html ?? '');
                }
                if (data.transcript_data) {
                    setTranscriptData(data.transcript_data);
                }
                updateProject(id as string, updates);
            });
    }, [id, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

    // Sync notes ← store quando notesHtml cambia esternamente (useSyncOnLogin, altro dispositivo)
    // e l'utente non sta modificando. Risolve il bug: note mostrate nel div ma textarea vuota.
    useEffect(() => {
        if (isEditingNotesRef.current) return;
        setNotes(project?.notesHtml || '');
    }, [project?.notesHtml]); // eslint-disable-line react-hooks/exhaustive-deps

    // Autosave note con debounce 2s
    useEffect(() => {
        if (!project || notes === (project.notesHtml || '')) return;
        const t = setTimeout(() => {
            updateProject(project.id, { notesHtml: notes });
            syncProject({ notes_html: notes });
        }, 2000);
        return () => clearTimeout(t);
    }, [notes]); // eslint-disable-line react-hooks/exhaustive-deps

    // Timer — sync to store + Supabase every 5s; salva il valore finale all'arresto
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isTimerRunning) {
            wasTimerRunningRef.current = true;
            interval = setInterval(() => {
                elapsedRef.current += 1;
                setElapsedTime(elapsedRef.current);
                if (elapsedRef.current % 5 === 0) {
                    updateProject(id as string, { timer: elapsedRef.current });
                    syncProject({ timer_seconds: elapsedRef.current });
                }
            }, 1000);
        } else if (wasTimerRunningRef.current) {
            // Timer appena fermato — salva il valore finale (evita di perdere gli ultimi secondi)
            wasTimerRunningRef.current = false;
            updateProject(id as string, { timer: elapsedRef.current });
            syncProject({ timer_seconds: elapsedRef.current });
        }
        return () => clearInterval(interval);
    }, [isTimerRunning, id, updateProject]); // eslint-disable-line react-hooks/exhaustive-deps

    // YouTube IFrame API: polling tempo corrente quando la trascrizione è aperta
    useEffect(() => {
        if (!transcriptOpen || !project?.videoId) return;
        const initPlayer = () => {
            if (!(window as any).YT?.Player) return;
            if (ytPlayerRef.current) {
                timePollerRef.current = setInterval(() => {
                    try {
                        const t = ytPlayerRef.current?.getCurrentTime?.();
                        if (typeof t === 'number') setCurrentVideoTime(t);
                    } catch {}
                }, 500);
                return;
            }
            ytPlayerRef.current = new (window as any).YT.Player('yt-player-project', {
                events: {
                    onReady: () => {
                        timePollerRef.current = setInterval(() => {
                            try {
                                const t = ytPlayerRef.current?.getCurrentTime?.();
                                if (typeof t === 'number') setCurrentVideoTime(t);
                            } catch {}
                        }, 500);
                    },
                },
            });
        };
        if ((window as any).YT?.Player) {
            initPlayer();
        } else {
            const existing = document.querySelector('script[src*="iframe_api"]');
            if (!existing) {
                const tag = document.createElement('script');
                tag.src = 'https://www.youtube.com/iframe_api';
                document.head.appendChild(tag);
            }
            (window as any).onYouTubeIframeAPIReady = initPlayer;
        }
        return () => {
            if (timePollerRef.current) { clearInterval(timePollerRef.current); timePollerRef.current = null; }
        };
    }, [transcriptOpen, project?.videoId]); // eslint-disable-line react-hooks/exhaustive-deps

    // Auto-scroll segmento attivo nella trascrizione
    useEffect(() => {
        if (activeSegmentRef.current && transcriptOpen) {
            activeSegmentRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
    }, [currentVideoTime]); // eslint-disable-line react-hooks/exhaustive-deps

    // Redirect se il progetto viene eliminato su un altro dispositivo mentre siamo qui
    useEffect(() => {
        if (hasLoadedRef.current && !project) {
            router.replace('/');
        }
    }, [project]); // eslint-disable-line react-hooks/exhaustive-deps

    // Pointer drag globale per il riordino immagini (funziona su mobile e desktop)
    useEffect(() => {
        if (imgDragIdx === null) return;
        imgDragState.current = { from: imgDragIdx, over: null };

        const onMove = (e: PointerEvent) => {
            const el = document.elementFromPoint(e.clientX, e.clientY);
            const item = el?.closest('[data-img-idx]') as HTMLElement | null;
            if (item) {
                const idx = parseInt(item.dataset.imgIdx ?? '-1');
                if (idx >= 0 && imgDragState.current) {
                    imgDragState.current.over = idx;
                    setImgOverIdx(idx);
                }
            }
        };

        const onUp = () => {
            if (imgDragState.current) {
                const { from, over } = imgDragState.current;
                if (over !== null && over !== from) moveImage(from, over);
            }
            imgDragState.current = null;
            setImgDragIdx(null);
            setImgOverIdx(null);
        };

        document.addEventListener('pointermove', onMove);
        document.addEventListener('pointerup', onUp);
        return () => {
            document.removeEventListener('pointermove', onMove);
            document.removeEventListener('pointerup', onUp);
        };
    }, [imgDragIdx]); // eslint-disable-line react-hooks/exhaustive-deps

    if (project) hasLoadedRef.current = true;
    if (!project) {
        if (hasLoadedRef.current) return null; // redirect in corso
        return <div className="p-10 text-center font-bold">Progetto non trovato</div>;
    }

    // ── Transcript helpers ────────────────────────────────────────────────────
    const copyTextToClipboard = async (text: string): Promise<boolean> => {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
            document.body.appendChild(ta);
            ta.focus(); ta.select();
            try { document.execCommand('copy'); return true; } catch { return false; }
            finally { document.body.removeChild(ta); }
        }
    };

    const generateTranscript = async (translate: boolean) => {
        if (!project?.videoId && !audioFile) return;
        
        // Handle audio file upload
        if (audioFile) {
            setAudioUploading(true);
            setAudioUploadError('');
            try {
                const formData = new FormData();
                formData.append('file', audioFile);
                formData.append('tutorialId', id as string);
                formData.append('translate', String(translate));
                formData.append('table', 'projects');

                const res = await fetch('/api/tutorials/transcript', {
                    method: 'POST',
                    body: formData,
                });
                const data = await res.json();
                if (!res.ok || !data.success) throw new Error(data.error || 'Errore trascrizione audio');
                
                const newData: TranscriptData = {
                    transcript: data.segments,
                    translated: data.translated ?? null,
                    generated_at: new Date().toISOString(),
                    has_translation: !!data.translated,
                    source: 'whisper',
                };
                setTranscriptData(newData);
                updateProject(id as string, { transcriptData: newData });
                setShowAudioUpload(false);
                setAudioFile(null);
            } catch (err: any) {
                setAudioUploadError(err.message || 'Errore nel caricamento dell\'audio.');
            } finally {
                setAudioUploading(false);
                setTranscriptAction(null);
            }
            return;
        }
        
        // Original video transcript
        setTranscriptAction(translate ? 'translate' : 'original');
        setTranscriptError('');
        try {
            // Se traduciamo e abbiamo già i segmenti, non ri-fetchiamo
            let segments = (translate && transcriptData?.transcript) ? transcriptData.transcript : null;
            if (!segments) {
                const res = await fetch(`/api/tutorials/transcript?videoId=${project.videoId}`);
                const data = await res.json();
                if (!res.ok || !data.success) {
                    const errMsg = data.error || 'Errore trascrizione';
                    // Check if it's a blocked video error - show audio upload option
                    if (errMsg.includes('non 2xx') || errMsg.includes('non supportato') || errMsg.includes('bloccato')) {
                        setTranscriptError('Video non disponibile per trascrizione automatica. Puoi caricare un file audio.');
                        setShowAudioUpload(true);
                    } else {
                        setTranscriptError(errMsg);
                    }
                    throw new Error(errMsg);
                }
                setTranscriptCost(data.nextCost ?? 0);
                segments = data.segments;
            }
            const saveRes = await fetch('/api/tutorials/transcript', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tutorialId: id, transcript: segments, translate, table: 'projects' }),
            });
            const saveData = await saveRes.json();
            if (!saveRes.ok) throw new Error(saveData.error || 'Errore salvataggio');
            const newData: TranscriptData = {
                transcript: segments!,
                translated: saveData.translated ?? transcriptData?.translated ?? null,
                generated_at: new Date().toISOString(),
                has_translation: !!(saveData.translated || (!translate && transcriptData?.has_translation)),
            };
            setTranscriptData(newData);
            updateProject(id as string, { transcriptData: newData });
        } catch (err: any) {
            if (!transcriptError) {
                setTranscriptError(err.message || 'Errore nel recupero della trascrizione.');
            }
        } finally {
            setTranscriptAction(null);
        }
    };

    const activeSegs = transcriptData
        ? (transcriptView === 'translated' && transcriptData.has_translation
            ? transcriptData.translated ?? transcriptData.transcript
            : transcriptData.transcript)
        : [];
    const formatTranscriptTime = (s: number) => {
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        return `${m}:${String(sec).padStart(2, '0')}`;
    };
    const seekTo = (startSec: number) => {
        try { ytPlayerRef.current?.seekTo?.(startSec, true); } catch {}
    };
    const COPY_CHUNK = 5000;
    const handleCopyChunk = async (idx: number) => {
        const fullText = activeSegs.map(s => s.text).join('\n');
        const totalChunks = Math.ceil(fullText.length / COPY_CHUNK);
        const chunk = fullText.slice(idx * COPY_CHUNK, (idx + 1) * COPY_CHUNK);
        await copyTextToClipboard(chunk);
        if (idx + 1 >= totalChunks) {
            setCopyChunkIdx(null);
            setCopySuccess(true);
            setTimeout(() => setCopySuccess(false), 2500);
        } else {
            setCopyChunkIdx(idx + 1);
        }
    };
    const copyAll = () => { setCopyChunkIdx(0); };

    // ── parseYouTubeUrl helper ────────────────────────────────────────────────
    const parseYouTubeUrl = (url: string): { videoId: string; playlistId: string } | null => {
        try {
            const u = new URL(url);
            let videoId = '';
            let playlistId = u.searchParams.get('list') || '';
            if (u.hostname.includes('youtu.be')) videoId = u.pathname.slice(1).split('/')[0];
            else if (u.hostname.includes('youtube.com')) {
                if (u.pathname.startsWith('/watch')) videoId = u.searchParams.get('v') || '';
                else if (u.pathname.startsWith('/shorts/')) videoId = u.pathname.split('/')[2];
            }
            if (!videoId && !playlistId) return null;
            return { videoId, playlistId };
        } catch { return null; }
    };

    const formatTime = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return [h, m, s].map(v => String(v).padStart(2, '0')).join(':');
    };

    const handleAddImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const rawFile = e.target.files?.[0];
        if (!rawFile) return;
        // Comprimi prima di salvare in IndexedDB e caricare su Supabase
        const file = await compressImage(rawFile);
        // Save blob to IndexedDB — NOT as base64 in Zustand/localStorage
        const imgId = `${project.id}_img_${Date.now()}`;
        await luDB.saveFile({ id: imgId, blob: file });
        const objectUrl = URL.createObjectURL(file);
        const updatedImages = [...(project.images || []), { id: imgId }];
        updateProject(project.id, { images: updatedImages });
        setImageUrls(prev => [...prev, objectUrl]);
        setTotalPages(updatedImages.length);

        // Genera thumbnail se è la prima immagine (progetto senza thumbnail)
        let thumbDataURL: string | undefined;
        if (!project.thumbDataURL && (project.images?.length ?? 0) === 0) {
            try {
                thumbDataURL = await new Promise<string>((resolve) => {
                    const img = new window.Image();
                    img.onload = () => {
                        const maxDim = 120;
                        const scale = Math.min(maxDim / img.width, maxDim / img.height, 1);
                        const cv = document.createElement('canvas');
                        cv.width = Math.round(img.width * scale);
                        cv.height = Math.round(img.height * scale);
                        cv.getContext('2d')!.drawImage(img, 0, 0, cv.width, cv.height);
                        resolve(cv.toDataURL('image/jpeg', 0.7));
                        // NON revocare objectUrl qui — è ancora usato da imageUrls per la visualizzazione
                    };
                    img.onerror = () => resolve('');
                    img.src = objectUrl;
                });
                if (thumbDataURL) {
                    updateProject(project.id, { thumbDataURL });
                }
            } catch { /* silently skip */ }
        }

        // Carica su Supabase Storage e sincronizza lista immagini nel DB
        // syncProject usa upsert → funziona anche per tutorial legacy non ancora in tabella projects
        // NON passiamo images nei fields: syncProject legge lo stato corrente dallo store
        // (che potrebbe avere più immagini rispetto alla closure captata qui).
        if (user) {
            const supabase = createClient();
            const storagePath = `${user.id}/${project.id}/${imgId}`;
            supabase.storage.from('project-files').upload(storagePath, file, { upsert: true })
                .then(({ error: storageErr }) => {
                    if (storageErr) { console.warn('Image upload failed:', storageErr.message); return; }
                    syncProject({
                        ...(thumbDataURL ? { thumb_url: thumbDataURL } : {}),
                    });
                });
        }
    };

    const handleDeleteCurrentImage = async () => {
        if (!project.images || project.images.length === 0) return;
        if (!confirm("Eliminare questa immagine?")) return;
        const imgId = project.images[currentPage - 1]?.id;
        if (imgId && imgId !== project.id) {
            luDB.deleteFile(imgId).catch(() => {}); // delete from IDB (keep main file)
        }
        const updatedImages = project.images.filter((_, i) => i !== (currentPage - 1));
        const deletedWasCover = project.coverImageId === imgId;
        updateProject(project.id, {
            images: updatedImages,
            ...(deletedWasCover ? { coverImageId: undefined } : {}),
        });
        setImageUrls(prev => prev.filter((_, i) => i !== (currentPage - 1)));
        setTotalPages(updatedImages.length);
        setCurrentPage(p => Math.max(1, Math.min(updatedImages.length, p)));
        syncProject({
            images: updatedImages.map(img => ({ id: img.id })),
            ...(deletedWasCover ? { cover_image_id: null } : {}),
        });
    };

    const handleSaveNotes = () => {
        updateProject(project.id, { notesHtml: notes });
        syncProject({ notes_html: notes });
        setIsEditingNotes(false);
    };

    // ── Image manager helpers ────────────────────────────────────────────────
    const moveImage = (from: number, to: number) => {
        const newImages = [...(project.images ?? [])];
        const [removed] = newImages.splice(from, 1);
        newImages.splice(to, 0, removed);
        const newUrls = [...imageUrls];
        const [removedUrl] = newUrls.splice(from, 1);
        newUrls.splice(to, 0, removedUrl);
        updateProject(project.id, { images: newImages });
        setImageUrls(newUrls);
        setCurrentPage(p => {
            if (p - 1 === from) return to + 1;
            return p;
        });
        syncProject({ images: newImages.map(img => ({ id: img.id })) });
    };

    const setCoverImage = (imgId: string) => {
        updateProject(project.id, { coverImageId: imgId });
        syncProject({ cover_image_id: imgId });
    };

    // ── Reorder helpers ──────────────────────────────────────────────────────
    const moveCounter = (from: number, to: number) => {
        const newSecs = [...project.secs];
        const [removed] = newSecs.splice(from, 1);
        newSecs.splice(to, 0, removed);
        updateProject(project.id, { secs: newSecs });
        syncSecs(newSecs);
    };

    const sections = project.sections ?? [];

    const moveSection = (fromIdx: number, toIdx: number) => {
        const sorted = [...sections].sort((a, b) => a.order - b.order);
        const [removed] = sorted.splice(fromIdx, 1);
        sorted.splice(toIdx, 0, removed);
        const newSections = sorted.map((s, i) => ({ ...s, order: i }));
        updateProject(project.id, { sections: newSections });
        syncSections(newSections);
    };

    const moveCounterInSection = (sectionId: string, fromRelIdx: number, toRelIdx: number) => {
        // Replace section counters in their original positions, just reordered
        const sectionIndices = project.secs
            .map((s, i) => s.sectionId === sectionId ? i : -1)
            .filter(i => i >= 0);
        const sectionCounters = sectionIndices.map(i => project.secs[i]);
        const [removed] = sectionCounters.splice(fromRelIdx, 1);
        sectionCounters.splice(toRelIdx, 0, removed);
        const newSecs = [...project.secs];
        sectionIndices.forEach((absIdx, relIdx) => { newSecs[absIdx] = sectionCounters[relIdx]; });
        updateProject(project.id, { secs: newSecs });
        syncSecs(newSecs);
    };

    const startLongPress = (e: React.PointerEvent) => {
        lpStartPos.current = { x: e.clientX, y: e.clientY };
        longPressRef.current = setTimeout(() => {
            setReorderMode(true);
            if (navigator.vibrate) navigator.vibrate(40);
        }, 500);
    };

    const cancelLongPress = () => {
        if (longPressRef.current) { clearTimeout(longPressRef.current); longPressRef.current = null; }
        lpStartPos.current = null;
    };

    const checkLongPressMove = (e: React.PointerEvent) => {
        if (!lpStartPos.current) return;
        if (Math.abs(e.clientX - lpStartPos.current.x) > 8 || Math.abs(e.clientY - lpStartPos.current.y) > 8) cancelLongPress();
    };

    // ── PDF export ───────────────────────────────────────────────────────────
    const handleExportPdf = async () => {
        setExportingPdf(true);
        try {
            const { generatePatternPdf } = await import('@/lib/pdf-export');
            const pdfBytes = await generatePatternPdf({
                ...project,
                sections: project.sections ?? [],
                // Passa il link YouTube come campo url — pdf-export.ts lo mostra in copertina
                url: project.videoId ? `https://www.youtube.com/watch?v=${project.videoId}` : undefined,
            }, imageUrls);
            const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${project.title.replace(/[^a-zA-Z0-9]/g, '-')}.pdf`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (e) {
            console.error('[PDF Export]', e);
            alert('Errore durante la generazione del PDF. Riprova.');
        } finally {
            setExportingPdf(false);
        }
    };

    const handleExportZip = async () => {
        const { zipSync, strToU8 } = await import('fflate');
        const infoLines = [
            `Progetto: ${project.title}`,
            `Creato: ${new Date(project.createdAt).toLocaleDateString('it-IT')}`,
            `Tempo totale: ${formatTime(elapsedRef.current)}`,
            project.videoId ? `Video tutorial: https://www.youtube.com/watch?v=${project.videoId}` : '',
            ...(project.secs.length > 0 ? (() => {
                const secs = project.secs;
                const sectionsList = project.sections ?? [];
                const lines: string[] = [];
                // Counters grouped by section
                if (sectionsList.length > 0) {
                    const sorted = [...sectionsList].sort((a, b) => a.order - b.order);
                    for (const section of sorted) {
                        lines.push(`\n[${section.title}]${section.description ? ' — ' + section.description : ''}`);
                        const secCounters = secs.filter(s => s.sectionId === section.id);
                        for (const s of secCounters) lines.push(`  ${s.name} [${s.value}]`);
                    }
                    const ungrouped = secs.filter(s => !s.sectionId);
                    if (ungrouped.length > 0) {
                        lines.push('\n[Senza sezione]');
                        for (const s of ungrouped) lines.push(`  ${s.name} [${s.value}]`);
                    }
                } else {
                    lines.push('Giri secondari:');
                    for (const s of secs) lines.push(`  ${s.name} [${s.value}]`);
                }
                return lines;
            })() : []),
            project.notesHtml ? `Note: ${project.notesHtml}` : '',
            '',
            'Made with lurumi.it',
        ].filter(Boolean).join('\n');

        const files: Record<string, Uint8Array> = {
            'info.txt': strToU8(infoLines),
        };

        try {
            const record = await luDB.getFile(id as string);
            if (record?.blob) {
                const buf = await record.blob.arrayBuffer();
                const ext = project.type === 'pdf' ? 'pdf' : 'jpg';
                files[`progetto.${ext}`] = new Uint8Array(buf);
            }
        } catch {}

        // Includi tutte le immagini del progetto
        if (project.images?.length) {
            for (let i = 0; i < project.images.length; i++) {
                try {
                    const imgRecord = await luDB.getFile(project.images[i].id);
                    if (imgRecord?.blob) {
                        const buf = await imgRecord.blob.arrayBuffer();
                        files[`immagine-${i + 1}.jpg`] = new Uint8Array(buf);
                    }
                } catch {}
            }
        }

        const zipped = zipSync(files);
        const blob = new Blob([zipped.buffer as ArrayBuffer], { type: 'application/zip' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${project.title.replace(/[^a-zA-Z0-9]/g, '-')}.zip`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="max-w-2xl mx-auto px-4 pt-6 pb-20 bg-[#FAFAFC] min-h-screen">
            {fullscreen && (
                <FullscreenViewer
                    type={project.type === 'pdf' ? 'pdf' : 'images'}
                    images={imageUrls}
                    pdfDoc={pdfDoc}
                    totalPages={totalPages}
                    initialPage={currentPage}
                    onClose={() => setFullscreen(false)}
                />
            )}

            {/* Nav */}
            <div className="flex items-center justify-between mb-6">
                <Link href="/" className="w-10 h-10 flex items-center justify-center bg-white border border-[#EEF0F4] rounded-xl text-[#9AA2B1] active:scale-95 transition-transform">
                    <ArrowLeft size={20} />
                </Link>
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setIsTimerRunning(r => !r)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-full font-black text-xs shadow-sm transition-all ${isTimerRunning ? 'bg-red-50 text-red-500 border border-red-100' : 'bg-[#F4EEFF] text-[#7B5CF6]'}`}
                        >
                            <Timer size={14} strokeWidth={3} />
                            <span>{formatTime(elapsedTime)}</span>
                        </button>
                        <button
                            onClick={() => {
                                setIsTimerRunning(false);
                                setElapsedTime(0);
                                elapsedRef.current = 0;
                                updateProject(id as string, { timer: 0 });
                                syncProject({ timer_seconds: 0 });
                            }}
                            className="w-7 h-7 flex items-center justify-center text-[#9AA2B1] hover:text-red-400 active:scale-90 transition-all"
                            title="Azzera timer"
                        >
                            <RotateCcw size={13} strokeWidth={3} />
                        </button>
                    </div>
                    <div className="flex flex-col items-center gap-0.5">
                        <button
                            onClick={handleExportZip}
                            className="w-10 h-10 flex items-center justify-center bg-white border border-[#EEF0F4] rounded-xl text-[#7B5CF6] active:scale-95 transition-transform shadow-sm"
                            title="Esporta ZIP"
                        >
                            <Archive size={20} />
                        </button>
                        <span className="text-[9px] font-black uppercase tracking-widest text-[#7B5CF6]">zip</span>
                    </div>
                    <div className="flex flex-col items-center gap-0.5">
                        <button
                            onClick={handleExportPdf}
                            disabled={exportingPdf}
                            className="w-10 h-10 flex items-center justify-center bg-white border border-[#EEF0F4] rounded-xl text-[#7B5CF6] active:scale-95 transition-transform shadow-sm disabled:opacity-50"
                            title="Esporta PDF editabile"
                        >
                            <FileDown size={20} />
                        </button>
                        <span className="text-[9px] font-black uppercase tracking-widest text-[#7B5CF6]">pdf</span>
                    </div>
                </div>
            </div>

            <header className="mb-6">
                <h1 className="text-3xl font-black text-[#1C1C1E] mb-1">{project.title}</h1>
                <p className="text-[#9AA2B1] text-sm font-bold uppercase tracking-widest flex items-center gap-1.5">
                    {project.type === 'pdf' ? 'Pattern PDF'
                        : project.type === 'tutorial' ? <><Youtube size={13} className="text-red-400" /> Tutorial YouTube</>
                        : project.type === 'blank' ? 'Progetto'
                        : 'Galleria Immagini'}
                </p>
            </header>

            {/* YouTube Player — visibile solo per progetti con videoId */}
            {project.videoId && (
                <div className="mb-6">
                    <div className="relative pb-[56.25%] rounded-[24px] overflow-hidden bg-black shadow-sm">
                        <iframe
                            ref={iframeRef}
                            id="yt-player-project"
                            className="absolute inset-0 w-full h-full"
                            src={project.videoId
                                ? `https://www.youtube.com/embed/${project.videoId}?rel=0&modestbranding=1&playsinline=1&enablejsapi=1`
                                : project.playlistId
                                    ? `https://www.youtube.com/embed/videoseries?list=${project.playlistId}&rel=0&modestbranding=1&playsinline=1`
                                    : ''}
                            allowFullScreen
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        />
                    </div>

                    {/* Pannello Trascrizione */}
                    <div className="mt-3 bg-white rounded-[24px] border border-[#EEF0F4] overflow-hidden shadow-sm">
                        <button
                            className="w-full flex items-center justify-between px-5 py-4"
                            onClick={() => setTranscriptOpen(o => !o)}
                        >
                            <div className="flex items-center gap-2.5 text-[#7B5CF6]">
                                <FileText size={18} strokeWidth={2.5} />
                                <span className="font-black text-sm uppercase tracking-wider">Trascrizione</span>
                            </div>
                            {transcriptOpen ? <ChevronUp size={18} className="text-[#9AA2B1]" /> : <ChevronDown size={18} className="text-[#9AA2B1]" />}
                        </button>

                        {transcriptOpen && (
                            <div className="border-t border-[#EEF0F4] px-5 pb-5 pt-4">
                                {!transcriptData ? (
                                    <div className="text-center py-6">
                                        <p className="text-sm text-[#9AA2B1] font-medium mb-4">
                                            Genera la trascrizione del video per seguire il tutorial passo passo.
                                            {transcriptCost > 0 && <span className="block mt-1 text-amber-500 font-bold text-xs">Costo: {transcriptCost} credito/i AI</span>}
                                        </p>
                                        {transcriptError && !showAudioUpload && <p className="text-xs text-red-500 font-medium mb-3">{transcriptError}</p>}
                                        
                                        {showAudioUpload ? (
                                            <div className="mb-4">
                                                <p className="text-xs text-[#9AA2B1] mb-3">
                                                    Carica un file audio del video (MP3, WAV, OGG, WebM, M4A - max 25MB)
                                                </p>
                                                <input
                                                    type="file"
                                                    accept="audio/*"
                                                    onChange={(e) => setAudioFile(e.target.files?.[0] || null)}
                                                    className="block w-full text-sm text-[#9AA2B1] file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[#7B5CF6] file:text-white hover:file:bg-[#6B46CD] mb-3"
                                                />
                                                {audioFile && (
                                                    <p className="text-xs text-green-500 mb-3">{audioFile.name}</p>
                                                )}
                                                {audioUploadError && <p className="text-xs text-red-500 font-medium mb-3">{audioUploadError}</p>}
                                                <div className="flex gap-2 justify-center">
                                                    <button
                                                        onClick={() => generateTranscript(false)}
                                                        disabled={!audioFile || audioUploading}
                                                        className="h-10 px-4 bg-[#7B5CF6] text-white rounded-xl font-bold text-sm disabled:opacity-50 flex items-center gap-2"
                                                    >
                                                        {audioUploading ? <><Loader2 size={15} className="animate-spin" /> Caricamento...</> : 'Trascrivi audio'}
                                                    </button>
                                                    <button
                                                        onClick={() => { setShowAudioUpload(false); setTranscriptError(''); }}
                                                        className="h-10 px-4 bg-gray-200 text-gray-700 rounded-xl font-bold text-sm"
                                                    >
                                                        Annulla
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                <button
                                                    onClick={() => generateTranscript(false)}
                                                    disabled={!!transcriptAction}
                                                    className="h-10 px-6 bg-[#7B5CF6] text-white rounded-xl font-bold text-sm disabled:opacity-50 flex items-center gap-2 mx-auto"
                                                >
                                                    {transcriptAction === 'original' ? <><Loader2 size={15} className="animate-spin" /> Trascrizione in corso…</> : 'Genera trascrizione'}
                                                </button>
                                                {transcriptError && (
                                                    <button
                                                        onClick={() => setShowAudioUpload(true)}
                                                        className="mt-3 text-xs text-[#7B5CF6] underline"
                                                    >
                                                        Problemi? Carica un file audio
                                                    </button>
                                                )}
                                            </>
                                        )}
                                    </div>
                                ) : (
                                    <>
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex gap-1.5">
                                                <button
                                                    onClick={() => setTranscriptView('original')}
                                                    className={`h-8 px-3 rounded-lg text-xs font-black transition-all ${transcriptView === 'original' ? 'bg-[#7B5CF6] text-white' : 'bg-[#FAFAFC] text-[#9AA2B1]'}`}
                                                >
                                                    Originale
                                                </button>
                                                {transcriptData.has_translation ? (
                                                    <button
                                                        onClick={() => setTranscriptView('translated')}
                                                        className={`h-8 px-3 rounded-lg text-xs font-black transition-all ${transcriptView === 'translated' ? 'bg-[#7B5CF6] text-white' : 'bg-[#FAFAFC] text-[#9AA2B1]'}`}
                                                    >
                                                        Italiano
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={() => generateTranscript(true)}
                                                        disabled={!!transcriptAction}
                                                        className="h-8 px-3 rounded-lg text-xs font-black bg-[#FAFAFC] text-[#7B5CF6] flex items-center gap-1 disabled:opacity-50"
                                                    >
                                                        {transcriptAction === 'translate' ? <Loader2 size={13} className="animate-spin" /> : <Languages size={13} />}
                                                        Traduci in italiano
                                                    </button>
                                                )}
                                            </div>
                                            <button
                                                onClick={copyAll}
                                                className="h-8 px-3 rounded-lg text-xs font-black bg-[#FAFAFC] text-[#9AA2B1] flex items-center gap-1 transition-colors hover:text-[#7B5CF6]"
                                            >
                                                {copySuccess ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
                                                {copyChunkIdx !== null ? `Copia (${copyChunkIdx + 1})…` : 'Copia tutto'}
                                            </button>
                                        </div>
                                        {transcriptData?.source === 'whisper' && (
                                            <p className="text-xs text-[#9AA2B1] font-medium mb-2 flex items-center gap-1">
                                                <span className="bg-[#F4EEFF] text-[#7B5CF6] text-[10px] font-black px-1.5 py-0.5 rounded-md">AI</span>
                                                Trascritto da Whisper AI (video senza sottotitoli)
                                            </p>
                                        )}
                                        {transcriptError && <p className="text-xs text-red-500 font-medium mb-2">{transcriptError}</p>}
                                        <div className="max-h-72 overflow-y-auto flex flex-col gap-1.5">
                                            {activeSegs.map((seg, si) => {
                                                const nextStart = activeSegs[si + 1]?.start ?? Infinity;
                                                const isActive = currentVideoTime >= seg.start && currentVideoTime < nextStart;
                                                return (
                                                    <div
                                                        key={si}
                                                        ref={isActive ? activeSegmentRef : undefined}
                                                        className={`rounded-xl px-3 py-2 transition-colors cursor-pointer ${isActive ? 'bg-[#F4EEFF] border border-[#E6DAFF]' : 'hover:bg-[#FAFAFC]'}`}
                                                        onClick={() => seekTo(seg.start)}
                                                    >
                                                        <span className="text-[10px] font-black text-[#7B5CF6] uppercase tracking-widest mr-2">
                                                            {formatTranscriptTime(seg.start)}
                                                        </span>
                                                        <span className="text-sm text-[#1C1C1E] leading-relaxed font-medium">
                                                            {seg.text}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        <div className="mt-3 flex justify-center">
                                            <button
                                                onClick={() => handleCopyChunk(copyChunkIdx ?? 0)}
                                                className="h-8 px-4 rounded-lg text-xs font-black bg-[#FAFAFC] text-[#9AA2B1] flex items-center gap-1.5 hover:text-[#7B5CF6] transition-colors"
                                            >
                                                {copySuccess ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
                                                {copySuccess ? 'Copiato!' : copyChunkIdx !== null ? `Copia blocco ${copyChunkIdx + 1}…` : 'Copia testo'}
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Link apri su YouTube */}
                    <a
                        href={`https://www.youtube.com/watch?v=${project.videoId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 flex items-center justify-center gap-1.5 text-xs font-bold text-[#9AA2B1] hover:text-red-500 transition-colors"
                    >
                        <ExternalLink size={12} />
                        Apri su YouTube
                    </a>
                </div>
            )}

            {/* D3 — Aggiungi YouTube (solo per progetti senza videoId) */}
            {!project.videoId && (
                <div className="mb-6">
                    <button
                        onClick={() => { setAddYouTubeUrl(''); setAddYouTubeError(''); setShowAddYouTubeModal(true); }}
                        className="w-full flex items-center justify-center gap-2 h-11 bg-white border border-[#EEF0F4] rounded-2xl text-[#9AA2B1] font-bold text-sm hover:border-red-200 hover:text-red-500 transition-colors shadow-sm"
                    >
                        <Youtube size={16} />
                        Aggiungi video YouTube
                    </button>
                </div>
            )}

            {/* Main Counter — più compatto su mobile */}
            <div className="bg-white rounded-xl md:rounded-2xl p-2 md:p-4 shadow-[0_12px_40px_rgba(0,0,0,0.03)] border border-[#EEF0F4] text-center mb-6">
                <p className="text-[10px] md:text-[11px] font-black text-[#9AA2B1] uppercase tracking-[0.2em] mb-1 md:mb-2">Contatore Principale</p>
                <div className="text-[28px] md:text-[48px] font-black text-[#1C1C1E] leading-none mb-2 md:mb-4 tracking-tighter">{project.counter}</div>
                <div className="flex items-center justify-center gap-4 md:gap-6">
                    <button
                        onClick={() => {
                            const v = Math.max(0, project.counter - 1);
                            updateProject(project.id, { counter: v });
                            syncProject({ counter: v });
                        }}
                        className="w-6 h-6 md:w-9 md:h-9 flex items-center justify-center bg-[#FAFAFC] border border-[#EEF0F4] rounded-lg text-[#1C1C1E] active:scale-90 transition-transform"
                    >
                        <Minus size={12} strokeWidth={3} />
                    </button>
                    <button
                        onClick={() => {
                            const v = project.counter + 1;
                            updateProject(project.id, { counter: v });
                            syncProject({ counter: v });
                        }}
                        className="w-9 h-9 md:w-14 md:h-14 flex items-center justify-center bg-[#7B5CF6] text-white rounded-[12px] md:rounded-[18px] shadow-[0_6px_14px_rgba(123,92,246,0.3)] active:scale-95 transition-transform"
                    >
                        <Plus size={16} strokeWidth={3} />
                    </button>
                    <button
                        onClick={() => {
                            updateProject(project.id, { counter: 0 });
                            syncProject({ counter: 0 });
                        }}
                        className="w-6 h-6 md:w-9 md:h-9 flex items-center justify-center bg-[#FAFAFC] border border-[#EEF0F4] rounded-lg text-[#9AA2B1] active:scale-90 transition-transform"
                    >
                        <RotateCcw size={10} strokeWidth={3} />
                    </button>
                </div>
            </div>

            {/* Viewer — galleria immagini / PDF / placeholder per blank */}
            <div className="bg-white rounded-[32px] border border-[#EEF0F4] overflow-hidden shadow-sm mb-8">
                {/* Toolbar — no zoom buttons */}
                <div className="p-3 bg-white border-b border-[#EEF0F4] flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                        <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} className="w-9 h-9 flex items-center justify-center bg-[#FAFAFC] rounded-lg text-[#1C1C1E] active:scale-90 transition-all">
                            <ChevronLeft size={20} strokeWidth={3} />
                        </button>
                        <span className="text-[13px] font-black text-[#1C1C1E] bg-[#FAFAFC] px-3 py-1.5 rounded-lg border border-[#EEF0F4]">
                            {totalPages > 0 ? currentPage : 0} / {totalPages}
                        </span>
                        <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} className="w-9 h-9 flex items-center justify-center bg-[#FAFAFC] rounded-lg text-[#1C1C1E] active:scale-90 transition-all">
                            <ChevronRight size={20} strokeWidth={3} />
                        </button>
                    </div>
                    <div className="flex items-center gap-2">
                        {project.type !== 'pdf' && (
                            <>
                                <input type="file" ref={fileInputRef} onChange={handleAddImage} className="hidden" accept="image/*" />
                                <button onClick={() => fileInputRef.current?.click()} className="w-9 h-9 flex items-center justify-center bg-[#F4EEFF] text-[#7B5CF6] rounded-lg">
                                    <PlusIcon size={18} strokeWidth={3} />
                                </button>
                                {imageUrls.length > 0 && project.images?.[currentPage - 1] && (
                                    <button
                                        onClick={() => {
                                            const imgId = project.images[currentPage - 1]?.id;
                                            if (imgId) router.push(`/projects/${id}/edit-image/${imgId}`);
                                        }}
                                        className="w-9 h-9 flex items-center justify-center bg-[#FFF4E0] text-orange-500 rounded-lg"
                                        title="Modifica immagine"
                                    >
                                        <Pencil size={16} strokeWidth={3} />
                                    </button>
                                )}
                                <button onClick={handleDeleteCurrentImage} className="w-9 h-9 flex items-center justify-center bg-red-50 text-red-500 rounded-lg">
                                    <Trash2 size={18} strokeWidth={3} />
                                </button>
                            </>
                        )}
                        {project.type !== 'pdf' && project.images.length > 1 && (
                            <button
                                onClick={() => setShowImageManager(true)}
                                className="w-9 h-9 flex items-center justify-center bg-[#F4EEFF] text-[#7B5CF6] rounded-lg"
                                title="Gestisci immagini"
                            >
                                <GripVertical size={18} />
                            </button>
                        )}
                        <button
                            onClick={() => setFullscreen(true)}
                            className="w-9 h-9 flex items-center justify-center bg-[#FAFAFC] text-[#9AA2B1] hover:text-[#7B5CF6] rounded-lg transition-colors"
                            title="Apri a schermo intero"
                        >
                            <Maximize2 size={18} />
                        </button>
                    </div>
                </div>

                {/* Content — double click / double tap to fullscreen */}
                <div
                    className="overflow-auto bg-[#FAFAFC] flex justify-center relative cursor-pointer"
                    onDoubleClick={() => setFullscreen(true)}
                    onTouchEnd={(e) => {
                        const now = Date.now();
                        if (now - lastTapRef.current < 300) {
                            e.preventDefault();
                            setFullscreen(true);
                        }
                        lastTapRef.current = now;
                    }}
                >
                    {project.type === 'pdf' ? (
                        <canvas ref={canvasRef} className="max-w-full h-auto shadow-sm" />
                    ) : (
                        <div className="w-full flex items-center justify-center p-4">
                            {imageUrls.length > 0 ? (
                                <img
                                    src={imageUrls[currentPage - 1] || project.thumbDataURL}
                                    alt="Project"
                                    className="max-w-full object-contain shadow-2xl rounded-2xl"
                                />
                            ) : (
                                <div className="text-center p-12">
                                    <div className="w-16 h-16 bg-[#F4EEFF] rounded-2xl flex items-center justify-center mx-auto mb-4 text-[#7B5CF6]">
                                        <Camera size={32} />
                                    </div>
                                    <p className="text-[#9AA2B1] font-bold text-sm">Nessuna immagine</p>
                                </div>
                            )}
                        </div>
                    )}
                    {/* Hint */}
                    {hintVisible && (imageUrls.length > 0 || pdfDoc) && (
                        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/50 text-white text-xs font-bold px-3 py-1.5 rounded-full pointer-events-none animate-in fade-in">
                            <span className="md:hidden">Doppio tap per schermo intero</span>
                            <span className="hidden md:inline">Doppio click per schermo intero</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Sezioni */}
            <div className="mb-8">
                {/* Header */}
                <div className="flex items-center justify-between mb-4 px-2">
                    <h2 className="text-xl font-black text-[#1C1C1E]">Sezioni</h2>
                    <div className="flex items-center gap-2">
                        {sections.length > 1 && (
                            <button
                                onClick={() => { setReorderSectionsMode(r => !r); setReorderInSectionId(null); setSectionMenuId(null); }}
                                className={`px-3 py-1.5 rounded-xl font-black text-xs flex items-center gap-1.5 transition-colors ${reorderSectionsMode ? 'bg-green-500/10 text-green-600 border border-green-200' : 'bg-[#F4EEFF] text-[#7B5CF6]'}`}
                            >
                                <GripVertical size={13} strokeWidth={3} />
                                {reorderSectionsMode ? 'FINE' : 'ORDINA'}
                            </button>
                        )}
                        {!reorderSectionsMode && (
                            <button
                                onClick={() => { setNewSectionTitle(""); setNewSectionDescription(""); setShowNewSectionModal(true); }}
                                className="bg-[#7B5CF6]/10 text-[#7B5CF6] px-3 py-1.5 rounded-xl font-black text-xs flex items-center gap-2"
                            >
                                <PlusIcon size={14} strokeWidth={3} />
                                NUOVO
                            </button>
                        )}
                    </div>
                </div>

                <div className="flex flex-col gap-3">
                    {/* Section cards */}
                    {[...sections].sort((a, b) => a.order - b.order).map((section, sectionIndex) => {
                        const sectionCounters = project.secs.filter(s => s.sectionId === section.id);
                        const isExpanded = expandedSections[section.id] !== false; // default expanded
                        const isReorderingThisSection = reorderInSectionId === section.id;
                        const isMenuOpen = sectionMenuId === section.id;

                        return (
                            <div key={section.id} className={`flex items-stretch gap-2 transition-all ${reorderSectionsMode ? 'cursor-default' : ''}`}>
                                {/* Section reorder controls */}
                                {reorderSectionsMode && (
                                    <div className="flex flex-col items-center justify-center gap-1 bg-[#F4EEFF] rounded-2xl px-1 py-2 shrink-0">
                                        <button
                                            onClick={() => sectionIndex > 0 && moveSection(sectionIndex, sectionIndex - 1)}
                                            disabled={sectionIndex === 0}
                                            className="w-7 h-7 flex items-center justify-center rounded-lg text-[#7B5CF6] disabled:opacity-25 hover:bg-[#7B5CF6]/10 active:scale-90 transition-all"
                                        >
                                            <ChevronUp size={16} strokeWidth={3} />
                                        </button>
                                        <GripVertical size={14} className="text-[#9AA2B1]" />
                                        <button
                                            onClick={() => sectionIndex < sections.length - 1 && moveSection(sectionIndex, sectionIndex + 1)}
                                            disabled={sectionIndex === sections.length - 1}
                                            className="w-7 h-7 flex items-center justify-center rounded-lg text-[#7B5CF6] disabled:opacity-25 hover:bg-[#7B5CF6]/10 active:scale-90 transition-all"
                                        >
                                            <ChevronDown size={16} strokeWidth={3} />
                                        </button>
                                    </div>
                                )}
                                {/* Section card */}
                                <div className="flex-1 min-w-0 bg-white border border-[#EEF0F4] rounded-2xl shadow-sm">
                                    {/* Section header */}
                                    <div className="flex items-center gap-2 px-4 py-3">
                                        <button
                                            onClick={() => setExpandedSections(e => ({ ...e, [section.id]: !isExpanded }))}
                                            className="w-7 h-7 flex items-center justify-center rounded-lg text-[#9AA2B1] hover:bg-[#F4F4F8] transition-colors flex-shrink-0"
                                        >
                                            {isExpanded ? <ChevronDown size={16} strokeWidth={3} /> : <ChevronRight size={16} strokeWidth={3} />}
                                        </button>
                                        <span className="flex-1 font-black text-[#1C1C1E] text-base truncate">{section.title}</span>
                                        <span className="text-xs text-[#9AA2B1] font-bold shrink-0">{sectionCounters.length}</span>
                                        {!reorderSectionsMode && (
                                            <>
                                                <button
                                                    onClick={() => { setNewCounterSectionId(section.id); setNewCounterName(""); setShowNewCounterModal(true); }}
                                                    className="w-7 h-7 flex items-center justify-center rounded-lg text-[#7B5CF6] bg-[#F4EEFF] hover:bg-[#E6DAFF] active:scale-90 transition-all shrink-0"
                                                >
                                                    <PlusIcon size={15} strokeWidth={3} />
                                                </button>
                                                <div className="relative shrink-0">
                                                    <button
                                                        onClick={() => setSectionMenuId(isMenuOpen ? null : section.id)}
                                                        className="w-7 h-7 flex items-center justify-center rounded-lg border border-[#EEF0F4] bg-white text-[#9599AA] active:bg-[#F4EEFF]"
                                                    >
                                                        <MoreVertical size={15} />
                                                    </button>
                                                    {isMenuOpen && (
                                                        <>
                                                            <div className="fixed inset-0 z-10" onClick={() => setSectionMenuId(null)} />
                                                            <div className="absolute right-0 top-9 z-20 bg-white rounded-2xl shadow-xl border border-[#EEF0F4] p-1.5 w-52 animate-in fade-in zoom-in duration-150">
                                                                <button
                                                                    onClick={() => { setEditSectionModal({ id: section.id, title: section.title, description: section.description ?? '' }); setSectionMenuId(null); }}
                                                                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm font-bold text-[#1C1C1E] hover:bg-[#F4F4F8] rounded-xl"
                                                                >
                                                                    <Pencil size={14} className="text-[#7B5CF6]" />
                                                                    Modifica sezione
                                                                </button>
                                                                {sectionCounters.length > 1 && (
                                                                    <button
                                                                        onClick={() => { setReorderInSectionId(isReorderingThisSection ? null : section.id); setSectionMenuId(null); setExpandedSections(e => ({ ...e, [section.id]: true })); }}
                                                                        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm font-bold text-[#1C1C1E] hover:bg-[#F4F4F8] rounded-xl"
                                                                    >
                                                                        <GripVertical size={14} className="text-[#7B5CF6]" />
                                                                        Riordina contatori
                                                                    </button>
                                                                )}
                                                                <button
                                                                    onClick={() => { setDeleteSectionId(section.id); setSectionMenuId(null); }}
                                                                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm font-bold text-red-500 hover:bg-red-50 rounded-xl"
                                                                >
                                                                    <Trash2 size={14} />
                                                                    Elimina sezione
                                                                </button>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                    {/* Expanded content */}
                                    {isExpanded && (
                                        <div className="px-4 pb-4">
                                            {section.description && (
                                                <p className="text-xs text-[#9AA2B1] font-medium mb-3 leading-relaxed">{section.description}</p>
                                            )}
                                            {isReorderingThisSection && (
                                                <div className="flex items-center justify-between mb-2">
                                                    <p className="text-xs text-[#9AA2B1] font-medium">Usa ↑↓ per spostare</p>
                                                    <button onClick={() => setReorderInSectionId(null)} className="text-xs text-green-600 font-black px-2 py-1 bg-green-50 rounded-lg">FINE</button>
                                                </div>
                                            )}
                                            <div className="flex flex-col gap-2">
                                                {sectionCounters.map((sec, relIdx) => {
                                                    const imgIndex = sec.imageId
                                                        ? (project.images ?? []).findIndex(img => img.id === sec.imageId)
                                                        : -1;
                                                    const secImageUrl = imgIndex >= 0 ? imageUrls[imgIndex] : undefined;
                                                    return (
                                                        <div key={sec.id} className="flex items-stretch gap-2">
                                                            {isReorderingThisSection && (
                                                                <div className="flex flex-col items-center justify-center gap-1 bg-[#F4EEFF] rounded-xl px-1 py-1 shrink-0">
                                                                    <button
                                                                        onClick={() => relIdx > 0 && moveCounterInSection(section.id, relIdx, relIdx - 1)}
                                                                        disabled={relIdx === 0}
                                                                        className="w-6 h-6 flex items-center justify-center rounded-lg text-[#7B5CF6] disabled:opacity-25 active:scale-90"
                                                                    >
                                                                        <ChevronUp size={14} strokeWidth={3} />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => relIdx < sectionCounters.length - 1 && moveCounterInSection(section.id, relIdx, relIdx + 1)}
                                                                        disabled={relIdx === sectionCounters.length - 1}
                                                                        className="w-6 h-6 flex items-center justify-center rounded-lg text-[#7B5CF6] disabled:opacity-25 active:scale-90"
                                                                    >
                                                                        <ChevronDown size={14} strokeWidth={3} />
                                                                    </button>
                                                                </div>
                                                            )}
                                                            <div className="flex-1 min-w-0">
                                                                <RoundCounter
                                                                    {...sec}
                                                                    imageUrl={secImageUrl}
                                                                    hasSections={sections.length > 0}
                                                                    onIncrement={(sid) => {
                                                                        const updated = project.secs.map(s => s.id === sid ? { ...s, value: s.value + 1 } : s);
                                                                        updateProject(project.id, { secs: updated });
                                                                        syncSecs(updated);
                                                                    }}
                                                                    onDecrement={(sid) => {
                                                                        const updated = project.secs.map(s => s.id === sid ? { ...s, value: Math.max(1, s.value - 1) } : s);
                                                                        updateProject(project.id, { secs: updated });
                                                                        syncSecs(updated);
                                                                    }}
                                                                    onRename={(sid, newName) => {
                                                                        const updated = project.secs.map(s => s.id === sid ? { ...s, name: newName } : s);
                                                                        updateProject(project.id, { secs: updated });
                                                                        syncSecs(updated);
                                                                    }}
                                                                    onDelete={(sid) => {
                                                                        const updated = project.secs.filter(s => s.id !== sid);
                                                                        updateProject(project.id, { secs: updated });
                                                                        syncSecs(updated);
                                                                    }}
                                                                    onAssociateImage={(sid) => setPickerCounterId(sid)}
                                                                    onRemoveImage={(sid) => {
                                                                        const updated = project.secs.map(s => s.id === sid ? { ...s, imageId: undefined } : s);
                                                                        updateProject(project.id, { secs: updated });
                                                                        syncSecs(updated);
                                                                    }}
                                                                />
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                                {sectionCounters.length === 0 && (
                                                    <div className="text-center py-4 text-xs text-[#9AA2B1] font-medium border border-dashed border-[#EEF0F4] rounded-xl">
                                                        Nessun contatore — premi + per aggiungere
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}

                    {/* Ungrouped counters (existing counters without sectionId) */}
                    {(() => {
                        const ungrouped = project.secs.filter(s => !s.sectionId);
                        if (ungrouped.length === 0) return null;
                        return (
                            <div>
                                {sections.length > 0 && (
                                    <div className="flex items-center justify-between px-2 mb-2">
                                        <p className="text-xs font-black text-[#9AA2B1] uppercase tracking-widest">Senza sezione</p>
                                        {ungrouped.length > 1 && (
                                            <button
                                                onClick={() => setReorderMode(r => !r)}
                                                className={`px-2 py-1 rounded-lg font-black text-xs flex items-center gap-1 ${reorderMode ? 'text-green-600' : 'text-[#9AA2B1]'}`}
                                            >
                                                <GripVertical size={11} strokeWidth={3} />
                                                {reorderMode ? 'FINE' : 'ORDINA'}
                                            </button>
                                        )}
                                    </div>
                                )}
                                {sections.length === 0 && ungrouped.length > 1 && (
                                    <div className="flex items-center justify-end px-2 mb-2">
                                        <button
                                            onClick={() => setReorderMode(r => !r)}
                                            className={`px-3 py-1.5 rounded-xl font-black text-xs flex items-center gap-1.5 transition-colors ${reorderMode ? 'bg-green-500/10 text-green-600 border border-green-200' : 'bg-[#F4EEFF] text-[#7B5CF6]'}`}
                                        >
                                            <GripVertical size={13} strokeWidth={3} />
                                            {reorderMode ? 'FINE' : 'ORDINA'}
                                        </button>
                                    </div>
                                )}
                                <div className="flex flex-col gap-3">
                                    {ungrouped.map((sec) => {
                                        const ungroupedIndex = project.secs.indexOf(sec);
                                        const imgIndex = sec.imageId
                                            ? (project.images ?? []).findIndex(img => img.id === sec.imageId)
                                            : -1;
                                        const secImageUrl = imgIndex >= 0 ? imageUrls[imgIndex] : undefined;
                                        const relIdx = ungrouped.indexOf(sec);
                                        return (
                                            <div
                                                key={sec.id}
                                                draggable={reorderMode}
                                                onDragStart={() => setDragIdx(ungroupedIndex)}
                                                onDragEnd={() => { setDragIdx(null); setOverIdx(null); }}
                                                onDragOver={(e) => { e.preventDefault(); setOverIdx(ungroupedIndex); }}
                                                onDrop={() => {
                                                    if (dragIdx !== null && dragIdx !== ungroupedIndex) moveCounter(dragIdx, ungroupedIndex);
                                                    setDragIdx(null); setOverIdx(null);
                                                }}
                                                className={`relative flex items-stretch gap-2 transition-all ${reorderMode ? 'cursor-grab' : ''} ${overIdx === ungroupedIndex && dragIdx !== ungroupedIndex ? 'ring-2 ring-[#7B5CF6] rounded-[28px]' : ''} ${dragIdx === ungroupedIndex ? 'opacity-50' : ''}`}
                                            >
                                                {reorderMode && (
                                                    <div className="flex flex-col items-center justify-center gap-1 bg-[#F4EEFF] rounded-2xl px-1 py-2 shrink-0">
                                                        <button
                                                            onClick={() => relIdx > 0 && moveCounter(ungroupedIndex, project.secs.indexOf(ungrouped[relIdx - 1]))}
                                                            disabled={relIdx === 0}
                                                            className="w-7 h-7 flex items-center justify-center rounded-lg text-[#7B5CF6] disabled:opacity-25 active:scale-90"
                                                        >
                                                            <ChevronUp size={16} strokeWidth={3} />
                                                        </button>
                                                        <GripVertical size={14} className="text-[#9AA2B1] md:block hidden" />
                                                        <button
                                                            onClick={() => relIdx < ungrouped.length - 1 && moveCounter(ungroupedIndex, project.secs.indexOf(ungrouped[relIdx + 1]))}
                                                            disabled={relIdx === ungrouped.length - 1}
                                                            className="w-7 h-7 flex items-center justify-center rounded-lg text-[#7B5CF6] disabled:opacity-25 active:scale-90"
                                                        >
                                                            <ChevronDown size={16} strokeWidth={3} />
                                                        </button>
                                                    </div>
                                                )}
                                                <div className="flex-1 min-w-0">
                                                    <RoundCounter
                                                        {...sec}
                                                        imageUrl={secImageUrl}
                                                        hasSections={sections.length > 0}
                                                        onAssignToSection={(sid) => setAssignCounterToSectionId(sid)}
                                                        onIncrement={(sid) => {
                                                            const updated = project.secs.map(s => s.id === sid ? { ...s, value: s.value + 1 } : s);
                                                            updateProject(project.id, { secs: updated });
                                                            syncSecs(updated);
                                                        }}
                                                        onDecrement={(sid) => {
                                                            const updated = project.secs.map(s => s.id === sid ? { ...s, value: Math.max(1, s.value - 1) } : s);
                                                            updateProject(project.id, { secs: updated });
                                                            syncSecs(updated);
                                                        }}
                                                        onRename={(sid, newName) => {
                                                            const updated = project.secs.map(s => s.id === sid ? { ...s, name: newName } : s);
                                                            updateProject(project.id, { secs: updated });
                                                            syncSecs(updated);
                                                        }}
                                                        onDelete={(sid) => {
                                                            const updated = project.secs.filter(s => s.id !== sid);
                                                            updateProject(project.id, { secs: updated });
                                                            syncSecs(updated);
                                                        }}
                                                        onAssociateImage={(sid) => setPickerCounterId(sid)}
                                                        onRemoveImage={(sid) => {
                                                            const updated = project.secs.map(s => s.id === sid ? { ...s, imageId: undefined } : s);
                                                            updateProject(project.id, { secs: updated });
                                                            syncSecs(updated);
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })()}

                    {/* Empty state */}
                    {sections.length === 0 && project.secs.length === 0 && (
                        <div className="text-center p-6 bg-[#FAFAFC] rounded-2xl border border-dashed border-[#EEF0F4] text-[#9AA2B1] text-sm font-medium">
                            Nessuna sezione creata — premi + NUOVO per iniziare
                        </div>
                    )}
                </div>
            </div>

            {/* Image Manager Modal */}
            {showImageManager && (
                <div className="fixed inset-0 z-[10000] flex items-end md:items-center justify-center bg-black/50" onClick={() => setShowImageManager(false)}>
                    <div
                        className="w-full max-w-2xl bg-white rounded-t-[32px] md:rounded-[32px] shadow-2xl animate-in slide-in-from-bottom md:slide-in-from-bottom-0 duration-300 flex flex-col max-h-[85vh]"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-[#EEF0F4] shrink-0">
                            <div>
                                <h3 className="text-xl font-black text-[#1C1C1E]">Gestisci Immagini</h3>
                                <p className="text-xs text-[#9AA2B1] font-medium mt-0.5">
                                    ⭐ Copertina · Trascina ☰ o usa ↑↓ per riordinare
                                </p>
                            </div>
                            <button
                                onClick={() => setShowImageManager(false)}
                                className="w-9 h-9 flex items-center justify-center rounded-xl bg-[#FAFAFC] border border-[#EEF0F4] text-[#9AA2B1]"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Image list */}
                        <div className="overflow-y-auto flex-1 px-4 py-3">
                            {(project.images ?? []).map((img, i) => {
                                const url = imageUrls[i];
                                const isCover = project.coverImageId
                                    ? img.id === project.coverImageId
                                    : i === 0;
                                const isDragging = imgDragIdx === i;
                                const isOver = imgOverIdx === i && imgDragIdx !== i;
                                return (
                                    <div
                                        key={img.id}
                                        data-img-idx={i}
                                        className={`flex items-center gap-3 p-2.5 rounded-2xl mb-2 border transition-all select-none
                                            ${isOver ? 'border-[#7B5CF6] bg-[#F4EEFF]' : isDragging ? 'opacity-40 border-dashed border-[#7B5CF6]' : 'border-transparent hover:border-[#EEF0F4] hover:bg-[#FAFAFC]'}`}
                                    >
                                        {/* Drag handle — pointer events, works on mobile + desktop */}
                                        <div
                                            className="w-8 h-16 flex items-center justify-center shrink-0 rounded-xl bg-[#FAFAFC] border border-[#EEF0F4] cursor-grab active:cursor-grabbing touch-none"
                                            onPointerDown={(e) => {
                                                e.preventDefault();
                                                setImgDragIdx(i);
                                            }}
                                            title="Trascina per riordinare"
                                        >
                                            <GripVertical size={16} className="text-[#9AA2B1]" />
                                        </div>

                                        {/* Thumbnail */}
                                        <div className="w-16 h-16 rounded-xl overflow-hidden bg-[#FAFAFC] border border-[#EEF0F4] shrink-0 relative">
                                            {url && <img src={url} alt="" className="w-full h-full object-cover" draggable={false} />}
                                            {isCover && (
                                                <div className="absolute top-1 right-1 w-5 h-5 bg-amber-400 rounded-full flex items-center justify-center shadow-sm">
                                                    <span className="text-[10px]">⭐</span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold text-[#1C1C1E]">
                                                Immagine {i + 1}
                                                {isCover && <span className="ml-2 text-amber-500 text-xs font-black">COPERTINA</span>}
                                            </p>
                                            {!isCover && (
                                                <button
                                                    onClick={() => setCoverImage(img.id)}
                                                    className="text-xs text-[#9AA2B1] hover:text-amber-500 font-bold mt-0.5 transition-colors"
                                                >
                                                    ⭐ Imposta come copertina
                                                </button>
                                            )}
                                        </div>

                                        {/* ↑↓ tap controls */}
                                        <div className="flex flex-col gap-1 shrink-0">
                                            <button
                                                onClick={() => i > 0 && moveImage(i, i - 1)}
                                                disabled={i === 0}
                                                className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#FAFAFC] border border-[#EEF0F4] text-[#7B5CF6] disabled:opacity-25 active:scale-90 transition-all"
                                            >
                                                <ChevronUp size={15} strokeWidth={3} />
                                            </button>
                                            <button
                                                onClick={() => i < (project.images.length - 1) && moveImage(i, i + 1)}
                                                disabled={i === project.images.length - 1}
                                                className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#FAFAFC] border border-[#EEF0F4] text-[#7B5CF6] disabled:opacity-25 active:scale-90 transition-all"
                                            >
                                                <ChevronDown size={15} strokeWidth={3} />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="px-6 pb-6 pt-3 shrink-0">
                            <button
                                onClick={() => setShowImageManager(false)}
                                className="w-full h-12 bg-[#7B5CF6] text-white rounded-2xl font-bold shadow-lg"
                            >
                                Fatto
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* CounterImagePicker */}
            {pickerCounterId && (
                <CounterImagePicker
                    imageUrls={imageUrls}
                    imageIds={(project.images ?? []).map(img => img.id)}
                    currentImageId={project.secs.find(s => s.id === pickerCounterId)?.imageId}
                    onSelect={(imgId) => {
                        const updated = project.secs.map(s => s.id === pickerCounterId ? { ...s, imageId: imgId } : s);
                        updateProject(project.id, { secs: updated });
                        syncSecs(updated);
                        setPickerCounterId(null);
                    }}
                    onRemove={() => {
                        const updated = project.secs.map(s => s.id === pickerCounterId ? { ...s, imageId: undefined } : s);
                        updateProject(project.id, { secs: updated });
                        syncSecs(updated);
                        setPickerCounterId(null);
                    }}
                    onClose={() => setPickerCounterId(null)}
                />
            )}

            {/* Modal nuovo contatore */}
            {showNewCounterModal && (
                <div className="fixed inset-0 z-[10000] flex items-end justify-center bg-black/40" onClick={() => { setShowNewCounterModal(false); setNewCounterSectionId(null); }}>
                    <div className="w-full max-w-2xl bg-white rounded-t-[32px] p-6 pb-10 shadow-2xl animate-in slide-in-from-bottom duration-300" onClick={e => e.stopPropagation()}>
                        <div className="w-12 h-1.5 bg-[#EEF0F4] rounded-full mx-auto mb-6" />
                        <h3 className="text-2xl font-black mb-1">Nuovo Contatore</h3>
                        {newCounterSectionId && (
                            <p className="text-xs text-[#7B5CF6] font-bold mb-4">
                                Sezione: {sections.find(s => s.id === newCounterSectionId)?.title}
                            </p>
                        )}
                        {!newCounterSectionId && <div className="mb-4" />}
                        <input
                            autoFocus
                            type="text"
                            placeholder="Nome del contatore (es. Giro Manica)..."
                            value={newCounterName}
                            onChange={e => setNewCounterName(e.target.value)}
                            onKeyDown={e => {
                                if (e.key === 'Enter' && newCounterName.trim()) {
                                    const newCounter: RoundCounterType = { id: Date.now().toString(), name: newCounterName.trim(), value: 1, ...(newCounterSectionId ? { sectionId: newCounterSectionId } : {}) };
                                    const updated = [...project.secs, newCounter];
                                    updateProject(project.id, { secs: updated });
                                    syncSecs(updated);
                                    setShowNewCounterModal(false);
                                    setNewCounterSectionId(null);
                                }
                            }}
                            className="w-full h-12 px-4 bg-[#FAFAFC] border border-[#E6DAFF] rounded-xl outline-none focus:border-[#7B5CF6] font-medium mb-4"
                        />
                        <div className="flex gap-3">
                            <button onClick={() => { setShowNewCounterModal(false); setNewCounterSectionId(null); }} className="flex-1 h-12 bg-white border border-[#EEF0F4] rounded-2xl font-bold text-[#9AA2B1]">Annulla</button>
                            <button
                                onClick={() => {
                                    if (!newCounterName.trim()) return;
                                    const newCounter: RoundCounterType = { id: Date.now().toString(), name: newCounterName.trim(), value: 1, ...(newCounterSectionId ? { sectionId: newCounterSectionId } : {}) };
                                    const updated = [...project.secs, newCounter];
                                    updateProject(project.id, { secs: updated });
                                    syncSecs(updated);
                                    setShowNewCounterModal(false);
                                    setNewCounterSectionId(null);
                                }}
                                className="flex-[2] h-12 bg-[#7B5CF6] text-white rounded-2xl font-bold shadow-lg"
                            >
                                Crea
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal nuova sezione */}
            {showNewSectionModal && (
                <div className="fixed inset-0 z-[10000] flex items-end justify-center bg-black/40" onClick={() => setShowNewSectionModal(false)}>
                    <div className="w-full max-w-2xl bg-white rounded-t-[32px] p-6 pb-10 shadow-2xl animate-in slide-in-from-bottom duration-300" onClick={e => e.stopPropagation()}>
                        <div className="w-12 h-1.5 bg-[#EEF0F4] rounded-full mx-auto mb-6" />
                        <h3 className="text-2xl font-black mb-4">Nuova Sezione</h3>
                        <input
                            autoFocus
                            type="text"
                            placeholder="Titolo sezione (es. Testa, Corpo, Zampe)..."
                            value={newSectionTitle}
                            onChange={e => setNewSectionTitle(e.target.value)}
                            className="w-full h-12 px-4 bg-[#FAFAFC] border border-[#E6DAFF] rounded-xl outline-none focus:border-[#7B5CF6] font-medium mb-3"
                        />
                        <textarea
                            placeholder="Descrizione (opzionale)..."
                            value={newSectionDescription}
                            onChange={e => setNewSectionDescription(e.target.value)}
                            rows={2}
                            className="w-full px-4 py-3 bg-[#FAFAFC] border border-[#EEF0F4] rounded-xl text-sm font-medium focus:outline-none focus:border-[#7B5CF6] resize-none mb-4"
                        />
                        <div className="flex gap-3">
                            <button onClick={() => setShowNewSectionModal(false)} className="flex-1 h-12 bg-white border border-[#EEF0F4] rounded-2xl font-bold text-[#9AA2B1]">Annulla</button>
                            <button
                                disabled={!newSectionTitle.trim()}
                                onClick={() => {
                                    if (!newSectionTitle.trim()) return;
                                    const newSection: Section = { id: Date.now().toString(), title: newSectionTitle.trim(), description: newSectionDescription.trim() || undefined, order: sections.length };
                                    const newSections = [...sections, newSection];
                                    updateProject(project.id, { sections: newSections });
                                    syncSections(newSections);
                                    setShowNewSectionModal(false);
                                    setExpandedSections(e => ({ ...e, [newSection.id]: true }));
                                }}
                                className="flex-[2] h-12 bg-[#7B5CF6] text-white rounded-2xl font-bold shadow-lg disabled:opacity-50"
                            >
                                Crea
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal modifica sezione */}
            {editSectionModal && (
                <div className="fixed inset-0 z-[10000] flex items-end justify-center bg-black/40" onClick={() => setEditSectionModal(null)}>
                    <div className="w-full max-w-2xl bg-white rounded-t-[32px] p-6 pb-10 shadow-2xl animate-in slide-in-from-bottom duration-300" onClick={e => e.stopPropagation()}>
                        <div className="w-12 h-1.5 bg-[#EEF0F4] rounded-full mx-auto mb-6" />
                        <h3 className="text-2xl font-black mb-4">Modifica Sezione</h3>
                        <label className="text-xs font-black text-[#1C1C1E] uppercase tracking-widest mb-1.5 block">Titolo *</label>
                        <input
                            autoFocus
                            type="text"
                            value={editSectionModal.title}
                            onChange={e => setEditSectionModal(m => m ? { ...m, title: e.target.value } : m)}
                            className="w-full h-12 px-4 bg-[#FAFAFC] border border-[#E6DAFF] rounded-xl outline-none focus:border-[#7B5CF6] font-medium mb-3"
                        />
                        <label className="text-xs font-black text-[#1C1C1E] uppercase tracking-widest mb-1.5 block">Descrizione (opzionale)</label>
                        <textarea
                            value={editSectionModal.description}
                            onChange={e => setEditSectionModal(m => m ? { ...m, description: e.target.value } : m)}
                            rows={2}
                            className="w-full px-4 py-3 bg-[#FAFAFC] border border-[#EEF0F4] rounded-xl text-sm font-medium focus:outline-none focus:border-[#7B5CF6] resize-none mb-4"
                        />
                        <div className="flex gap-3">
                            <button onClick={() => setEditSectionModal(null)} className="flex-1 h-12 bg-white border border-[#EEF0F4] rounded-2xl font-bold text-[#9AA2B1]">Annulla</button>
                            <button
                                disabled={!editSectionModal.title.trim()}
                                onClick={() => {
                                    if (!editSectionModal.title.trim()) return;
                                    const newSections = sections.map(s => s.id === editSectionModal.id ? { ...s, title: editSectionModal.title.trim(), description: editSectionModal.description.trim() || undefined } : s);
                                    updateProject(project.id, { sections: newSections });
                                    syncSections(newSections);
                                    setEditSectionModal(null);
                                }}
                                className="flex-[2] h-12 bg-[#7B5CF6] text-white rounded-2xl font-bold shadow-lg disabled:opacity-50"
                            >
                                Salva
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal conferma elimina sezione */}
            {deleteSectionId && (
                <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 px-4" onClick={() => setDeleteSectionId(null)}>
                    <div className="w-full max-w-sm bg-white rounded-[32px] p-6 shadow-2xl animate-in fade-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
                        <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <AlertTriangle size={24} className="text-red-500" />
                        </div>
                        <h3 className="text-xl font-black text-center mb-2">Elimina sezione</h3>
                        <p className="text-sm text-[#6B7280] text-center leading-relaxed mb-6">
                            Eliminando la sezione <strong className="text-[#1C1C1E]">&ldquo;{sections.find(s => s.id === deleteSectionId)?.title}&rdquo;</strong> verranno eliminati anche tutti i contatori al suo interno. Questa azione non può essere annullata.
                        </p>
                        <div className="flex gap-3">
                            <button onClick={() => setDeleteSectionId(null)} className="flex-1 h-12 bg-white border border-[#EEF0F4] rounded-2xl font-bold text-[#9AA2B1]">Annulla</button>
                            <button
                                onClick={() => {
                                    const newSecs = project.secs.filter(s => s.sectionId !== deleteSectionId);
                                    const newSections = sections.filter(s => s.id !== deleteSectionId).map((s, i) => ({ ...s, order: i }));
                                    updateProject(project.id, { secs: newSecs, sections: newSections });
                                    syncSections(newSections, newSecs);
                                    setDeleteSectionId(null);
                                }}
                                className="flex-[2] h-12 bg-red-500 text-white rounded-2xl font-bold shadow-lg"
                            >
                                Elimina tutto
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal assegna contatore a sezione */}
            {assignCounterToSectionId && sections.length > 0 && (
                <div className="fixed inset-0 z-[10000] flex items-end justify-center bg-black/40" onClick={() => setAssignCounterToSectionId(null)}>
                    <div className="w-full max-w-2xl bg-white rounded-t-[32px] p-6 pb-10 shadow-2xl animate-in slide-in-from-bottom duration-300" onClick={e => e.stopPropagation()}>
                        <div className="w-12 h-1.5 bg-[#EEF0F4] rounded-full mx-auto mb-6" />
                        <h3 className="text-xl font-black mb-1">Associa a sezione</h3>
                        <p className="text-sm text-[#9AA2B1] mb-4">Scegli la sezione per il contatore <strong className="text-[#1C1C1E]">&ldquo;{project.secs.find(s => s.id === assignCounterToSectionId)?.name}&rdquo;</strong></p>
                        <div className="flex flex-col gap-2">
                            {[...sections].sort((a, b) => a.order - b.order).map(section => (
                                <button
                                    key={section.id}
                                    onClick={() => {
                                        const updated = project.secs.map(s => s.id === assignCounterToSectionId ? { ...s, sectionId: section.id } : s);
                                        updateProject(project.id, { secs: updated });
                                        syncSecs(updated);
                                        setAssignCounterToSectionId(null);
                                        setExpandedSections(e => ({ ...e, [section.id]: true }));
                                    }}
                                    className="flex items-center gap-3 px-4 py-3 bg-[#FAFAFC] hover:bg-[#F4EEFF] border border-[#EEF0F4] hover:border-[#7B5CF6] rounded-2xl text-left transition-colors"
                                >
                                    <FolderPlus size={16} className="text-[#7B5CF6] shrink-0" />
                                    <div>
                                        <p className="font-bold text-sm text-[#1C1C1E]">{section.title}</p>
                                        {section.description && <p className="text-xs text-[#9AA2B1]">{section.description}</p>}
                                    </div>
                                </button>
                            ))}
                        </div>
                        <button onClick={() => setAssignCounterToSectionId(null)} className="w-full h-11 mt-4 bg-white border border-[#EEF0F4] rounded-2xl font-bold text-[#9AA2B1]">Annulla</button>
                    </div>
                </div>
            )}

            {/* Modal Aggiungi YouTube */}
            {showAddYouTubeModal && (
                <div className="fixed inset-0 z-[10000] flex items-end justify-center bg-black/40" onClick={() => setShowAddYouTubeModal(false)}>
                    <div className="w-full max-w-2xl bg-white rounded-t-[32px] p-6 pb-10 shadow-2xl animate-in slide-in-from-bottom duration-300" onClick={e => e.stopPropagation()}>
                        <div className="w-12 h-1.5 bg-[#EEF0F4] rounded-full mx-auto mb-6" />
                        <div className="flex items-center gap-2.5 mb-5">
                            <Youtube size={20} className="text-red-500" />
                            <h3 className="text-xl font-black">Aggiungi Video YouTube</h3>
                        </div>
                        <input
                            autoFocus
                            type="url"
                            placeholder="Incolla il link YouTube (es. youtube.com/watch?v=...)"
                            value={addYouTubeUrl}
                            onChange={e => { setAddYouTubeUrl(e.target.value); setAddYouTubeError(''); }}
                            className="w-full h-12 px-4 bg-[#FAFAFC] border border-[#E6DAFF] rounded-xl outline-none focus:border-[#7B5CF6] font-medium mb-2 text-sm"
                        />
                        {addYouTubeError && <p className="text-xs text-red-500 font-medium mb-3">{addYouTubeError}</p>}
                        <div className="flex gap-3 mt-4">
                            <button onClick={() => setShowAddYouTubeModal(false)} className="flex-1 h-12 bg-white border border-[#EEF0F4] rounded-2xl font-bold text-[#9AA2B1]">Annulla</button>
                            <button
                                onClick={() => {
                                    const parsed = parseYouTubeUrl(addYouTubeUrl.trim());
                                    if (!parsed) { setAddYouTubeError('URL YouTube non valido. Prova un link come youtube.com/watch?v=...'); return; }
                                    const { videoId, playlistId } = parsed;
                                    const thumbUrl = videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : undefined;
                                    updateProject(project.id, { videoId, playlistId: playlistId || undefined, thumbUrl, thumbDataURL: thumbUrl });
                                    syncProject({ video_id: videoId || null, playlist_id: playlistId || null, thumb_url: thumbUrl || null });
                                    setShowAddYouTubeModal(false);
                                }}
                                className="flex-[2] h-12 bg-[#7B5CF6] text-white rounded-2xl font-bold shadow-lg"
                            >
                                Aggiungi
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Notes */}
            <div className="bg-white rounded-[32px] p-6 border border-[#EEF0F4] shadow-sm mb-10">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2 text-[#7B5CF6]">
                        <StickyNote size={20} strokeWidth={3} />
                        <h3 className="font-black text-sm uppercase tracking-widest">Note di Lavoro</h3>
                    </div>
                    {isEditingNotes ? (
                        <button onClick={handleSaveNotes} className="flex items-center gap-1.5 text-green-500 font-bold text-xs uppercase">
                            <Save size={14} /> Salva
                        </button>
                    ) : (
                        <button onClick={() => setIsEditingNotes(true)} className="text-[#9AA2B1] font-bold text-xs uppercase hover:text-[#7B5CF6]">
                            Modifica
                        </button>
                    )}
                </div>
                {isEditingNotes ? (
                    <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        autoFocus
                        className="w-full h-32 bg-[#FAFAFC] rounded-2xl p-4 text-[#1C1C1E] font-medium text-sm focus:outline-none border border-[#EEF0F4]"
                        placeholder="Scrivi qui le tue annotazioni, filati usati o modifiche allo schema..."
                    />
                ) : (
                    <div className="text-sm font-medium text-[#1C1C1E] leading-relaxed whitespace-pre-wrap">
                        {project.notesHtml || <span className="text-[#9AA2B1] italic">Nessuna nota salvata per questo progetto.</span>}
                    </div>
                )}
            </div>

            {/* Contribuisci schema — visible only with secs data */}
            {project.secs.length > 0 && user && (
                <div className="bg-gradient-to-br from-[#F4EEFF] to-[#EEF0F4] rounded-[32px] p-6 border border-[#E6DAFF] shadow-sm mb-10">
                    <div className="flex items-start gap-3 mb-4">
                        <div className="w-10 h-10 rounded-2xl bg-[#7B5CF6] flex items-center justify-center shrink-0 shadow-md">
                            <Sparkles size={18} className="text-white" />
                        </div>
                        <div>
                            <h3 className="font-black text-[#1C1C1E] text-sm">Contribuisci al Modello AI</h3>
                            <p className="text-xs text-[#6B7280] mt-0.5 leading-relaxed">
                                Hai compilato {project.secs.length} contator{project.secs.length === 1 ? 'e' : 'i'} per questo progetto.
                                Condividi la struttura del tuo schema per aiutare ad addestrare il modello AI Lurumi.
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => {
                            setContribTitle(project.title);
                            setContribDone(false);
                            setShowContribuisci(true);
                        }}
                        className="w-full h-11 bg-[#7B5CF6] text-white rounded-2xl font-bold text-sm shadow-md active:scale-95 transition-transform"
                    >
                        Condividi schema
                    </button>
                </div>
            )}

            {/* Modal Contribuisci */}
            {showContribuisci && (
                <div className="fixed inset-0 z-[10000] flex items-end md:items-center justify-center bg-black/50" onClick={() => setShowContribuisci(false)}>
                    <div
                        className="w-full max-w-lg bg-white rounded-t-[32px] md:rounded-[32px] shadow-2xl animate-in slide-in-from-bottom md:slide-in-from-bottom-0 duration-300 flex flex-col max-h-[90vh]"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-[#EEF0F4] shrink-0">
                            <div className="flex items-center gap-2.5">
                                <Sparkles size={18} className="text-[#7B5CF6]" />
                                <h3 className="text-lg font-black text-[#1C1C1E]">Condividi Schema</h3>
                            </div>
                            <button onClick={() => setShowContribuisci(false)} className="w-8 h-8 flex items-center justify-center rounded-xl bg-[#FAFAFC] border border-[#EEF0F4] text-[#9AA2B1]">
                                <X size={16} />
                            </button>
                        </div>

                        {contribDone ? (
                            <div className="flex flex-col items-center justify-center py-16 px-6 gap-4">
                                <CheckCircle2 size={48} className="text-green-500" />
                                <p className="font-black text-[#1C1C1E] text-lg text-center">Schema inviato!</p>
                                <p className="text-sm text-[#6B7280] text-center">Il team Lurumi lo revisionerà e lo aggiungerà al dataset di training. Grazie!</p>
                                <button onClick={() => setShowContribuisci(false)} className="mt-2 h-11 px-8 bg-[#7B5CF6] text-white rounded-2xl font-bold text-sm">
                                    Chiudi
                                </button>
                            </div>
                        ) : (
                            <div className="overflow-y-auto flex-1 px-6 py-4 flex flex-col gap-4">
                                {/* Titolo */}
                                <div>
                                    <label className="text-xs font-black text-[#1C1C1E] uppercase tracking-widest mb-1.5 block">Titolo schema</label>
                                    <input
                                        type="text"
                                        value={contribTitle}
                                        onChange={e => setContribTitle(e.target.value)}
                                        placeholder="Es. Orsetto Bruno, Testa Coniglio..."
                                        className="w-full h-11 px-4 bg-[#FAFAFC] border border-[#EEF0F4] rounded-xl text-sm font-medium focus:outline-none focus:border-[#7B5CF6]"
                                    />
                                </div>

                                {/* Difficoltà */}
                                <div>
                                    <label className="text-xs font-black text-[#1C1C1E] uppercase tracking-widest mb-1.5 block">Difficoltà</label>
                                    <div className="flex gap-2">
                                        {(['beginner', 'intermediate', 'advanced'] as const).map(d => (
                                            <button
                                                key={d}
                                                onClick={() => setContribDifficulty(d)}
                                                className={`flex-1 h-9 rounded-xl text-xs font-bold border transition-all ${contribDifficulty === d ? 'bg-[#7B5CF6] text-white border-[#7B5CF6]' : 'bg-[#FAFAFC] text-[#6B7280] border-[#EEF0F4]'}`}
                                            >
                                                {d === 'beginner' ? 'Facile' : d === 'intermediate' ? 'Medio' : 'Avanzato'}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Parti rilevate dai contatori */}
                                <div>
                                    <label className="text-xs font-black text-[#1C1C1E] uppercase tracking-widest mb-1.5 block">
                                        Parti rilevate ({project.secs.length})
                                    </label>
                                    <div className="bg-[#FAFAFC] rounded-2xl border border-[#EEF0F4] divide-y divide-[#EEF0F4]">
                                        {project.secs.map(sec => (
                                            <div key={sec.id} className="flex items-center justify-between px-4 py-2.5">
                                                <span className="text-sm font-bold text-[#1C1C1E]">{sec.name}</span>
                                                <span className="text-sm font-black text-[#7B5CF6]">{sec.value} giri</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Note opzionali */}
                                <div>
                                    <label className="text-xs font-black text-[#1C1C1E] uppercase tracking-widest mb-1.5 block">Note aggiuntive (opzionale)</label>
                                    <textarea
                                        value={contribNotes}
                                        onChange={e => setContribNotes(e.target.value)}
                                        rows={3}
                                        placeholder="Filato usato, misura uncinetto, note sullo schema..."
                                        className="w-full px-4 py-3 bg-[#FAFAFC] border border-[#EEF0F4] rounded-xl text-sm font-medium focus:outline-none focus:border-[#7B5CF6] resize-none"
                                    />
                                </div>

                                <p className="text-xs text-[#9AA2B1] leading-relaxed">
                                    Inviando questo schema accetti che venga usato in forma anonima per addestrare il modello AI Lurumi. Puoi richiederne la rimozione in qualsiasi momento.
                                </p>
                            </div>
                        )}

                        {!contribDone && (
                            <div className="px-6 pb-6 pt-3 shrink-0">
                                <button
                                    disabled={!contribTitle.trim() || contribSubmitting}
                                    onClick={async () => {
                                        if (!contribTitle.trim() || contribSubmitting) return;
                                        setContribSubmitting(true);
                                        try {
                                            const parts = project.secs.map(sec => ({
                                                name: sec.name,
                                                rounds: [],
                                                final_count: sec.value,
                                                source: 'sec_counter',
                                            }));
                                            const res = await fetch('/api/training/submit-contribution', {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({
                                                    title: contribTitle.trim(),
                                                    difficulty: contribDifficulty,
                                                    admin_notes: contribNotes.trim() || null,
                                                    project_id: project.id,
                                                    parts,
                                                }),
                                            });
                                            if (res.ok) {
                                                setContribDone(true);
                                            }
                                        } finally {
                                            setContribSubmitting(false);
                                        }
                                    }}
                                    className="w-full h-12 bg-[#7B5CF6] text-white rounded-2xl font-bold shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {contribSubmitting ? (
                                        <span className="animate-pulse">Invio in corso...</span>
                                    ) : (
                                        <>
                                            <Sparkles size={16} />
                                            Invia schema
                                        </>
                                    )}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
