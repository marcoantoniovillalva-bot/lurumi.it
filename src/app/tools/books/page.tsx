"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { BookOpen, ArrowLeft, Lock, ChevronRight, Search, X, Sparkles, Star } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useAuth } from "@/hooks/useAuth";
import type { LibraryItem } from "@/features/admin/actions/library";

/* ─── Cover Gallery Fullscreen ──────────────────────────────── */
function CoverGallery({ item, userTier, onClose }: {
    item: LibraryItem;
    userTier: 'free' | 'premium';
    onClose: () => void;
}) {
    const [idx, setIdx] = useState(0);
    const [scale, setScale] = useState(1);
    const [translate, setTranslate] = useState({ x: 0, y: 0 });
    const [descExpanded, setDescExpanded] = useState(false);
    const images = item.cover_urls;
    const isLocked = item.tier === 'premium' && userTier !== 'premium';
    const typeLabel = item.item_type === 'book' ? 'Libro' : 'Schema';
    const hasLongDesc = (item.description?.length ?? 0) > 80;

    // Touch tracking
    const touchStartX = useRef<number | null>(null);
    const touchStartY = useRef<number | null>(null);
    const pinchDist = useRef<number | null>(null);
    const doubleTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const tapCount = useRef(0);

    const resetZoom = () => { setScale(1); setTranslate({ x: 0, y: 0 }); };

    const goToSlide = useCallback((n: number) => {
        setIdx(n); resetZoom();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowRight' && scale === 1) goToSlide(Math.min(images.length - 1, idx + 1));
            if (e.key === 'ArrowLeft'  && scale === 1) goToSlide(Math.max(0, idx - 1));
        };
        window.addEventListener('keydown', handler);
        document.body.style.overflow = 'hidden';
        return () => { window.removeEventListener('keydown', handler); document.body.style.overflow = ''; };
    }, [images.length, idx, scale, onClose, goToSlide]);

    const handleTouchStart = (e: React.TouchEvent) => {
        if (e.touches.length === 2) {
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            pinchDist.current = Math.hypot(dx, dy);
        } else {
            touchStartX.current = e.touches[0].clientX;
            touchStartY.current = e.touches[0].clientY;
        }
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (e.touches.length === 2 && pinchDist.current !== null) {
            e.preventDefault();
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            const newDist = Math.hypot(dx, dy);
            const ratio = newDist / pinchDist.current;
            pinchDist.current = newDist;
            setScale(s => Math.min(5, Math.max(1, s * ratio)));
        } else if (e.touches.length === 1 && scale > 1) {
            e.preventDefault();
            if (touchStartX.current === null || touchStartY.current === null) return;
            const dx = e.touches[0].clientX - touchStartX.current;
            const dy = e.touches[0].clientY - touchStartY.current;
            touchStartX.current = e.touches[0].clientX;
            touchStartY.current = e.touches[0].clientY;
            setTranslate(t => ({ x: t.x + dx, y: t.y + dy }));
        }
    };

    const handleTouchEnd = (e: React.TouchEvent) => {
        pinchDist.current = null;
        // Swipe per cambiare slide (solo se non zoomato)
        if (scale === 1 && touchStartX.current !== null && e.changedTouches.length === 1) {
            const diff = touchStartX.current - e.changedTouches[0].clientX;
            if (Math.abs(diff) > 50) {
                if (diff > 0) goToSlide(Math.min(images.length - 1, idx + 1));
                else goToSlide(Math.max(0, idx - 1));
            }
        }
        // Double tap → reset zoom
        tapCount.current += 1;
        if (tapCount.current === 1) {
            doubleTapTimer.current = setTimeout(() => { tapCount.current = 0; }, 280);
        } else if (tapCount.current === 2) {
            if (doubleTapTimer.current) clearTimeout(doubleTapTimer.current);
            tapCount.current = 0;
            scale > 1 ? resetZoom() : setScale(2);
        }
        touchStartX.current = null;
        touchStartY.current = null;
    };

    return (
        <div className="fixed inset-0 z-[99999] bg-black flex flex-col">
            {/* Header compatto */}
            <div className="flex items-center justify-between px-4 py-2 bg-black/60 flex-shrink-0">
                <div>
                    <p className="text-white font-black text-sm leading-tight truncate max-w-[220px]">{item.title}</p>
                    <p className="text-white/40 text-[11px] font-bold">
                        {images.length > 1 ? `${idx + 1} / ${images.length} · ` : ''}
                        {scale > 1 ? `${Math.round(scale * 100)}% — doppio tap per reset` : 'Pizzica per zoomare'}
                    </p>
                </div>
                <button onClick={onClose} className="w-9 h-9 flex items-center justify-center text-white bg-white/10 rounded-full active:scale-90 transition-transform">
                    <X size={20} />
                </button>
            </div>

            {/* Immagine — flex-1, occupa tutto lo spazio disponibile */}
            <div
                className="flex-1 flex items-center justify-center relative overflow-hidden"
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                style={{ touchAction: scale > 1 ? 'none' : 'pan-y' }}
            >
                <img
                    src={images[idx]}
                    alt={item.title}
                    className="max-w-full max-h-full object-contain select-none"
                    draggable={false}
                    style={{
                        transform: `scale(${scale}) translate(${translate.x / scale}px, ${translate.y / scale}px)`,
                        transformOrigin: 'center center',
                        transition: scale === 1 ? 'transform 0.25s ease' : 'none',
                        cursor: scale > 1 ? 'grab' : 'default',
                        willChange: 'transform',
                    }}
                />
                {/* Frecce navigazione — solo se non zoomato */}
                {scale === 1 && images.length > 1 && (
                    <>
                        {idx > 0 && (
                            <button onClick={() => goToSlide(idx - 1)} className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/40 text-white rounded-full flex items-center justify-center active:scale-90 transition-transform">
                                <ChevronRight size={20} className="rotate-180" />
                            </button>
                        )}
                        {idx < images.length - 1 && (
                            <button onClick={() => goToSlide(idx + 1)} className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/40 text-white rounded-full flex items-center justify-center active:scale-90 transition-transform">
                                <ChevronRight size={20} />
                            </button>
                        )}
                    </>
                )}
            </div>

            {/* Dots */}
            {images.length > 1 && scale === 1 && (
                <div className="flex justify-center gap-1.5 py-2 bg-black/60 flex-shrink-0">
                    {images.map((_, i) => (
                        <button key={i} onClick={() => goToSlide(i)} className={`w-2 h-2 rounded-full transition-all ${i === idx ? 'bg-white scale-125' : 'bg-white/30'}`} />
                    ))}
                </div>
            )}

            {/* CTA panel — compatto, non ruba spazio all'immagine */}
            <div className="bg-black/90 px-4 py-3 flex-shrink-0">
                {/* Badge fila */}
                <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${item.item_type === 'book' ? 'bg-[#7B5CF6] text-white' : 'bg-amber-500 text-white'}`}>
                        {typeLabel}
                    </span>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${item.tier === 'premium' ? 'bg-emerald-600 text-white' : 'bg-white/20 text-white'}`}>
                        {item.tier === 'premium' ? '✦ Premium' : 'Gratuito'}
                    </span>
                    {item.language && <span className="text-[10px] font-bold text-white/40">{item.language}</span>}
                </div>

                {/* Descrizione espandibile */}
                {item.description && (
                    <div className="mb-2">
                        <p className={`text-white/70 text-xs font-medium leading-relaxed ${descExpanded ? '' : 'line-clamp-2'}`}>
                            {item.description}
                        </p>
                        {hasLongDesc && (
                            <button
                                onClick={() => setDescExpanded(v => !v)}
                                className="text-[#A78BFA] text-[11px] font-black mt-0.5 active:opacity-70 transition-opacity"
                            >
                                {descExpanded ? 'Mostra meno ↑' : 'Leggi tutto ↓'}
                            </button>
                        )}
                    </div>
                )}

                {isLocked ? (
                    /* ── Paywall ── */
                    <div className="flex items-center gap-3">
                        {/* Testo + vantaggi */}
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-1">
                                <Lock size={13} className="text-[#A78BFA] flex-shrink-0" />
                                <p className="text-white font-black text-sm leading-none">Solo per utenti Premium</p>
                            </div>
                            <div className="flex flex-col gap-0.5">
                                {[
                                    { icon: <BookOpen size={11} />, text: 'Tutti gli schemi e libri premium' },
                                    { icon: <Sparkles size={11} />, text: '300 crediti AI al mese' },
                                    { icon: <Star size={11} />, text: 'Contenuti esclusivi' },
                                ].map(({ icon, text }, i) => (
                                    <div key={i} className="flex items-center gap-1.5">
                                        <span className="text-[#A78BFA] flex-shrink-0">{icon}</span>
                                        <span className="text-white/70 text-xs font-semibold">{text}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        {/* Bottone verticale a destra */}
                        <Link
                            href="/pricing"
                            onClick={onClose}
                            className="flex-shrink-0 flex flex-col items-center justify-center gap-1 px-4 py-3 bg-gradient-to-b from-[#7B5CF6] to-[#6D48F0] text-white font-black text-xs rounded-2xl active:scale-95 transition-transform shadow-lg shadow-[#7B5CF6]/40 text-center"
                        >
                            <Sparkles size={16} />
                            <span>Passa a<br />Premium</span>
                        </Link>
                    </div>
                ) : (
                    /* ── Apri contenuto ── */
                    <Link
                        href={`/tools/books/${item.id}`}
                        onClick={onClose}
                        className="flex items-center justify-center gap-2 w-full h-11 bg-[#7B5CF6] text-white font-black text-sm rounded-xl active:scale-[0.98] transition-transform"
                    >
                        <BookOpen size={16} />
                        Apri {typeLabel}
                        <ChevronRight size={16} />
                    </Link>
                )}
            </div>
        </div>
    );
}

/* ─── Library Card ────────────────────────────────────────── */
function LibraryCard({ item, userTier, onCoverClick }: {
    item: LibraryItem;
    userTier: 'free' | 'premium';
    onCoverClick: () => void;
}) {
    const isLocked = item.tier === 'premium' && userTier !== 'premium';
    const cover = item.cover_urls[0] ?? null;

    return (
        <div className="bg-white rounded-[20px] border border-[#EEF0F4] overflow-hidden shadow-sm active:scale-[0.98] transition-transform">
            {/* Cover — click apre fullscreen per tutti */}
            <div
                className="relative aspect-[3/4] bg-[#F4F4F8] cursor-pointer"
                onClick={item.cover_urls.length > 0 ? onCoverClick : undefined}
            >
                {cover ? (
                    <img src={cover} alt={item.title} className="w-full h-full object-cover" draggable={false} />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-[#9AA2B1]">
                        <BookOpen size={40} />
                    </div>
                )}
                {isLocked && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <div className="bg-white/90 rounded-full p-2">
                            <Lock size={20} className="text-[#7B5CF6]" />
                        </div>
                    </div>
                )}
                <div className="absolute top-2 left-2">
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full shadow-sm ${item.item_type === 'book' ? 'bg-[#7B5CF6] text-white' : 'bg-amber-500 text-white'}`}>
                        {item.item_type === 'book' ? 'Libro' : 'Schema'}
                    </span>
                </div>
                {item.tier === 'premium' && (
                    <div className="absolute top-2 right-2">
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-600 text-white shadow-sm">✦</span>
                    </div>
                )}
            </div>
            {/* Info + CTA */}
            <Link href={`/tools/books/${item.id}`} className="block p-3">
                <p className="font-black text-[#1C1C1E] text-sm leading-tight line-clamp-2 mb-1">{item.title}</p>
                {item.language && <p className="text-[10px] font-bold text-[#9AA2B1] mb-2">{item.language}</p>}
                <div className={`w-full py-1.5 rounded-xl text-[11px] font-black text-center transition-colors ${isLocked ? 'bg-[#F4EEFF] text-[#7B5CF6]' : 'bg-[#7B5CF6] text-white'}`}>
                    {isLocked ? '🔒 Passa a Premium' : 'Apri →'}
                </div>
            </Link>
        </div>
    );
}

/* ─── Page ─────────────────────────────────────────────────── */
export default function BooksPage() {
    const { user } = useAuth();
    const { profile } = useUserProfile();
    const [items, setItems] = useState<LibraryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [galleryItem, setGalleryItem] = useState<LibraryItem | null>(null);
    const userTier = (profile?.tier ?? 'free') as 'free' | 'premium';

    const fetchItems = useCallback(async () => {
        const res = await fetch('/api/library');
        if (res.ok) {
            const data = await res.json();
            setItems(data.items ?? []);
        }
        setLoading(false);
    }, []);

    useEffect(() => { fetchItems(); }, [fetchItems]);

    // Realtime subscription for new/updated library items
    useEffect(() => {
        const supabase = createClient();
        const channel = supabase
            .channel('library-public')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'library_items' }, () => {
                fetchItems();
            })
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [fetchItems]);

    const filtered = items.filter(it =>
        it.title.toLowerCase().includes(search.toLowerCase()) ||
        (it.description ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (it.language ?? '').toLowerCase().includes(search.toLowerCase())
    );

    return (
        <>
            <div className="max-w-2xl mx-auto px-4 pt-6 pb-20">
                <div className="mb-6">
                    <Link href="/tools" className="inline-flex items-center gap-2 text-[#9AA2B1] font-bold text-sm hover:text-[#7B5CF6] transition-colors">
                        <ArrowLeft size={18} />
                        Torna agli Utensili
                    </Link>
                </div>

                <h1 className="text-3xl font-black mb-1">Libreria</h1>
                <p className="text-[#9AA2B1] text-sm mb-5">Schemi e libri di uncinetto</p>

                {/* Search */}
                <div className="relative mb-6">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9AA2B1]" />
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Cerca per titolo, lingua…"
                        className="w-full bg-white border border-[#EEF0F4] rounded-2xl pl-9 pr-10 py-2.5 text-sm font-bold text-[#1C1C1E] placeholder:text-[#9AA2B1] outline-none focus:border-[#7B5CF6] transition-colors"
                    />
                    {search && (
                        <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9AA2B1] active:scale-90 transition-transform">
                            <X size={16} />
                        </button>
                    )}
                </div>

                {loading ? (
                    <div className="grid grid-cols-2 gap-3">
                        {[...Array(4)].map((_, i) => (
                            <div key={i} className="bg-white rounded-[20px] border border-[#EEF0F4] overflow-hidden shadow-sm animate-pulse">
                                <div className="aspect-[3/4] bg-[#F4F4F8]" />
                                <div className="p-3 space-y-2">
                                    <div className="h-3 bg-[#F4F4F8] rounded-full w-3/4" />
                                    <div className="h-3 bg-[#F4F4F8] rounded-full w-1/2" />
                                    <div className="h-6 bg-[#F4F4F8] rounded-xl" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="bg-white rounded-2xl p-8 border border-[#EEF0F4] text-center">
                        <div className="w-16 h-16 bg-[#F4EEFF] text-[#7B5CF6] rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <BookOpen size={32} />
                        </div>
                        <h3 className="text-lg font-black text-[#1C1C1E] mb-1">
                            {search ? 'Nessun risultato' : 'Libreria vuota'}
                        </h3>
                        <p className="text-[#9AA2B1] text-sm">
                            {search ? `Nessun elemento corrisponde a "${search}"` : 'Non ci sono ancora libri o schemi pubblicati'}
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-3">
                        {filtered.map(item => (
                            <LibraryCard
                                key={item.id}
                                item={item}
                                userTier={userTier}
                                onCoverClick={() => setGalleryItem(item)}
                            />
                        ))}
                    </div>
                )}

                {/* Premium upsell banner */}
                {!loading && userTier !== 'premium' && filtered.some(it => it.tier === 'premium') && (
                    <div className="mt-6 bg-gradient-to-r from-[#7B5CF6] to-[#9B7BFF] rounded-2xl p-4 text-white flex items-center gap-4">
                        <div className="flex-1">
                            <p className="font-black text-sm">Sblocca tutti i contenuti</p>
                            <p className="text-white/70 text-xs mt-0.5">Accedi a tutti gli schemi e libri con il piano Premium</p>
                        </div>
                        <Link href="/pricing" className="bg-white text-[#7B5CF6] font-black text-xs px-3 py-2 rounded-xl flex-shrink-0 active:scale-95 transition-transform">
                            Premium
                        </Link>
                    </div>
                )}
            </div>

            {galleryItem && (
                <CoverGallery item={galleryItem} userTier={userTier} onClose={() => setGalleryItem(null)} />
            )}
        </>
    );
}
