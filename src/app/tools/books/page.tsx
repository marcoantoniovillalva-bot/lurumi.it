"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { BookOpen, ArrowLeft, Lock, ChevronRight, Search, X } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useAuth } from "@/hooks/useAuth";
import type { LibraryItem } from "@/features/admin/actions/library";

/* ─── Cover Gallery Fullscreen ──────────────────────────────── */
function CoverGallery({ item, onClose }: { item: LibraryItem; onClose: () => void }) {
    const [idx, setIdx] = useState(0);
    const touchStartX = useRef<number | null>(null);
    const images = item.cover_urls;

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowRight') setIdx(i => Math.min(images.length - 1, i + 1));
            if (e.key === 'ArrowLeft') setIdx(i => Math.max(0, i - 1));
        };
        window.addEventListener('keydown', handler);
        document.body.style.overflow = 'hidden';
        return () => { window.removeEventListener('keydown', handler); document.body.style.overflow = ''; };
    }, [images.length, onClose]);

    return (
        <div className="fixed inset-0 z-[99999] bg-black flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 bg-black/60 flex-shrink-0">
                <div>
                    <p className="text-white font-black text-base leading-tight truncate max-w-[220px]">{item.title}</p>
                    <p className="text-white/50 text-xs font-bold">{idx + 1} / {images.length}</p>
                </div>
                <button onClick={onClose} className="w-10 h-10 flex items-center justify-center text-white bg-white/10 rounded-full active:scale-90 transition-transform">
                    <X size={22} />
                </button>
            </div>
            <div
                className="flex-1 flex items-center justify-center relative overflow-hidden"
                onTouchStart={e => { touchStartX.current = e.touches[0].clientX; }}
                onTouchEnd={e => {
                    if (touchStartX.current === null) return;
                    const diff = touchStartX.current - e.changedTouches[0].clientX;
                    if (Math.abs(diff) > 50) {
                        if (diff > 0) setIdx(i => Math.min(images.length - 1, i + 1));
                        else setIdx(i => Math.max(0, i - 1));
                    }
                    touchStartX.current = null;
                }}
            >
                <img src={images[idx]} alt={item.title} className="max-w-full max-h-full object-contain select-none" draggable={false} />
                {images.length > 1 && (
                    <>
                        {idx > 0 && (
                            <button onClick={() => setIdx(i => i - 1)} className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/40 text-white rounded-full flex items-center justify-center active:scale-90 transition-transform">
                                <ChevronRight size={20} className="rotate-180" />
                            </button>
                        )}
                        {idx < images.length - 1 && (
                            <button onClick={() => setIdx(i => i + 1)} className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/40 text-white rounded-full flex items-center justify-center active:scale-90 transition-transform">
                                <ChevronRight size={20} />
                            </button>
                        )}
                    </>
                )}
            </div>
            {/* Dots */}
            {images.length > 1 && (
                <div className="flex justify-center gap-1.5 py-3 bg-black/60 flex-shrink-0">
                    {images.map((_, i) => (
                        <button key={i} onClick={() => setIdx(i)} className={`w-2 h-2 rounded-full transition-all ${i === idx ? 'bg-white scale-125' : 'bg-white/30'}`} />
                    ))}
                </div>
            )}
            {/* Info panel */}
            <div className="bg-black/80 px-5 py-4 flex-shrink-0">
                <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[11px] font-black px-2 py-0.5 rounded-full ${item.item_type === 'book' ? 'bg-[#7B5CF6] text-white' : 'bg-amber-500 text-white'}`}>
                        {item.item_type === 'book' ? 'Libro' : 'Schema'}
                    </span>
                    <span className={`text-[11px] font-black px-2 py-0.5 rounded-full ${item.tier === 'premium' ? 'bg-emerald-600 text-white' : 'bg-white/20 text-white'}`}>
                        {item.tier === 'premium' ? '✦ Premium' : 'Gratuito'}
                    </span>
                    {item.language && <span className="text-[11px] font-bold text-white/50">{item.language}</span>}
                </div>
                {item.description && <p className="text-white/70 text-xs leading-relaxed line-clamp-3">{item.description}</p>}
            </div>
        </div>
    );
}

/* ─── Library Card ────────────────────────────────────────── */
function LibraryCard({ item, userTier, onCoverDoubleClick }: {
    item: LibraryItem;
    userTier: 'free' | 'premium';
    onCoverDoubleClick: () => void;
}) {
    const isLocked = item.tier === 'premium' && userTier !== 'premium';
    const cover = item.cover_urls[0] ?? null;
    const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const tapCount = useRef(0);

    const handleCoverClick = () => {
        tapCount.current += 1;
        if (tapCount.current === 1) {
            tapTimer.current = setTimeout(() => { tapCount.current = 0; }, 300);
        } else if (tapCount.current === 2) {
            if (tapTimer.current) clearTimeout(tapTimer.current);
            tapCount.current = 0;
            onCoverDoubleClick();
        }
    };

    return (
        <div className="bg-white rounded-[20px] border border-[#EEF0F4] overflow-hidden shadow-sm active:scale-[0.98] transition-transform">
            {/* Cover */}
            <div
                className="relative aspect-[3/4] bg-[#F4F4F8] cursor-pointer"
                onClick={handleCoverClick}
                onDoubleClick={onCoverDoubleClick}
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
                                onCoverDoubleClick={() => item.cover_urls.length > 0 && setGalleryItem(item)}
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
                <CoverGallery item={galleryItem} onClose={() => setGalleryItem(null)} />
            )}
        </>
    );
}
