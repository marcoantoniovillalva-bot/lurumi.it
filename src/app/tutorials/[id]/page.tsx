"use client";

import React, { useState, useEffect, useRef } from "react";
import {
    ArrowLeft,
    Minus,
    Plus,
    RotateCcw,
    Timer,
    Share2,
    Youtube,
    StickyNote,
    Plus as PlusIcon,
    Save
} from "lucide-react";
import { useProjectStore, Tutorial, RoundCounter as RoundCounterType } from "@/features/projects/store/useProjectStore";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { RoundCounter } from "@/features/projects/components/RoundCounter";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";

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

    const [isTimerRunning, setIsTimerRunning] = useState(false);
    const [elapsedTime, setElapsedTime] = useState(0);
    const [isEditingNotes, setIsEditingNotes] = useState(false);
    const [notes, setNotes] = useState("");
    const [showNewCounterModal, setShowNewCounterModal] = useState(false);
    const [newCounterName, setNewCounterName] = useState("");
    const elapsedRef = useRef(0);
    const isTimerRunningRef = useRef(false);
    const isEditingNotesRef = useRef(false);
    const wasTimerRunningRef = useRef(false);

    useEffect(() => {
        if (!tutorial) return;
        setElapsedTime(tutorial.timer || 0);
        elapsedRef.current = tutorial.timer || 0;
        setNotes(tutorial.notesHtml || "");
    }, [tutorial?.id]);

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
    const embedUrl = tutorial.videoId
        ? `https://www.youtube.com/embed/${tutorial.videoId}?rel=0&modestbranding=1&playsinline=1`
        : tutorial.playlistId
            ? `https://www.youtube.com/embed/videoseries?list=${tutorial.playlistId}&rel=0&modestbranding=1&playsinline=1`
            : '';

    return (
        <div className="max-w-2xl mx-auto px-4 pt-6 pb-20">
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
                    <button
                        onClick={() => {
                            if (navigator.share) {
                                navigator.share({ title: tutorial.title, url: tutorial.url }).catch(() => {});
                            } else {
                                navigator.clipboard.writeText(tutorial.url);
                                alert('Link copiato!');
                            }
                        }}
                        className="w-10 h-10 flex items-center justify-center bg-white border border-[#EEF0F4] rounded-xl text-[#7B5CF6] shadow-sm active:scale-95 transition-transform"
                        title="Condividi tutorial"
                    >
                        <Share2 size={20} />
                    </button>
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

            {/* Rounds / Secondary Counters */}
            <div className="mb-10">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-black text-[#1C1C1E]">Giri Secondari</h2>
                    <button
                        onClick={() => { setNewCounterName(""); setShowNewCounterModal(true); }}
                        className="bg-[#7B5CF6]/10 text-[#7B5CF6] px-3 py-1.5 rounded-xl font-black text-xs flex items-center gap-2"
                    >
                        <PlusIcon size={14} strokeWidth={3} />
                        AGGIUNGI
                    </button>
                </div>
                <div className="flex flex-col gap-3">
                    {tutorial.secs.map(sec => (
                        <RoundCounter
                            key={sec.id}
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
                            onAssociateImage={() => {}}
                            onRemoveImage={() => {}}
                            hideImageOption={true}
                        />
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
