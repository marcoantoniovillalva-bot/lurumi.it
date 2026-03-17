"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { ArrowLeft, ChevronDown, ChevronUp, Lock, ZoomIn, ZoomOut, ChevronRight, ChevronLeft, X, Maximize2 } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getLibraryItemById } from "@/features/admin/actions/library";
import { useUserProfile } from "@/hooks/useUserProfile";
import type { LibraryItem, LibrarySection } from "@/features/admin/actions/library";

/* ─── PDF Viewer ─────────────────────────────────────────────── */
function PdfViewer({ url }: { url: string }) {
    const [numPages, setNumPages] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [scale, setScale] = useState(1.2);
    const [loading, setLoading] = useState(true);
    const [loadProgress, setLoadProgress] = useState(0); // 0-100 download progress
    const [error, setError] = useState('');

    // Preview canvas
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const pdfRef = useRef<any>(null);
    const renderTaskRef = useRef<any>(null);
    const previewPinchRef = useRef<number | null>(null);

    // Fullscreen state
    const [fsOpen, setFsOpen] = useState(false);
    const fsCanvasRef = useRef<HTMLCanvasElement>(null);
    const fsRenderTaskRef = useRef<any>(null);
    const fsWrapRef = useRef<HTMLDivElement>(null);
    const [fsZoom, setFsZoom] = useState(1);
    const [fsPan, setFsPan] = useState({ x: 0, y: 0 });
    // Refs mirror state for non-passive event handlers
    const fsZoomRef = useRef(1);
    const fsPanRef = useRef({ x: 0, y: 0 });
    const fsPinchRef = useRef<number | null>(null);
    const fsPanStartRef = useRef<{ tx: number; ty: number; px: number; py: number } | null>(null);
    const fsContainerCenterRef = useRef({ cx: 0, cy: 0 });
    // Double-tap to reset zoom
    const fsTapCountRef = useRef(0);
    const fsTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // ── Render a page onto a canvas ───────────────────────────────
    const renderPage = useCallback(async (
        pdf: any, page: number, sc: number,
        canvasEl: HTMLCanvasElement | null,
        taskRef: React.MutableRefObject<any>
    ) => {
        if (!canvasEl) return;
        if (taskRef.current) { try { taskRef.current.cancel(); } catch {} }
        const pdfPage = await pdf.getPage(page);
        const viewport = pdfPage.getViewport({ scale: sc });
        canvasEl.width = viewport.width;
        canvasEl.height = viewport.height;
        const ctx = canvasEl.getContext('2d');
        if (!ctx) return;
        taskRef.current = pdfPage.render({ canvasContext: ctx, viewport });
        try { await taskRef.current.promise; } catch {}
    }, []);

    // ── Load PDF ──────────────────────────────────────────────────
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const pdfjs = await import('pdfjs-dist');
                const version = pdfjs.version;
                pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

                // Scarica il PDF nel browser (main thread) con progress — evita problemi CORS del worker
                setLoadProgress(0);
                const response = await fetch(url);
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const contentLength = Number(response.headers.get('content-length') ?? 0);
                const reader = response.body!.getReader();
                const chunks: Uint8Array[] = [];
                let received = 0;
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    if (cancelled) return;
                    chunks.push(value);
                    received += value.length;
                    if (contentLength > 0) setLoadProgress(Math.round(received / contentLength * 90));
                }

                if (cancelled) return;
                setLoadProgress(95);

                // Concatena chunks in un unico Uint8Array e passa i dati direttamente a pdfjs
                const data = new Uint8Array(received);
                let pos = 0;
                for (const chunk of chunks) { data.set(chunk, pos); pos += chunk.length; }

                const pdf = await pdfjs.getDocument({
                    data,
                    cMapUrl: `https://unpkg.com/pdfjs-dist@${version}/cmaps/`,
                    cMapPacked: true,
                    standardFontDataUrl: `https://unpkg.com/pdfjs-dist@${version}/standard_fonts/`,
                }).promise;

                if (cancelled) return;
                pdfRef.current = pdf;
                setNumPages(pdf.numPages);
                setLoadProgress(100);
                setLoading(false);
                await renderPage(pdf, 1, scale, canvasRef.current, renderTaskRef);
            } catch (e: any) {
                if (!cancelled) {
                    console.error('[PdfViewer] load error:', e?.message ?? e);
                    setError('Impossibile caricare il PDF. Riprova più tardi.');
                }
                setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Re-render preview on page/scale change ────────────────────
    useEffect(() => {
        if (pdfRef.current) renderPage(pdfRef.current, currentPage, scale, canvasRef.current, renderTaskRef);
    }, [currentPage, scale, renderPage]);

    // ── Open fullscreen ───────────────────────────────────────────
    const openFs = useCallback(() => {
        fsZoomRef.current = 1; fsPanRef.current = { x: 0, y: 0 };
        setFsZoom(1); setFsPan({ x: 0, y: 0 });
        setFsOpen(true);
    }, []);

    // ── Render FS canvas when opened or page changes ──────────────
    useEffect(() => {
        if (!fsOpen || !pdfRef.current) return;
        const fsScale = Math.min(3.0, (window.innerWidth / (canvasRef.current?.width ?? 400)) * scale * 1.5);
        renderPage(pdfRef.current, currentPage, Math.max(1.5, fsScale), fsCanvasRef.current, fsRenderTaskRef);
    }, [fsOpen, currentPage, renderPage, scale]);

    // ── Lock body scroll in fullscreen ────────────────────────────
    useEffect(() => {
        document.body.style.overflow = fsOpen ? 'hidden' : '';
        return () => { document.body.style.overflow = ''; };
    }, [fsOpen]);

    // ── Non-passive touchmove (needed for preventDefault) ─────────
    useEffect(() => {
        const el = fsWrapRef.current;
        if (!el || !fsOpen) return;
        const onMove = (e: TouchEvent) => {
            e.preventDefault();
            if (e.touches.length === 2) {
                const newDist = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY
                );
                if (fsPinchRef.current !== null) {
                    const oldZoom = fsZoomRef.current;
                    const newZoom = Math.min(8, Math.max(0.5, oldZoom * (newDist / fsPinchRef.current)));
                    const ratio = newZoom / oldZoom;
                    // Adjust pan so the pinch center stays fixed
                    const { cx, cy } = fsContainerCenterRef.current;
                    const px = e.touches[0].clientX, py = e.touches[0].clientY;
                    const qx = e.touches[1].clientX, qy = e.touches[1].clientY;
                    const pinchX = (px + qx) / 2 - cx;
                    const pinchY = (py + qy) / 2 - cy;
                    const newPan = {
                        x: pinchX * (1 - ratio) + fsPanRef.current.x * ratio,
                        y: pinchY * (1 - ratio) + fsPanRef.current.y * ratio,
                    };
                    fsZoomRef.current = newZoom; fsPanRef.current = newPan;
                    setFsZoom(newZoom); setFsPan(newPan);
                }
                fsPinchRef.current = newDist;
            } else if (e.touches.length === 1 && fsPanStartRef.current) {
                const newPan = {
                    x: fsPanStartRef.current.px + (e.touches[0].clientX - fsPanStartRef.current.tx),
                    y: fsPanStartRef.current.py + (e.touches[0].clientY - fsPanStartRef.current.ty),
                };
                fsPanRef.current = newPan; setFsPan(newPan);
            }
        };
        el.addEventListener('touchmove', onMove, { passive: false });
        return () => el.removeEventListener('touchmove', onMove);
    }, [fsOpen]);

    // ── Fullscreen touch start/end ────────────────────────────────
    const handleFsTouchStart = (e: React.TouchEvent) => {
        if (fsWrapRef.current) {
            const r = fsWrapRef.current.getBoundingClientRect();
            fsContainerCenterRef.current = { cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
        }
        if (e.touches.length === 2) {
            fsPinchRef.current = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            fsPanStartRef.current = null;
        } else if (e.touches.length === 1) {
            fsPanStartRef.current = { tx: e.touches[0].clientX, ty: e.touches[0].clientY, px: fsPanRef.current.x, py: fsPanRef.current.y };
        }
    };
    const handleFsTouchEnd = (e: React.TouchEvent) => {
        if (e.touches.length < 2) fsPinchRef.current = null;
        if (e.touches.length === 0) fsPanStartRef.current = null;
    };

    // ── Double-tap to reset zoom ──────────────────────────────────
    const handleFsTap = () => {
        fsTapCountRef.current++;
        if (fsTapCountRef.current >= 2) {
            clearTimeout(fsTapTimerRef.current!);
            fsTapCountRef.current = 0;
            fsZoomRef.current = 1; fsPanRef.current = { x: 0, y: 0 };
            setFsZoom(1); setFsPan({ x: 0, y: 0 });
        } else {
            fsTapTimerRef.current = setTimeout(() => { fsTapCountRef.current = 0; }, 300);
        }
    };

    // ── Navigate keeping FS state reset ──────────────────────────
    const goToPage = useCallback((page: number) => {
        setCurrentPage(page);
        fsZoomRef.current = 1; fsPanRef.current = { x: 0, y: 0 };
        setFsZoom(1); setFsPan({ x: 0, y: 0 });
    }, []);

    // ── Preview pinch-to-zoom ─────────────────────────────────────
    const handlePreviewTouchStart = (e: React.TouchEvent) => {
        if (e.touches.length === 2) {
            previewPinchRef.current = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
        }
    };
    const handlePreviewTouchMove = (e: React.TouchEvent) => {
        if (e.touches.length === 2 && previewPinchRef.current !== null) {
            const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
            setScale(s => Math.min(4, Math.max(0.5, s * (d / previewPinchRef.current!))));
            previewPinchRef.current = d;
        }
    };

    if (loading) return (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="w-8 h-8 border-4 border-[#7B5CF6] border-t-transparent rounded-full animate-spin" />
            {loadProgress > 0 && loadProgress < 100 ? (
                <div className="flex flex-col items-center gap-2 w-48">
                    <div className="w-full h-2 bg-[#F4F4F8] rounded-full overflow-hidden">
                        <div
                            className="h-full bg-[#7B5CF6] rounded-full transition-all duration-300"
                            style={{ width: `${loadProgress}%` }}
                        />
                    </div>
                    <p className="text-[#9AA2B1] text-xs font-bold">Download {loadProgress}%</p>
                </div>
            ) : (
                <p className="text-[#9AA2B1] text-sm font-bold">Caricamento PDF…</p>
            )}
        </div>
    );
    if (error) return <div className="text-center py-16 text-red-500 font-bold">{error}</div>;

    const toolbarBtn = "w-8 h-8 flex items-center justify-center rounded-xl text-[#7B5CF6] bg-[#F4EEFF] active:scale-90 transition-transform disabled:opacity-30";
    const fsBtnCls = "w-9 h-9 flex items-center justify-center rounded-xl text-white bg-white/15 active:scale-90 transition-transform disabled:opacity-30";

    return (
        <>
            <div className="flex flex-col gap-3">
                {/* Toolbar */}
                <div className="flex items-center justify-between bg-white border border-[#EEF0F4] rounded-2xl px-4 py-2.5 sticky top-16 z-10 shadow-sm">
                    <div className="flex items-center gap-1">
                        <button onClick={() => setScale(s => Math.max(0.5, s - 0.2))} className={toolbarBtn}><ZoomOut size={16} /></button>
                        <span className="text-xs font-black text-[#1C1C1E] w-12 text-center">{Math.round(scale * 100)}%</span>
                        <button onClick={() => setScale(s => Math.min(4, s + 0.2))} className={toolbarBtn}><ZoomIn size={16} /></button>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage <= 1} className={toolbarBtn}><ChevronLeft size={16} /></button>
                        <span className="text-xs font-black text-[#1C1C1E]">{currentPage} / {numPages}</span>
                        <button onClick={() => setCurrentPage(p => Math.min(numPages, p + 1))} disabled={currentPage >= numPages} className={toolbarBtn}><ChevronRight size={16} /></button>
                        <button onClick={openFs} title="Schermo intero" className={`${toolbarBtn} ml-1`}><Maximize2 size={15} /></button>
                    </div>
                </div>

                {/* Preview canvas — tap to open fullscreen */}
                <div
                    className="overflow-auto rounded-2xl border border-[#EEF0F4] bg-[#F4F4F8]"
                    onTouchStart={handlePreviewTouchStart}
                    onTouchMove={handlePreviewTouchMove}
                    style={{ touchAction: 'pan-x pan-y' }}
                >
                    <canvas
                        ref={canvasRef}
                        className="block mx-auto cursor-zoom-in"
                        onClick={openFs}
                    />
                </div>
            </div>

            {/* ── Fullscreen overlay ────────────────────────────────── */}
            {fsOpen && (
                <div className="fixed inset-0 z-[99999] bg-black flex flex-col select-none">
                    {/* FS toolbar */}
                    <div className="flex items-center justify-between px-4 py-2.5 bg-black/70 backdrop-blur-md flex-shrink-0">
                        <div className="flex items-center gap-1">
                            <button onClick={() => goToPage(Math.max(1, currentPage - 1))} disabled={currentPage <= 1} className={fsBtnCls}><ChevronLeft size={20} /></button>
                            <span className="text-white text-xs font-bold w-16 text-center">{currentPage} / {numPages}</span>
                            <button onClick={() => goToPage(Math.min(numPages, currentPage + 1))} disabled={currentPage >= numPages} className={fsBtnCls}><ChevronRight size={20} /></button>
                        </div>
                        <span className="text-white/40 text-xs font-bold">{Math.round(fsZoom * 100)}%</span>
                        <button onClick={() => setFsOpen(false)} className={fsBtnCls}><X size={20} /></button>
                    </div>

                    {/* Canvas area — pinch-zoom + pan */}
                    <div
                        ref={fsWrapRef}
                        className="flex-1 overflow-hidden flex items-center justify-center"
                        onTouchStart={handleFsTouchStart}
                        onTouchEnd={handleFsTouchEnd}
                        onClick={handleFsTap}
                        style={{ touchAction: 'none' }}
                    >
                        <canvas
                            ref={fsCanvasRef}
                            style={{
                                transform: `translate(${fsPan.x}px, ${fsPan.y}px) scale(${fsZoom})`,
                                transformOrigin: 'center center',
                                maxWidth: '100vw',
                                display: 'block',
                            }}
                        />
                    </div>

                    {/* Hint */}
                    <p className="text-white/25 text-[11px] text-center py-2 font-bold flex-shrink-0">
                        pizzica per zoomare · scorri per sfogliare · doppio tap per resettare
                    </p>
                </div>
            )}
        </>
    );
}

/* ─── Image Fullscreen ───────────────────────────────────────── */
function ImageFullscreen({ src, caption, onClose }: { src: string; caption?: string; onClose: () => void }) {
    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handler);
        document.body.style.overflow = 'hidden';
        return () => { window.removeEventListener('keydown', handler); document.body.style.overflow = ''; };
    }, [onClose]);

    return (
        <div className="fixed inset-0 z-[99999] bg-black flex flex-col items-center justify-center" onClick={onClose}>
            <button className="absolute top-4 right-4 w-10 h-10 bg-white/10 rounded-full flex items-center justify-center text-white">
                <X size={22} />
            </button>
            <img src={src} alt={caption ?? ''} className="max-w-full max-h-full object-contain" onClick={e => e.stopPropagation()} />
            {caption && (
                <p className="text-white/80 text-sm font-bold text-center px-4 py-3 bg-black/60 w-full" onClick={e => e.stopPropagation()}>
                    {caption}
                </p>
            )}
        </div>
    );
}

/* ─── Sections Accordion ─────────────────────────────────────── */
function SectionsAccordion({ sections }: { sections: LibrarySection[] }) {
    const [openId, setOpenId] = useState<string | null>(sections[0]?.id ?? null);
    const [fullscreen, setFullscreen] = useState<{ src: string; caption?: string } | null>(null);

    const sorted = [...sections].sort((a, b) => a.order - b.order);

    return (
        <>
            <div className="flex flex-col gap-2">
                {sorted.map(sec => {
                    const isOpen = openId === sec.id;
                    return (
                        <div key={sec.id} className="bg-white border border-[#EEF0F4] rounded-2xl overflow-hidden shadow-sm">
                            <button
                                className="w-full flex items-center justify-between px-4 py-3.5 text-left"
                                onClick={() => setOpenId(isOpen ? null : sec.id)}
                            >
                                <span className="font-black text-[#1C1C1E] text-sm leading-tight pr-4">{sec.title}</span>
                                {isOpen ? <ChevronUp size={18} className="text-[#7B5CF6] flex-shrink-0" /> : <ChevronDown size={18} className="text-[#9AA2B1] flex-shrink-0" />}
                            </button>
                            {isOpen && (
                                <div className="px-4 pb-4 border-t border-[#F4EEFF]">
                                    {sec.body && (
                                        <p className="text-[#1C1C1E] text-sm leading-relaxed whitespace-pre-wrap mt-3">{sec.body}</p>
                                    )}
                                    {sec.image_urls?.length > 0 && (
                                        <div className="flex flex-col gap-3 mt-3">
                                            {sec.image_urls.map((imgUrl, i) => {
                                                const caption = (sec.image_captions ?? [])[i]?.trim() || undefined;
                                                return (
                                                    <div key={i} className="flex flex-col gap-1">
                                                        <img
                                                            src={imgUrl}
                                                            alt={caption ?? `${sec.title} immagine ${i + 1}`}
                                                            className="w-full rounded-xl object-cover cursor-pointer active:opacity-80 transition-opacity"
                                                            onClick={() => setFullscreen({ src: imgUrl, caption })}
                                                            onDoubleClick={() => setFullscreen({ src: imgUrl, caption })}
                                                        />
                                                        {caption && (
                                                            <p className="text-[#9AA2B1] text-xs font-bold text-center px-2">{caption}</p>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
            {fullscreen && <ImageFullscreen src={fullscreen.src} caption={fullscreen.caption} onClose={() => setFullscreen(null)} />}
        </>
    );
}

/* ─── YouTube Embed ──────────────────────────────────────────── */
function getYouTubeId(url: string): string | null {
    const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    return match?.[1] ?? null;
}
function YouTubeEmbed({ url }: { url: string }) {
    const videoId = getYouTubeId(url);
    if (!videoId) return null;
    return (
        <div className="mb-6 rounded-2xl overflow-hidden border border-[#EEF0F4] bg-black aspect-video">
            <iframe
                src={`https://www.youtube.com/embed/${videoId}`}
                title="Video YouTube"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full"
            />
        </div>
    );
}

/* ─── Paywall Overlay ────────────────────────────────────────── */
function PaywallOverlay() {
    return (
        <div className="relative mt-4">
            {/* Blurred fake content */}
            <div className="rounded-2xl overflow-hidden pointer-events-none select-none" style={{ filter: 'blur(6px)', opacity: 0.4 }}>
                {[...Array(3)].map((_, i) => (
                    <div key={i} className="bg-white border border-[#EEF0F4] rounded-2xl p-4 mb-2">
                        <div className="h-4 bg-[#F4F4F8] rounded-full w-3/4 mb-2" />
                        <div className="h-3 bg-[#F4F4F8] rounded-full w-full mb-1" />
                        <div className="h-3 bg-[#F4F4F8] rounded-full w-5/6" />
                    </div>
                ))}
            </div>
            {/* Lock panel */}
            <div className="absolute inset-0 flex items-center justify-center">
                <div className="bg-white rounded-3xl shadow-xl border border-[#EEF0F4] p-6 max-w-xs w-full mx-4 text-center">
                    <div className="w-14 h-14 bg-[#F4EEFF] rounded-2xl flex items-center justify-center mx-auto mb-3">
                        <Lock size={26} className="text-[#7B5CF6]" />
                    </div>
                    <p className="font-black text-[#1C1C1E] text-base mb-1">Contenuto Premium</p>
                    <p className="text-[#9AA2B1] text-sm mb-4">Passa al piano Premium per leggere questo contenuto</p>
                    <Link
                        href="/pricing"
                        className="block bg-[#7B5CF6] text-white font-black text-sm px-4 py-2.5 rounded-xl active:scale-95 transition-transform"
                    >
                        ✦ Scopri Premium
                    </Link>
                </div>
            </div>
        </div>
    );
}

/* ─── Page ────────────────────────────────────────────────────── */
export default function BookDetailPage() {
    const { id } = useParams<{ id: string }>();
    const { profile } = useUserProfile();
    const [item, setItem] = useState<LibraryItem | null>(null);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);

    const userTier = (profile?.tier ?? 'free') as 'free' | 'premium';
    const isLocked = item?.tier === 'premium' && userTier !== 'premium';

    useEffect(() => {
        if (!id) return;
        getLibraryItemById(id).then(data => {
            if (!data) setNotFound(true);
            else setItem(data);
            setLoading(false);
        });
    }, [id]);

    if (loading) return (
        <div className="max-w-2xl mx-auto px-4 pt-6 pb-20">
            <div className="animate-pulse space-y-4">
                <div className="h-5 bg-[#F4F4F8] rounded-full w-32" />
                <div className="aspect-[3/4] bg-[#F4F4F8] rounded-3xl" />
                <div className="h-6 bg-[#F4F4F8] rounded-full w-2/3" />
                <div className="h-4 bg-[#F4F4F8] rounded-full w-full" />
            </div>
        </div>
    );

    if (notFound || !item) return (
        <div className="max-w-2xl mx-auto px-4 pt-6 pb-20 text-center">
            <p className="text-[#9AA2B1] font-bold">Contenuto non trovato</p>
            <Link href="/tools/books" className="text-[#7B5CF6] font-black text-sm mt-2 inline-block">← Torna alla libreria</Link>
        </div>
    );

    return (
        <div className="max-w-2xl mx-auto px-4 pt-6 pb-20">
            {/* Back */}
            <div className="mb-5">
                <Link href="/tools/books" className="inline-flex items-center gap-2 text-[#9AA2B1] font-bold text-sm hover:text-[#7B5CF6] transition-colors">
                    <ArrowLeft size={18} />
                    Libreria
                </Link>
            </div>

            {/* Cover strip */}
            {item.cover_urls.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-2 mb-5 scrollbar-none">
                    {item.cover_urls.map((url, i) => (
                        <img
                            key={i}
                            src={url}
                            alt={`${item.title} copertina ${i + 1}`}
                            className="h-48 w-auto rounded-2xl object-cover flex-shrink-0 shadow-md"
                        />
                    ))}
                </div>
            )}

            {/* Meta */}
            <div className="flex items-center gap-2 flex-wrap mb-2">
                <span className={`text-[11px] font-black px-2.5 py-1 rounded-full ${item.item_type === 'book' ? 'bg-[#7B5CF6] text-white' : 'bg-amber-500 text-white'}`}>
                    {item.item_type === 'book' ? 'Libro' : 'Schema'}
                </span>
                <span className={`text-[11px] font-black px-2.5 py-1 rounded-full ${item.tier === 'premium' ? 'bg-emerald-600 text-white' : 'bg-[#F4F4F8] text-[#9AA2B1]'}`}>
                    {item.tier === 'premium' ? '✦ Premium' : 'Gratuito'}
                </span>
                {item.language && <span className="text-[11px] font-bold text-[#9AA2B1]">{item.language}</span>}
            </div>
            <h1 className="text-2xl font-black text-[#1C1C1E] mb-2 leading-tight">{item.title}</h1>
            {item.description && <p className="text-[#9AA2B1] text-sm leading-relaxed mb-6">{item.description}</p>}

            {/* Video YouTube */}
            {item.video_url && <YouTubeEmbed url={item.video_url} />}

            {/* Content */}
            {isLocked ? (
                <PaywallOverlay />
            ) : item.content_type === 'pdf' && item.pdf_url ? (
                <PdfViewer url={item.pdf_url} />
            ) : item.content_type === 'sections' && item.sections?.length > 0 ? (
                <SectionsAccordion sections={item.sections} />
            ) : (
                <div className="bg-[#F4F4F8] rounded-2xl p-6 text-center text-[#9AA2B1] font-bold text-sm">
                    Nessun contenuto disponibile
                </div>
            )}
        </div>
    );
}
