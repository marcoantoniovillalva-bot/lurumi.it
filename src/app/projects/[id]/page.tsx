"use client";

import React, { useState, useEffect, useRef } from "react";
import {
    ArrowLeft, Minus, Plus, RotateCcw, Timer, Share2,
    ChevronLeft, ChevronRight, StickyNote, Trash2,
    Plus as PlusIcon, Camera, Save, Maximize2, Archive, Pencil,
    GripVertical, ChevronUp, ChevronDown, FileDown, ExternalLink, X
} from "lucide-react";
import { useProjectStore, Project, RoundCounter as RoundCounterType, ProjectImage } from "@/features/projects/store/useProjectStore";
import { luDB } from "@/lib/db";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { RoundCounter } from "@/features/projects/components/RoundCounter";
import { CounterImagePicker } from "@/features/projects/components/CounterImagePicker";
import { FullscreenViewer } from "@/components/FullscreenViewer";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { loadPdfjs } from "@/lib/pdfjs";



export default function ProjectDetail() {
    const { id } = useParams();
    const router = useRouter();
    const { projects, updateProject } = useProjectStore();
    const { user } = useAuth();
    const project = projects.find(p => p.id === id);

    const syncProject = (fields: Record<string, unknown>) => {
        if (!user || !id) return;
        const supabase = createClient();
        supabase.from('projects')
            .update(fields)
            .eq('id', id)
            .eq('user_id', user.id)
            .then(({ error }) => { if (error) console.warn('project sync failed:', error.message); });
    };

    const syncSecs = (newSecs: RoundCounterType[]) => syncProject({ secs: newSecs });

    const [pdfDoc, setPdfDoc] = useState<any>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(0);
    const [isTimerRunning, setIsTimerRunning] = useState(false);
    const [elapsedTime, setElapsedTime] = useState(0);
    const [isEditingNotes, setIsEditingNotes] = useState(false);
    const [notes, setNotes] = useState("");
    const [showNewCounterModal, setShowNewCounterModal] = useState(false);
    const [newCounterName, setNewCounterName] = useState("");
    const [pickerCounterId, setPickerCounterId] = useState<string | null>(null);
    const [fullscreen, setFullscreen] = useState(false);
    const [hintVisible, setHintVisible] = useState(true);
    // Image data URLs loaded from IndexedDB (NOT stored in Zustand/localStorage)
    const [imageUrls, setImageUrls] = useState<string[]>([]);

    // Reorder states (counters)
    const [reorderMode, setReorderMode] = useState(false);
    const [dragIdx, setDragIdx] = useState<number | null>(null);
    const [overIdx, setOverIdx] = useState<number | null>(null);
    // Image manager states
    const [showImageManager, setShowImageManager] = useState(false);
    const [imgDragIdx, setImgDragIdx] = useState<number | null>(null);
    const [imgOverIdx, setImgOverIdx] = useState<number | null>(null);
    const [exportingPdf, setExportingPdf] = useState(false);

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const renderTaskRef = useRef<any>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const elapsedRef = useRef(0);
    const blobUrlsRef = useRef<string[]>([]);
    const isTimerRunningRef = useRef(false);
    const isEditingNotesRef = useRef(false);
    const hasLoadedRef = useRef(false);
    const wasTimerRunningRef = useRef(false);
    const lastTapRef = useRef(0);
    const longPressRef = useRef<NodeJS.Timeout | null>(null);
    const lpStartPos = useRef<{ x: number; y: number } | null>(null);
    const imgDragState = useRef<{ from: number; over: number | null } | null>(null);

    // Init timer + notes dallo store, reset hint al cambio progetto
    useEffect(() => {
        if (!project) return;
        setElapsedTime(project.timer || 0);
        elapsedRef.current = project.timer || 0;
        setNotes(project.notesHtml || "");
        setHintVisible(true);
        const t = setTimeout(() => setHintVisible(false), 4000);
        return () => clearTimeout(t);
    }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

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
    useEffect(() => {
        if (!project || project.type !== 'images') return;
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
                setTotalPages(urls.length);
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
                updateProject(id as string, updates);
            })
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [id, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

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

    const formatTime = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return [h, m, s].map(v => String(v).padStart(2, '0')).join(':');
    };

    const handleAddImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        // Save blob to IndexedDB — NOT as base64 in Zustand/localStorage
        const imgId = `${project.id}_img_${Date.now()}`;
        await luDB.saveFile({ id: imgId, blob: file });
        const objectUrl = URL.createObjectURL(file);
        const updatedImages = [...(project.images || []), { id: imgId }];
        updateProject(project.id, { images: updatedImages });
        setImageUrls(prev => [...prev, objectUrl]);
        setTotalPages(updatedImages.length);

        // Carica su Supabase Storage e sincronizza lista immagini nel DB
        if (user) {
            const supabase = createClient();
            const storagePath = `${user.id}/${project.id}/${imgId}`;
            supabase.storage.from('project-files').upload(storagePath, file, { upsert: true })
                .then(({ error: storageErr }) => {
                    if (storageErr) { console.warn('Image upload failed:', storageErr.message); return; }
                    supabase.from('projects').update({
                        images: updatedImages.map(img => ({ id: img.id })),
                    }).eq('id', project.id).eq('user_id', user.id)
                        .then(({ error }) => { if (error) console.warn('Images DB sync failed:', error.message); });
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
        updateProject(project.id, { images: updatedImages });
        setImageUrls(prev => prev.filter((_, i) => i !== (currentPage - 1)));
        setTotalPages(updatedImages.length);
        setCurrentPage(p => Math.max(1, Math.min(updatedImages.length, p)));
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
            const pdfBytes = await generatePatternPdf(project, imageUrls);
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
            project.secs.length > 0
                ? `Giri secondari: ${project.secs.map(s => `${s.name}: ${s.value}`).join(', ')}`
                : '',
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
                    <button
                        onClick={handleExportZip}
                        className="w-10 h-10 flex items-center justify-center bg-white border border-[#EEF0F4] rounded-xl text-[#7B5CF6] active:scale-95 transition-transform shadow-sm"
                        title="Esporta ZIP"
                    >
                        <Archive size={20} />
                    </button>
                    <button
                        onClick={handleExportPdf}
                        disabled={exportingPdf}
                        className="w-10 h-10 flex items-center justify-center bg-white border border-[#EEF0F4] rounded-xl text-[#7B5CF6] active:scale-95 transition-transform shadow-sm disabled:opacity-50"
                        title="Esporta PDF editabile"
                    >
                        <FileDown size={20} />
                    </button>
                    <button
                        onClick={() => window.open('https://www.canva.com/create', '_blank')}
                        className="w-10 h-10 flex items-center justify-center bg-white border border-[#EEF0F4] rounded-xl text-[#9AA2B1] active:scale-95 transition-transform shadow-sm"
                        title="Apri Canva (importa il PDF con File → Importa)"
                    >
                        <ExternalLink size={18} />
                    </button>
                </div>
            </div>

            <header className="mb-6">
                <h1 className="text-3xl font-black text-[#1C1C1E] mb-1">{project.title}</h1>
                <p className="text-[#9AA2B1] text-sm font-bold uppercase tracking-widest">
                    {project.type === 'pdf' ? 'Pattern PDF' : 'Galleria Immagini'}
                </p>
            </header>

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

            {/* Viewer */}
            <div className="bg-white rounded-[32px] border border-[#EEF0F4] overflow-hidden shadow-sm mb-8">
                {/* Toolbar — no zoom buttons */}
                <div className="p-3 bg-white border-b border-[#EEF0F4] flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                        <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} className="w-9 h-9 flex items-center justify-center bg-[#FAFAFC] rounded-lg text-[#1C1C1E] active:scale-90 transition-all">
                            <ChevronLeft size={20} strokeWidth={3} />
                        </button>
                        <span className="text-[13px] font-black text-[#1C1C1E] bg-[#FAFAFC] px-3 py-1.5 rounded-lg border border-[#EEF0F4]">
                            {currentPage} / {totalPages || 1}
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

            {/* Secondary Counters */}
            <div className="mb-8">
                <div className="flex items-center justify-between mb-4 px-2">
                    <h2 className="text-xl font-black text-[#1C1C1E]">Contatori Giri</h2>
                    <div className="flex items-center gap-2">
                        {project.secs.length > 1 && (
                            <button
                                onClick={() => setReorderMode(r => !r)}
                                className={`px-3 py-1.5 rounded-xl font-black text-xs flex items-center gap-1.5 transition-colors ${reorderMode ? 'bg-green-500/10 text-green-600 border border-green-200' : 'bg-[#F4EEFF] text-[#7B5CF6]'}`}
                            >
                                <GripVertical size={13} strokeWidth={3} />
                                {reorderMode ? 'FINE' : 'ORDINA'}
                            </button>
                        )}
                        {!reorderMode && (
                            <button
                                onClick={() => { setNewCounterName(""); setShowNewCounterModal(true); }}
                                className="bg-[#7B5CF6]/10 text-[#7B5CF6] px-3 py-1.5 rounded-xl font-black text-xs flex items-center gap-2"
                            >
                                <PlusIcon size={14} strokeWidth={3} />
                                NUOVO
                            </button>
                        )}
                    </div>
                </div>
                {reorderMode && (
                    <p className="text-xs text-[#9AA2B1] font-medium px-2 mb-3">
                        <span className="hidden md:inline">Trascina le card per riordinare • </span>
                        Usa ↑↓ per spostare
                    </p>
                )}
                <div className="flex flex-col gap-3">
                    {project.secs.map((sec, index) => {
                        const imgIndex = sec.imageId
                            ? (project.images ?? []).findIndex(img => img.id === sec.imageId)
                            : -1;
                        const secImageUrl = imgIndex >= 0 ? imageUrls[imgIndex] : undefined;

                        return (
                            <div
                                key={sec.id}
                                draggable={reorderMode}
                                onPointerDown={reorderMode ? undefined : startLongPress}
                                onPointerUp={reorderMode ? undefined : cancelLongPress}
                                onPointerCancel={reorderMode ? undefined : cancelLongPress}
                                onPointerMove={reorderMode ? undefined : checkLongPressMove}
                                onDragStart={() => setDragIdx(index)}
                                onDragEnd={() => { setDragIdx(null); setOverIdx(null); }}
                                onDragOver={(e) => { e.preventDefault(); setOverIdx(index); }}
                                onDrop={() => {
                                    if (dragIdx !== null && dragIdx !== index) moveCounter(dragIdx, index);
                                    setDragIdx(null); setOverIdx(null);
                                }}
                                className={`relative flex items-stretch gap-2 transition-all ${reorderMode ? 'cursor-grab active:cursor-grabbing' : ''} ${overIdx === index && dragIdx !== index ? 'ring-2 ring-[#7B5CF6] rounded-[28px]' : ''} ${dragIdx === index ? 'opacity-50' : ''}`}
                            >
                                {/* Reorder controls — visible only in reorder mode */}
                                {reorderMode && (
                                    <div className="flex flex-col items-center justify-center gap-1 bg-[#F4EEFF] rounded-2xl px-1 py-2 shrink-0">
                                        <button
                                            onClick={() => index > 0 && moveCounter(index, index - 1)}
                                            disabled={index === 0}
                                            className="w-7 h-7 flex items-center justify-center rounded-lg text-[#7B5CF6] disabled:opacity-25 hover:bg-[#7B5CF6]/10 active:scale-90 transition-all"
                                        >
                                            <ChevronUp size={16} strokeWidth={3} />
                                        </button>
                                        <GripVertical size={14} className="text-[#9AA2B1] md:block hidden" />
                                        <button
                                            onClick={() => index < project.secs.length - 1 && moveCounter(index, index + 1)}
                                            disabled={index === project.secs.length - 1}
                                            className="w-7 h-7 flex items-center justify-center rounded-lg text-[#7B5CF6] disabled:opacity-25 hover:bg-[#7B5CF6]/10 active:scale-90 transition-all"
                                        >
                                            <ChevronDown size={16} strokeWidth={3} />
                                        </button>
                                    </div>
                                )}
                                <div className="flex-1 min-w-0">
                                    <RoundCounter
                                        {...sec}
                                        imageUrl={secImageUrl}
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
                    {project.secs.length === 0 && (
                        <div className="text-center p-6 bg-[#FAFAFC] rounded-2xl border border-dashed border-[#EEF0F4] text-[#9AA2B1] text-sm font-medium">
                            Nessun contatore secondario aggiunto
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
                <div className="fixed inset-0 z-[10000] flex items-end justify-center bg-black/40" onClick={() => setShowNewCounterModal(false)}>
                    <div className="w-full max-w-2xl bg-white rounded-t-[32px] p-6 pb-10 shadow-2xl animate-in slide-in-from-bottom duration-300" onClick={e => e.stopPropagation()}>
                        <div className="w-12 h-1.5 bg-[#EEF0F4] rounded-full mx-auto mb-6" />
                        <h3 className="text-2xl font-black mb-4">Nuovo Contatore</h3>
                        <input
                            autoFocus
                            type="text"
                            placeholder="Nome del contatore (es. Giro Manica)..."
                            value={newCounterName}
                            onChange={e => setNewCounterName(e.target.value)}
                            onKeyDown={e => {
                                if (e.key === 'Enter' && newCounterName.trim()) {
                                    const updated = [...project.secs, { id: Date.now().toString(), name: newCounterName.trim(), value: 1 }];
                                    updateProject(project.id, { secs: updated });
                                    syncSecs(updated);
                                    setShowNewCounterModal(false);
                                }
                            }}
                            className="w-full h-12 px-4 bg-[#FAFAFC] border border-[#E6DAFF] rounded-xl outline-none focus:border-[#7B5CF6] font-medium mb-4"
                        />
                        <div className="flex gap-3">
                            <button onClick={() => setShowNewCounterModal(false)} className="flex-1 h-12 bg-white border border-[#EEF0F4] rounded-2xl font-bold text-[#9AA2B1]">Annulla</button>
                            <button
                                onClick={() => {
                                    if (!newCounterName.trim()) return;
                                    const updated = [...project.secs, { id: Date.now().toString(), name: newCounterName.trim(), value: 1 }];
                                    updateProject(project.id, { secs: updated });
                                    syncSecs(updated);
                                    setShowNewCounterModal(false);
                                }}
                                className="flex-[2] h-12 bg-[#7B5CF6] text-white rounded-2xl font-bold shadow-lg"
                            >
                                Crea
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
        </div>
    );
}
