"use client";

import React, { useState, useEffect } from "react";
import { StickyNote, ArrowLeft, Plus, MoreVertical, Pencil, Trash2, Check, X } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface Note {
    id: string;
    title: string;
    content: string;
    updatedAt: number;
}

const STORAGE_KEY = 'lurumi-notes';

export default function NotesPage() {
    const { user } = useAuth();
    const [notes, setNotes] = useState<Note[]>([]);
    const [showNew, setShowNew] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [editContent, setEditContent] = useState('');
    const [menuId, setMenuId] = useState<string | null>(null);
    const [renamingId, setRenamingId] = useState<string | null>(null);
    const [renameValue, setRenameValue] = useState('');
    const [loaded, setLoaded] = useState(false);

    // Load notes
    useEffect(() => {
        const loadNotes = async () => {
            if (user) {
                const supabase = createClient();
                const { data, error } = await supabase.from('notes').select('*').eq('user_id', user.id).order('updated_at', { ascending: false });
                if (error) console.warn('[Notes] load failed:', error.message);
                if (data && data.length > 0) {
                    setNotes(data.map(n => ({ id: n.id, title: n.title, content: n.content, updatedAt: new Date(n.updated_at).getTime() })));
                    setLoaded(true);
                    return;
                }
                // Nessuna nota su Supabase: migra da localStorage se esistono
                try {
                    const saved = localStorage.getItem(STORAGE_KEY);
                    if (saved) {
                        const localNotes: Note[] = JSON.parse(saved);
                        if (localNotes.length > 0) {
                            setNotes(localNotes);
                            // Upload su Supabase
                            for (const note of localNotes) {
                                supabase.from('notes').upsert({
                                    id: note.id, user_id: user.id, title: note.title,
                                    content: note.content, updated_at: new Date(note.updatedAt).toISOString()
                                }).then(({ error: e }) => { if (e) console.warn('[Notes] migrate upsert failed:', e.message); });
                            }
                        }
                    }
                } catch {}
                setLoaded(true);
                return;
            }
            // Non loggato: usa solo localStorage
            try {
                const saved = localStorage.getItem(STORAGE_KEY);
                if (saved) setNotes(JSON.parse(saved));
            } catch {}
            setLoaded(true);
        };
        loadNotes();
    }, [user?.id]);

    // Persist notes
    useEffect(() => {
        if (!loaded) return;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
    }, [notes, loaded]);

    const saveToSupabase = async (note: Note, action: 'upsert' | 'delete') => {
        if (!user) return;
        const supabase = createClient();
        if (action === 'upsert') {
            await supabase.from('notes').upsert({ id: note.id, user_id: user.id, title: note.title, content: note.content, updated_at: new Date(note.updatedAt).toISOString() });
        } else {
            await supabase.from('notes').delete().eq('id', note.id).eq('user_id', user.id);
        }
    };

    const createNote = () => {
        if (!newTitle.trim()) return;
        const note: Note = { id: crypto.randomUUID(), title: newTitle.trim(), content: '', updatedAt: Date.now() };
        setNotes(prev => [note, ...prev]);
        saveToSupabase(note, 'upsert');
        setNewTitle('');
        setShowNew(false);
        setExpandedId(note.id);
        setEditContent('');
    };

    const saveContent = (id: string) => {
        const updated = notes.map(n => n.id === id ? { ...n, content: editContent, updatedAt: Date.now() } : n);
        setNotes(updated);
        const note = updated.find(n => n.id === id);
        if (note) saveToSupabase(note, 'upsert');
        setExpandedId(null);
    };

    const deleteNote = (id: string) => {
        const note = notes.find(n => n.id === id);
        if (!note) return;
        setNotes(prev => prev.filter(n => n.id !== id));
        saveToSupabase(note, 'delete');
        setMenuId(null);
    };

    const startRename = (note: Note) => {
        setRenamingId(note.id);
        setRenameValue(note.title);
        setMenuId(null);
    };

    const saveRename = (id: string) => {
        if (!renameValue.trim()) return;
        const updated = notes.map(n => n.id === id ? { ...n, title: renameValue.trim(), updatedAt: Date.now() } : n);
        setNotes(updated);
        const note = updated.find(n => n.id === id);
        if (note) saveToSupabase(note, 'upsert');
        setRenamingId(null);
    };

    return (
        <div className="max-w-2xl mx-auto px-4 pt-6 pb-28">
            <div className="mb-6">
                <Link href="/tools" className="inline-flex items-center gap-2 text-[#9AA2B1] font-bold text-sm hover:text-[#7B5CF6] transition-colors">
                    <ArrowLeft size={18} />
                    Torna agli Utensili
                </Link>
            </div>

            <h1 className="text-3xl font-black mb-1">Le mie Note</h1>
            <p className="text-[#9AA2B1] text-sm mb-8">La tua agenda creativa</p>

            {/* New note modal */}
            {showNew && (
                <div className="fixed inset-0 z-[10000] flex items-end justify-center bg-black/40" onClick={() => setShowNew(false)}>
                    <div className="w-full max-w-2xl bg-white rounded-t-[32px] p-6 pb-10 shadow-2xl animate-in slide-in-from-bottom duration-300" onClick={e => e.stopPropagation()}>
                        <div className="w-12 h-1.5 bg-[#EEF0F4] rounded-full mx-auto mb-6" />
                        <h3 className="text-2xl font-black mb-4">Nuova Nota</h3>
                        <input
                            autoFocus
                            type="text"
                            placeholder="Titolo della nota..."
                            value={newTitle}
                            onChange={e => setNewTitle(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && createNote()}
                            className="w-full h-12 px-4 bg-[#FAFAFC] border border-[#E6DAFF] rounded-xl outline-none focus:border-[#7B5CF6] font-medium mb-4"
                        />
                        <div className="flex gap-3">
                            <button onClick={() => setShowNew(false)} className="flex-1 h-12 bg-white border border-[#EEF0F4] rounded-2xl font-bold text-[#9AA2B1]">Annulla</button>
                            <button onClick={createNote} className="flex-[2] h-12 bg-[#7B5CF6] text-white rounded-2xl font-bold shadow-lg">Crea</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Notes list */}
            {notes.length === 0 ? (
                <div className="flex flex-col items-center justify-center pt-10 pb-20 text-center opacity-60">
                    <div className="w-16 h-16 bg-[#FEF9E7] text-[#F1C40F] rounded-2xl flex items-center justify-center mb-4">
                        <StickyNote size={32} />
                    </div>
                    <h3 className="text-lg font-bold text-[#1C1C1E]">Ancora nessuna nota</h3>
                    <p className="text-[#9AA2B1] text-sm">Tocca + per creare la prima nota</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {notes.map(note => (
                        <div key={note.id} className="bg-white rounded-2xl border border-[#EEF0F4] shadow-sm">
                            {/* Header row */}
                            <div className="flex items-center gap-3 p-4">
                                <div className="w-9 h-9 bg-[#FEF9E7] text-[#F1C40F] rounded-xl flex items-center justify-center flex-shrink-0">
                                    <StickyNote size={18} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    {renamingId === note.id ? (
                                        <div className="flex items-center gap-2">
                                            <input
                                                autoFocus
                                                value={renameValue}
                                                onChange={e => setRenameValue(e.target.value)}
                                                onKeyDown={e => { if (e.key === 'Enter') saveRename(note.id); if (e.key === 'Escape') setRenamingId(null); }}
                                                className="flex-1 h-8 px-2 border border-[#7B5CF6] rounded-lg text-sm font-bold outline-none"
                                            />
                                            <button onClick={() => saveRename(note.id)} className="text-green-500"><Check size={16} /></button>
                                            <button onClick={() => setRenamingId(null)} className="text-[#9AA2B1]"><X size={16} /></button>
                                        </div>
                                    ) : (
                                        <>
                                            <h3 className="font-bold text-[#1C1C1E] truncate">{note.title}</h3>
                                            <p className="text-xs text-[#9AA2B1]">{new Date(note.updatedAt).toLocaleDateString('it-IT')}</p>
                                        </>
                                    )}
                                </div>
                                <div className="relative">
                                    <button
                                        onClick={() => { setMenuId(menuId === note.id ? null : note.id); setExpandedId(null); }}
                                        className="w-8 h-8 flex items-center justify-center rounded-lg text-[#9AA2B1] hover:bg-[#FAFAFC]"
                                    >
                                        <MoreVertical size={16} />
                                    </button>
                                    {menuId === note.id && (
                                        <>
                                            <div className="fixed inset-0 z-10" onClick={() => setMenuId(null)} />
                                            <div className="absolute right-0 top-9 z-20 bg-white rounded-2xl shadow-xl border border-[#EEF0F4] p-1.5 w-40 animate-in fade-in zoom-in duration-150">
                                                <button
                                                    onClick={() => { startRename(note); setExpandedId(note.id); setEditContent(note.content); }}
                                                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm font-bold text-[#1C1C1E] hover:bg-[#F4F4F8] rounded-xl"
                                                >
                                                    <Pencil size={15} className="text-[#7B5CF6]" />
                                                    Rinomina
                                                </button>
                                                <button
                                                    onClick={() => deleteNote(note.id)}
                                                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm font-bold text-red-500 hover:bg-red-50 rounded-xl"
                                                >
                                                    <Trash2 size={15} />
                                                    Elimina
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                                <button
                                    onClick={() => {
                                        if (expandedId === note.id) { saveContent(note.id); }
                                        else { setExpandedId(note.id); setEditContent(note.content); setMenuId(null); }
                                    }}
                                    className={`text-xs font-bold px-3 py-1.5 rounded-xl transition-colors ${expandedId === note.id ? 'bg-green-500 text-white' : 'bg-[#F4EEFF] text-[#7B5CF6]'}`}
                                >
                                    {expandedId === note.id ? 'Salva' : 'Apri'}
                                </button>
                            </div>
                            {/* Expanded content */}
                            {expandedId === note.id && (
                                <div className="px-4 pb-4 border-t border-[#F4F4F8] pt-3">
                                    <textarea
                                        autoFocus
                                        value={editContent}
                                        onChange={e => setEditContent(e.target.value)}
                                        placeholder="Scrivi le tue note qui..."
                                        className="w-full min-h-[120px] bg-[#FAFAFC] rounded-xl p-3 text-sm font-medium text-[#1C1C1E] focus:outline-none border border-[#EEF0F4] resize-none"
                                    />
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* FAB */}
            <button
                onClick={() => setShowNew(true)}
                className="fixed right-5 bottom-[calc(100px+env(safe-area-inset-bottom))] w-14 h-14 bg-[#7B5CF6] text-white rounded-full flex items-center justify-center shadow-[0_16px_30px_rgba(123,92,246,0.35)] transition-transform active:scale-95"
            >
                <Plus size={26} />
            </button>
        </div>
    );
}
