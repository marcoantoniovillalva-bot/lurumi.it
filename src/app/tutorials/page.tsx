"use client";

import React, { useState, useEffect } from "react";
import { Search, ListFilter, Plus, X, Youtube, MoreVertical, Pencil, Trash2, Share2, Check, ExternalLink } from "lucide-react";
import { useProjectStore, Tutorial } from "@/features/projects/store/useProjectStore";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCharacterTheme } from "@/hooks/useCharacterTheme";

export default function TutorialsPage() {
    const { tutorials, addTutorial, deleteTutorial, updateTutorial } = useProjectStore();
    const { user } = useAuth();
    const { getUrl } = useCharacterTheme();
    const supabase = createClient();
    const [searchQuery, setSearchQuery] = useState("");
    const [showSearch, setShowSearch] = useState(false);
    const [sortOrder, setSortOrder] = useState<'recent' | 'oldest' | 'alpha'>('recent');
    const [showSortMenu, setShowSortMenu] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);
    const [newUrl, setNewUrl] = useState("");
    const [newTitle, setNewTitle] = useState("");

    // Three-dots menu
    const [menuId, setMenuId] = useState<string | null>(null);
    const [renamingId, setRenamingId] = useState<string | null>(null);
    const [renameValue, setRenameValue] = useState('');

    // Realtime: sincronizza tutorial list da altri dispositivi/tab
    useEffect(() => {
        if (!user) return;
        const channel = supabase
            .channel(`tutorials-list-${user.id}`)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tutorials', filter: `user_id=eq.${user.id}` }, (payload) => {
                if (!payload.new?.id) return;
                const t = payload.new as Record<string, any>;
                const exists = useProjectStore.getState().tutorials.some(x => x.id === t.id);
                if (!exists) {
                    addTutorial({
                        id: t.id,
                        title: t.title,
                        url: t.url ?? '',
                        videoId: t.video_id ?? '',
                        playlistId: t.playlist_id ?? '',
                        thumbUrl: t.thumb_url ?? '',
                        createdAt: t.created_at ? new Date(t.created_at).getTime() : Date.now(),
                        counter: t.counter ?? 0,
                        timer: t.timer_seconds ?? 0,
                        secs: t.secs ?? [],
                        notesHtml: t.notes_html ?? '',
                    });
                }
            })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tutorials', filter: `user_id=eq.${user.id}` }, (payload) => {
                if (!payload.new?.id) return;
                const t = payload.new as Record<string, any>;
                updateTutorial(t.id, {
                    title: t.title,
                    counter: t.counter ?? 0,
                    timer: t.timer_seconds ?? 0,
                    secs: t.secs ?? [],
                    notesHtml: t.notes_html ?? '',
                    transcriptData: t.transcript_data ?? undefined,
                });
            })
            .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'tutorials' }, (payload) => {
                if (!payload.old?.id) return;
                deleteTutorial(payload.old.id);
            })
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

    const parseYouTube = (url: string) => {
        try {
            const u = new URL(url);
            let videoId = "";
            let playlistId = u.searchParams.get("list") || "";

            if (u.hostname.includes("youtu.be")) {
                videoId = u.pathname.slice(1).split("/")[0];
            } else if (u.hostname.includes("youtube.com")) {
                if (u.pathname.startsWith("/watch")) videoId = u.searchParams.get("v") || "";
                else if (u.pathname.startsWith("/shorts/")) videoId = u.pathname.split("/")[2];
            }
            return { videoId, playlistId };
        } catch { return null; }
    };

    const handleAddTutorial = () => {
        const parsed = parseYouTube(newUrl);
        if (!parsed || !newTitle) {
            alert("Inserisci un link YouTube valido e un titolo");
            return;
        }

        const { videoId, playlistId } = parsed;
        const tutorial: Tutorial = {
            id: Math.random().toString(36).slice(2, 9),
            title: newTitle,
            url: newUrl,
            videoId,
            playlistId,
            thumbUrl: videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : "https://placehold.co/120x120?text=Playlist",
            createdAt: Date.now(),
            counter: 0,
            timer: 0,
            secs: [],
            notesHtml: ""
        };

        addTutorial(tutorial);
        setShowAddModal(false);
        setNewUrl("");
        setNewTitle("");

        // Sync to Supabase in background if logged in
        if (user) {
            supabase.from('tutorials').upsert({
                id: tutorial.id,
                user_id: user.id,
                title: tutorial.title,
                url: tutorial.url,
                video_id: tutorial.videoId,
                playlist_id: tutorial.playlistId,
                thumb_url: tutorial.thumbUrl,
                counter: 0,
                timer_seconds: 0,
                notes_html: '',
            }).then(({ error }) => { if (error) console.warn('Tutorial upsert failed:', error.message); });
        }
    };

    const handleDelete = (id: string) => {
        if (!confirm('Eliminare questo tutorial?')) return;
        deleteTutorial(id);
        setMenuId(null);

        // Sync delete to Supabase in background
        if (user) {
            supabase.from('tutorials').delete().eq('id', id).eq('user_id', user.id).then(({ error }) => {
                if (error) console.warn('Tutorial delete failed:', error.message);
            });
        }
    };

    const startRename = (tutorial: Tutorial) => {
        setRenamingId(tutorial.id);
        setRenameValue(tutorial.title);
        setMenuId(null);
    };

    const saveRename = (id: string) => {
        if (!renameValue.trim()) return;
        const newTitle = renameValue.trim();
        updateTutorial(id, { title: newTitle });
        setRenamingId(null);

        if (user) {
            supabase.from('tutorials').update({ title: newTitle }).eq('id', id).eq('user_id', user.id).then(({ error }) => {
                if (error) console.warn('Tutorial rename sync failed:', error.message);
            });
        }
    };

    const handleShare = (tutorial: Tutorial) => {
        if (navigator.share) {
            navigator.share({ title: tutorial.title, url: tutorial.url });
        } else {
            navigator.clipboard.writeText(tutorial.url);
            alert('Link copiato!');
        }
        setMenuId(null);
    };

    const handleOpenYouTube = (url: string) => {
        window.open(url, '_blank');
        setMenuId(null);
    };

    const sortLabels: Record<string, string> = { recent: 'Recenti', oldest: 'Meno recenti', alpha: 'A → Z' };

    const filteredTutorials = tutorials
        .filter(t => t.title.toLowerCase().includes(searchQuery.toLowerCase()))
        .sort((a, b) => {
            if (sortOrder === 'alpha') return a.title.localeCompare(b.title);
            if (sortOrder === 'oldest') return a.createdAt - b.createdAt;
            return b.createdAt - a.createdAt;
        });

    return (
        <div className="max-w-2xl mx-auto px-4 pt-6 pb-20">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h1 className="text-3xl font-black text-[#1C1C1E] mb-1">Tutorial</h1>
                    <p className="text-[#9AA2B1] text-sm font-medium">I tuoi video salvati</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => { setShowSearch(s => !s); if (showSearch) setSearchQuery(''); }}
                        className={`w-10 h-10 flex items-center justify-center border rounded-xl transition-all active:scale-90 ${showSearch ? 'bg-[#7B5CF6] border-[#7B5CF6] text-white' : 'bg-white border-[#EEF0F4] text-[#9AA2B1]'}`}
                    >
                        <Search size={20} />
                    </button>
                    <div className="relative">
                        <button
                            onClick={() => setShowSortMenu(s => !s)}
                            className="w-10 h-10 flex items-center justify-center bg-white border border-[#EEF0F4] rounded-xl text-[#9AA2B1] transition-transform active:scale-90"
                        >
                            <ListFilter size={20} />
                        </button>
                        {showSortMenu && (
                            <>
                                <div className="fixed inset-0 z-10" onClick={() => setShowSortMenu(false)} />
                                <div className="absolute right-0 top-12 z-20 bg-white rounded-2xl shadow-xl border border-[#EEF0F4] p-1.5 w-44 animate-in fade-in zoom-in duration-150">
                                    {(['recent', 'oldest', 'alpha'] as const).map(opt => (
                                        <button
                                            key={opt}
                                            onClick={() => { setSortOrder(opt); setShowSortMenu(false); }}
                                            className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-bold rounded-xl transition-colors ${sortOrder === opt ? 'bg-[#F4EEFF] text-[#7B5CF6]' : 'text-[#1C1C1E] hover:bg-[#F4F4F8]'}`}
                                        >
                                            {sortLabels[opt]}
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Expandable search bar */}
            {showSearch && (
                <div className="relative mb-4 animate-in fade-in slide-in-from-top-1 duration-200">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7B5CF6]" size={18} />
                    <input
                        autoFocus
                        type="text"
                        placeholder="Cerca tutorial..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full h-11 pl-10 pr-10 bg-white border border-[#E6DAFF] rounded-xl outline-none focus:border-[#7B5CF6] transition-colors text-sm font-medium"
                    />
                    {searchQuery && (
                        <button onClick={() => setSearchQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center text-[#9AA2B1]">
                            <X size={16} />
                        </button>
                    )}
                </div>
            )}

            {/* Tutorials List */}
            <div className="grid gap-3.5">
                {filteredTutorials.length > 0 ? (
                    filteredTutorials.map((t) => (
                        <div key={t.id} className="bg-white p-3.5 rounded-2xl border border-[#EEF0F4] shadow-sm flex items-center gap-3 min-w-0 active:scale-[0.98] transition-transform">
                            <Link href={`/tutorials/${t.id}`} className="flex-1 flex items-center gap-4 min-w-0">
                                <div className="w-20 h-14 bg-black rounded-xl overflow-hidden relative group flex-shrink-0">
                                    <img src={t.thumbUrl} alt={t.title} className="w-full h-full object-cover opacity-80 group-hover:scale-110 transition-transform" />
                                    <div className="absolute inset-0 flex items-center justify-center text-white">
                                        <Youtube size={20} />
                                    </div>
                                </div>
                                <div className="flex-1 min-w-0">
                                    {renamingId === t.id ? (
                                        <div className="flex items-center gap-1 min-w-0" onClick={e => e.preventDefault()}>
                                            <input
                                                autoFocus
                                                value={renameValue}
                                                onChange={e => setRenameValue(e.target.value)}
                                                onKeyDown={e => { if (e.key === 'Enter') saveRename(t.id); if (e.key === 'Escape') setRenamingId(null); }}
                                                className="min-w-0 flex-1 h-8 px-2 border border-[#7B5CF6] rounded-lg text-sm font-bold outline-none"
                                            />
                                            <button onClick={() => saveRename(t.id)} className="flex-shrink-0 text-green-500 p-1"><Check size={14} /></button>
                                            <button onClick={() => setRenamingId(null)} className="flex-shrink-0 text-[#9AA2B1] p-1"><X size={14} /></button>
                                        </div>
                                    ) : (
                                        <>
                                            <h3 className="font-bold text-[#1C1C1E] truncate">{t.title}</h3>
                                            <p className="text-xs text-[#9AA2B1] font-medium uppercase tracking-wider">
                                                {t.playlistId ? 'Playlist' : 'Video'} • {new Date(t.createdAt).toLocaleDateString()}
                                            </p>
                                        </>
                                    )}
                                </div>
                            </Link>

                            {/* Three-dots menu */}
                            <div className="relative flex-shrink-0">
                                <button
                                    onClick={() => setMenuId(menuId === t.id ? null : t.id)}
                                    className="w-9 h-9 flex items-center justify-center rounded-xl bg-[#FAFAFC] text-[#9AA2B1] hover:text-[#1C1C1E] transition-colors"
                                >
                                    <MoreVertical size={18} />
                                </button>
                                {menuId === t.id && (
                                    <>
                                        <div className="fixed inset-0 z-10" onClick={() => setMenuId(null)} />
                                        <div className="absolute right-0 top-10 z-20 bg-white rounded-2xl shadow-xl border border-[#EEF0F4] p-1.5 w-48 animate-in fade-in zoom-in duration-150">
                                            <button
                                                onClick={() => startRename(t)}
                                                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-bold text-[#1C1C1E] hover:bg-[#F4F4F8] rounded-xl"
                                            >
                                                <Pencil size={15} className="text-[#7B5CF6]" />
                                                Rinomina
                                            </button>
                                            <button
                                                onClick={() => handleOpenYouTube(t.url)}
                                                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-bold text-[#1C1C1E] hover:bg-[#F4F4F8] rounded-xl"
                                            >
                                                <ExternalLink size={15} className="text-[#7B5CF6]" />
                                                Apri su YouTube
                                            </button>
                                            <button
                                                onClick={() => handleShare(t)}
                                                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-bold text-[#1C1C1E] hover:bg-[#F4F4F8] rounded-xl"
                                            >
                                                <Share2 size={15} className="text-[#7B5CF6]" />
                                                Condividi
                                            </button>
                                            <div className="h-px bg-[#F4F4F8] my-1" />
                                            <button
                                                onClick={() => handleDelete(t.id)}
                                                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-bold text-red-500 hover:bg-red-50 rounded-xl"
                                            >
                                                <Trash2 size={15} />
                                                Elimina
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="flex flex-col items-center justify-center pt-10 pb-20 text-center">
                        <div className="w-[180px] mb-6 opacity-80">
                            <Youtube size={80} className="mx-auto text-[#E6DAFF]" />
                        </div>
                        {searchQuery ? (
                            <>
                                <h3 className="text-xl font-bold mb-1.5 text-[#1C1C1E]">Nessun risultato</h3>
                                <p className="text-[#9AA2B1] text-sm">Nessun tutorial corrisponde a &ldquo;{searchQuery}&rdquo;</p>
                            </>
                        ) : (
                            <>
                                <img
                                    src={getUrl('tutorials_empty')}
                                    alt="Nessun tutorial"
                                    className="w-36 h-36 object-contain mb-3 animate-character-float"
                                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                                    suppressHydrationWarning
                                />
                                <h3 className="text-xl font-bold mb-1.5 text-[#1C1C1E]">Nessun tutorial salvato</h3>
                                <p className="text-[#9AA2B1] text-sm">Tocca "+" e incolla il link YouTube del tuo tutorial preferito</p>
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* Add Tutorial Modal (Simplified Sheet) */}
            {showAddModal && (
                <div className="fixed inset-0 z-[10000] flex items-end justify-center bg-black/40">
                    <div className="w-full max-w-2xl bg-white rounded-t-[32px] p-6 pb-12 shadow-2xl animate-in slide-in-from-bottom duration-300">
                        <div className="w-12 h-1.5 bg-[#EEF0F4] rounded-full mx-auto mb-6" onClick={() => setShowAddModal(false)} />
                        <h3 className="text-2xl font-black mb-6">Aggiungi Tutorial</h3>

                        <div className="space-y-4 mb-8">
                            <div>
                                <label className="text-xs font-bold text-[#9AA2B1] uppercase tracking-widest block mb-2 px-1">Link YouTube</label>
                                <input
                                    type="url"
                                    placeholder="https://youtube.com/watch?v=..."
                                    value={newUrl}
                                    onChange={(e) => setNewUrl(e.target.value)}
                                    className="w-full h-12 px-4 bg-[#FAFAFC] border border-[#E6DAFF] rounded-xl outline-none focus:border-[#7B5CF6] font-medium"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-[#9AA2B1] uppercase tracking-widest block mb-2 px-1">Titolo</label>
                                <input
                                    type="text"
                                    placeholder="es. Cerchietto Amigurumi"
                                    value={newTitle}
                                    onChange={(e) => setNewTitle(e.target.value)}
                                    className="w-full h-12 px-4 bg-[#FAFAFC] border border-[#E6DAFF] rounded-xl outline-none focus:border-[#7B5CF6] font-medium"
                                />
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button onClick={() => setShowAddModal(false)} className="flex-1 h-14 bg-white border border-[#EEF0F4] rounded-2xl font-bold text-[#9AA2B1] active:bg-[#FAFAFC]">Annulla</button>
                            <button onClick={handleAddTutorial} className="flex-[2] h-14 bg-[#7B5CF6] text-white rounded-2xl font-bold shadow-lg shadow-[#7B5CF6]/30 active:scale-95 transition-transform">Salva Tutorial</button>
                        </div>
                    </div>
                </div>
            )}

            {/* FAB "+" */}
            <button
                onClick={() => setShowAddModal(true)}
                className="fixed right-5 bottom-[calc(100px+env(safe-area-inset-bottom))] w-14 h-14 bg-[#7B5CF6] text-white rounded-full flex items-center justify-center shadow-[0_16px_30px_rgba(123,92,246,0.35)] transition-transform active:scale-95"
            >
                <Plus size={26} />
            </button>
        </div>
    );
}
