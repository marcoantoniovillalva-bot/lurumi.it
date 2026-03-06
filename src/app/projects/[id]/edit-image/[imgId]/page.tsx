"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Sparkles, Download, RotateCcw, ZoomIn, ZoomOut, Eraser, Paintbrush, Undo2, Redo2, Palette, Wand2, Check, X, AlertCircle, Loader2, ChevronRight, Hand } from "lucide-react";
import { useProjectStore } from "@/features/projects/store/useProjectStore";
import { useAuth } from "@/hooks/useAuth";
import { luDB } from "@/lib/db";
import { createClient } from "@/lib/supabase/client";
import { CREDIT_COSTS } from "@/lib/ai-credits-config";

// ---------- Tipi ----------
type Step = 'original' | 'removed' | 'brush' | 'background';
type BrushMode = 'restore' | 'erase';
type BgMode = 'color' | 'ai';

interface HistoryEntry {
    imageData: ImageData;
}

// ---------- Helper: carica immagine da src ----------
function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((res, rej) => {
        const img = new window.Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => res(img);
        img.onerror = rej;
        img.src = src;
    });
}

// ---------- Pagina ----------
export default function EditImagePage() {
    const { id, imgId } = useParams<{ id: string; imgId: string }>();
    const router = useRouter();
    const { projects, updateProject } = useProjectStore();
    const { user } = useAuth();
    const project = projects.find(p => p.id === id);

    // Step corrente
    const [step, setStep] = useState<Step>('original');

    // Immagine originale (objectURL)
    const [originalUrl, setOriginalUrl] = useState<string | null>(null);
    // Immagine dopo rimozione sfondo (base64 PNG trasparente)
    const [removedUrl, setRemovedUrl] = useState<string | null>(null);
    // Sfondo generato (base64)
    const [bgUrl, setBgUrl] = useState<string | null>(null);

    // Loading / error
    const [loadingStep, setLoadingStep] = useState<'remove' | 'generate' | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Brush
    const brushCanvasRef = useRef<HTMLCanvasElement>(null);
    const [brushMode, setBrushMode] = useState<BrushMode>('restore');
    const [brushSize, setBrushSize] = useState(24);
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const isPainting = useRef(false);
    const lastPaintPoint = useRef<{ x: number; y: number } | null>(null);
    const history = useRef<HistoryEntry[]>([]);
    const historyIndex = useRef(-1);
    const [historyLen, setHistoryLen] = useState(0); // trigger re-render per undo/redo buttons

    // Pan mode
    const [panMode, setPanMode] = useState(false);
    const panDragStart = useRef<{ mx: number; my: number; px: number; py: number } | null>(null);

    // Pinch zoom
    const lastPinchDist = useRef<number | null>(null);
    const lastPinchCenter = useRef<{ x: number; y: number } | null>(null);
    const panStart = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

    // Background
    const [bgMode, setBgMode] = useState<BgMode>('color');
    const [bgColor, setBgColor] = useState('#FFFFFF');
    const [bgPrompt, setBgPrompt] = useState('');
    const [subjectScale, setSubjectScale] = useState(1);
    const [subjectX, setSubjectX] = useState(0.5); // 0-1
    const [subjectY, setSubjectY] = useState(0.5); // 0-1
    const compositeCanvasRef = useRef<HTMLCanvasElement>(null);

    // Save modal
    const [showSaveModal, setShowSaveModal] = useState(false);
    const [saving, setSaving] = useState(false);

    // ------- Carica immagine originale da IndexedDB / Supabase -------
    useEffect(() => {
        if (!project) return;
        const load = async () => {
            try {
                const record = await luDB.getFile(imgId);
                if (record?.blob) {
                    setOriginalUrl(URL.createObjectURL(record.blob));
                    return;
                }
                if (user) {
                    const supabase = createClient();
                    const storagePath = imgId === id
                        ? `${user.id}/${id}/main`
                        : `${user.id}/${id}/${imgId}`;
                    const { data: blob } = await supabase.storage.from('project-files').download(storagePath);
                    if (blob) {
                        await luDB.saveFile({ id: imgId, blob });
                        setOriginalUrl(URL.createObjectURL(blob));
                    }
                }
            } catch (e) {
                console.error('Failed to load image', e);
                setError('Impossibile caricare l\'immagine.');
            }
        };
        load();
    }, [imgId, id, user?.id]); // eslint-disable-line

    // ------- Inizializza canvas pennello quando arriviamo allo step brush -------
    useEffect(() => {
        if (step !== 'brush' || !removedUrl || !brushCanvasRef.current) return;
        const canvas = brushCanvasRef.current;
        const ctx = canvas.getContext('2d')!;
        const img = new window.Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            ctx.drawImage(img, 0, 0);
            // Salva stato iniziale nella storia
            history.current = [{ imageData: ctx.getImageData(0, 0, canvas.width, canvas.height) }];
            historyIndex.current = 0;
            setHistoryLen(1);
        };
        img.src = removedUrl;
    }, [step, removedUrl]);

    // ------- Aggiorna composite canvas ogni volta che cambiano bg / soggetto / scale -------
    useEffect(() => {
        if (step !== 'background') return;
        drawComposite();
    }, [step, bgUrl, bgColor, bgMode, subjectScale, subjectX, subjectY, removedUrl]); // eslint-disable-line

    const drawComposite = useCallback(async () => {
        const canvas = compositeCanvasRef.current;
        if (!canvas) return;
        const subjectSrc = getBrushResult() || removedUrl;
        if (!subjectSrc) return;

        const ctx = canvas.getContext('2d')!;
        const subject = await loadImage(subjectSrc);

        // Determina dimensione canvas (quadrato per semplicità, usa naturalWidth soggetto)
        const size = Math.max(subject.naturalWidth, subject.naturalHeight);
        canvas.width = size;
        canvas.height = size;

        // Sfondo
        if (bgMode === 'color') {
            ctx.fillStyle = bgColor;
            ctx.fillRect(0, 0, size, size);
        } else if (bgUrl) {
            const bg = await loadImage(bgUrl);
            ctx.drawImage(bg, 0, 0, size, size);
        } else {
            // placeholder grigio
            ctx.fillStyle = '#EEEEEE';
            ctx.fillRect(0, 0, size, size);
        }

        // Soggetto ridimensionato e posizionato
        const w = subject.naturalWidth * subjectScale;
        const h = subject.naturalHeight * subjectScale;
        const x = subjectX * size - w / 2;
        const y = subjectY * size - h / 2;
        ctx.drawImage(subject, x, y, w, h);
    }, [bgMode, bgColor, bgUrl, subjectScale, subjectX, subjectY, removedUrl]);

    const getBrushResult = (): string | null => {
        const canvas = brushCanvasRef.current;
        if (!canvas || canvas.width === 0) return null;
        return canvas.toDataURL('image/png');
    };

    // ------- API: rimozione sfondo -------
    const handleRemoveBg = async () => {
        if (!originalUrl) return;
        setError(null);
        setLoadingStep('remove');
        try {
            // Converti objectURL in base64
            const res = await fetch(originalUrl);
            const blob = await res.blob();
            const base64 = await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.readAsDataURL(blob);
            });

            const response = await fetch('/api/image/remove-bg', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ imageBase64: base64 }),
            });
            let data: any;
            try { data = await response.json(); } catch {
                throw new Error('Risposta del server non valida. Il servizio potrebbe essere temporaneamente sovraccarico — riprova tra qualche secondo.');
            }
            if (!data.success) {
                setError(data.error || 'Errore rimozione sfondo.');
                return;
            }
            setRemovedUrl(data.imageBase64);
            setStep('removed');
        } catch (e: any) {
            setError(e.message || 'Errore di rete.');
        } finally {
            setLoadingStep(null);
        }
    };

    // ------- API: genera sfondo -------
    const handleGenerateBg = async () => {
        if (!bgPrompt.trim()) return;
        setError(null);
        setLoadingStep('generate');
        try {
            // Aspect ratio dal soggetto (approssimato)
            const subjectSrc = getBrushResult() || removedUrl;
            const response = await fetch('/api/image/generate-bg', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: bgPrompt, aspectRatio: '1:1' }),
            });
            const data = await response.json();
            if (!data.success) {
                setError(data.error || 'Errore generazione sfondo.');
                return;
            }
            setBgUrl(data.imageBase64);
        } catch (e: any) {
            setError(e.message || 'Errore di rete.');
        } finally {
            setLoadingStep(null);
        }
    };

    // ------- Pennello: paint su canvas -------
    const getCanvasPoint = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / (rect.width / zoom);
        const scaleY = canvas.height / (rect.height / zoom);
        let clientX: number, clientY: number;
        if ('touches' in e) {
            if (e.touches.length !== 1) return null;
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = e.clientX;
            clientY = e.clientY;
        }
        return {
            x: (clientX - rect.left + pan.x) / zoom * (canvas.width / rect.width * zoom),
            y: (clientY - rect.top + pan.y) / zoom * (canvas.height / rect.height * zoom),
        };
    };

    const paintAt = (canvas: HTMLCanvasElement, x: number, y: number) => {
        const ctx = canvas.getContext('2d')!;
        const radiusScaled = brushSize * (canvas.width / canvas.getBoundingClientRect().width / zoom);
        ctx.save();
        if (brushMode === 'erase') {
            ctx.globalCompositeOperation = 'destination-out';
        } else {
            ctx.globalCompositeOperation = 'destination-over';
        }

        if (brushMode === 'restore') {
            // Restaura dalla immagine originale rimossa
            const srcImg = new window.Image();
            srcImg.src = removedUrl!;
            // Disegniamo un cerchio che copia i pixel dall'originale
            ctx.save();
            ctx.beginPath();
            ctx.arc(x, y, radiusScaled, 0, Math.PI * 2);
            ctx.clip();
            ctx.globalCompositeOperation = 'source-over';
            ctx.drawImage(srcImg, 0, 0, canvas.width, canvas.height);
            ctx.restore();
        } else {
            // Erase: rimuovi pixel (destination-out)
            ctx.beginPath();
            ctx.arc(x, y, radiusScaled, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(0,0,0,1)';
            ctx.fill();
        }
        ctx.restore();
    };

    const saveToHistory = (canvas: HTMLCanvasElement) => {
        const ctx = canvas.getContext('2d')!;
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        // Tronca future redo entries
        history.current = history.current.slice(0, historyIndex.current + 1);
        history.current.push({ imageData });
        if (history.current.length > 20) history.current.shift();
        historyIndex.current = history.current.length - 1;
        setHistoryLen(history.current.length);
    };

    const handleUndo = () => {
        const canvas = brushCanvasRef.current;
        if (!canvas || historyIndex.current <= 0) return;
        historyIndex.current--;
        const ctx = canvas.getContext('2d')!;
        ctx.putImageData(history.current[historyIndex.current].imageData, 0, 0);
        setHistoryLen(h => h); // trigger
    };

    const handleRedo = () => {
        const canvas = brushCanvasRef.current;
        if (!canvas || historyIndex.current >= history.current.length - 1) return;
        historyIndex.current++;
        const ctx = canvas.getContext('2d')!;
        ctx.putImageData(history.current[historyIndex.current].imageData, 0, 0);
        setHistoryLen(h => h);
    };

    // Mouse events pennello / pan
    const onMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (panMode) {
            panDragStart.current = { mx: e.clientX, my: e.clientY, px: pan.x, py: pan.y };
            return;
        }
        if (!brushCanvasRef.current) return;
        isPainting.current = true;
        const p = getCanvasPoint(e, brushCanvasRef.current);
        if (!p) return;
        lastPaintPoint.current = p;
        paintAt(brushCanvasRef.current, p.x, p.y);
    };
    const onMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (panMode && panDragStart.current) {
            const dx = e.clientX - panDragStart.current.mx;
            const dy = e.clientY - panDragStart.current.my;
            setPan({ x: panDragStart.current.px + dx / zoom, y: panDragStart.current.py + dy / zoom });
            return;
        }
        if (!isPainting.current || !brushCanvasRef.current) return;
        const p = getCanvasPoint(e, brushCanvasRef.current);
        if (!p) return;
        paintAt(brushCanvasRef.current, p.x, p.y);
        lastPaintPoint.current = p;
    };
    const onMouseUp = () => {
        if (panMode) { panDragStart.current = null; return; }
        if (!isPainting.current || !brushCanvasRef.current) return;
        isPainting.current = false;
        saveToHistory(brushCanvasRef.current);
    };

    // Touch events pennello / pan
    const onTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
        if (e.touches.length === 2) {
            // Pinch + pan start
            const d = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            lastPinchDist.current = d;
            lastPinchCenter.current = {
                x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
                y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
            };
            isPainting.current = false;
            return;
        }
        if (panMode) {
            panDragStart.current = { mx: e.touches[0].clientX, my: e.touches[0].clientY, px: pan.x, py: pan.y };
            return;
        }
        if (!brushCanvasRef.current) return;
        e.preventDefault();
        isPainting.current = true;
        const p = getCanvasPoint(e, brushCanvasRef.current);
        if (!p) return;
        paintAt(brushCanvasRef.current, p.x, p.y);
    };
    const onTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
        if (e.touches.length === 2 && lastPinchDist.current !== null) {
            const d = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            const delta = d / lastPinchDist.current;
            setZoom(z => Math.min(8, Math.max(0.5, z * delta)));
            // Pan based on pinch center movement
            if (lastPinchCenter.current) {
                const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
                const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2;
                const dcx = cx - lastPinchCenter.current.x;
                const dcy = cy - lastPinchCenter.current.y;
                setPan(p => ({ x: p.x + dcx / zoom, y: p.y + dcy / zoom }));
                lastPinchCenter.current = { x: cx, y: cy };
            }
            lastPinchDist.current = d;
            return;
        }
        if (panMode && panDragStart.current) {
            const dx = e.touches[0].clientX - panDragStart.current.mx;
            const dy = e.touches[0].clientY - panDragStart.current.my;
            setPan({ x: panDragStart.current.px + dx / zoom, y: panDragStart.current.py + dy / zoom });
            return;
        }
        if (!isPainting.current || !brushCanvasRef.current) return;
        e.preventDefault();
        const p = getCanvasPoint(e, brushCanvasRef.current);
        if (!p) return;
        paintAt(brushCanvasRef.current, p.x, p.y);
    };
    const onTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
        lastPinchDist.current = null;
        lastPinchCenter.current = null;
        if (panMode) { panDragStart.current = null; return; }
        if (!isPainting.current || !brushCanvasRef.current) return;
        isPainting.current = false;
        saveToHistory(brushCanvasRef.current);
    };

    // ------- Salva immagine -------
    const getFinalImageBlob = async (): Promise<Blob> => {
        if (step === 'background' && compositeCanvasRef.current) {
            return new Promise(resolve => compositeCanvasRef.current!.toBlob(b => resolve(b!), 'image/jpeg', 0.95));
        }
        const brushResult = getBrushResult();
        if (brushResult) {
            const res = await fetch(brushResult);
            return res.blob();
        }
        if (removedUrl) {
            const res = await fetch(removedUrl);
            return res.blob();
        }
        const res = await fetch(originalUrl!);
        return res.blob();
    };

    const handleSave = async (mode: 'replace' | 'new') => {
        if (!project || !user) return;
        setSaving(true);
        setError(null);
        try {
            const blob = await getFinalImageBlob();
            const supabase = createClient();

            if (mode === 'replace') {
                // Sostituisce l'immagine originale nel progetto
                await luDB.saveFile({ id: imgId, blob });
                const storagePath = imgId === id
                    ? `${user.id}/${id}/main`
                    : `${user.id}/${id}/${imgId}`;
                await supabase.storage.from('project-files').upload(storagePath, blob, { upsert: true });
                // Rimane lo stesso imgId nella lista — già presente in project.images
            } else {
                // Aggiunge come nuova immagine
                const newImgId = `${project.id}_img_${Date.now()}`;
                await luDB.saveFile({ id: newImgId, blob });
                const storagePath = `${user.id}/${id}/${newImgId}`;
                await supabase.storage.from('project-files').upload(storagePath, blob, { upsert: true });
                const updatedImages = [...(project.images || []), { id: newImgId }];
                updateProject(project.id, { images: updatedImages });
                await supabase.from('projects').update({
                    images: updatedImages.map(img => ({ id: img.id })),
                }).eq('id', project.id).eq('user_id', user.id);
            }

            router.push(`/projects/${id}`);
        } catch (e: any) {
            setError(e.message || 'Errore durante il salvataggio.');
        } finally {
            setSaving(false);
        }
    };

    if (!project) {
        return <div className="p-10 text-center font-bold">Progetto non trovato</div>;
    }

    const canUndo = historyIndex.current > 0;
    const canRedo = historyIndex.current < history.current.length - 1;

    return (
        <div className="flex flex-col h-screen bg-[#0E0E10] text-white overflow-hidden">
            {/* ---- Navbar ---- */}
            <div className="flex items-center justify-between px-4 py-3 bg-[#18181B] border-b border-white/10 flex-shrink-0">
                <button
                    onClick={() => router.push(`/projects/${id}`)}
                    className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/10 text-white active:scale-90 transition-transform"
                >
                    <ArrowLeft size={18} />
                </button>
                <div className="text-center">
                    <p className="text-xs text-white/40 font-bold uppercase tracking-widest">Editor Immagine</p>
                    <p className="text-sm font-black truncate max-w-[180px]">{project.title}</p>
                </div>
                <button
                    onClick={() => setShowSaveModal(true)}
                    disabled={step === 'original' && !removedUrl}
                    className="px-4 py-2 bg-[#7B5CF6] text-white rounded-xl font-bold text-sm disabled:opacity-30 active:scale-95 transition-transform"
                >
                    Salva
                </button>
            </div>

            {/* ---- Step indicator ---- */}
            <div className="flex items-center gap-1 px-4 py-2.5 bg-[#18181B] border-b border-white/10 overflow-x-auto flex-shrink-0">
                {(['original', 'removed', 'brush', 'background'] as Step[]).map((s, i) => {
                    const labels: Record<Step, string> = {
                        original: 'Originale',
                        removed: 'Sfondo rimosso',
                        brush: 'Pennello',
                        background: 'Sfondo',
                    };
                    const available = s === 'original'
                        || (s === 'removed' && !!removedUrl)
                        || (s === 'brush' && !!removedUrl)
                        || (s === 'background' && !!removedUrl);
                    return (
                        <React.Fragment key={s}>
                            {i > 0 && <ChevronRight size={12} className="text-white/20 flex-shrink-0" />}
                            <button
                                onClick={() => available && setStep(s)}
                                disabled={!available}
                                className={`px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                                    step === s
                                        ? 'bg-[#7B5CF6] text-white'
                                        : available
                                            ? 'bg-white/10 text-white/60 hover:bg-white/20'
                                            : 'text-white/20 cursor-not-allowed'
                                }`}
                            >
                                {labels[s]}
                            </button>
                        </React.Fragment>
                    );
                })}
            </div>

            {/* ---- Errore ---- */}
            {error && (
                <div className="mx-4 mt-3 p-3 bg-red-500/20 border border-red-500/40 rounded-2xl flex items-start gap-2 text-red-300 text-sm flex-shrink-0">
                    <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                    <span>{error}</span>
                    <button onClick={() => setError(null)} className="ml-auto flex-shrink-0"><X size={14} /></button>
                </div>
            )}

            {/* ---- Area principale ---- */}
            <div className="flex-1 overflow-hidden relative">

                {/* STEP: Originale */}
                {step === 'original' && (
                    <div className="flex flex-col h-full">
                        <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
                            {originalUrl ? (
                                <img src={originalUrl} alt="Originale" className="max-w-full max-h-full object-contain rounded-2xl" />
                            ) : (
                                <div className="text-white/30 text-sm">Caricamento...</div>
                            )}
                        </div>
                        <div className="p-4 bg-[#18181B] border-t border-white/10 flex-shrink-0">
                            <div className="flex items-center justify-between mb-3">
                                <div>
                                    <p className="text-white font-black text-sm">Rimuovi sfondo</p>
                                    <p className="text-white/40 text-xs">Usa AI BRIA RMBG 2.0 — {CREDIT_COSTS.bg_removal} crediti</p>
                                </div>
                            </div>
                            <button
                                onClick={handleRemoveBg}
                                disabled={!originalUrl || loadingStep === 'remove'}
                                className="w-full h-12 bg-[#7B5CF6] text-white rounded-2xl font-black flex items-center justify-center gap-2 disabled:opacity-40 active:scale-95 transition-transform"
                            >
                                {loadingStep === 'remove' ? (
                                    <><Loader2 size={18} className="animate-spin" /> Rimozione in corso...</>
                                ) : (
                                    <><Wand2 size={18} /> Rimuovi sfondo</>
                                )}
                            </button>
                        </div>
                    </div>
                )}

                {/* STEP: Sfondo rimosso (preview) */}
                {step === 'removed' && removedUrl && (
                    <div className="flex flex-col h-full">
                        <div
                            className="flex-1 flex items-center justify-center p-4 overflow-hidden"
                            style={{ backgroundImage: 'repeating-conic-gradient(#333 0% 25%, #222 0% 50%)', backgroundSize: '20px 20px' }}
                        >
                            <img src={removedUrl} alt="Sfondo rimosso" className="max-w-full max-h-full object-contain rounded-2xl" />
                        </div>
                        <div className="p-4 bg-[#18181B] border-t border-white/10 flex-shrink-0 flex gap-3">
                            <button
                                onClick={() => setStep('brush')}
                                className="flex-1 h-12 bg-white/10 text-white rounded-2xl font-bold flex items-center justify-center gap-2"
                            >
                                <Paintbrush size={16} /> Ritocca con pennello
                            </button>
                            <button
                                onClick={() => setStep('background')}
                                className="flex-1 h-12 bg-[#7B5CF6] text-white rounded-2xl font-bold flex items-center justify-center gap-2"
                            >
                                <Palette size={16} /> Aggiungi sfondo
                            </button>
                        </div>
                    </div>
                )}

                {/* STEP: Pennello */}
                {step === 'brush' && removedUrl && (
                    <div className="flex flex-col h-full">
                        {/* Toolbar pennello */}
                        <div className="flex items-center gap-2 px-3 py-2 bg-[#18181B] border-b border-white/10 flex-shrink-0 overflow-x-auto">
                            {/* Undo/Redo */}
                            <button onClick={handleUndo} disabled={!canUndo} className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/10 disabled:opacity-30">
                                <Undo2 size={16} />
                            </button>
                            <button onClick={handleRedo} disabled={!canRedo} className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/10 disabled:opacity-30">
                                <Redo2 size={16} />
                            </button>

                            <div className="w-px h-6 bg-white/10 flex-shrink-0 mx-1" />

                            {/* Modalità pennello */}
                            <button
                                onClick={() => setBrushMode('restore')}
                                className={`flex items-center gap-1.5 px-3 h-9 rounded-xl text-xs font-bold ${brushMode === 'restore' ? 'bg-green-500/30 text-green-300' : 'bg-white/10 text-white/60'}`}
                            >
                                <Paintbrush size={14} /> Ripristina
                            </button>
                            <button
                                onClick={() => setBrushMode('erase')}
                                className={`flex items-center gap-1.5 px-3 h-9 rounded-xl text-xs font-bold ${brushMode === 'erase' ? 'bg-red-500/30 text-red-300' : 'bg-white/10 text-white/60'}`}
                            >
                                <Eraser size={14} /> Elimina
                            </button>

                            <div className="w-px h-6 bg-white/10 flex-shrink-0 mx-1" />

                            {/* Brush size */}
                            <div className="flex items-center gap-2 flex-shrink-0">
                                <span className="text-xs text-white/40">Dim:</span>
                                <input
                                    type="range"
                                    min={4}
                                    max={100}
                                    value={brushSize}
                                    onChange={e => setBrushSize(Number(e.target.value))}
                                    className="w-20 accent-purple-500"
                                />
                                <span className="text-xs text-white/60 w-6">{brushSize}</span>
                            </div>

                            <div className="w-px h-6 bg-white/10 flex-shrink-0 mx-1" />

                            {/* Zoom */}
                            <button onClick={() => setZoom(z => Math.min(8, z * 1.3))} className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/10">
                                <ZoomIn size={16} />
                            </button>
                            <span className="text-xs text-white/40 flex-shrink-0">{Math.round(zoom * 100)}%</span>
                            <button onClick={() => setZoom(z => Math.max(0.5, z / 1.3))} className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/10">
                                <ZoomOut size={16} />
                            </button>
                            <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/10" title="Reset zoom">
                                <RotateCcw size={14} />
                            </button>
                            <button
                                onClick={() => setPanMode(v => !v)}
                                className={`w-9 h-9 flex items-center justify-center rounded-xl text-sm font-bold transition-colors ${panMode ? 'bg-[#7B5CF6] text-white' : 'bg-white/10 text-white/60'}`}
                                title="Modalità sposta (trascina per muoverti)"
                            >
                                <Hand size={16} />
                            </button>
                        </div>

                        {/* Canvas */}
                        <div
                            className="flex-1 overflow-hidden relative flex items-center justify-center"
                            style={{ backgroundImage: 'repeating-conic-gradient(#333 0% 25%, #222 0% 50%)', backgroundSize: '20px 20px' }}
                        >
                            <div style={{ transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`, transformOrigin: 'center', transition: panDragStart.current ? 'none' : 'transform 0.05s' }}>
                                <canvas
                                    ref={brushCanvasRef}
                                    className="max-w-full max-h-full rounded-lg shadow-2xl"
                                    style={{ cursor: panMode ? (panDragStart.current ? 'grabbing' : 'grab') : brushMode === 'erase' ? 'crosshair' : 'cell', touchAction: 'none' }}
                                    onMouseDown={onMouseDown}
                                    onMouseMove={onMouseMove}
                                    onMouseUp={onMouseUp}
                                    onMouseLeave={onMouseUp}
                                    onTouchStart={onTouchStart}
                                    onTouchMove={onTouchMove}
                                    onTouchEnd={onTouchEnd}
                                />
                            </div>
                        </div>

                        <div className="p-3 bg-[#18181B] border-t border-white/10 flex-shrink-0">
                            <button
                                onClick={() => setStep('background')}
                                className="w-full h-11 bg-[#7B5CF6] text-white rounded-2xl font-bold flex items-center justify-center gap-2"
                            >
                                <Palette size={16} /> Aggiungi sfondo
                            </button>
                        </div>
                    </div>
                )}

                {/* STEP: Aggiungi sfondo */}
                {step === 'background' && (
                    <div className="flex flex-col h-full">
                        {/* Composite canvas preview */}
                        <div className="flex-1 flex items-center justify-center p-3 overflow-hidden">
                            <canvas
                                ref={compositeCanvasRef}
                                className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl"
                                style={{ imageRendering: 'crisp-edges' }}
                            />
                        </div>

                        {/* Controlli */}
                        <div className="bg-[#18181B] border-t border-white/10 flex-shrink-0 overflow-y-auto max-h-[55vh]">
                            <div className="p-4 space-y-4">
                                {/* Modalità sfondo */}
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setBgMode('color')}
                                        className={`flex-1 h-10 rounded-xl font-bold text-sm ${bgMode === 'color' ? 'bg-[#7B5CF6] text-white' : 'bg-white/10 text-white/60'}`}
                                    >
                                        Colore
                                    </button>
                                    <button
                                        onClick={() => setBgMode('ai')}
                                        className={`flex-1 h-10 rounded-xl font-bold text-sm flex items-center justify-center gap-1.5 ${bgMode === 'ai' ? 'bg-[#7B5CF6] text-white' : 'bg-white/10 text-white/60'}`}
                                    >
                                        <Sparkles size={14} /> AI
                                    </button>
                                </div>

                                {bgMode === 'color' && (
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs text-white/60 font-bold">Colore sfondo</span>
                                        <input
                                            type="color"
                                            value={bgColor}
                                            onChange={e => setBgColor(e.target.value)}
                                            className="w-10 h-10 rounded-xl overflow-hidden border-0 cursor-pointer"
                                        />
                                        <span className="text-xs text-white/40 font-mono">{bgColor}</span>
                                    </div>
                                )}

                                {bgMode === 'ai' && (
                                    <div className="space-y-2">
                                        <label className="text-xs text-white/60 font-bold block">Descrivi lo sfondo</label>
                                        <div className="flex gap-2">
                                            <textarea
                                                value={bgPrompt}
                                                onChange={e => setBgPrompt(e.target.value)}
                                                placeholder="es. sfondo bokeh verde bosco, luce soffice..."
                                                rows={2}
                                                className="flex-1 bg-white/10 text-white text-sm rounded-xl px-3 py-2 resize-none outline-none border border-white/10 focus:border-[#7B5CF6] placeholder:text-white/30"
                                            />
                                            <button
                                                onClick={handleGenerateBg}
                                                disabled={!bgPrompt.trim() || loadingStep === 'generate'}
                                                className="w-12 h-full bg-[#7B5CF6] rounded-xl flex items-center justify-center disabled:opacity-40 flex-shrink-0"
                                            >
                                                {loadingStep === 'generate'
                                                    ? <Loader2 size={18} className="animate-spin" />
                                                    : <Wand2 size={18} />
                                                }
                                            </button>
                                        </div>
                                        <p className="text-white/30 text-xs">{CREDIT_COSTS.bg_generation} crediti per ogni generazione</p>
                                    </div>
                                )}

                                {/* Dimensione soggetto */}
                                <div>
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-xs text-white/60 font-bold">Dimensione soggetto</span>
                                        <span className="text-xs text-white/40">{Math.round(subjectScale * 100)}%</span>
                                    </div>
                                    <input
                                        type="range"
                                        min={20}
                                        max={200}
                                        value={Math.round(subjectScale * 100)}
                                        onChange={e => setSubjectScale(Number(e.target.value) / 100)}
                                        className="w-full accent-purple-500"
                                    />
                                </div>

                                {/* Posizione soggetto */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-xs text-white/60 font-bold">Pos. X</span>
                                            <span className="text-xs text-white/40">{Math.round(subjectX * 100)}%</span>
                                        </div>
                                        <input
                                            type="range"
                                            min={0}
                                            max={100}
                                            value={Math.round(subjectX * 100)}
                                            onChange={e => setSubjectX(Number(e.target.value) / 100)}
                                            className="w-full accent-purple-500"
                                        />
                                    </div>
                                    <div>
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-xs text-white/60 font-bold">Pos. Y</span>
                                            <span className="text-xs text-white/40">{Math.round(subjectY * 100)}%</span>
                                        </div>
                                        <input
                                            type="range"
                                            min={0}
                                            max={100}
                                            value={Math.round(subjectY * 100)}
                                            onChange={e => setSubjectY(Number(e.target.value) / 100)}
                                            className="w-full accent-purple-500"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* ---- Modal salva ---- */}
            {showSaveModal && (
                <div
                    className="fixed inset-0 z-[10000] flex items-end justify-center bg-black/60"
                    onClick={() => !saving && setShowSaveModal(false)}
                >
                    <div
                        className="w-full max-w-2xl bg-[#1C1C1E] rounded-t-[32px] p-6 pb-10 shadow-2xl animate-in slide-in-from-bottom duration-300 border-t border-white/10"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-5" />
                        <h3 className="text-xl font-black text-white mb-2">Salva immagine</h3>
                        <p className="text-white/50 text-sm mb-5">Come vuoi salvare l'immagine modificata?</p>

                        {error && (
                            <div className="mb-4 p-3 bg-red-500/20 rounded-xl text-red-300 text-sm">{error}</div>
                        )}

                        <div className="flex flex-col gap-3">
                            <button
                                onClick={() => handleSave('replace')}
                                disabled={saving}
                                className="w-full h-14 bg-[#7B5CF6] text-white rounded-2xl font-bold flex items-center justify-center gap-2 disabled:opacity-40"
                            >
                                {saving ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                                Sostituisci immagine originale
                            </button>
                            <button
                                onClick={() => handleSave('new')}
                                disabled={saving}
                                className="w-full h-14 bg-white/10 text-white rounded-2xl font-bold flex items-center justify-center gap-2 disabled:opacity-40"
                            >
                                {saving ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
                                Aggiungi come nuova immagine
                            </button>
                            <button
                                onClick={() => setShowSaveModal(false)}
                                disabled={saving}
                                className="w-full h-12 text-white/40 font-bold text-sm"
                            >
                                Annulla
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
