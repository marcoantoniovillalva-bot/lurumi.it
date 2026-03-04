"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { ArrowLeft, ChevronDown, ChevronUp, Lock, ZoomIn, ZoomOut, ChevronRight, ChevronLeft, X } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getLibraryItemById } from "@/features/admin/actions/library";
import { useUserProfile } from "@/hooks/useUserProfile";
import type { LibraryItem, LibrarySection } from "@/features/admin/actions/library";

/* ─── PDF Viewer ─────────────────────────────────────────────── */
function PdfViewer({ url }: { url: string }) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [numPages, setNumPages] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [scale, setScale] = useState(1.2);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const pdfRef = useRef<any>(null);
    const renderTaskRef = useRef<any>(null);

    const renderPage = useCallback(async (pdf: any, page: number, sc: number) => {
        if (!canvasRef.current) return;
        // Cancel previous render
        if (renderTaskRef.current) {
            try { renderTaskRef.current.cancel(); } catch {}
        }
        const pdfPage = await pdf.getPage(page);
        const viewport = pdfPage.getViewport({ scale: sc });
        const canvas = canvasRef.current;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        renderTaskRef.current = pdfPage.render({ canvasContext: ctx, viewport });
        try { await renderTaskRef.current.promise; } catch {}
    }, []);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const pdfjs = await import('pdfjs-dist');
                const version = pdfjs.version;
                pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${version}/build/pdf.worker.min.mjs`;
                const pdf = await pdfjs.getDocument(url).promise;
                if (cancelled) return;
                pdfRef.current = pdf;
                setNumPages(pdf.numPages);
                setLoading(false);
                await renderPage(pdf, 1, scale);
            } catch (e: any) {
                if (!cancelled) setError('Impossibile caricare il PDF. Riprova più tardi.');
                setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (pdfRef.current) renderPage(pdfRef.current, currentPage, scale);
    }, [currentPage, scale, renderPage]);

    // Pinch-to-zoom
    const lastPinchDist = useRef<number | null>(null);
    const handleTouchStart = (e: React.TouchEvent) => {
        if (e.touches.length === 2) {
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            lastPinchDist.current = Math.hypot(dx, dy);
        }
    };
    const handleTouchMove = (e: React.TouchEvent) => {
        if (e.touches.length === 2 && lastPinchDist.current !== null) {
            e.preventDefault();
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            const newDist = Math.hypot(dx, dy);
            const ratio = newDist / lastPinchDist.current;
            lastPinchDist.current = newDist;
            setScale(s => Math.min(4, Math.max(0.5, s * ratio)));
        }
    };

    if (loading) return (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-8 h-8 border-4 border-[#7B5CF6] border-t-transparent rounded-full animate-spin" />
            <p className="text-[#9AA2B1] text-sm font-bold">Caricamento PDF…</p>
        </div>
    );
    if (error) return (
        <div className="text-center py-16 text-red-500 font-bold">{error}</div>
    );

    return (
        <div className="flex flex-col gap-3">
            {/* Toolbar */}
            <div className="flex items-center justify-between bg-white border border-[#EEF0F4] rounded-2xl px-4 py-2.5 sticky top-16 z-10 shadow-sm">
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => setScale(s => Math.max(0.5, s - 0.2))}
                        className="w-8 h-8 flex items-center justify-center rounded-xl text-[#7B5CF6] bg-[#F4EEFF] active:scale-90 transition-transform"
                    >
                        <ZoomOut size={16} />
                    </button>
                    <span className="text-xs font-black text-[#1C1C1E] w-12 text-center">{Math.round(scale * 100)}%</span>
                    <button
                        onClick={() => setScale(s => Math.min(4, s + 0.2))}
                        className="w-8 h-8 flex items-center justify-center rounded-xl text-[#7B5CF6] bg-[#F4EEFF] active:scale-90 transition-transform"
                    >
                        <ZoomIn size={16} />
                    </button>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage <= 1}
                        className="w-8 h-8 flex items-center justify-center rounded-xl text-[#7B5CF6] bg-[#F4EEFF] disabled:opacity-30 active:scale-90 transition-transform"
                    >
                        <ChevronLeft size={16} />
                    </button>
                    <span className="text-xs font-black text-[#1C1C1E]">{currentPage} / {numPages}</span>
                    <button
                        onClick={() => setCurrentPage(p => Math.min(numPages, p + 1))}
                        disabled={currentPage >= numPages}
                        className="w-8 h-8 flex items-center justify-center rounded-xl text-[#7B5CF6] bg-[#F4EEFF] disabled:opacity-30 active:scale-90 transition-transform"
                    >
                        <ChevronRight size={16} />
                    </button>
                </div>
            </div>
            {/* Canvas */}
            <div
                ref={containerRef}
                className="overflow-auto rounded-2xl border border-[#EEF0F4] bg-[#F4F4F8] touch-pan-x touch-pan-y"
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                style={{ touchAction: 'pan-x pan-y' }}
            >
                <canvas ref={canvasRef} className="block mx-auto" />
            </div>
        </div>
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
