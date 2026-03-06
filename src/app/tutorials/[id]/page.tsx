"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
    ArrowLeft,
    Minus,
    Plus,
    RotateCcw,
    Timer,
    Youtube,
    StickyNote,
    Plus as PlusIcon,
    Save,
    FileText,
    ChevronDown,
    ChevronUp,
    Languages,
    Loader2,
    GripVertical,
    Copy,
    Check,
    Camera,
    Archive,
    FileDown,
    Maximize2,
    Trash2,
    ChevronLeft,
    ChevronRight,
    X,
} from "lucide-react";
import { useProjectStore, Tutorial, RoundCounter as RoundCounterType, TranscriptSegment, TranscriptData, ProjectImage } from "@/features/projects/store/useProjectStore";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { RoundCounter } from "@/features/projects/components/RoundCounter";
import { CounterImagePicker } from "@/features/projects/components/CounterImagePicker";
import { FullscreenViewer } from "@/components/FullscreenViewer";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { luDB } from "@/lib/db";

export default function TutorialDetail() {
    const { id } = useParams();
    const router = useRouter();
    const { tutorials, updateTutorial } = useProjectStore();
    const tutorial = tutorials.find(t => t.id === id);
    const { user } = useAuth();
    const hasLoadedRef = useRef(false);

    const syncTutorial = (fields: Record<string, unknown>) => {
        if (!user || !id) return;
        const supabase = createClient();
        supabase.from('tutorials')
            .update(fields)
            .eq('id', id)
            .eq('user_id', user.id)
            .then(({ error }) => { if (error) console.warn('tutorial sync failed:', error.message); });
    };

    const syncSecs = (newSecs: RoundCounterType[]) => syncTutorial({ secs: newSecs });
    const syncImages = (newImages: ProjectImage[], coverImageId?: string) => {
        const fields: Record<string, unknown> = { images: newImages.map(img => ({ id: img.id })) };
        if (coverImageId !== undefined) fields.cover_image_id = coverImageId;
        syncTutorial(fields);
    };

    // Image state
    const [imageUrls, setImageUrls] = useState<string[]>([]);
    const [currentImgPage, setCurrentImgPage] = useState(1);
    const [fullscreen, setFullscreen] = useState(false);
    const [showCounterImagePicker, setShowCounterImagePicker] = useState(false);
    const [pickerTargetSecId, setPickerTargetSecId] = useState<string | null>(null);
    const [showImageManager, setShowImageManager] = useState(false);
    const [imgDragIdx, setImgDragIdx] = useState<number | null>(null);
    const [imgOverIdx, setImgOverIdx] = useState<number | null>(null);
    const [exportingPdf, setExportingPdf] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const blobUrlsRef = useRef<string[]>([]);

    const [isTimerRunning, setIsTimerRunning] = useState(false);
    const [elapsedTime, setElapsedTime] = useState(0);
    const [isEditingNotes, setIsEditingNotes] = useState(false);
    const [notes, setNotes] = useState("");
    const [showNewCounterModal, setShowNewCounterModal] = useState(false);
    const [newCounterName, setNewCounterName] = useState("");
    const [reorderMode, setReorderMode] = useState(false);
    const [dragIdx, setDragIdx] = useState<number | null>(null);
    const [overIdx, setOverIdx] = useState<number | null>(null);
    const elapsedRef = useRef(0);
    const isTimerRunningRef = useRef(false);
    const isEditingNotesRef = useRef(false);
    const wasTimerRunningRef = useRef(false);

    // Transcript state
    const [transcriptOpen, setTranscriptOpen] = useState(false);
    const [transcriptView, setTranscriptView] = useState<'original' | 'translated'>('original');
    const [transcriptAction, setTranscriptAction] = useState<'original' | 'translate' | null>(null);
    const [transcriptError, setTranscriptError] = useState('');
    const [transcriptData, setTranscriptData] = useState<TranscriptData | null>(tutorial?.transcriptData ?? null);
    const [transcriptCost, setTranscriptCost] = useState(0);
    const [copySuccess, setCopySuccess] = useState(false);
    const [copyChunkIdx, setCopyChunkIdx] = useState<number | null>(null);
    const [currentVideoTime, setCurrentVideoTime] = useState(0);
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const timePollerRef = useRef<NodeJS.Timeout | null>(null);
    const activeSegmentRef = useRef<HTMLDivElement | null>(null);
    const ytPlayerRef = useRef<any>(null);

    useEffect(() => {
        if (!tutorial) return;
        setElapsedTime(tutorial.timer || 0);
        elapsedRef.current = tutorial.timer || 0;
        setNotes(tutorial.notesHtml || "");
    }, [tutorial?.id]);

    // Carica immagini tutorial da IDB / Supabase Storage
    useEffect(() => {
        if (!tutorial) return;
        const load = async () => {
            const imgs = tutorial.images ?? [];
            const urls: string[] = [];
            const sb = user ? createClient() : null;
            for (const img of imgs) {
                const record = await luDB.getFile(img.id);
                if (record?.blob) {
                    urls.push(URL.createObjectURL(record.blob));
                } else if (sb && user) {
                    const { data: blob } = await sb.storage.from('project-files').download(`${user.id}/tutorials/${id}/${img.id}`);
                    if (blob) {
                        await luDB.saveFile({ id: img.id, blob });
                        urls.push(URL.createObjectURL(blob));
                    }
                }
            }
            blobUrlsRef.current.forEach(u => URL.revokeObjectURL(u));
            blobUrlsRef.current = urls.filter(u => u.startsWith('blob:'));
            setImageUrls(urls);
            setCurrentImgPage(p => Math.min(p, Math.max(1, urls.length)));
        };
        load();
        return () => { blobUrlsRef.current.forEach(u => URL.revokeObjectURL(u)); blobUrlsRef.current = []; };
    }, [id, tutorial?.images?.length, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

    // Keep refs in sync for Realtime callback (avoids stale closures)
    useEffect(() => { isTimerRunningRef.current = isTimerRunning; }, [isTimerRunning]);
    useEffect(() => { isEditingNotesRef.current = isEditingNotes; }, [isEditingNotes]);

    // Realtime: sincronizza counter, secs, timer e note da altri dispositivi/tab
    useEffect(() => {
        if (!user || !id) return;
        const supabase = createClient();
        const channel = supabase
            .channel(`tutorial-counter-${id}`)
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'tutorials',
                filter: `id=eq.${id}`,
            }, (payload) => {
                if (!payload.new) return;
                const remote = payload.new as Record<string, any>;
                const updates: Partial<Tutorial> = {
                    counter: remote.counter ?? 0,
                    secs: remote.secs ?? [],
                    images: (remote.images ?? []).map((img: any) => ({ id: typeof img === 'string' ? img : img.id })),
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
                updateTutorial(id as string, updates);
            })
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [id, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

    // Autosave note con debounce 2s
    useEffect(() => {
        if (!tutorial || notes === (tutorial.notesHtml || '')) return;
        const t = setTimeout(() => {
            updateTutorial(tutorial.id, { notesHtml: notes });
            syncTutorial({ notes_html: notes });
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
                    updateTutorial(id as string, { timer: elapsedRef.current });
                    syncTutorial({ timer_seconds: elapsedRef.current });
                }
            }, 1000);
        } else if (wasTimerRunningRef.current) {
            // Timer appena fermato — salva il valore finale
            wasTimerRunningRef.current = false;
            updateTutorial(id as string, { timer: elapsedRef.current });
            syncTutorial({ timer_seconds: elapsedRef.current });
        }
        return () => clearInterval(interval);
    }, [isTimerRunning, id, updateTutorial]); // eslint-disable-line react-hooks/exhaustive-deps

    // YouTube IFrame API: polling tempo corrente quando la trascrizione è aperta
    useEffect(() => {
        if (!transcriptOpen || !tutorial?.videoId) return;

        const initPlayer = () => {
            if (!(window as any).YT?.Player) return;
            if (ytPlayerRef.current) {
                // Player già creato, riavvia il poller
                timePollerRef.current = setInterval(() => {
                    try {
                        const t = ytPlayerRef.current?.getCurrentTime?.();
                        if (typeof t === 'number') setCurrentVideoTime(t);
                    } catch {}
                }, 500);
                return;
            }
            ytPlayerRef.current = new (window as any).YT.Player('yt-player', {
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
            if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
                const script = document.createElement('script');
                script.src = 'https://www.youtube.com/iframe_api';
                document.head.appendChild(script);
            }
            const prevReady = (window as any).onYouTubeIframeAPIReady;
            (window as any).onYouTubeIframeAPIReady = () => {
                prevReady?.();
                initPlayer();
            };
        }

        return () => {
            if (timePollerRef.current) clearInterval(timePollerRef.current);
        };
    }, [transcriptOpen, tutorial?.videoId]); // eslint-disable-line react-hooks/exhaustive-deps

    // Auto-scroll al segmento attivo nella trascrizione
    useEffect(() => {
        if (activeSegmentRef.current && transcriptOpen) {
            activeSegmentRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
    }, [currentVideoTime]); // eslint-disable-line react-hooks/exhaustive-deps

    // Carica costo corrente della trascrizione (auto-scaling)
    useEffect(() => {
        fetch('/api/transcript-config')
            .then(r => r.json())
            .then(d => setTranscriptCost(d.cost ?? 0))
            .catch(() => {});
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Redirect se il tutorial viene eliminato su un altro dispositivo mentre siamo qui
    useEffect(() => {
        if (hasLoadedRef.current && !tutorial) {
            router.replace('/tutorials');
        }
    }, [tutorial]); // eslint-disable-line react-hooks/exhaustive-deps

    if (tutorial) hasLoadedRef.current = true;
    if (!tutorial) {
        if (hasLoadedRef.current) return null; // redirect in corso
        return <div className="p-10 text-center">Tutorial non trovato</div>;
    }

    // ── Image handlers ───────────────────────────────────────────────────────
    const handleAddImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = '';
        const imgId = Math.random().toString(36).slice(2, 9);
        const objectUrl = URL.createObjectURL(file);
        const newImages = [...(tutorial.images ?? []), { id: imgId }];
        await luDB.saveFile({ id: imgId, blob: file });
        updateTutorial(tutorial.id, { images: newImages });
        setImageUrls(prev => { const next = [...prev, objectUrl]; setCurrentImgPage(next.length); return next; });
        if (user) {
            const sb = createClient();
            sb.storage.from('project-files').upload(`${user.id}/tutorials/${tutorial.id}/${imgId}`, file, { upsert: true })
                .then(({ error }) => { if (error) console.warn('Tutorial image upload failed:', error.message); });
            sb.from('tutorials').update({ images: newImages.map(img => ({ id: img.id })) })
                .eq('id', tutorial.id).eq('user_id', user.id)
                .then(({ error }) => { if (error) console.warn('Tutorial images DB sync failed:', error.message); });
        }
    };

    const handleDeleteCurrentImage = async () => {
        const imgs = tutorial.images ?? [];
        if (!imgs.length) return;
        if (!confirm('Eliminare questa immagine?')) return;
        const imgId = imgs[currentImgPage - 1]?.id;
        if (imgId) luDB.deleteFile(imgId).catch(() => {});
        const updatedImages = imgs.filter((_, i) => i !== currentImgPage - 1);
        updateTutorial(tutorial.id, { images: updatedImages });
        setImageUrls(prev => { const next = prev.filter((_, i) => i !== currentImgPage - 1); setCurrentImgPage(p => Math.max(1, Math.min(next.length, p))); return next; });
        syncImages(updatedImages);
    };

    const moveImage = (from: number, to: number) => {
        const newImages = [...(tutorial.images ?? [])];
        const [removed] = newImages.splice(from, 1);
        newImages.splice(to, 0, removed);
        const newUrls = [...imageUrls];
        const [removedUrl] = newUrls.splice(from, 1);
        newUrls.splice(to, 0, removedUrl);
        updateTutorial(tutorial.id, { images: newImages });
        setImageUrls(newUrls);
        setCurrentImgPage(p => p === from + 1 ? to + 1 : p);
        syncImages(newImages, tutorial.coverImageId);
    };

    const handleExportPdf = async () => {
        setExportingPdf(true);
        try {
            const { generatePatternPdf } = await import('@/lib/pdf-export');
            const pdfInput = {
                title: tutorial.title,
                timer: tutorial.timer,
                type: 'tutorial',
                url: tutorial.url,
                coverImageId: tutorial.coverImageId,
                images: (tutorial.images ?? []).map(img => ({ id: img.id })),
                secs: (tutorial.secs ?? []).map(s => ({ id: s.id, name: s.name, value: s.value, imageId: s.imageId })),
                notesHtml: tutorial.notesHtml,
            };
            const pdfBytes = await generatePatternPdf(pdfInput, imageUrls);
            const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${tutorial.title.replace(/[^a-zA-Z0-9]/g, '-')}.pdf`;
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
        const files: Record<string, Uint8Array> = {
            'info.txt': strToU8([
                `Tutorial: ${tutorial.title}`,
                `YouTube: ${tutorial.url}`,
                `Giri: ${tutorial.counter}`,
                tutorial.secs.length > 0 ? `Giri secondari: ${tutorial.secs.map(s => `${s.name}: ${s.value}`).join(', ')}` : '',
                tutorial.notesHtml ? `Note: ${tutorial.notesHtml}` : '',
                '', 'Creato con lurumi.it',
            ].filter(Boolean).join('\n')),
        };
        if (tutorial.images?.length) {
            for (let i = 0; i < tutorial.images.length; i++) {
                const rec = await luDB.getFile(tutorial.images[i].id);
                if (rec?.blob) files[`immagine-${i + 1}.jpg`] = new Uint8Array(await rec.blob.arrayBuffer());
            }
        }
        const zipped = zipSync(files);
        const blob = new Blob([zipped.buffer as ArrayBuffer], { type: 'application/zip' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${tutorial.title.replace(/[^a-zA-Z0-9]/g, '-')}.zip`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const moveCounter = (from: number, to: number) => {
        const newSecs = [...tutorial.secs];
        const [removed] = newSecs.splice(from, 1);
        newSecs.splice(to, 0, removed);
        updateTutorial(tutorial.id, { secs: newSecs });
        syncSecs(newSecs);
    };

    const copyTextToClipboard = async (text: string): Promise<boolean> => {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch {
            // Fallback per browser/iOS che non supportano clipboard API
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
            document.body.appendChild(ta);
            ta.focus();
            ta.select();
            try { document.execCommand('copy'); return true; } catch { return false; }
            finally { document.body.removeChild(ta); }
        }
    };

    const handleCopyTranscript = async (segments: TranscriptSegment[]) => {
        const fullText = segments.map(s => s.text).join('\n');
        const ok = await copyTextToClipboard(fullText);
        if (ok) { setCopySuccess(true); setTimeout(() => setCopySuccess(false), 2500); }
    };

    // Per trascrizioni molto lunghe su mobile: copia a pezzi da 5000 chars
    const COPY_CHUNK = 5000;
    const handleCopyChunk = async (segments: TranscriptSegment[], idx: number) => {
        const fullText = segments.map(s => s.text).join('\n');
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

    const generateTranscript = async (translate: boolean) => {
        if (!user || !tutorial.videoId) return;
        setTranscriptAction(translate ? 'translate' : 'original');
        setTranscriptError('');
        try {
            // Step 1: server scarica la trascrizione completa (tutto server-side)
            const trackRes = await fetch(`/api/tutorials/transcript?videoId=${tutorial.videoId}`);
            const trackData = await trackRes.json();
            if (!trackData.success) throw new Error(trackData.error || 'Impossibile trovare i sottotitoli');

            const segments = trackData.segments;
            if (!segments?.length) throw new Error('Trascrizione vuota. Verifica che il video abbia i sottotitoli attivi.');

            // Aggiorna il costo per la prossima trascrizione (auto-scaling)
            if (typeof trackData.nextCost === 'number') setTranscriptCost(trackData.nextCost);

            // Step 2: server salva + traduce via Groq se richiesto
            const saveRes = await fetch('/api/tutorials/transcript', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tutorialId: tutorial.id, transcript: segments, translate }),
            });
            const saveData = await saveRes.json();
            if (!saveData.success) throw new Error(saveData.error || 'Errore nel salvataggio');

            const newData: TranscriptData = {
                transcript: segments,
                translated: saveData.translated ?? null,
                generated_at: new Date().toISOString(),
                has_translation: !!saveData.translated,
            };
            setTranscriptData(newData);
            updateTutorial(tutorial.id, { transcriptData: newData });
        } catch (err: any) {
            setTranscriptError(err.message || 'Errore nella generazione della trascrizione');
        } finally {
            setTranscriptAction(null);
        }
    };

    const formatTime = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return [h, m, s].map(v => String(v).padStart(2, '0')).join(':');
    };


    const handleSaveNotes = () => {
        updateTutorial(tutorial.id, { notesHtml: notes });
        syncTutorial({ notes_html: notes });
        setIsEditingNotes(false);
    };

    // Per playlist senza videoId specifico, usa l'URL embed della playlist
    // enablejsapi=1 abilita YouTube IFrame API per il polling del tempo (trascrizione sincronizzata)
    const embedUrl = tutorial.videoId
        ? `https://www.youtube.com/embed/${tutorial.videoId}?rel=0&modestbranding=1&playsinline=1&enablejsapi=1`
        : tutorial.playlistId
            ? `https://www.youtube.com/embed/videoseries?list=${tutorial.playlistId}&rel=0&modestbranding=1&playsinline=1`
            : '';

    return (
        <div className="max-w-2xl mx-auto px-4 pt-6 pb-20">
            {fullscreen && imageUrls.length > 0 && (
                <FullscreenViewer
                    type="images"
                    images={imageUrls}
                    initialPage={currentImgPage}
                    onClose={() => setFullscreen(false)}
                />
            )}

            <div className="flex items-center justify-between mb-6">
                <Link href="/tutorials" className="w-10 h-10 flex items-center justify-center bg-white border border-[#EEF0F4] rounded-xl text-[#9AA2B1]">
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
                                updateTutorial(id as string, { timer: 0 });
                                syncTutorial({ timer_seconds: 0 });
                            }}
                            className="w-7 h-7 flex items-center justify-center text-[#9AA2B1] hover:text-red-400 active:scale-90 transition-all"
                            title="Azzera timer"
                        >
                            <RotateCcw size={13} strokeWidth={3} />
                        </button>
                    </div>
                    <input type="file" ref={fileInputRef} onChange={handleAddImage} className="hidden" accept="image/*" />
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
                            title="Esporta PDF"
                        >
                            <FileDown size={20} />
                        </button>
                        <span className="text-[9px] font-black uppercase tracking-widest text-[#7B5CF6]">pdf</span>
                    </div>
                </div>
            </div>

            <header className="mb-6">
                <h1 className="text-3xl font-black text-[#1C1C1E] mb-1">{tutorial.title}</h1>
                <p className="text-[#9AA2B1] text-sm font-bold flex items-center gap-1.5">
                    <Youtube size={16} className="text-red-500" />
                    LIVELLO DISPONIBILE
                </p>
            </header>

            {/* YouTube Player */}
            <div className="bg-black rounded-3xl overflow-hidden aspect-video shadow-lg mb-8">
                {embedUrl ? (
                    <iframe
                        ref={iframeRef}
                        id="yt-player"
                        src={embedUrl}
                        className="w-full h-full border-0"
                        allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-white/60 text-sm font-bold">
                        Video non disponibile
                    </div>
                )}
            </div>

            {/* Transcript Card */}
            {tutorial.videoId && (
                <div className="bg-white rounded-[32px] border border-[#EEF0F4] shadow-sm mb-8 overflow-hidden">
                    <button
                        onClick={() => setTranscriptOpen(o => !o)}
                        className="w-full flex items-center justify-between px-6 py-5"
                    >
                        <div className="flex items-center gap-2 text-[#7B5CF6]">
                            <FileText size={20} strokeWidth={3} />
                            <h3 className="font-black text-sm uppercase tracking-widest">Trascrizione</h3>
                            {transcriptData && (
                                <span className="bg-[#7B5CF6]/10 text-[#7B5CF6] text-xs font-bold px-2 py-0.5 rounded-full">
                                    {transcriptData.has_translation ? '🇮🇹 + orig.' : 'disponibile'}
                                </span>
                            )}
                        </div>
                        {transcriptOpen ? <ChevronUp size={18} className="text-[#9AA2B1]" /> : <ChevronDown size={18} className="text-[#9AA2B1]" />}
                    </button>

                    {transcriptOpen && (
                        <div className="px-6 pb-6">
                            {/* Genera trascrizione */}
                            {!transcriptData && (
                                <div className="flex flex-col gap-2">
                                    <p className="text-sm text-[#9AA2B1] font-medium mb-1">
                                        Genera la trascrizione automatica del video{transcriptCost === 0 ? ' (gratuita)' : ` (${transcriptCost} ✦ crediti)`}. Sincronizzata con il player.
                                    </p>
                                    {transcriptError && (
                                        <p className="text-red-500 text-sm font-medium">{transcriptError}</p>
                                    )}
                                    {!user ? (
                                        <p className="text-[#9AA2B1] text-sm italic">Accedi per generare la trascrizione.</p>
                                    ) : (
                                        <>
                                            <button
                                                onClick={() => generateTranscript(false)}
                                                disabled={transcriptAction !== null}
                                                className="flex items-center justify-center gap-2 h-11 bg-[#FAFAFC] border border-[#EEF0F4] rounded-xl font-bold text-sm text-[#1C1C1E] disabled:opacity-50 active:scale-95 transition-transform"
                                            >
                                                {transcriptAction === 'original' ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
                                                Solo trascrizione originale
                                            </button>
                                            <button
                                                onClick={() => generateTranscript(true)}
                                                disabled={transcriptAction !== null}
                                                className="flex items-center justify-center gap-2 h-11 bg-[#7B5CF6] text-white rounded-xl font-bold text-sm shadow-md disabled:opacity-50 active:scale-95 transition-transform"
                                            >
                                                {transcriptAction === 'translate' ? <Loader2 size={16} className="animate-spin" /> : <Languages size={16} />}
                                                Genera + Traduzione Italiana
                                            </button>
                                        </>
                                    )}
                                </div>
                            )}

                            {/* Trascrizione disponibile */}
                            {transcriptData && (() => {
                                const segments = transcriptView === 'translated' && transcriptData.translated
                                    ? transcriptData.translated
                                    : transcriptData.transcript;
                                return (
                                    <>
                                        {/* Toggle originale / traduzione */}
                                        {transcriptData.has_translation && transcriptData.translated && (
                                            <div className="flex gap-2 mb-4">
                                                <button
                                                    onClick={() => setTranscriptView('original')}
                                                    className={`flex-1 h-9 rounded-xl font-bold text-xs transition-colors ${transcriptView === 'original' ? 'bg-[#7B5CF6] text-white' : 'bg-[#FAFAFC] border border-[#EEF0F4] text-[#9AA2B1]'}`}
                                                >
                                                    Originale
                                                </button>
                                                <button
                                                    onClick={() => setTranscriptView('translated')}
                                                    className={`flex-1 h-9 rounded-xl font-bold text-xs transition-colors ${transcriptView === 'translated' ? 'bg-[#7B5CF6] text-white' : 'bg-[#FAFAFC] border border-[#EEF0F4] text-[#9AA2B1]'}`}
                                                >
                                                    🇮🇹 Italiano
                                                </button>
                                            </div>
                                        )}

                                        {/* Aggiungi traduzione se mancante */}
                                        {!transcriptData.has_translation && user && (
                                            <button
                                                onClick={() => generateTranscript(true)}
                                                disabled={transcriptAction !== null}
                                                className="flex items-center gap-1.5 text-[#7B5CF6] font-bold text-xs mb-4 disabled:opacity-50"
                                            >
                                                {transcriptAction === 'translate' ? <Loader2 size={12} className="animate-spin" /> : <Languages size={12} />}
                                                Aggiungi traduzione italiana
                                            </button>
                                        )}
                                        {transcriptError && (
                                            <p className="text-red-500 text-xs font-medium mb-2">{transcriptError}</p>
                                        )}

                                        {/* Lista segmenti */}
                                        <div className="max-h-[380px] overflow-y-auto flex flex-col gap-0.5 pr-1 -mx-1 px-1">
                                            {segments.map((seg, i) => {
                                                const next = segments[i + 1];
                                                const isActive = seg.start <= currentVideoTime && (!next || next.start > currentVideoTime) && currentVideoTime > 0;
                                                return (
                                                    <div
                                                        key={i}
                                                        ref={isActive ? activeSegmentRef : null}
                                                        onClick={() => ytPlayerRef.current?.seekTo?.(seg.start, true)}
                                                        className={`flex gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors text-sm ${
                                                            isActive
                                                                ? 'bg-[#7B5CF6]/10 text-[#7B5CF6] font-bold'
                                                                : 'text-[#1C1C1E] font-medium hover:bg-[#FAFAFC]'
                                                        }`}
                                                    >
                                                        <span className="text-[10px] font-black text-[#9AA2B1] mt-0.5 w-10 shrink-0 tabular-nums">
                                                            {formatTime(Math.floor(seg.start))}
                                                        </span>
                                                        <span className="leading-relaxed">{seg.text}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {/* Pulsanti copia */}
                                        <div className="flex gap-2 mt-3 flex-wrap">
                                            <button
                                                onClick={() => { setCopyChunkIdx(null); handleCopyTranscript(segments); }}
                                                className="flex items-center gap-1.5 h-9 px-3 bg-[#FAFAFC] border border-[#EEF0F4] rounded-xl text-xs font-bold text-[#1C1C1E] active:scale-95 transition-transform"
                                            >
                                                {copySuccess && copyChunkIdx === null ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                                                {copySuccess && copyChunkIdx === null ? 'Copiata!' : 'Copia testo'}
                                            </button>
                                            {segments.map(s => s.text).join('\n').length > COPY_CHUNK && (
                                                <button
                                                    onClick={() => handleCopyChunk(segments, copyChunkIdx ?? 0)}
                                                    className="flex items-center gap-1.5 h-9 px-3 bg-[#F4EEFF] border border-[#7B5CF6]/20 rounded-xl text-xs font-bold text-[#7B5CF6] active:scale-95 transition-transform"
                                                >
                                                    <Copy size={12} />
                                                    {copyChunkIdx === null
                                                        ? 'Copia a pezzi'
                                                        : `Copia parte ${copyChunkIdx + 1}/${Math.ceil(segments.map(s => s.text).join('\n').length / COPY_CHUNK)}`
                                                    }
                                                </button>
                                            )}
                                        </div>
                                    </>
                                );
                            })()}
                        </div>
                    )}
                </div>
            )}

            {/* Main Counter — più compatto su mobile */}
            <div className="bg-white rounded-xl md:rounded-2xl p-2 md:p-4 shadow-[0_4px_24px_rgba(0,0,0,0.06)] border border-[#EEF0F4] text-center mb-8">
                <p className="text-[10px] md:text-[11px] font-bold text-[#9AA2B1] uppercase tracking-widest mb-1 md:mb-2">Contatore Tutorial</p>
                <div className="text-[28px] md:text-[48px] font-black text-[#1C1C1E] leading-none mb-2 md:mb-4 tracking-tighter">{tutorial.counter}</div>
                <div className="flex items-center justify-center gap-4 md:gap-6">
                    <button
                        onClick={() => {
                            const v = Math.max(0, tutorial.counter - 1);
                            updateTutorial(tutorial.id, { counter: v });
                            syncTutorial({ counter: v });
                        }}
                        className="w-6 h-6 md:w-9 md:h-9 flex items-center justify-center bg-[#FAFAFC] border border-[#EEF0F4] rounded-lg text-[#1C1C1E] active:scale-90 transition-transform"
                    >
                        <Minus size={12} strokeWidth={3} />
                    </button>
                    <button
                        onClick={() => {
                            const v = tutorial.counter + 1;
                            updateTutorial(tutorial.id, { counter: v });
                            syncTutorial({ counter: v });
                        }}
                        className="w-9 h-9 md:w-14 md:h-14 flex items-center justify-center bg-[#7B5CF6] text-white rounded-[12px] md:rounded-[18px] shadow-[0_6px_14px_rgba(123,92,246,0.3)] active:scale-95 transition-transform"
                    >
                        <Plus size={16} strokeWidth={3} />
                    </button>
                    <button
                        onClick={() => {
                            updateTutorial(tutorial.id, { counter: 0 });
                            syncTutorial({ counter: 0 });
                        }}
                        className="w-6 h-6 md:w-9 md:h-9 flex items-center justify-center bg-[#FAFAFC] border border-[#EEF0F4] rounded-lg text-[#9AA2B1] active:scale-90 transition-transform"
                    >
                        <RotateCcw size={10} strokeWidth={3} />
                    </button>
                </div>
            </div>

            {/* Gallery / Immagini */}
            <div className="bg-white rounded-[32px] border border-[#EEF0F4] overflow-hidden shadow-sm mb-8">
                {/* Toolbar */}
                <div className="p-3 bg-white border-b border-[#EEF0F4] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-[#1C1C1E]">Immagini</span>
                        {imageUrls.length > 0 && (
                            <span className="text-[13px] font-black text-[#1C1C1E] bg-[#FAFAFC] px-3 py-1.5 rounded-lg border border-[#EEF0F4]">
                                {currentImgPage} / {imageUrls.length}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-1.5">
                        <button
                            onClick={() => setCurrentImgPage(p => Math.max(1, p - 1))}
                            disabled={imageUrls.length <= 1}
                            className="w-9 h-9 flex items-center justify-center bg-[#FAFAFC] rounded-lg text-[#1C1C1E] active:scale-90 transition-all disabled:opacity-30"
                        >
                            <ChevronLeft size={20} strokeWidth={3} />
                        </button>
                        <button
                            onClick={() => setCurrentImgPage(p => Math.min(imageUrls.length, p + 1))}
                            disabled={imageUrls.length <= 1}
                            className="w-9 h-9 flex items-center justify-center bg-[#FAFAFC] rounded-lg text-[#1C1C1E] active:scale-90 transition-all disabled:opacity-30"
                        >
                            <ChevronRight size={20} strokeWidth={3} />
                        </button>
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="w-9 h-9 flex items-center justify-center bg-[#F4EEFF] text-[#7B5CF6] rounded-lg"
                            title="Aggiungi immagine"
                        >
                            <Plus size={18} strokeWidth={3} />
                        </button>
                        {imageUrls.length > 0 && (
                            <button
                                onClick={handleDeleteCurrentImage}
                                className="w-9 h-9 flex items-center justify-center bg-red-50 text-red-500 rounded-lg"
                                title="Elimina immagine"
                            >
                                <Trash2 size={18} strokeWidth={3} />
                            </button>
                        )}
                        {imageUrls.length > 1 && (
                            <button
                                onClick={() => setShowImageManager(true)}
                                className="w-9 h-9 flex items-center justify-center bg-[#F4EEFF] text-[#7B5CF6] rounded-lg"
                                title="Gestisci immagini"
                            >
                                <GripVertical size={18} />
                            </button>
                        )}
                        {imageUrls.length > 0 && (
                            <button
                                onClick={() => setFullscreen(true)}
                                className="w-9 h-9 flex items-center justify-center bg-[#FAFAFC] text-[#9AA2B1] hover:text-[#7B5CF6] rounded-lg transition-colors"
                                title="Schermo intero"
                            >
                                <Maximize2 size={18} />
                            </button>
                        )}
                    </div>
                </div>

                {/* Viewer */}
                <div
                    className="bg-[#FAFAFC] flex justify-center relative min-h-[180px]"
                    onDoubleClick={() => imageUrls.length > 0 && setFullscreen(true)}
                >
                    {imageUrls.length > 0 ? (
                        <div className="w-full flex items-center justify-center p-4">
                            <img
                                src={imageUrls[currentImgPage - 1]}
                                alt="Tutorial"
                                className="max-w-full max-h-[380px] object-contain shadow-2xl rounded-2xl"
                            />
                        </div>
                    ) : (
                        <div className="text-center p-12">
                            <div className="w-16 h-16 bg-[#F4EEFF] rounded-2xl flex items-center justify-center mx-auto mb-4 text-[#7B5CF6]">
                                <Camera size={32} />
                            </div>
                            <p className="text-[#9AA2B1] font-bold text-sm">Nessuna immagine</p>
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="mt-3 text-xs font-bold text-[#7B5CF6]"
                            >
                                + Aggiungi
                            </button>
                        </div>
                    )}
                    {/* Cover badge */}
                    {tutorial.coverImageId && (tutorial.images ?? [])[currentImgPage - 1]?.id === tutorial.coverImageId && (
                        <div className="absolute top-3 left-3 bg-amber-400 text-amber-900 text-[10px] font-black px-2 py-0.5 rounded-full pointer-events-none">⭐ Copertina</div>
                    )}
                    {/* Set / remove cover button */}
                    {imageUrls.length > 0 && (
                        <button
                            onClick={() => {
                                const imgId = (tutorial.images ?? [])[currentImgPage - 1]?.id;
                                const newCoverId = tutorial.coverImageId === imgId ? undefined : imgId;
                                updateTutorial(tutorial.id, { coverImageId: newCoverId });
                                syncImages(tutorial.images ?? [], newCoverId);
                            }}
                            className="absolute top-3 right-3 text-[10px] font-black px-2 py-0.5 rounded-full bg-white/80 border border-[#EEF0F4] text-[#9AA2B1] hover:text-amber-500 hover:border-amber-300 transition-colors"
                        >
                            {tutorial.coverImageId === (tutorial.images ?? [])[currentImgPage - 1]?.id ? '★ Rimuovi copertina' : '☆ Imposta copertina'}
                        </button>
                    )}
                </div>
            </div>

            {/* Rounds / Secondary Counters */}
            <div className="mb-10">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-black text-[#1C1C1E]">Giri Secondari</h2>
                    <div className="flex items-center gap-2">
                        {tutorial.secs.length > 1 && (
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
                                AGGIUNGI
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
                    {tutorial.secs.map((sec, index) => (
                        <div
                            key={sec.id}
                            draggable={reorderMode}
                            onDragStart={() => setDragIdx(index)}
                            onDragEnd={() => { setDragIdx(null); setOverIdx(null); }}
                            onDragOver={(e) => { e.preventDefault(); setOverIdx(index); }}
                            onDrop={() => {
                                if (dragIdx !== null && dragIdx !== index) moveCounter(dragIdx, index);
                                setDragIdx(null); setOverIdx(null);
                            }}
                            className={`relative flex items-stretch gap-2 transition-all ${reorderMode ? 'cursor-grab active:cursor-grabbing' : ''} ${overIdx === index && dragIdx !== index ? 'ring-2 ring-[#7B5CF6] rounded-[28px]' : ''} ${dragIdx === index ? 'opacity-50' : ''}`}
                        >
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
                                        onClick={() => index < tutorial.secs.length - 1 && moveCounter(index, index + 1)}
                                        disabled={index === tutorial.secs.length - 1}
                                        className="w-7 h-7 flex items-center justify-center rounded-lg text-[#7B5CF6] disabled:opacity-25 hover:bg-[#7B5CF6]/10 active:scale-90 transition-all"
                                    >
                                        <ChevronDown size={16} strokeWidth={3} />
                                    </button>
                                </div>
                            )}
                            <div className="flex-1 min-w-0">
                                <RoundCounter
                                    {...sec}
                                    onIncrement={(sid) => {
                                        const updated = tutorial.secs.map(s => s.id === sid ? { ...s, value: s.value + 1 } : s);
                                        updateTutorial(tutorial.id, { secs: updated });
                                        syncSecs(updated);
                                    }}
                                    onDecrement={(sid) => {
                                        const updated = tutorial.secs.map(s => s.id === sid ? { ...s, value: Math.max(1, s.value - 1) } : s);
                                        updateTutorial(tutorial.id, { secs: updated });
                                        syncSecs(updated);
                                    }}
                                    onRename={(sid, newName) => {
                                        const updated = tutorial.secs.map(s => s.id === sid ? { ...s, name: newName } : s);
                                        updateTutorial(tutorial.id, { secs: updated });
                                        syncSecs(updated);
                                    }}
                                    onDelete={(sid) => {
                                        const updated = tutorial.secs.filter(s => s.id !== sid);
                                        updateTutorial(tutorial.id, { secs: updated });
                                        syncSecs(updated);
                                    }}
                                    imageId={sec.imageId}
                                    imageUrl={sec.imageId ? imageUrls[(tutorial.images ?? []).findIndex(i => i.id === sec.imageId)] : undefined}
                                    onAssociateImage={(sid) => { setPickerTargetSecId(sid); setShowCounterImagePicker(true); }}
                                    onRemoveImage={(sid) => {
                                        const updated = tutorial.secs.map(s => s.id === sid ? { ...s, imageId: undefined } : s);
                                        updateTutorial(tutorial.id, { secs: updated });
                                        syncSecs(updated);
                                    }}
                                    hideImageOption={imageUrls.length === 0}
                                />
                            </div>
                        </div>
                    ))}
                    {tutorial.secs.length === 0 && (
                        <div className="text-center p-6 bg-[#FAFAFC] rounded-2xl border border-dashed border-[#EEF0F4] text-[#9AA2B1] text-sm font-medium">
                            Nessun contatore secondario aggiunto
                        </div>
                    )}
                </div>
            </div>

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
                                    const updated = [...tutorial.secs, { id: Date.now().toString(), name: newCounterName.trim(), value: 1 }];
                                    updateTutorial(tutorial.id, { secs: updated });
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
                                    const updated = [...tutorial.secs, { id: Date.now().toString(), name: newCounterName.trim(), value: 1 }];
                                    updateTutorial(tutorial.id, { secs: updated });
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

            {/* CounterImagePicker */}
            {showCounterImagePicker && pickerTargetSecId && (
                <CounterImagePicker
                    imageUrls={imageUrls}
                    imageIds={(tutorial.images ?? []).map(i => i.id)}
                    currentImageId={tutorial.secs.find(s => s.id === pickerTargetSecId)?.imageId}
                    onSelect={(imageId) => {
                        const updated = tutorial.secs.map(s => s.id === pickerTargetSecId ? { ...s, imageId } : s);
                        updateTutorial(tutorial.id, { secs: updated });
                        syncSecs(updated);
                        setShowCounterImagePicker(false);
                        setPickerTargetSecId(null);
                    }}
                    onRemove={() => {
                        const updated = tutorial.secs.map(s => s.id === pickerTargetSecId ? { ...s, imageId: undefined } : s);
                        updateTutorial(tutorial.id, { secs: updated });
                        syncSecs(updated);
                        setShowCounterImagePicker(false);
                        setPickerTargetSecId(null);
                    }}
                    onClose={() => { setShowCounterImagePicker(false); setPickerTargetSecId(null); }}
                />
            )}

            {/* Image Manager Modal */}
            {showImageManager && (
                <div className="fixed inset-0 z-[10000] flex items-end md:items-center justify-center bg-black/50" onClick={() => setShowImageManager(false)}>
                    <div
                        className="w-full max-w-2xl bg-white rounded-t-[32px] md:rounded-[32px] shadow-2xl animate-in slide-in-from-bottom md:slide-in-from-bottom-0 duration-300 flex flex-col max-h-[85vh]"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-[#EEF0F4] shrink-0">
                            <div>
                                <h3 className="text-xl font-black text-[#1C1C1E]">Gestisci Immagini</h3>
                                <p className="text-xs text-[#9AA2B1] font-medium mt-0.5">⭐ Copertina · Usa ↑↓ per riordinare</p>
                            </div>
                            <button
                                onClick={() => setShowImageManager(false)}
                                className="w-9 h-9 flex items-center justify-center rounded-xl bg-[#FAFAFC] border border-[#EEF0F4] text-[#9AA2B1]"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="overflow-y-auto flex-1 px-4 py-3">
                            {(tutorial.images ?? []).map((img, i) => {
                                const url = imageUrls[i];
                                const isCover = tutorial.coverImageId
                                    ? img.id === tutorial.coverImageId
                                    : i === 0;
                                const isDragging = imgDragIdx === i;
                                const isOver = imgOverIdx === i && imgDragIdx !== i;
                                return (
                                    <div
                                        key={img.id}
                                        className={`flex items-center gap-3 p-2.5 rounded-2xl mb-2 border transition-all select-none
                                            ${isOver ? 'border-[#7B5CF6] bg-[#F4EEFF]' : isDragging ? 'opacity-40 border-dashed border-[#7B5CF6]' : 'border-transparent hover:border-[#EEF0F4] hover:bg-[#FAFAFC]'}`}
                                    >
                                        <div className="w-8 h-16 flex items-center justify-center shrink-0 rounded-xl bg-[#FAFAFC] border border-[#EEF0F4] cursor-grab active:cursor-grabbing touch-none"
                                            onPointerDown={(e) => { e.preventDefault(); setImgDragIdx(i); }}
                                            onPointerMove={(e) => {
                                                if (imgDragIdx === null) return;
                                                const el = document.elementFromPoint(e.clientX, e.clientY);
                                                const row = el?.closest('[data-img-idx]');
                                                if (row) setImgOverIdx(Number(row.getAttribute('data-img-idx')));
                                            }}
                                            onPointerUp={() => {
                                                if (imgDragIdx !== null && imgOverIdx !== null && imgDragIdx !== imgOverIdx) {
                                                    moveImage(imgDragIdx, imgOverIdx);
                                                }
                                                setImgDragIdx(null); setImgOverIdx(null);
                                            }}
                                            title="Trascina per riordinare"
                                        >
                                            <GripVertical size={16} className="text-[#9AA2B1]" />
                                        </div>

                                        <div className="w-16 h-16 rounded-xl overflow-hidden bg-[#FAFAFC] border border-[#EEF0F4] shrink-0 relative" data-img-idx={i}>
                                            {url && <img src={url} alt="" className="w-full h-full object-cover" draggable={false} />}
                                            {isCover && (
                                                <div className="absolute top-1 right-1 w-5 h-5 bg-amber-400 rounded-full flex items-center justify-center shadow-sm">
                                                    <span className="text-[10px]">⭐</span>
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold text-[#1C1C1E]">
                                                Immagine {i + 1}
                                                {isCover && <span className="ml-2 text-amber-500 text-xs font-black">COPERTINA</span>}
                                            </p>
                                            {!isCover && (
                                                <button
                                                    onClick={() => {
                                                        updateTutorial(tutorial.id, { coverImageId: img.id });
                                                        syncImages(tutorial.images ?? [], img.id);
                                                    }}
                                                    className="text-xs text-[#9AA2B1] hover:text-amber-500 font-bold mt-0.5 transition-colors"
                                                >
                                                    ⭐ Imposta come copertina
                                                </button>
                                            )}
                                        </div>

                                        <div className="flex flex-col gap-1 shrink-0">
                                            <button
                                                onClick={() => i > 0 && moveImage(i, i - 1)}
                                                disabled={i === 0}
                                                className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#FAFAFC] border border-[#EEF0F4] text-[#7B5CF6] disabled:opacity-25 active:scale-90 transition-all"
                                            >
                                                <ChevronUp size={15} strokeWidth={3} />
                                            </button>
                                            <button
                                                onClick={() => i < (tutorial.images ?? []).length - 1 && moveImage(i, i + 1)}
                                                disabled={i === (tutorial.images ?? []).length - 1}
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

            {/* Notes — Annota Progressi */}
            <div className="bg-white rounded-[32px] p-6 border border-[#EEF0F4] shadow-sm mb-10">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2 text-[#7B5CF6]">
                        <StickyNote size={20} strokeWidth={3} />
                        <h3 className="font-black text-sm uppercase tracking-widest">Annota Progressi</h3>
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
                        placeholder="Scrivi qui i tuoi progressi, parti completate, filati usati..."
                    />
                ) : (
                    <div className="text-sm font-medium text-[#1C1C1E] leading-relaxed whitespace-pre-wrap">
                        {tutorial.notesHtml || <span className="text-[#9AA2B1] italic">Nessuna nota salvata per questo tutorial.</span>}
                    </div>
                )}
            </div>
        </div>
    );
}
