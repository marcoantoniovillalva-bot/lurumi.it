"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
    Shield, BarChart2, Plus, Edit2, Trash2,
    ChevronDown, ChevronUp, ExternalLink, X, Save, ToggleLeft, ToggleRight,
    CalendarDays, ArrowLeft, Users, UserCheck, Clock, MessageSquare, Send, Bug,
    ChevronRight as ChevRight, BookOpen, FileText, GripVertical, Mail, Sparkles,
    CheckCircle2,
} from "lucide-react";
import { FullscreenViewer } from "@/components/FullscreenViewer";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
    getAdminStats, getAdminEvents, getEventBookers, getEventInterests,
    createEvent, updateEvent, deleteEvent, listAllUsers, setUserAdmin, setUserEventCredit,
    resetUserAiCredits, grantBonusAiCredits,
    getInterestMessages, sendAdminMessage,
    getAiSpendingSummary, getAdminSettings, setAdminSetting, getAiDeposits, addAiDeposit,
    getAllBugReports, getAdminSupportMessages, sendAdminSupportReply, updateBugReportStatus,
    getSupadataStatus, setSupadataBudget,
    EventFormData, UserProfile, AiSpendingSummary, AiDeposit, BugReport, SupportMessage, SupadataStatus,
} from "@/features/admin/actions/admin";
import {
    getAdminLibraryItems, createLibraryItem, updateLibraryItem, deleteLibraryItem,
    LibraryItem, LibrarySection, LibraryFormData,
} from "@/features/admin/actions/library";
import {
    getCampaigns, createCampaign, updateCampaign, deleteCampaign, approveCampaign, sendCampaignNow,
    getSequences, createSequence, updateSequence, deleteSequence, toggleSequenceActive,
    getSequenceSteps, createSequenceStep, updateSequenceStep, deleteSequenceStep, sendManualSequenceToAll,
    getEmailLogs, getReceivedEmails, markEmailRead, getAudienceCounts,
    EmailCampaign, EmailSequence, EmailSequenceStep, EmailSendLog, ReceivedEmail,
} from "@/features/admin/actions/email";

/* ─── Types ─────────────────────────────────────────────── */
interface Stats {
    totalUsers: number; premiumCount: number;
    todaySessions: number; avgMinutes: number; peakHours: number[];
}
interface AdminEvent {
    id: string; title: string; description: string | null; image_url: string | null;
    image_urls: string[] | null; duration_minutes: number | null;
    cost: number; event_date: string; access_link: string | null;
    max_participants: number | null; is_active: boolean; created_at: string;
    confirmed_count: number; // solo prenotazioni attive (status='confirmed')
}
interface Booker {
    id: string; user_email: string | null; amount_paid: number;
    credit_used: number; status: string; created_at: string;
}
interface EventInterest {
    id: string; user_email: string | null;
    preferred_date: string | null; message: string | null; created_at: string;
}

/* ─── Helpers ────────────────────────────────────────────── */
function fmtDuration(minutes: number | null): string {
    if (!minutes) return '';
    const h = Math.floor(minutes / 60), m = minutes % 60;
    if (h === 0) return `${m} min`;
    if (m === 0) return `${h} h`;
    return `${h} h ${m} min`;
}

/* ─── Stat Card (mini) ───────────────────────────────────── */
function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
    return (
        <div className="bg-white rounded-[20px] border border-[#EEF0F4] p-3 md:p-4 shadow-sm">
            <p className="text-[#9AA2B1] text-[9px] md:text-[10px] font-black uppercase tracking-wider mb-1 truncate">{label}</p>
            <p className="text-base md:text-2xl font-black text-[#1C1C1E] truncate">{value}</p>
            {sub && <p className="text-[10px] md:text-xs text-[#9AA2B1] font-bold mt-0.5">{sub}</p>}
        </div>
    );
}

/* ─── Section Card (clickable) ──────────────────────────── */
function SectionCard({ icon, title, subtitle, onClick }: {
    icon: React.ReactNode; title: string; subtitle?: string; onClick: () => void;
}) {
    return (
        <button
            onClick={onClick}
            className="w-full bg-white rounded-[24px] border border-[#EEF0F4] p-5 shadow-sm flex items-center gap-4 active:scale-[0.98] transition-transform text-left"
        >
            <div className="w-11 h-11 rounded-2xl bg-[#F4EEFF] flex items-center justify-center flex-shrink-0">
                {icon}
            </div>
            <div className="flex-1 min-w-0">
                <p className="font-black text-[#1C1C1E] text-[15px]">{title}</p>
                {subtitle && <p className="text-[#9AA2B1] text-xs font-medium mt-0.5 truncate">{subtitle}</p>}
            </div>
            <ChevRight size={18} className="text-[#9AA2B1] flex-shrink-0" />
        </button>
    );
}

/* ─── Section Header with Back ──────────────────────────── */
function SectionHeader({ title, onBack }: { title: string; onBack: () => void }) {
    return (
        <div className="flex items-center gap-3 mb-6">
            <button
                onClick={onBack}
                className="w-10 h-10 flex items-center justify-center bg-white border border-[#EEF0F4] rounded-xl text-[#9AA2B1] active:scale-95 transition-transform flex-shrink-0"
            >
                <ArrowLeft size={20} />
            </button>
            <h2 className="text-xl font-black text-[#1C1C1E]">{title}</h2>
        </div>
    );
}

/* ─── Peak Hours Chart ──────────────────────────────────── */
function PeakChart({ hours }: { hours: number[] }) {
    const max = Math.max(...hours, 1);
    return (
        <div className="space-y-1">
            {hours.map((count, h) => (
                <div key={h} className="flex items-center gap-2 text-[10px]">
                    <span className="w-6 text-right font-bold text-[#9AA2B1]">{h}h</span>
                    <div className="flex-1 bg-[#F4F4F8] rounded-full h-2.5 overflow-hidden">
                        <div className="bg-[#7B5CF6] h-full rounded-full transition-all"
                            style={{ width: `${(count / max) * 100}%` }} />
                    </div>
                    <span className="w-5 font-bold text-[#9AA2B1] text-right">{count}</span>
                </div>
            ))}
        </div>
    );
}

/* ─── Event Form Modal ───────────────────────────────────── */
const EMPTY_FORM: EventFormData = {
    title: '', description: '', image_url: '', image_urls: [], cost: 0,
    event_date: '', access_link: '', max_participants: null, is_active: true,
    duration_minutes: null,
};
const MAX_IMAGES = 5;

function EventFormModal({ initial, onClose, onSaved }: {
    initial?: AdminEvent | null; onClose: () => void; onSaved: () => void;
}) {
    const initDate = initial ? initial.event_date.slice(0, 10) : '';
    const initTime = initial ? initial.event_date.slice(11, 16) : '';
    const initUrls = initial?.image_urls?.length ? initial.image_urls : (initial?.image_url ? [initial.image_url] : []);

    const [form, setForm] = useState<EventFormData>(
        initial ? {
            title: initial.title, description: initial.description ?? '',
            image_url: initial.image_url ?? '', image_urls: initUrls,
            cost: initial.cost, event_date: initial.event_date.slice(0, 16),
            access_link: initial.access_link ?? '', max_participants: initial.max_participants,
            is_active: initial.is_active, duration_minutes: initial.duration_minutes ?? null,
        } : EMPTY_FORM
    );
    const [dateVal, setDateVal] = useState(initDate);
    const [timeVal, setTimeVal] = useState(initTime);
    const [existingUrls, setExistingUrls] = useState<string[]>(initUrls);
    const [newFiles, setNewFiles] = useState<(File | null)[]>(initUrls.map(() => null));
    const [previews, setPreviews] = useState<string[]>(initUrls);
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState('');
    const [improvingField, setImprovingField] = useState<'title' | 'description' | null>(null);
    const [analyzingImage, setAnalyzingImage] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const analyzeImage = async () => {
        const url = previews[0];
        if (!url) return;
        setAnalyzingImage(true);
        try {
            const res = await fetch('/api/ai/analyze-image', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ imageUrl: url, context: 'event' }),
            });
            const data = await res.json();
            if (data.success) {
                setForm(f => ({
                    ...f,
                    title: data.title || f.title,
                    description: data.description || f.description,
                }));
            } else { alert(data.error || 'Errore analisi immagine'); }
        } catch (e: any) { alert(e.message); } finally { setAnalyzingImage(false); }
    };

    const improveText = async (field: 'title' | 'description') => {
        const text = field === 'title' ? form.title : form.description;
        if (!text.trim()) return;
        setImprovingField(field);
        try {
            const res = await fetch('/api/ai/improve-text', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, type: field }),
            });
            const data = await res.json();
            if (data.success) setForm(f => ({ ...f, [field]: data.text }));
        } catch {}
        setImprovingField(null);
    };

    const handleAddImages = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files ?? []); if (!files.length) return;
        e.target.value = '';
        const toAdd = files.slice(0, MAX_IMAGES - previews.length);
        setExistingUrls(p => [...p, ...toAdd.map(() => '')]);
        setNewFiles(p => [...p, ...toAdd]);
        setPreviews(p => [...p, ...toAdd.map(f => URL.createObjectURL(f))]);
    };
    const handleRemoveImage = (idx: number) => {
        setExistingUrls(p => p.filter((_, i) => i !== idx));
        setNewFiles(p => p.filter((_, i) => i !== idx));
        setPreviews(p => p.filter((_, i) => i !== idx));
    };
    const uploadOneImage = async (eventId: string, file: File): Promise<string> => {
        const supabase = createClient();
        const path = `events/${eventId}/img-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const { error } = await supabase.storage.from('event-covers').upload(path, file, { contentType: file.type });
        if (error) throw new Error(`Errore upload immagine: ${error.message}`);
        return supabase.storage.from('event-covers').getPublicUrl(path).data.publicUrl;
    };
    const handleSave = async () => {
        if (!form.title.trim()) { setErr('Il titolo è obbligatorio'); return; }
        if (!dateVal) { setErr('La data è obbligatoria'); return; }
        const eventDate = timeVal ? `${dateVal}T${timeVal}` : `${dateVal}T00:00`;
        setSaving(true); setErr('');
        try {
            const eventId = initial?.id ?? (await createEvent({ ...form, event_date: eventDate, image_url: '', image_urls: [] }))?.id;
            if (!eventId) throw new Error('Errore creazione evento');
            const finalUrls: string[] = [];
            for (let i = 0; i < previews.length; i++) {
                finalUrls.push(newFiles[i] ? await uploadOneImage(eventId, newFiles[i]!) : existingUrls[i]);
            }
            await updateEvent(eventId, { ...form, event_date: eventDate, image_url: finalUrls[0] ?? '', image_urls: finalUrls });
            onSaved();
        } catch (e: any) { setErr(e.message); } finally { setSaving(false); }
    };

    return (
        <div className="fixed inset-0 z-[10000] flex items-end justify-center bg-black/40" onClick={onClose}>
            <div className="w-full max-w-2xl bg-white rounded-t-[32px] p-6 pb-10 shadow-2xl animate-in slide-in-from-bottom duration-300 max-h-[90vh] overflow-y-auto"
                onClick={e => e.stopPropagation()}>
                <div className="w-12 h-1.5 bg-[#EEF0F4] rounded-full mx-auto mb-6" />
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-2xl font-black">{initial ? 'Modifica Evento' : 'Nuovo Evento'}</h3>
                    <button onClick={onClose} className="text-[#9AA2B1]"><X size={20} /></button>
                </div>
                {err && <p className="text-red-500 text-sm font-bold mb-4 bg-red-50 p-3 rounded-xl">{err}</p>}
                {/* Multi-image */}
                <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-black text-[#9AA2B1] uppercase tracking-wider">Immagini ({previews.length}/{MAX_IMAGES})</label>
                        {previews.length > 0 && (
                            <button type="button" onClick={analyzeImage} disabled={analyzingImage}
                                className="flex items-center gap-1 text-[#7B5CF6] text-[11px] font-bold disabled:opacity-40 hover:text-[#9B7DFF] transition-colors">
                                <Sparkles size={12} className={analyzingImage ? 'animate-pulse' : ''} />
                                {analyzingImage ? 'Analizzando...' : 'Analizza con AI'}
                            </button>
                        )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {previews.map((src, i) => (
                            <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden border border-[#EEF0F4]">
                                <img src={src} alt="" className="w-full h-full object-cover" />
                                <button onClick={() => handleRemoveImage(i)} className="absolute top-0.5 right-0.5 w-5 h-5 flex items-center justify-center bg-black/60 text-white rounded-full"><X size={10} /></button>
                            </div>
                        ))}
                        {previews.length < MAX_IMAGES && (
                            <button type="button" onClick={() => fileInputRef.current?.click()}
                                className="w-20 h-20 rounded-xl border-2 border-dashed border-[#E6DAFF] flex flex-col items-center justify-center text-[#7B5CF6] bg-[#FAFAFC] hover:bg-[#F4EEFF] transition-colors">
                                <Plus size={20} /><span className="text-[10px] font-bold mt-0.5">Aggiungi</span>
                            </button>
                        )}
                    </div>
                    <input type="file" ref={fileInputRef} accept="image/*" multiple className="hidden" onChange={handleAddImages} />
                </div>
                <div className="space-y-4">
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <label className="text-xs font-black text-[#9AA2B1] uppercase tracking-wider">Titolo *</label>
                            <button type="button" onClick={() => improveText('title')} disabled={improvingField === 'title' || !form.title.trim()}
                                className="flex items-center gap-1 text-[#7B5CF6] text-[11px] font-bold disabled:opacity-40 hover:text-[#9B7DFF] transition-colors">
                                <Sparkles size={12} className={improvingField === 'title' ? 'animate-pulse' : ''} />
                                {improvingField === 'title' ? 'Migliorando...' : 'Migliora con AI'}
                            </button>
                        </div>
                        <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="w-full h-12 px-4 bg-[#FAFAFC] border border-[#E6DAFF] rounded-xl outline-none focus:border-[#7B5CF6] font-medium" />
                    </div>
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <label className="text-xs font-black text-[#9AA2B1] uppercase tracking-wider">Descrizione</label>
                            <button type="button" onClick={() => improveText('description')} disabled={improvingField === 'description' || !form.description.trim()}
                                className="flex items-center gap-1 text-[#7B5CF6] text-[11px] font-bold disabled:opacity-40 hover:text-[#9B7DFF] transition-colors">
                                <Sparkles size={12} className={improvingField === 'description' ? 'animate-pulse' : ''} />
                                {improvingField === 'description' ? 'Migliorando...' : 'Migliora con AI'}
                            </button>
                        </div>
                        <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} className="w-full px-4 py-3 bg-[#FAFAFC] border border-[#E6DAFF] rounded-xl outline-none focus:border-[#7B5CF6] font-medium resize-none" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs font-black text-[#9AA2B1] uppercase tracking-wider block mb-1">Costo (€)</label>
                            <input type="number" min="0" step="0.01" value={form.cost} onChange={e => setForm(f => ({ ...f, cost: parseFloat(e.target.value) || 0 }))} className="w-full h-12 px-4 bg-[#FAFAFC] border border-[#E6DAFF] rounded-xl outline-none focus:border-[#7B5CF6] font-medium" />
                        </div>
                        <div>
                            <label className="text-xs font-black text-[#9AA2B1] uppercase tracking-wider block mb-1">Max partecipanti</label>
                            <input type="number" min="1" value={form.max_participants ?? ''} onChange={e => setForm(f => ({ ...f, max_participants: e.target.value ? parseInt(e.target.value) : null }))} placeholder="Illimitati" className="w-full h-12 px-4 bg-[#FAFAFC] border border-[#E6DAFF] rounded-xl outline-none focus:border-[#7B5CF6] font-medium" />
                        </div>
                    </div>
                    <div>
                        <label className="text-xs font-black text-[#9AA2B1] uppercase tracking-wider block mb-1">Data e ora *</label>
                        <div className="grid grid-cols-2 gap-3">
                            <input type="date" value={dateVal} onChange={e => setDateVal(e.target.value)} className="w-full h-12 px-4 bg-[#FAFAFC] border border-[#E6DAFF] rounded-xl outline-none focus:border-[#7B5CF6] font-medium" />
                            <input type="time" value={timeVal} onChange={e => setTimeVal(e.target.value)} className="w-full h-12 px-4 bg-[#FAFAFC] border border-[#E6DAFF] rounded-xl outline-none focus:border-[#7B5CF6] font-medium" />
                        </div>
                    </div>
                    <div>
                        <label className="text-xs font-black text-[#9AA2B1] uppercase tracking-wider block mb-1">Durata (minuti)</label>
                        <input type="number" min="0" step="15" value={form.duration_minutes ?? ''} onChange={e => setForm(f => ({ ...f, duration_minutes: e.target.value ? parseInt(e.target.value) : null }))} placeholder="es. 120 per 2 ore" className="w-full h-12 px-4 bg-[#FAFAFC] border border-[#E6DAFF] rounded-xl outline-none focus:border-[#7B5CF6] font-medium" />
                        {form.duration_minutes ? <p className="text-xs text-[#7B5CF6] font-bold mt-1">{fmtDuration(form.duration_minutes)}</p> : null}
                    </div>
                    <div>
                        <label className="text-xs font-black text-[#9AA2B1] uppercase tracking-wider block mb-1">Link accesso (evento online)</label>
                        <input value={form.access_link} onChange={e => setForm(f => ({ ...f, access_link: e.target.value }))} placeholder="https://zoom.us/..." className="w-full h-12 px-4 bg-[#FAFAFC] border border-[#E6DAFF] rounded-xl outline-none focus:border-[#7B5CF6] font-medium" />
                    </div>
                    <div className="flex items-center justify-between p-4 bg-[#FAFAFC] rounded-xl">
                        <span className="font-bold text-[#1C1C1E]">Evento attivo</span>
                        <button onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))} className={`transition-colors ${form.is_active ? 'text-[#7B5CF6]' : 'text-[#9AA2B1]'}`}>
                            {form.is_active ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
                        </button>
                    </div>
                </div>
                <div className="flex gap-3 mt-6">
                    <button onClick={onClose} className="flex-1 h-12 bg-white border border-[#EEF0F4] rounded-2xl font-bold text-[#9AA2B1]">Annulla</button>
                    <button onClick={handleSave} disabled={saving} className="flex-[2] h-12 bg-[#7B5CF6] text-white rounded-2xl font-bold shadow-lg flex items-center justify-center gap-2 disabled:opacity-60">
                        <Save size={16} /> {saving ? 'Salvataggio...' : 'Salva'}
                    </button>
                </div>
            </div>
        </div>
    );
}

/* ─── Bookers List ───────────────────────────────────────── */
function BookersList({ eventId, onClose }: { eventId: string; onClose: () => void }) {
    const [bookers, setBookers] = useState<Booker[]>([]);
    const [loading, setLoading] = useState(true);
    useEffect(() => { getEventBookers(eventId).then(d => { setBookers(d as Booker[]); setLoading(false); }); }, [eventId]);
    return (
        <div className="mt-3 bg-[#FAFAFC] rounded-2xl p-4 border border-[#EEF0F4]">
            <div className="flex items-center justify-between mb-3">
                <h4 className="font-black text-[#1C1C1E] text-sm">Prenotazioni</h4>
                <button onClick={onClose} className="text-[#9AA2B1]"><X size={16} /></button>
            </div>
            {loading ? <p className="text-[#9AA2B1] text-sm">Caricamento...</p> : bookers.length === 0 ? (
                <p className="text-[#9AA2B1] text-sm italic">Nessuna prenotazione</p>
            ) : (
                <div className="space-y-2">
                    {bookers.map(b => (
                        <div key={b.id} className="bg-white rounded-xl p-3 border border-[#EEF0F4]">
                            <div className="flex items-start justify-between gap-2">
                                <p className="font-bold text-[#1C1C1E] text-sm min-w-0 break-all leading-snug">{b.user_email ?? '—'}</p>
                                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full flex-shrink-0 ${b.status === 'confirmed' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-500'}`}>
                                    {b.status === 'confirmed' ? 'Confermata' : 'Cancellata'}
                                </span>
                            </div>
                            <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-1">
                                <span className="text-[#9AA2B1] text-xs font-medium">€{Number(b.amount_paid).toFixed(2)} pagato</span>
                                {Number(b.credit_used) > 0 && (
                                    <span className="text-[#9AA2B1] text-xs font-medium">€{Number(b.credit_used).toFixed(2)} credito</span>
                                )}
                                <span className="text-[#9AA2B1] text-xs font-medium">{new Date(b.created_at).toLocaleDateString('it-IT')}</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

/* ─── Interest Chat Modal (admin → bottom sheet) ────────────── */
interface InterestMessage { id: string; sender_role: string; content: string; created_at: string; }

function InterestChatModal({ interestId, userEmail, onClose }: {
    interestId: string; userEmail: string | null; onClose: () => void;
}) {
    const [messages, setMessages] = useState<InterestMessage[]>([]);
    const [loading, setLoading] = useState(true);
    const [text, setText] = useState('');
    const [sending, setSending] = useState(false);
    const bottomRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const load = useCallback(async () => {
        const data = await getInterestMessages(interestId);
        setMessages(data as InterestMessage[]);
        setLoading(false);
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 60);
    }, [interestId]);

    useEffect(() => { load(); }, [load]);

    useEffect(() => {
        const supabase = createClient();
        const ch = supabase.channel(`imsg-admin-${interestId}`)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'interest_messages', filter: `interest_id=eq.${interestId}` }, () => load())
            .subscribe();
        return () => { supabase.removeChannel(ch); };
    }, [interestId, load]);

    // Blocca scroll body e scrolls to bottom quando la tastiera si apre
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        const timer = setTimeout(() => inputRef.current?.focus(), 300);
        return () => { document.body.style.overflow = ''; clearTimeout(timer); };
    }, []);

    const handleSend = async () => {
        if (!text.trim() || sending) return;
        setSending(true);
        const content = text.trim();
        setText(''); // svuota subito l'input
        try {
            await sendAdminMessage(interestId, content);
            await load(); // ricarica i messaggi dopo l'invio
        }
        catch (e: any) { setText(content); alert(e.message); } // ripristina testo se errore
        finally { setSending(false); }
    };

    return (
        <div className="fixed inset-0 z-[20000] flex items-end justify-center bg-black/50" onClick={onClose}>
            <div
                className="w-full max-w-2xl bg-white rounded-t-[32px] shadow-2xl animate-in slide-in-from-bottom duration-300 flex flex-col"
                style={{ maxHeight: '82dvh' }}
                onClick={e => e.stopPropagation()}
            >
                {/* Handle + header */}
                <div className="flex-shrink-0 px-5 pt-4 pb-3 border-b border-[#EEF0F4]">
                    <div className="w-10 h-1 bg-[#EEF0F4] rounded-full mx-auto mb-3" />
                    <div className="flex items-center justify-between">
                        <div className="min-w-0">
                            <p className="font-black text-[#1C1C1E] text-[15px]">Conversazione privata</p>
                            <p className="text-[#9AA2B1] text-xs font-medium truncate mt-0.5">{userEmail ?? 'Utente anonimo'}</p>
                        </div>
                        <button onClick={onClose} className="ml-3 flex-shrink-0 w-9 h-9 flex items-center justify-center bg-[#F4F4F8] rounded-xl text-[#9AA2B1]">
                            <X size={16} />
                        </button>
                    </div>
                </div>

                {/* Messaggi */}
                <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2 min-h-0">
                    {loading ? (
                        <p className="text-[#9AA2B1] text-sm text-center py-6">Caricamento...</p>
                    ) : messages.length === 0 ? (
                        <p className="text-[#9AA2B1] text-sm italic text-center py-6">Nessun messaggio — scrivi per iniziare</p>
                    ) : messages.map(m => (
                        <div key={m.id} className={`flex ${m.sender_role === 'admin' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[78%] flex flex-col gap-0.5 ${m.sender_role === 'admin' ? 'items-end' : 'items-start'}`}>
                                <span className="text-[10px] font-bold text-[#9AA2B1] px-1">
                                    {m.sender_role === 'admin' ? 'Tu (admin)' : 'Utente'}
                                </span>
                                <div className={`px-3 py-2 rounded-2xl text-sm font-medium leading-relaxed break-words min-w-0 ${m.sender_role === 'admin' ? 'bg-[#7B5CF6] text-white rounded-br-sm' : 'bg-[#F4F4F8] text-[#1C1C1E] rounded-bl-sm'}`}>
                                    {m.content}
                                </div>
                            </div>
                        </div>
                    ))}
                    <div ref={bottomRef} />
                </div>

                {/* Input */}
                <div className="flex-shrink-0 flex gap-2 px-4 py-3 border-t border-[#EEF0F4]">
                    <input
                        ref={inputRef}
                        value={text}
                        onChange={e => setText(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                        placeholder="Scrivi un messaggio..."
                        className="flex-1 h-11 px-4 text-sm bg-[#FAFAFC] border border-[#EEF0F4] rounded-2xl outline-none focus:border-[#7B5CF6]"
                    />
                    <button
                        onClick={handleSend}
                        disabled={!text.trim() || sending}
                        className="h-11 w-11 flex items-center justify-center bg-[#7B5CF6] text-white rounded-2xl disabled:opacity-40 flex-shrink-0 active:scale-90 transition-transform"
                    >
                        <Send size={15} />
                    </button>
                </div>
            </div>
        </div>
    );
}

/* ─── Interests List ─────────────────────────────────────── */
function InterestsList({ eventId, onClose }: { eventId: string; onClose: () => void }) {
    const [interests, setInterests] = useState<EventInterest[]>([]);
    const [loading, setLoading] = useState(true);
    const [chatInterest, setChatInterest] = useState<EventInterest | null>(null);

    const load = useCallback(() => { getEventInterests(eventId).then(d => { setInterests(d as EventInterest[]); setLoading(false); }); }, [eventId]);
    useEffect(() => { load(); }, [load]);
    useEffect(() => {
        const supabase = createClient();
        const ch = supabase.channel(`interests-admin-${eventId}`)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'event_interests', filter: `event_id=eq.${eventId}` }, () => load())
            .subscribe();
        return () => { supabase.removeChannel(ch); };
    }, [eventId, load]);

    return (
        <>
            <div className="mt-3 bg-[#FFF8E7] rounded-2xl p-4 border border-[#FFE4A0]">
                <div className="flex items-center justify-between mb-3">
                    <h4 className="font-black text-[#1C1C1E] text-sm flex items-center gap-1.5">
                        <MessageSquare size={14} className="text-amber-500" /> Interessi altra data
                    </h4>
                    <button onClick={onClose} className="text-[#9AA2B1]"><X size={16} /></button>
                </div>
                {loading ? <p className="text-[#9AA2B1] text-sm">Caricamento...</p> : interests.length === 0 ? (
                    <p className="text-[#9AA2B1] text-sm italic">Nessun interesse registrato</p>
                ) : (
                    <div className="space-y-3">
                        {interests.map(i => (
                            <div key={i.id} className="bg-white rounded-xl p-3 border border-[#EEF0F4]">
                                <p className="font-bold text-[#1C1C1E] text-sm break-all leading-snug">{i.user_email ?? 'Utente anonimo'}</p>
                                {i.preferred_date && <p className="text-amber-600 text-xs font-bold mt-1 break-words">Data preferita: {i.preferred_date}</p>}
                                {i.message && <p className="text-[#9AA2B1] text-xs mt-0.5 break-words leading-relaxed">{i.message}</p>}
                                <div className="flex items-center justify-between mt-2">
                                    <p className="text-[#9AA2B1] text-[10px]">{new Date(i.created_at).toLocaleString('it-IT')}</p>
                                    <button
                                        onClick={() => setChatInterest(i)}
                                        className="flex items-center gap-1 text-[11px] font-black px-2.5 py-1 rounded-lg bg-[#F4EEFF] text-[#7B5CF6] active:scale-95 transition-transform"
                                    >
                                        <MessageSquare size={11} /> Rispondi
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Chat come modal a schermo intero — responsive su mobile */}
            {chatInterest && (
                <InterestChatModal
                    interestId={chatInterest.id}
                    userEmail={chatInterest.user_email}
                    onClose={() => setChatInterest(null)}
                />
            )}
        </>
    );
}

/* ═══════════════════════════════════════════════════════════
   SEZIONI DETTAGLIO
   ═══════════════════════════════════════════════════════════ */

/* ─── Sezione: Orari di Punta ────────────────────────────── */
function SectionPeakHours({ stats, onBack }: { stats: Stats; onBack: () => void }) {
    return (
        <div>
            <SectionHeader title="Orari di Punta" onBack={onBack} />
            <div className="bg-white rounded-[24px] border border-[#EEF0F4] p-5 shadow-sm">
                <p className="text-[#9AA2B1] text-xs font-black uppercase tracking-wider mb-4">Ultimi 7 giorni</p>
                <PeakChart hours={stats.peakHours} />
            </div>
        </div>
    );
}

/* ─── Sezione: Gestione Admin ────────────────────────────── */
function SectionAdminUsers({ onBack }: { onBack: () => void }) {
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [toggling, setToggling] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [notice, setNotice] = useState('');
    const [editingCredit, setEditingCredit] = useState<string | null>(null);
    const [creditInput, setCreditInput] = useState('');
    const [savingCredit, setSavingCredit] = useState(false);
    const [aiCreditAction, setAiCreditAction] = useState<string | null>(null);
    const [editingAiBonus, setEditingAiBonus] = useState<string | null>(null);
    const [aiBonusInput, setAiBonusInput] = useState('');
    const [savingAiBonus, setSavingAiBonus] = useState(false);

    const load = async () => { setLoading(true); setUsers(await listAllUsers()); setLoading(false); };
    useEffect(() => { load(); }, []);
    useEffect(() => {
        const supabase = createClient();
        const ch = supabase.channel('admin-users-rt').on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, () => load()).subscribe();
        return () => { supabase.removeChannel(ch); };
    }, []);

    const handleToggle = async (u: UserProfile) => {
        if (toggling) return;
        setToggling(u.id);
        try {
            await setUserAdmin(u.id, !u.is_admin);
            setNotice(`${u.email ?? u.id} → ${!u.is_admin ? 'ADMIN' : 'utente normale'}`);
            setTimeout(() => setNotice(''), 3000);
            await load();
        } catch (e: any) { alert(e.message); } finally { setToggling(null); }
    };

    const startEditCredit = (u: UserProfile) => {
        setEditingCredit(u.id);
        setCreditInput(u.event_credit.toFixed(2));
    };

    const handleSaveCredit = async (userId: string) => {
        const amount = parseFloat(creditInput);
        if (isNaN(amount) || amount < 0) { alert('Importo non valido'); return; }
        setSavingCredit(true);
        try {
            await setUserEventCredit(userId, amount);
            setNotice(`Credito aggiornato a €${amount.toFixed(2)}`);
            setTimeout(() => setNotice(''), 3000);
            setEditingCredit(null);
            await load();
        } catch (e: any) { alert(e.message); } finally { setSavingCredit(false); }
    };

    const handleResetAiCredits = async (userId: string, email: string | null) => {
        if (!confirm(`Reset crediti AI per ${email ?? userId}?`)) return;
        setAiCreditAction(userId);
        try {
            await resetUserAiCredits(userId);
            setNotice(`Crediti AI resettati per ${email ?? userId}`);
            setTimeout(() => setNotice(''), 3000);
            await load();
        } catch (e: any) { alert(e.message); } finally { setAiCreditAction(null); }
    };

    const handleGrantAiCredits = async (userId: string) => {
        const n = parseInt(aiBonusInput, 10);
        if (isNaN(n) || n <= 0) {
            setNotice('Numero non valido');
            setTimeout(() => setNotice(''), 3000);
            return;
        }
        setSavingAiBonus(true);
        setAiCreditAction(userId);
        try {
            await grantBonusAiCredits(userId, n);
            const u = users.find(x => x.id === userId);
            setNotice(`+${n} crediti AI aggiunti a ${u?.email ?? userId}`);
            setTimeout(() => setNotice(''), 3000);
            setEditingAiBonus(null);
            setAiBonusInput('');
            await load();
        } catch (e: any) {
            setNotice(e.message);
            setTimeout(() => setNotice(''), 3000);
        } finally { setSavingAiBonus(false); setAiCreditAction(null); }
    };

    const filtered = users.filter(u => !search || (u.email ?? '').toLowerCase().includes(search.toLowerCase()));

    return (
        <div>
            <SectionHeader title="Gestione Admin" onBack={onBack} />
            {notice && <div className="bg-green-50 text-green-700 font-bold text-sm p-3 rounded-xl mb-4 border border-green-100">{notice}</div>}
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cerca per email..."
                className="w-full h-11 px-4 bg-white border border-[#EEF0F4] rounded-xl outline-none focus:border-[#7B5CF6] font-medium text-sm mb-4" />
            {loading ? (
                <p className="text-center text-[#9AA2B1] font-bold py-8">Caricamento...</p>
            ) : (
                <div className="flex flex-col gap-2">
                    {filtered.map(u => (
                        <div key={u.id} className="bg-white rounded-2xl border border-[#EEF0F4] p-4">
                            <div className="flex items-center gap-3">
                                <div className="flex-1 min-w-0">
                                    <p className="font-bold text-[#1C1C1E] text-sm truncate">{u.email ?? u.id}</p>
                                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${u.tier === 'premium' ? 'bg-[#F4EEFF] text-[#7B5CF6]' : 'bg-[#F4F4F8] text-[#9AA2B1]'}`}>{u.tier}</span>
                                        {u.is_admin && <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 flex items-center gap-0.5"><Shield size={9} /> Admin</span>}
                                        <button onClick={() => startEditCredit(u)}
                                            className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#F4EEFF] text-[#7B5CF6] border border-[#E4D4FF]"
                                            title="Modifica credito corsi">
                                            €{u.event_credit.toFixed(2)} credito
                                        </button>
                                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-purple-50 text-purple-600 border border-purple-100"
                                            title="Crediti AI usati questo mese">
                                            ✦ {u.ai_credits_used} cr AI
                                        </span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 flex-shrink-0">
                                    <button onClick={() => { setEditingAiBonus(u.id); setAiBonusInput(''); }} disabled={savingAiBonus && aiCreditAction === u.id}
                                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-purple-50 text-purple-500 hover:bg-purple-100 transition-colors disabled:opacity-50 text-[11px] font-black"
                                        title="Aggiungi crediti AI bonus">+</button>
                                    <button onClick={() => handleResetAiCredits(u.id, u.email)} disabled={aiCreditAction === u.id && !savingAiBonus}
                                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-[#F4F4F8] text-[#9AA2B1] hover:bg-red-50 hover:text-red-400 transition-colors disabled:opacity-50 text-[10px] font-black"
                                        title="Reset crediti AI mensili">↺</button>
                                    <button onClick={() => handleToggle(u)} disabled={toggling === u.id}
                                        className={`flex-shrink-0 transition-colors disabled:opacity-50 ${u.is_admin ? 'text-amber-500' : 'text-[#9AA2B1]'}`}
                                        title={u.is_admin ? 'Rimuovi admin' : 'Promuovi ad admin'}>
                                        {u.is_admin ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                                    </button>
                                </div>
                            </div>
                            {editingCredit === u.id && (
                                <div className="mt-3 flex items-center gap-2">
                                    <span className="text-xs font-bold text-[#9AA2B1]">Credito €</span>
                                    <input
                                        type="number" min="0" step="0.01"
                                        value={creditInput}
                                        onChange={e => setCreditInput(e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Enter') handleSaveCredit(u.id); if (e.key === 'Escape') setEditingCredit(null); }}
                                        className="flex-1 h-9 px-3 bg-[#FAFAFC] border border-[#7B5CF6] rounded-xl text-sm outline-none font-bold"
                                        autoFocus
                                    />
                                    <button onClick={() => handleSaveCredit(u.id)} disabled={savingCredit}
                                        className="h-9 px-3 bg-[#7B5CF6] text-white rounded-xl font-bold text-xs disabled:opacity-50">
                                        {savingCredit ? '...' : 'Salva'}
                                    </button>
                                    <button onClick={() => setEditingCredit(null)}
                                        className="h-9 px-2 text-[#9AA2B1] rounded-xl font-bold text-xs">
                                        <X size={14} />
                                    </button>
                                </div>
                            )}
                            {editingAiBonus === u.id && (
                                <div className="mt-3 flex items-center gap-2">
                                    <span className="text-xs font-bold text-[#9AA2B1]">Crediti AI +</span>
                                    <input
                                        type="number" min="1" step="1"
                                        value={aiBonusInput}
                                        onChange={e => setAiBonusInput(e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Enter') handleGrantAiCredits(u.id); if (e.key === 'Escape') setEditingAiBonus(null); }}
                                        className="flex-1 h-9 px-3 bg-[#FAFAFC] border border-[#7B5CF6] rounded-xl text-sm outline-none font-bold"
                                        placeholder="es. 10"
                                        autoFocus
                                    />
                                    <button onClick={() => handleGrantAiCredits(u.id)} disabled={savingAiBonus}
                                        className="h-9 px-3 bg-[#7B5CF6] text-white rounded-xl font-bold text-xs disabled:opacity-50">
                                        {savingAiBonus ? '...' : 'Aggiungi'}
                                    </button>
                                    <button onClick={() => setEditingAiBonus(null)}
                                        className="h-9 px-2 text-[#9AA2B1] rounded-xl font-bold text-xs">
                                        <X size={14} />
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                    {filtered.length === 0 && <p className="text-center text-[#9AA2B1] font-bold py-8">Nessun utente trovato</p>}
                </div>
            )}
        </div>
    );
}

/* ─── Sezione: Gestione Eventi ───────────────────────────── */
function SectionEvents({ onBack }: { onBack: () => void }) {
    const [events, setEvents] = useState<AdminEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editEvent, setEditEvent] = useState<AdminEvent | null>(null);
    const [expandedPanel, setExpandedPanel] = useState<{ id: string; type: 'bookers' | 'interests' } | null>(null);

    const load = useCallback(async () => { setLoading(true); setEvents((await getAdminEvents()) as AdminEvent[]); setLoading(false); }, []);
    useEffect(() => { load(); }, [load]);
    useEffect(() => {
        const supabase = createClient();
        const ch = supabase.channel('admin-events-rt')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, () => load())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'event_bookings' }, () => load())
            .subscribe();
        return () => { supabase.removeChannel(ch); };
    }, [load]);

    const [evtFullscreenImages, setEvtFullscreenImages] = useState<string[] | null>(null);

    const handleDelete = async (id: string, title: string) => {
        if (!confirm(`Eliminare "${title}"?`)) return;
        const result = await deleteEvent(id);
        if (!result.ok) { alert(result.error); return; }
        await load();
    };
    const handleToggleActive = async (ev: AdminEvent) => {
        try { await updateEvent(ev.id, { is_active: !ev.is_active }); await load(); } catch (e: any) { alert(e.message); }
    };

    return (
        <div>
            <div className="flex items-center gap-3 mb-6">
                <button onClick={onBack} className="w-10 h-10 flex items-center justify-center bg-white border border-[#EEF0F4] rounded-xl text-[#9AA2B1] active:scale-95 transition-transform flex-shrink-0">
                    <ArrowLeft size={20} />
                </button>
                <h2 className="text-xl font-black text-[#1C1C1E] flex-1">Gestione Eventi</h2>
                <button onClick={() => { setEditEvent(null); setShowForm(true); }}
                    className="flex items-center gap-1.5 bg-[#7B5CF6] text-white px-3 py-2 rounded-xl font-bold text-sm shadow-sm">
                    <Plus size={15} /> Nuovo
                </button>
            </div>

            {loading ? (
                <p className="text-center text-[#9AA2B1] font-bold py-8">Caricamento...</p>
            ) : events.length === 0 ? (
                <p className="text-center text-[#9AA2B1] font-bold py-12">Nessun evento creato</p>
            ) : (
                <div className="flex flex-col gap-4">
                    {events.map(ev => {
                        const bookCount = ev.confirmed_count ?? 0;
                        const panelOpen = expandedPanel?.id === ev.id;
                        return (
                            <div key={ev.id} className="bg-white rounded-[24px] border border-[#EEF0F4] overflow-hidden shadow-sm">
                                <div className="flex gap-3 p-4">
                                    {ev.image_url ? (
                                        <img
                                            src={ev.image_url} alt={ev.title}
                                            className="w-16 h-16 rounded-xl object-cover flex-shrink-0 cursor-pointer active:scale-95 transition-transform"
                                            onClick={() => setEvtFullscreenImages(ev.image_urls?.length ? ev.image_urls : [ev.image_url!])}
                                        />
                                    ) : (
                                        <div className="w-16 h-16 rounded-xl bg-[#F4EEFF] flex items-center justify-center flex-shrink-0">
                                            <CalendarDays size={24} className="text-[#7B5CF6]" />
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-2">
                                            <p className="font-black text-[#1C1C1E] truncate">{ev.title}</p>
                                            <button onClick={() => handleToggleActive(ev)} className={`flex-shrink-0 ${ev.is_active ? 'text-[#7B5CF6]' : 'text-[#9AA2B1]'}`}>
                                                {ev.is_active ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                                            </button>
                                        </div>
                                        <p className="text-[#9AA2B1] text-xs font-medium">
                                            {new Date(ev.event_date).toLocaleString('it-IT', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                            <p className="text-[#7B5CF6] font-black text-sm">
                                                {ev.cost === 0 ? 'Gratis' : `€${Number(ev.cost).toFixed(2)}`}
                                                {ev.max_participants && <span className="text-[#9AA2B1] font-bold"> · {ev.max_participants} posti</span>}
                                            </p>
                                            {ev.duration_minutes ? (
                                                <span className="flex items-center gap-0.5 text-[#9AA2B1] text-xs font-bold">
                                                    <Clock size={11} /> {fmtDuration(ev.duration_minutes)}
                                                </span>
                                            ) : null}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 px-4 pb-4 flex-wrap">
                                    <button onClick={() => setExpandedPanel(panelOpen && expandedPanel?.type === 'bookers' ? null : { id: ev.id, type: 'bookers' })}
                                        className="flex items-center gap-1.5 bg-[#F4EEFF] text-[#7B5CF6] px-3 py-1.5 rounded-lg font-bold text-xs">
                                        <Users size={11} /> {bookCount}
                                        {panelOpen && expandedPanel?.type === 'bookers' ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                                    </button>
                                    <button onClick={() => setExpandedPanel(panelOpen && expandedPanel?.type === 'interests' ? null : { id: ev.id, type: 'interests' })}
                                        className="flex items-center gap-1.5 bg-[#FFF8E7] text-amber-600 px-3 py-1.5 rounded-lg font-bold text-xs border border-amber-100">
                                        <MessageSquare size={11} /> Interessi
                                        {panelOpen && expandedPanel?.type === 'interests' ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                                    </button>
                                    {ev.access_link && (
                                        <a href={ev.access_link} target="_blank" className="flex items-center gap-1 text-[#9AA2B1] text-xs font-bold hover:text-[#7B5CF6]">
                                            <ExternalLink size={12} /> Link
                                        </a>
                                    )}
                                    <div className="flex-1" />
                                    <button onClick={() => { setEditEvent(ev); setShowForm(true); }} className="w-8 h-8 flex items-center justify-center bg-[#FAFAFC] text-[#9AA2B1] hover:text-[#7B5CF6] rounded-lg transition-colors">
                                        <Edit2 size={14} />
                                    </button>
                                    <button onClick={() => handleDelete(ev.id, ev.title)} className="w-8 h-8 flex items-center justify-center bg-red-50 text-red-400 hover:text-red-600 rounded-lg transition-colors">
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                                {panelOpen && expandedPanel?.type === 'bookers' && <div className="px-4 pb-4"><BookersList eventId={ev.id} onClose={() => setExpandedPanel(null)} /></div>}
                                {panelOpen && expandedPanel?.type === 'interests' && <div className="px-4 pb-4"><InterestsList eventId={ev.id} onClose={() => setExpandedPanel(null)} /></div>}
                            </div>
                        );
                    })}
                </div>
            )}

            {showForm && (
                <EventFormModal initial={editEvent} onClose={() => { setShowForm(false); setEditEvent(null); }}
                    onSaved={async () => { setShowForm(false); setEditEvent(null); await load(); }} />
            )}

            {evtFullscreenImages && (
                <FullscreenViewer
                    type="images"
                    images={evtFullscreenImages}
                    onClose={() => setEvtFullscreenImages(null)}
                />
            )}
        </div>
    );
}

/* ─── Sezione: Costi AI ──────────────────────────────────── */
const PROVIDER_LABELS: Record<string, string> = {
    'openai-gpt4o-mini':    'GPT-4o mini (chat)',
    'openai-gpt4o-vision':  'GPT-4o Vision',
    'openai-dalle3':        'DALL-E 3 HD',
    'replicate-flux-schnell': 'Flux Schnell (fast)',
    'replicate-flux-dev':   'Flux Dev (riferimento)',
}

function SectionAiCosts({ onBack }: { onBack: () => void }) {
    const [spending, setSpending] = useState<AiSpendingSummary | null>(null)
    const [settings, setSettings] = useState<Record<string, string>>({})
    const [deposits, setDeposits] = useState<AiDeposit[]>([])
    const [supadata, setSupadata] = useState<SupadataStatus | null>(null)
    const [loading, setLoading] = useState(true)
    const [notice, setNotice] = useState('')
    const [noticeType, setNoticeType] = useState<'ok' | 'err'>('ok')

    const [editingBudget, setEditingBudget] = useState(false)
    const [budgetInput, setBudgetInput] = useState('')
    const [savingBudget, setSavingBudget] = useState(false)

    const [depositAmount, setDepositAmount] = useState('')
    const [depositProvider, setDepositProvider] = useState('all')
    const [depositNote, setDepositNote] = useState('')
    const [savingDeposit, setSavingDeposit] = useState(false)

    const [togglingAi, setTogglingAi] = useState(false)
    const [togglingAuto, setTogglingAuto] = useState(false)

    // Supadata budget
    const [editingSupadata, setEditingSupadata] = useState(false)
    const [supaBudgetInput, setSupaBudgetInput] = useState('')
    const [supaThreshInput, setSupaThreshInput] = useState('80')
    const [savingSupadata, setSavingSupadata] = useState(false)

    const showNotice = (msg: string, type: 'ok' | 'err' = 'ok') => {
        setNotice(msg); setNoticeType(type); setTimeout(() => setNotice(''), 3000)
    }

    const load = useCallback(async () => {
        setLoading(true)
        const [s, cfg, d, sup] = await Promise.all([
            getAiSpendingSummary(),
            getAdminSettings(),
            getAiDeposits(),
            getSupadataStatus(),
        ])
        setSpending(s)
        setSettings(cfg)
        setDeposits(d)
        setSupadata(sup)
        setBudgetInput(cfg.monthly_budget_usd ?? '50')
        setSupaBudgetInput(sup.budgetEur.toString())
        setSupaThreshInput(sup.notifyThreshold.toString())
        setLoading(false)
    }, [])

    useEffect(() => { load() }, [load])

    // Realtime: aggiorna quando arriva una nuova generazione AI
    useEffect(() => {
        const supabase = createClient()
        const ch = supabase.channel('ai-costs-rt')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ai_generations' }, () => load())
            .subscribe()
        return () => { supabase.removeChannel(ch) }
    }, [load])

    const aiEnabled = settings.ai_disabled !== 'true'
    const autoMode  = settings.auto_disable_ai === 'true'
    const budget    = parseFloat(settings.monthly_budget_usd ?? '50')
    const monthSpend = spending?.thisMonth ?? 0
    const budgetPct  = Math.min(100, Math.round((monthSpend / budget) * 100))
    const isOverBudget = monthSpend >= budget

    const handleToggleAi = async () => {
        setTogglingAi(true)
        try {
            const newVal = aiEnabled ? 'true' : 'false'
            await setAdminSetting('ai_disabled', newVal)
            setSettings(s => ({ ...s, ai_disabled: newVal }))
            showNotice(aiEnabled ? 'AI disabilitata' : 'AI riabilitata')
        } catch (e: any) { showNotice(e.message, 'err') }
        finally { setTogglingAi(false) }
    }

    const handleToggleAuto = async () => {
        setTogglingAuto(true)
        try {
            const newVal = autoMode ? 'false' : 'true'
            await setAdminSetting('auto_disable_ai', newVal)
            setSettings(s => ({ ...s, auto_disable_ai: newVal }))
            showNotice(newVal === 'true' ? 'Auto-disable attivato' : 'Auto-disable disattivato')
        } catch (e: any) { showNotice(e.message, 'err') }
        finally { setTogglingAuto(false) }
    }

    const handleSaveBudget = async () => {
        const n = parseFloat(budgetInput)
        if (isNaN(n) || n <= 0) { showNotice('Budget non valido', 'err'); return }
        setSavingBudget(true)
        try {
            await setAdminSetting('monthly_budget_usd', n.toString())
            setSettings(s => ({ ...s, monthly_budget_usd: n.toString() }))
            setEditingBudget(false)
            showNotice('Budget aggiornato')
        } catch (e: any) { showNotice(e.message, 'err') }
        finally { setSavingBudget(false) }
    }

    const handleAddDeposit = async () => {
        const n = parseFloat(depositAmount)
        if (isNaN(n) || n <= 0) { showNotice('Importo non valido', 'err'); return }
        setSavingDeposit(true)
        try {
            await addAiDeposit(n, depositProvider, depositNote)
            setDepositAmount(''); setDepositNote('')
            showNotice(`Ricarica $${n.toFixed(2)} registrata — AI riabilitata`)
            setSettings(s => ({ ...s, ai_disabled: 'false' }))
            await load()
        } catch (e: any) { showNotice(e.message, 'err') }
        finally { setSavingDeposit(false) }
    }

    const handleSaveSupadata = async () => {
        const budget = parseFloat(supaBudgetInput)
        const thresh = parseInt(supaThreshInput, 10)
        if (isNaN(budget) || budget < 0) { showNotice('Budget non valido', 'err'); return }
        if (isNaN(thresh) || thresh < 50 || thresh > 100) { showNotice('Soglia deve essere tra 50 e 100', 'err'); return }
        setSavingSupadata(true)
        try {
            await setSupadataBudget(budget, thresh)
            setEditingSupadata(false)
            showNotice('Impostazioni Supadata salvate')
            await load()
        } catch (e: any) { showNotice(e.message, 'err') }
        finally { setSavingSupadata(false) }
    }

    return (
        <div>
            <SectionHeader title="Costi AI" onBack={onBack} />

            {notice && (
                <div className={`font-bold text-sm p-3 rounded-xl mb-4 border ${noticeType === 'ok' ? 'bg-green-50 text-green-700 border-green-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                    {notice}
                </div>
            )}

            {loading ? (
                <p className="text-center text-[#9AA2B1] font-bold py-8">Caricamento...</p>
            ) : (
                <div className="space-y-4">

                    {/* Spesa — 3 card */}
                    <div className="grid grid-cols-3 gap-1.5 md:gap-2">
                        <StatCard label="Oggi" value={`$${(spending?.today ?? 0).toFixed(3)}`} />
                        <StatCard label="Questo mese" value={`$${monthSpend.toFixed(2)}`} />
                        <StatCard label="Totale storico" value={`$${(spending?.allTime ?? 0).toFixed(2)}`} />
                    </div>

                    {/* Spesa per servizio */}
                    {(spending?.byProvider.length ?? 0) > 0 && (
                        <div className="bg-white rounded-2xl border border-[#EEF0F4] p-4">
                            <p className="text-[10px] font-black text-[#9AA2B1] uppercase tracking-wider mb-3">Per servizio — questo mese</p>
                            <div className="space-y-2.5">
                                {spending!.byProvider.map(p => (
                                    <div key={p.provider} className="flex items-center gap-3">
                                        <span className="flex-1 font-bold text-[#1C1C1E] text-sm truncate">{PROVIDER_LABELS[p.provider] ?? p.provider}</span>
                                        <span className="text-[10px] text-[#9AA2B1] font-bold flex-shrink-0">{p.count} req</span>
                                        <span className="font-black text-[#7B5CF6] text-sm flex-shrink-0 w-16 text-right">${p.total.toFixed(3)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Budget mensile */}
                    <div className="bg-white rounded-2xl border border-[#EEF0F4] p-4 space-y-3">
                        <div className="flex items-center justify-between">
                            <p className="text-[10px] font-black text-[#9AA2B1] uppercase tracking-wider">Budget mensile</p>
                            <button onClick={() => setEditingBudget(v => !v)}
                                className="text-[11px] font-black text-[#7B5CF6]">
                                {editingBudget ? 'Annulla' : 'Modifica'}
                            </button>
                        </div>
                        {editingBudget ? (
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-[#9AA2B1]">$</span>
                                <input type="number" min="1" step="1" value={budgetInput}
                                    onChange={e => setBudgetInput(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') handleSaveBudget(); if (e.key === 'Escape') setEditingBudget(false) }}
                                    className="flex-1 h-9 px-3 bg-[#FAFAFC] border border-[#7B5CF6] rounded-xl text-sm outline-none font-bold"
                                    autoFocus />
                                <button onClick={handleSaveBudget} disabled={savingBudget}
                                    className="h-9 px-3 bg-[#7B5CF6] text-white rounded-xl font-bold text-xs disabled:opacity-50">
                                    {savingBudget ? '...' : 'Salva'}
                                </button>
                            </div>
                        ) : (
                            <>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="font-bold text-[#1C1C1E]">${monthSpend.toFixed(2)} / ${budget.toFixed(0)}</span>
                                    <span className={`font-black text-xs ${isOverBudget ? 'text-red-500' : budgetPct >= 80 ? 'text-amber-500' : 'text-[#7B5CF6]'}`}>{budgetPct}%</span>
                                </div>
                                <div className="h-2 bg-[#F4F4F8] rounded-full overflow-hidden">
                                    <div className={`h-full rounded-full transition-all duration-500 ${isOverBudget ? 'bg-red-400' : budgetPct >= 80 ? 'bg-amber-400' : 'bg-emerald-400'}`}
                                        style={{ width: `${budgetPct}%` }} />
                                </div>
                                {isOverBudget && (
                                    <p className="text-xs font-bold text-red-500 bg-red-50 rounded-xl px-3 py-2">
                                        Budget superato. Ricarica o disabilita l'AI manualmente.
                                    </p>
                                )}
                                {!isOverBudget && budgetPct >= 80 && (
                                    <p className="text-xs font-bold text-amber-600 bg-amber-50 rounded-xl px-3 py-2">
                                        Budget quasi esaurito ({budgetPct}%).
                                    </p>
                                )}
                            </>
                        )}
                    </div>

                    {/* Controllo AI */}
                    <div className="bg-white rounded-2xl border border-[#EEF0F4] p-4 space-y-3">
                        <p className="text-[10px] font-black text-[#9AA2B1] uppercase tracking-wider">Controllo AI</p>

                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-bold text-[#1C1C1E] text-sm">Stato AI</p>
                                <p className="text-xs text-[#9AA2B1]">{aiEnabled ? 'Attiva — tutti gli utenti possono usarla' : 'Disabilitata — nessun utente può usarla'}</p>
                            </div>
                            <button onClick={handleToggleAi} disabled={togglingAi}
                                className={`flex-shrink-0 transition-colors disabled:opacity-50 ${aiEnabled ? 'text-emerald-500' : 'text-[#9AA2B1]'}`}>
                                {aiEnabled ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
                            </button>
                        </div>

                        <div className="border-t border-[#F4F4F8] pt-3 flex items-center justify-between">
                            <div>
                                <p className="font-bold text-[#1C1C1E] text-sm">Disabilita automaticamente</p>
                                <p className="text-xs text-[#9AA2B1]">{autoMode ? "L'AI si spegne quando si supera il budget" : 'Solo manuale'}</p>
                            </div>
                            <button onClick={handleToggleAuto} disabled={togglingAuto}
                                className={`flex-shrink-0 transition-colors disabled:opacity-50 ${autoMode ? 'text-[#7B5CF6]' : 'text-[#9AA2B1]'}`}>
                                {autoMode ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
                            </button>
                        </div>
                    </div>

                    {/* Ricarica credito */}
                    <div className="bg-white rounded-2xl border border-[#EEF0F4] p-4 space-y-3">
                        <p className="text-[10px] font-black text-[#9AA2B1] uppercase tracking-wider">Ricarica credito</p>

                        <div className="flex gap-2">
                            <a href="https://platform.openai.com/account/billing" target="_blank" rel="noopener noreferrer"
                                className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-xl border border-[#EEF0F4] text-xs font-black text-[#1C1C1E] hover:bg-[#F4EEFF] transition-colors">
                                <ExternalLink size={12} /> OpenAI Billing
                            </a>
                            <a href="https://replicate.com/account/billing" target="_blank" rel="noopener noreferrer"
                                className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-xl border border-[#EEF0F4] text-xs font-black text-[#1C1C1E] hover:bg-[#F4EEFF] transition-colors">
                                <ExternalLink size={12} /> Replicate Billing
                            </a>
                        </div>

                        <p className="text-xs text-[#9AA2B1] font-medium">
                            Dopo aver ricaricato su OpenAI o Replicate, registra qui l'importo.
                            L'AI verrà riabilitata automaticamente.
                        </p>

                        <div className="flex gap-2 flex-wrap">
                            <select value={depositProvider} onChange={e => setDepositProvider(e.target.value)}
                                className="h-9 px-2 bg-[#FAFAFC] border border-[#EEF0F4] rounded-xl text-xs font-bold outline-none focus:border-[#7B5CF6]">
                                <option value="all">Tutti</option>
                                <option value="openai">OpenAI</option>
                                <option value="replicate">Replicate</option>
                            </select>
                            <div className="relative w-28">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#9AA2B1]">$</span>
                                <input type="number" min="1" step="0.01" placeholder="Importo"
                                    value={depositAmount} onChange={e => setDepositAmount(e.target.value)}
                                    className="w-full h-9 pl-6 pr-2 bg-[#FAFAFC] border border-[#EEF0F4] rounded-xl text-sm font-bold outline-none focus:border-[#7B5CF6]" />
                            </div>
                            <input type="text" placeholder="Nota (opz.)"
                                value={depositNote} onChange={e => setDepositNote(e.target.value)}
                                className="flex-1 min-w-[80px] h-9 px-3 bg-[#FAFAFC] border border-[#EEF0F4] rounded-xl text-xs font-bold outline-none focus:border-[#7B5CF6]" />
                            <button onClick={handleAddDeposit} disabled={savingDeposit || !depositAmount}
                                className="h-9 px-3 bg-[#7B5CF6] text-white rounded-xl font-bold text-xs disabled:opacity-50 flex-shrink-0">
                                {savingDeposit ? '...' : 'Registra'}
                            </button>
                        </div>

                        {deposits.length > 0 && (
                            <div className="space-y-1.5 pt-1 border-t border-[#F4F4F8]">
                                <p className="text-[10px] font-black text-[#9AA2B1] uppercase tracking-wider pt-1">Ultime ricariche</p>
                                {deposits.map(d => (
                                    <div key={d.id} className="flex items-center justify-between text-xs">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <span className="text-[#9AA2B1] flex-shrink-0">
                                                {new Date(d.created_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })}
                                            </span>
                                            <span className="font-bold text-[#9AA2B1] flex-shrink-0">{d.provider}</span>
                                            {d.note && <span className="text-[#9AA2B1] truncate">{d.note}</span>}
                                        </div>
                                        <span className="font-black text-emerald-600 flex-shrink-0 ml-2">+${Number(d.amount_usd).toFixed(2)}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* ── Supadata (Trascrizioni YouTube) ───────────────── */}
                    {supadata && (() => {
                        const pct = supadata.pctUsed
                        const isAlert = pct >= supadata.notifyThreshold
                        const isOver = supadata.monthlyCount >= supadata.freeLimit
                        const barColor = isOver ? 'bg-red-400' : isAlert ? 'bg-amber-400' : 'bg-emerald-400'
                        const textColor = isOver ? 'text-red-500' : isAlert ? 'text-amber-500' : 'text-[#7B5CF6]'
                        return (
                            <div className="bg-white rounded-2xl border border-[#EEF0F4] p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                    <p className="text-[10px] font-black text-[#9AA2B1] uppercase tracking-wider">
                                        Trascrizioni YouTube (Supadata)
                                    </p>
                                    <button onClick={() => setEditingSupadata(v => !v)}
                                        className="text-[11px] font-black text-[#7B5CF6]">
                                        {editingSupadata ? 'Annulla' : 'Impostazioni'}
                                    </button>
                                </div>

                                {/* Contatore mensile */}
                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="font-bold text-[#1C1C1E]">
                                            {supadata.monthlyCount} / {supadata.freeLimit} richieste
                                        </span>
                                        <span className={`font-black text-xs ${textColor}`}>{pct}%</span>
                                    </div>
                                    <div className="h-2 bg-[#F4F4F8] rounded-full overflow-hidden">
                                        <div className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                                            style={{ width: `${pct}%` }} />
                                    </div>
                                    <div className="flex items-center justify-between text-[11px] text-[#9AA2B1] font-bold">
                                        <span>Reset tra {supadata.daysUntilReset} giorni</span>
                                        <span>Free tier: {supadata.freeLimit - supadata.monthlyCount} rimaste</span>
                                    </div>
                                </div>

                                {/* Avvisi */}
                                {isOver && (
                                    <div className="bg-red-50 border border-red-100 rounded-xl px-3 py-2 text-xs font-bold text-red-600">
                                        ⚠️ Limite free tier raggiunto! Le prossime trascrizioni costeranno crediti agli utenti.
                                        Ricarica Supadata per mantenere il servizio gratuito.
                                    </div>
                                )}
                                {!isOver && isAlert && (
                                    <div className="bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 text-xs font-bold text-amber-700">
                                        🔔 Hai usato il {pct}% del free tier mensile. Considera di ricaricare.
                                    </div>
                                )}

                                {/* Budget caricato + stima */}
                                <div className="flex items-center justify-between text-sm border-t border-[#F4F4F8] pt-2">
                                    <div>
                                        <p className="text-xs text-[#9AA2B1] font-bold">Credito Supadata caricato</p>
                                        <p className="font-black text-[#1C1C1E]">
                                            €{supadata.budgetEur.toFixed(2)}
                                        </p>
                                    </div>
                                    {supadata.recommendedBudget > 0 && (
                                        <div className="text-right">
                                            <p className="text-xs text-[#9AA2B1] font-bold">Budget consigliato</p>
                                            <p className="font-black text-amber-600">€{supadata.recommendedBudget.toFixed(2)}/mese</p>
                                        </div>
                                    )}
                                </div>

                                {/* Impostazioni */}
                                {editingSupadata && (
                                    <div className="border-t border-[#F4F4F8] pt-3 space-y-2">
                                        <div className="flex gap-2 items-center flex-wrap">
                                            <div className="relative w-28">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#9AA2B1]">€</span>
                                                <input type="number" min="0" step="1" placeholder="Budget"
                                                    value={supaBudgetInput} onChange={e => setSupaBudgetInput(e.target.value)}
                                                    className="w-full h-9 pl-6 pr-2 bg-[#FAFAFC] border border-[#EEF0F4] rounded-xl text-sm font-bold outline-none focus:border-[#7B5CF6]" />
                                            </div>
                                            <div className="relative w-24">
                                                <input type="number" min="50" max="100" step="5" placeholder="Soglia %"
                                                    value={supaThreshInput} onChange={e => setSupaThreshInput(e.target.value)}
                                                    className="w-full h-9 px-3 bg-[#FAFAFC] border border-[#EEF0F4] rounded-xl text-sm font-bold outline-none focus:border-[#7B5CF6]" />
                                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#9AA2B1] font-bold">%</span>
                                            </div>
                                            <button onClick={handleSaveSupadata} disabled={savingSupadata}
                                                className="h-9 px-3 bg-[#7B5CF6] text-white rounded-xl font-bold text-xs disabled:opacity-50">
                                                {savingSupadata ? '...' : 'Salva'}
                                            </button>
                                        </div>
                                        <p className="text-[11px] text-[#9AA2B1]">
                                            Budget = credito totale caricato su Supadata. Soglia = % a cui riceverai una notifica push.
                                        </p>
                                    </div>
                                )}

                                {/* Link ricarica */}
                                <a href="https://supadata.ai/dashboard" target="_blank" rel="noopener noreferrer"
                                    className="flex items-center justify-center gap-1.5 h-9 rounded-xl border border-[#EEF0F4] text-xs font-black text-[#1C1C1E] hover:bg-[#F4EEFF] transition-colors w-full">
                                    <ExternalLink size={12} /> Ricarica su Supadata
                                </a>
                            </div>
                        )
                    })()}

                </div>
            )}
        </div>
    )
}

/* ─── Support Chat Modal (admin → utente) ────────────────── */
function SupportChatModal({ report, onClose, onStatusChange }: {
    report: BugReport; onClose: () => void; onStatusChange: () => void;
}) {
    const [messages, setMessages] = useState<SupportMessage[]>([]);
    const [loading, setLoading] = useState(true);
    const [text, setText] = useState('');
    const [sending, setSending] = useState(false);
    const [toggling, setToggling] = useState(false);
    const bottomRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const load = useCallback(async () => {
        const data = await getAdminSupportMessages(report.id);
        setMessages(data as SupportMessage[]);
        setLoading(false);
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 60);
    }, [report.id]);

    useEffect(() => { load(); }, [load]);

    // Realtime: ascolta nuovi messaggi (dall'utente)
    useEffect(() => {
        const supabase = createClient();
        const ch = supabase.channel(`support-admin-${report.id}`)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'support_messages', filter: `bug_report_id=eq.${report.id}` }, () => load())
            .subscribe();
        return () => { supabase.removeChannel(ch); };
    }, [report.id, load]);

    useEffect(() => {
        document.body.style.overflow = 'hidden';
        const t = setTimeout(() => inputRef.current?.focus(), 300);
        return () => { document.body.style.overflow = ''; clearTimeout(t); };
    }, []);

    const handleSend = async () => {
        if (!text.trim() || sending) return;
        setSending(true);
        const content = text.trim();
        setText('');
        try {
            await sendAdminSupportReply(report.id, content);
            await load();
        } catch (e: any) { setText(content); alert(e.message); }
        finally { setSending(false); }
    };

    const handleToggleStatus = async () => {
        setToggling(true);
        try {
            await updateBugReportStatus(report.id, report.status === 'open' ? 'closed' : 'open');
            onStatusChange();
            onClose();
        } catch (e: any) { alert(e.message); }
        finally { setToggling(false); }
    };

    const isClosed = report.status === 'closed';

    return (
        <div className="fixed inset-0 z-[20000] flex items-end justify-center bg-black/50" onClick={onClose}>
            <div
                className="w-full max-w-2xl bg-white rounded-t-[32px] shadow-2xl animate-in slide-in-from-bottom duration-300 flex flex-col"
                style={{ maxHeight: '86dvh' }}
                onClick={e => e.stopPropagation()}
            >
                {/* Handle + header */}
                <div className="flex-shrink-0 px-5 pt-4 pb-3 border-b border-[#EEF0F4]">
                    <div className="w-10 h-1 bg-[#EEF0F4] rounded-full mx-auto mb-3" />
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                            <p className="font-black text-[#1C1C1E] text-[15px] leading-snug">{report.description}</p>
                            <div className="flex items-center gap-2 mt-1">
                                <p className="text-[#9AA2B1] text-xs font-medium truncate">{report.user_email ?? 'Utente anonimo'}</p>
                                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full flex-shrink-0 ${isClosed ? 'bg-[#F4F4F8] text-[#9AA2B1]' : 'bg-green-100 text-green-700'}`}>
                                    {isClosed ? 'Chiuso' : 'Aperto'}
                                </span>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                            <button
                                onClick={handleToggleStatus}
                                disabled={toggling}
                                className={`text-[11px] font-black px-2.5 py-1.5 rounded-xl transition-colors disabled:opacity-50 ${isClosed ? 'bg-green-50 text-green-700 hover:bg-green-100' : 'bg-red-50 text-red-500 hover:bg-red-100'}`}
                            >
                                {toggling ? '...' : isClosed ? 'Riapri' : 'Chiudi'}
                            </button>
                            <button onClick={onClose} className="w-9 h-9 flex items-center justify-center bg-[#F4F4F8] rounded-xl text-[#9AA2B1]">
                                <X size={16} />
                            </button>
                        </div>
                    </div>
                    {report.steps && (
                        <p className="text-xs text-[#9AA2B1] mt-2 bg-[#FAFAFC] rounded-xl px-3 py-2 leading-relaxed">
                            <span className="font-bold">Passi: </span>{report.steps}
                        </p>
                    )}
                </div>

                {/* Messaggi */}
                <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2 min-h-0">
                    {loading ? (
                        <p className="text-[#9AA2B1] text-sm text-center py-6">Caricamento...</p>
                    ) : messages.length === 0 ? (
                        <p className="text-[#9AA2B1] text-sm italic text-center py-6">Nessun messaggio — rispondi per avviare la conversazione</p>
                    ) : messages.map(m => (
                        <div key={m.id} className={`flex ${m.sender_type === 'admin' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[78%] flex flex-col gap-0.5 ${m.sender_type === 'admin' ? 'items-end' : 'items-start'}`}>
                                <span className="text-[10px] font-bold text-[#9AA2B1] px-1">
                                    {m.sender_type === 'admin' ? 'Tu (admin)' : 'Utente'}
                                </span>
                                <div className={`px-3 py-2 rounded-2xl text-sm font-medium leading-relaxed break-words min-w-0 ${m.sender_type === 'admin' ? 'bg-[#7B5CF6] text-white rounded-br-sm' : 'bg-[#F4F4F8] text-[#1C1C1E] rounded-bl-sm'}`}>
                                    {m.content}
                                </div>
                                <span className="text-[9px] text-[#C0C7D4] font-medium px-1">
                                    {new Date(m.created_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                        </div>
                    ))}
                    <div ref={bottomRef} />
                </div>

                {/* Input */}
                {!isClosed && (
                    <div className="flex-shrink-0 flex gap-2 px-4 py-3 border-t border-[#EEF0F4]">
                        <input
                            ref={inputRef}
                            value={text}
                            onChange={e => setText(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                            placeholder="Rispondi all'utente..."
                            className="flex-1 h-11 px-4 text-sm bg-[#FAFAFC] border border-[#EEF0F4] rounded-2xl outline-none focus:border-[#7B5CF6]"
                        />
                        <button
                            onClick={handleSend}
                            disabled={!text.trim() || sending}
                            className="h-11 w-11 flex items-center justify-center bg-[#7B5CF6] text-white rounded-2xl disabled:opacity-40 flex-shrink-0 active:scale-90 transition-transform"
                        >
                            <Send size={15} />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

/* ─── Sezione: Segnalazioni supporto ─────────────────────── */
function SectionSupport({ onBack }: { onBack: () => void }) {
    const [reports, setReports] = useState<BugReport[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeReport, setActiveReport] = useState<BugReport | null>(null);
    const [filter, setFilter] = useState<'open' | 'closed' | 'all'>('open');

    const load = useCallback(async () => {
        setLoading(true);
        const data = await getAllBugReports();
        setReports(data as BugReport[]);
        setLoading(false);
    }, []);

    useEffect(() => { load(); }, [load]);

    // Realtime: aggiorna lista quando arriva una nuova segnalazione o cambia stato
    useEffect(() => {
        const supabase = createClient();
        const ch = supabase.channel('admin-support-rt')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'bug_reports' }, () => load())
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'support_messages' }, () => load())
            .subscribe();
        return () => { supabase.removeChannel(ch); };
    }, [load]);

    const filtered = reports.filter(r => filter === 'all' ? true : r.status === filter);
    const openCount = reports.filter(r => r.status === 'open').length;

    return (
        <>
            <div>
                <SectionHeader title="Segnalazioni" onBack={onBack} />

                {/* Filtro */}
                <div className="flex gap-2 mb-4">
                    {([['open', 'Aperte'], ['closed', 'Chiuse'], ['all', 'Tutte']] as const).map(([val, label]) => (
                        <button
                            key={val}
                            onClick={() => setFilter(val)}
                            className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-colors ${filter === val ? 'bg-[#7B5CF6] text-white' : 'bg-[#F4F4F8] text-[#9AA2B1] hover:bg-[#EEF0F4]'}`}
                        >
                            {label}{val === 'open' && openCount > 0 ? ` (${openCount})` : ''}
                        </button>
                    ))}
                </div>

                {loading ? (
                    <p className="text-center text-[#9AA2B1] font-bold py-8">Caricamento...</p>
                ) : filtered.length === 0 ? (
                    <p className="text-center text-[#9AA2B1] font-bold py-12">Nessuna segnalazione</p>
                ) : (
                    <div className="flex flex-col gap-3">
                        {filtered.map(r => (
                            <button
                                key={r.id}
                                onClick={() => setActiveReport(r)}
                                className="w-full bg-white rounded-[20px] border border-[#EEF0F4] p-4 shadow-sm text-left active:scale-[0.98] transition-transform hover:border-[#D9B9F9]"
                            >
                                <div className="flex items-start gap-3">
                                    <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${r.status === 'open' ? 'bg-green-500' : 'bg-[#C0C7D4]'}`} />
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-[#1C1C1E] text-sm leading-snug line-clamp-2">{r.description}</p>
                                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                            <p className="text-[#9AA2B1] text-xs font-medium truncate">{r.user_email ?? 'Anonimo'}</p>
                                            <span className="text-[#9AA2B1] text-[10px]">·</span>
                                            <p className="text-[#9AA2B1] text-[10px] font-medium flex-shrink-0">
                                                {new Date(r.created_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })}
                                            </p>
                                        </div>
                                    </div>
                                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full flex-shrink-0 ml-1 ${r.status === 'open' ? 'bg-green-100 text-green-700' : 'bg-[#F4F4F8] text-[#9AA2B1]'}`}>
                                        {r.status === 'open' ? 'Aperta' : 'Chiusa'}
                                    </span>
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {activeReport && (
                <SupportChatModal
                    report={activeReport}
                    onClose={() => setActiveReport(null)}
                    onStatusChange={() => { load(); setActiveReport(null); }}
                />
            )}
        </>
    );
}

/* ═══════════════════════════════════════════════════════════
   SECTION LIBRARY
   ═══════════════════════════════════════════════════════════ */

const MAX_COVERS = 3;
const MAX_SEC_IMAGES = 3;
const LIBRARY_BUCKET = 'library-content';

function newSection(): LibrarySection {
    return { id: crypto.randomUUID(), title: '', body: '', image_urls: [], order: 0 };
}

function LibraryFormModal({ initial, onClose, onSaved }: {
    initial?: LibraryItem | null; onClose: () => void; onSaved: () => void;
}) {
    const [form, setForm] = useState<LibraryFormData>(initial ? {
        title: initial.title,
        description: initial.description,
        item_type: initial.item_type,
        tier: initial.tier,
        language: initial.language ?? '',
        cover_urls: initial.cover_urls,
        content_type: initial.content_type,
        pdf_url: initial.pdf_url ?? '',
        video_url: initial.video_url ?? '',
        sections: initial.sections,
        is_published: initial.is_published,
    } : {
        title: '', description: '', item_type: 'schema', tier: 'free',
        language: '', cover_urls: [], content_type: 'sections',
        pdf_url: '', video_url: '', sections: [], is_published: true,
    });
    const [coverPreviews, setCoverPreviews] = useState<string[]>(initial?.cover_urls ?? []);
    const [coverFiles, setCoverFiles] = useState<(File | null)[]>((initial?.cover_urls ?? []).map(() => null));
    const [pdfFile, setPdfFile] = useState<File | null>(null);
    const [sections, setSections] = useState<LibrarySection[]>(initial?.sections ?? []);
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState('');
    const [improvingLibField, setImprovingLibField] = useState<'title' | 'description' | null>(null);
    const [analyzingLibImage, setAnalyzingLibImage] = useState(false);
    const coverInputRef = useRef<HTMLInputElement>(null);
    const pdfInputRef = useRef<HTMLInputElement>(null);

    const analyzeLibImage = async () => {
        const url = coverPreviews[0];
        if (!url) return;
        setAnalyzingLibImage(true);
        try {
            const res = await fetch('/api/ai/analyze-image', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ imageUrl: url, context: 'library' }),
            });
            const data = await res.json();
            if (data.success) {
                setForm(f => ({
                    ...f,
                    title: data.title || f.title,
                    description: data.description || f.description,
                }));
            } else { alert(data.error || 'Errore analisi immagine'); }
        } catch (e: any) { alert(e.message); } finally { setAnalyzingLibImage(false); }
    };

    const improveLibText = async (field: 'title' | 'description') => {
        const text = field === 'title' ? form.title : form.description;
        if (!text.trim()) return;
        setImprovingLibField(field);
        try {
            const res = await fetch('/api/ai/improve-text', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, type: field, context: `Tipo: ${form.item_type}` }),
            });
            const data = await res.json();
            if (data.success) setForm(f => ({ ...f, [field]: data.text }));
        } catch {}
        setImprovingLibField(null);
    };

    const handleAddCovers = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files ?? []); e.target.value = '';
        const toAdd = files.slice(0, MAX_COVERS - coverPreviews.length);
        setCoverFiles(p => [...p, ...toAdd]);
        setCoverPreviews(p => [...p, ...toAdd.map(f => URL.createObjectURL(f))]);
    };
    const handleRemoveCover = (i: number) => {
        setCoverFiles(p => p.filter((_, j) => j !== i));
        setCoverPreviews(p => p.filter((_, j) => j !== i));
    };

    const uploadToStorage = async (path: string, file: File): Promise<string> => {
        const supabase = createClient();
        const { error } = await supabase.storage.from(LIBRARY_BUCKET).upload(path, file, { contentType: file.type, upsert: true });
        if (error) throw new Error(`Upload fallito: ${error.message}`);
        return supabase.storage.from(LIBRARY_BUCKET).getPublicUrl(path).data.publicUrl;
    };

    const handleSave = async () => {
        if (!form.title.trim()) { setErr('Il titolo è obbligatorio'); return; }
        setSaving(true); setErr('');
        try {
            const itemId = initial?.id ?? crypto.randomUUID();
            // Upload covers
            const finalCovers: string[] = [];
            for (let i = 0; i < coverPreviews.length; i++) {
                if (coverFiles[i]) {
                    finalCovers.push(await uploadToStorage(`covers/${itemId}/cover-${i}-${Date.now()}`, coverFiles[i]!));
                } else {
                    // coverPreviews[i] è l'URL Supabase originale quando non è stato sostituito
                    finalCovers.push(coverPreviews[i]);
                }
            }
            // Upload PDF
            let finalPdfUrl = form.pdf_url ?? '';
            if (form.content_type === 'pdf' && pdfFile) {
                finalPdfUrl = await uploadToStorage(`pdfs/${itemId}/document.pdf`, pdfFile);
            }
            // Upload section images — ricalcola order prima di salvare
            const finalSections: LibrarySection[] = [];
            for (const [si, sec] of sections.map((s, i) => [i, s] as const)) {
                const secImgUrls: string[] = [];
                for (const imgUrlOrLocal of sec.image_urls) {
                    if (imgUrlOrLocal.startsWith('blob:') || imgUrlOrLocal.startsWith('data:')) {
                        // local preview — need to re-fetch as blob
                        const resp = await fetch(imgUrlOrLocal);
                        const blob = await resp.blob();
                        const file = new File([blob], 'img.jpg', { type: blob.type });
                        secImgUrls.push(await uploadToStorage(`sections/${itemId}/${sec.id}/img-${Date.now()}-${secImgUrls.length}`, file));
                    } else {
                        secImgUrls.push(imgUrlOrLocal);
                    }
                }
                finalSections.push({ ...sec, order: si, image_urls: secImgUrls });
            }
            const payload: LibraryFormData = {
                ...form,
                cover_urls: finalCovers.filter(Boolean),
                pdf_url: finalPdfUrl,
                sections: finalSections,
            };
            if (initial) {
                await updateLibraryItem(initial.id, payload);
            } else {
                await createLibraryItem(itemId, payload);
            }
            onSaved();
        } catch (e: any) { setErr(e.message); } finally { setSaving(false); }
    };

    // ── Section editor helpers ───────────────────────────────
    const addSection = () => setSections(s => [...s, { ...newSection(), order: s.length }]);
    const removeSection = (id: string) => setSections(s =>
        s.filter(x => x.id !== id).map((x, i) => ({ ...x, order: i }))
    );
    const updateSectionField = (id: string, field: keyof LibrarySection, val: any) =>
        setSections(s => s.map(x => x.id === id ? { ...x, [field]: val } : x));
    const addSectionImages = (id: string, files: File[]) => {
        setSections(s => s.map(x => {
            if (x.id !== id) return x;
            const toAdd = files.slice(0, MAX_SEC_IMAGES - x.image_urls.length);
            return {
                ...x,
                image_urls: [...x.image_urls, ...toAdd.map(f => URL.createObjectURL(f))],
                image_captions: [...(x.image_captions ?? []), ...toAdd.map(() => '')],
            };
        }));
    };
    const removeSectionImage = (id: string, i: number) =>
        setSections(s => s.map(x => x.id === id ? {
            ...x,
            image_urls: x.image_urls.filter((_, j) => j !== i),
            image_captions: (x.image_captions ?? []).filter((_, j) => j !== i),
        } : x));
    const updateSectionCaption = (id: string, i: number, val: string) =>
        setSections(s => s.map(x => {
            if (x.id !== id) return x;
            const caps = [...(x.image_captions ?? x.image_urls.map(() => ''))];
            caps[i] = val;
            return { ...x, image_captions: caps };
        }));

    return (
        <div className="fixed inset-0 z-[10000] flex items-end justify-center bg-black/40" onClick={onClose}>
            <div className="w-full max-w-2xl bg-white rounded-t-[32px] p-6 pb-12 shadow-2xl animate-in slide-in-from-bottom duration-300 max-h-[92vh] overflow-y-auto"
                onClick={e => e.stopPropagation()}>
                <div className="w-12 h-1.5 bg-[#EEF0F4] rounded-full mx-auto mb-6" />
                <div className="flex items-center justify-between mb-5">
                    <h3 className="text-2xl font-black">{initial ? 'Modifica' : 'Nuovo Libro/Schema'}</h3>
                    <button onClick={onClose} className="text-[#9AA2B1]"><X size={20} /></button>
                </div>
                {err && <p className="text-red-500 text-sm font-bold mb-4 bg-red-50 p-3 rounded-xl">{err}</p>}

                {/* Covers */}
                <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-black text-[#9AA2B1] uppercase tracking-wider">Copertine ({coverPreviews.length}/{MAX_COVERS})</label>
                        {coverPreviews.length > 0 && (
                            <button type="button" onClick={analyzeLibImage} disabled={analyzingLibImage}
                                className="flex items-center gap-1 text-[#7B5CF6] text-[11px] font-bold disabled:opacity-40 hover:text-[#9B7DFF] transition-colors">
                                <Sparkles size={12} className={analyzingLibImage ? 'animate-pulse' : ''} />
                                {analyzingLibImage ? 'Analizzando...' : 'Analizza con AI'}
                            </button>
                        )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {coverPreviews.map((src, i) => (
                            <div key={i} className="relative w-20 h-28 rounded-xl overflow-hidden border border-[#EEF0F4]">
                                <img src={src} alt="" className="w-full h-full object-cover" />
                                <button onClick={() => handleRemoveCover(i)} className="absolute top-0.5 right-0.5 w-5 h-5 flex items-center justify-center bg-black/60 text-white rounded-full"><X size={10} /></button>
                            </div>
                        ))}
                        {coverPreviews.length < MAX_COVERS && (
                            <button type="button" onClick={() => coverInputRef.current?.click()}
                                className="w-20 h-28 rounded-xl border-2 border-dashed border-[#E6DAFF] flex flex-col items-center justify-center text-[#7B5CF6] bg-[#FAFAFC] hover:bg-[#F4EEFF] transition-colors">
                                <Plus size={20} /><span className="text-[10px] font-bold mt-0.5">Aggiungi</span>
                            </button>
                        )}
                    </div>
                    <input type="file" ref={coverInputRef} accept="image/*" multiple className="hidden" onChange={handleAddCovers} />
                </div>

                <div className="space-y-4">
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <label className="text-xs font-black text-[#9AA2B1] uppercase tracking-wider">Titolo *</label>
                            <button type="button" onClick={() => improveLibText('title')} disabled={improvingLibField === 'title' || !form.title.trim()}
                                className="flex items-center gap-1 text-[#7B5CF6] text-[11px] font-bold disabled:opacity-40 hover:text-[#9B7DFF] transition-colors">
                                <Sparkles size={12} className={improvingLibField === 'title' ? 'animate-pulse' : ''} />
                                {improvingLibField === 'title' ? 'Migliorando...' : 'Migliora con AI'}
                            </button>
                        </div>
                        <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="w-full h-12 px-4 bg-[#FAFAFC] border border-[#E6DAFF] rounded-xl outline-none focus:border-[#7B5CF6] font-medium" />
                    </div>
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <label className="text-xs font-black text-[#9AA2B1] uppercase tracking-wider">Descrizione</label>
                            <button type="button" onClick={() => improveLibText('description')} disabled={improvingLibField === 'description' || !form.description.trim()}
                                className="flex items-center gap-1 text-[#7B5CF6] text-[11px] font-bold disabled:opacity-40 hover:text-[#9B7DFF] transition-colors">
                                <Sparkles size={12} className={improvingLibField === 'description' ? 'animate-pulse' : ''} />
                                {improvingLibField === 'description' ? 'Migliorando...' : 'Migliora con AI'}
                            </button>
                        </div>
                        <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} className="w-full px-4 py-3 bg-[#FAFAFC] border border-[#E6DAFF] rounded-xl outline-none focus:border-[#7B5CF6] font-medium resize-none" />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                        <div>
                            <label className="text-xs font-black text-[#9AA2B1] uppercase tracking-wider block mb-1">Tipo</label>
                            <select value={form.item_type} onChange={e => setForm(f => ({ ...f, item_type: e.target.value as any }))} className="w-full h-12 px-3 bg-[#FAFAFC] border border-[#E6DAFF] rounded-xl outline-none focus:border-[#7B5CF6] font-medium">
                                <option value="schema">Schema</option>
                                <option value="book">Libro</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-black text-[#9AA2B1] uppercase tracking-wider block mb-1">Tier</label>
                            <select value={form.tier} onChange={e => setForm(f => ({ ...f, tier: e.target.value as any }))} className="w-full h-12 px-3 bg-[#FAFAFC] border border-[#E6DAFF] rounded-xl outline-none focus:border-[#7B5CF6] font-medium">
                                <option value="free">Free</option>
                                <option value="premium">Premium</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-black text-[#9AA2B1] uppercase tracking-wider block mb-1">Lingua</label>
                            <input value={form.language ?? ''} onChange={e => setForm(f => ({ ...f, language: e.target.value }))} placeholder="es. Italiano" className="w-full h-12 px-3 bg-[#FAFAFC] border border-[#E6DAFF] rounded-xl outline-none focus:border-[#7B5CF6] font-medium" />
                        </div>
                    </div>

                    {/* Pubblicato toggle */}
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-[#9AA2B1] uppercase tracking-wider">Pubblicato</span>
                        <button type="button" onClick={() => setForm(f => ({ ...f, is_published: !f.is_published }))}>
                            {form.is_published
                                ? <ToggleRight size={28} className="text-[#7B5CF6]" />
                                : <ToggleLeft size={28} className="text-[#9AA2B1]" />}
                        </button>
                    </div>

                    {/* Content type */}
                    <div>
                        <label className="text-xs font-black text-[#9AA2B1] uppercase tracking-wider block mb-2">Tipo di contenuto</label>
                        <div className="grid grid-cols-2 gap-2">
                            {(['pdf', 'sections'] as const).map(ct => (
                                <button key={ct} type="button" onClick={() => setForm(f => ({ ...f, content_type: ct }))}
                                    className={`h-12 rounded-xl font-black text-sm transition-colors ${form.content_type === ct ? 'bg-[#7B5CF6] text-white' : 'bg-[#FAFAFC] border border-[#E6DAFF] text-[#9AA2B1]'}`}>
                                    {ct === 'pdf' ? '📄 PDF' : '📝 Sezioni'}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* PDF Upload */}
                    {form.content_type === 'pdf' && (
                        <div>
                            <label className="text-xs font-black text-[#9AA2B1] uppercase tracking-wider block mb-2">File PDF</label>
                            {(pdfFile || form.pdf_url) && (
                                <div className="flex items-center gap-2 mb-2 bg-[#F4EEFF] rounded-xl px-3 py-2">
                                    <FileText size={16} className="text-[#7B5CF6]" />
                                    <span className="text-sm font-bold text-[#7B5CF6] truncate flex-1">
                                        {pdfFile ? pdfFile.name : 'PDF caricato'}
                                    </span>
                                    <button onClick={() => { setPdfFile(null); setForm(f => ({ ...f, pdf_url: '' })); }} className="text-[#9AA2B1]"><X size={14} /></button>
                                </div>
                            )}
                            <button type="button" onClick={() => pdfInputRef.current?.click()}
                                className="w-full h-12 border-2 border-dashed border-[#E6DAFF] rounded-xl flex items-center justify-center gap-2 text-[#7B5CF6] font-bold text-sm hover:bg-[#F4EEFF] transition-colors">
                                <Plus size={16} /> {pdfFile || form.pdf_url ? 'Sostituisci PDF' : 'Carica PDF'}
                            </button>
                            <input type="file" ref={pdfInputRef} accept="application/pdf" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) setPdfFile(f); e.target.value = ''; }} />
                        </div>
                    )}

                    {/* Video YouTube */}
                    <div>
                        <label className="text-xs font-black text-[#9AA2B1] uppercase tracking-wider block mb-2">Link Video YouTube (opzionale)</label>
                        <input
                            type="url"
                            placeholder="https://www.youtube.com/watch?v=..."
                            value={form.video_url ?? ''}
                            onChange={e => setForm(f => ({ ...f, video_url: e.target.value }))}
                            className="w-full h-11 border border-[#EEF0F4] rounded-xl px-3 text-sm font-bold text-[#1C1C1E] placeholder:text-[#C4C9D4] focus:outline-none focus:border-[#7B5CF6]"
                        />
                    </div>

                    {/* Sections editor */}
                    {form.content_type === 'sections' && (
                        <div>
                            <div className="flex items-center justify-between mb-3">
                                <label className="text-xs font-black text-[#9AA2B1] uppercase tracking-wider">Sezioni ({sections.length})</label>
                                <button type="button" onClick={addSection} className="flex items-center gap-1 text-[#7B5CF6] font-black text-xs px-3 py-1.5 bg-[#F4EEFF] rounded-xl active:scale-95 transition-transform">
                                    <Plus size={14} /> Aggiungi
                                </button>
                            </div>
                            <div className="flex flex-col gap-3">
                                {sections.map((sec, si) => {
                                    const secImgInput = React.createRef<HTMLInputElement>();
                                    return (
                                        <div key={sec.id} className="border border-[#E6DAFF] rounded-2xl p-4 bg-[#FAFAFC]">
                                            <div className="flex items-center gap-2 mb-3">
                                                <span className="text-xs font-black text-[#9AA2B1] w-5">{si + 1}.</span>
                                                <input
                                                    value={sec.title}
                                                    onChange={e => updateSectionField(sec.id, 'title', e.target.value)}
                                                    placeholder="Titolo sezione"
                                                    className="flex-1 h-9 px-3 bg-white border border-[#E6DAFF] rounded-xl outline-none focus:border-[#7B5CF6] font-bold text-sm"
                                                />
                                                <button onClick={() => removeSection(sec.id)} className="text-red-400 active:scale-90 transition-transform"><X size={16} /></button>
                                            </div>
                                            <textarea
                                                value={sec.body}
                                                onChange={e => updateSectionField(sec.id, 'body', e.target.value)}
                                                placeholder="Contenuto della sezione…"
                                                rows={3}
                                                className="w-full px-3 py-2 bg-white border border-[#E6DAFF] rounded-xl outline-none focus:border-[#7B5CF6] font-medium text-sm resize-none mb-3"
                                            />
                                            {/* Section images */}
                                            <div className="flex flex-col gap-2">
                                                {sec.image_urls.map((url, ii) => (
                                                    <div key={ii} className="flex items-center gap-2">
                                                        <div className="relative w-14 h-14 rounded-xl overflow-hidden border border-[#EEF0F4] flex-shrink-0">
                                                            <img src={url} alt="" className="w-full h-full object-cover" />
                                                            <button onClick={() => removeSectionImage(sec.id, ii)} className="absolute top-0.5 right-0.5 w-4 h-4 flex items-center justify-center bg-black/60 text-white rounded-full"><X size={8} /></button>
                                                        </div>
                                                        <input
                                                            value={(sec.image_captions ?? [])[ii] ?? ''}
                                                            onChange={e => updateSectionCaption(sec.id, ii, e.target.value)}
                                                            placeholder="Nome immagine (opzionale)"
                                                            className="flex-1 h-9 px-3 bg-white border border-[#E6DAFF] rounded-xl outline-none focus:border-[#7B5CF6] font-medium text-sm"
                                                        />
                                                    </div>
                                                ))}
                                                <div className="flex items-center gap-2">
                                                    {sec.image_urls.length < MAX_SEC_IMAGES && (
                                                        <button type="button" onClick={() => (secImgInput as any).current?.click()}
                                                            className="w-14 h-14 rounded-xl border-2 border-dashed border-[#E6DAFF] flex flex-col items-center justify-center text-[#7B5CF6] bg-white hover:bg-[#F4EEFF] transition-colors flex-shrink-0">
                                                            <Plus size={14} /><span className="text-[9px] font-bold">img</span>
                                                        </button>
                                                    )}
                                                </div>
                                                <input ref={secImgInput} type="file" accept="image/*" multiple className="hidden"
                                                    onChange={e => { const files = Array.from(e.target.files ?? []); addSectionImages(sec.id, files); e.target.value = ''; }} />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="w-full mt-6 h-12 bg-[#7B5CF6] text-white font-black rounded-2xl flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98] transition-transform"
                >
                    {saving ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save size={18} />}
                    {saving ? 'Salvataggio…' : (initial ? 'Salva modifiche' : 'Crea')}
                </button>
            </div>
        </div>
    );
}

function SectionLibrary({ onBack }: { onBack: () => void }) {
    const [items, setItems] = useState<LibraryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [formItem, setFormItem] = useState<LibraryItem | null | 'new'>('new' as any);
    const [showForm, setShowForm] = useState(false);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [deleting, setDeleting] = useState(false);

    const load = useCallback(async () => {
        try {
            const data = await getAdminLibraryItems();
            setItems(data);
        } catch {} finally { setLoading(false); }
    }, []);

    useEffect(() => { load(); }, [load]);

    const handleDelete = async (id: string) => {
        setDeleting(true);
        try { await deleteLibraryItem(id); await load(); } catch {} finally { setDeleting(false); setDeleteId(null); }
    };

    return (
        <div>
            <SectionHeader title="Libreria" onBack={onBack} />
            <button
                onClick={() => { setFormItem(null); setShowForm(true); }}
                className="w-full h-12 bg-[#7B5CF6] text-white font-black rounded-2xl flex items-center justify-center gap-2 mb-4 active:scale-[0.98] transition-transform"
            >
                <Plus size={18} /> Nuovo Libro/Schema
            </button>

            {loading ? (
                <div className="space-y-3">
                    {[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-[#F4F4F8] rounded-2xl animate-pulse" />)}
                </div>
            ) : items.length === 0 ? (
                <div className="text-center py-12 text-[#9AA2B1] font-bold">Nessun elemento in libreria</div>
            ) : (
                <div className="flex flex-col gap-3">
                    {items.map(item => (
                        <div key={item.id} className="bg-white border border-[#EEF0F4] rounded-2xl p-4 flex items-center gap-3 shadow-sm">
                            {item.cover_urls[0] ? (
                                <img src={item.cover_urls[0]} alt={item.title} className="w-12 h-16 rounded-xl object-cover flex-shrink-0" />
                            ) : (
                                <div className="w-12 h-16 rounded-xl bg-[#F4F4F8] flex items-center justify-center flex-shrink-0">
                                    <BookOpen size={20} className="text-[#9AA2B1]" />
                                </div>
                            )}
                            <div className="flex-1 min-w-0">
                                <p className="font-black text-[#1C1C1E] text-sm truncate">{item.title}</p>
                                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                    <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${item.item_type === 'book' ? 'bg-[#7B5CF6] text-white' : 'bg-amber-500 text-white'}`}>
                                        {item.item_type === 'book' ? 'Libro' : 'Schema'}
                                    </span>
                                    <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${item.tier === 'premium' ? 'bg-emerald-600 text-white' : 'bg-[#F4F4F8] text-[#9AA2B1]'}`}>
                                        {item.tier === 'premium' ? '✦ Premium' : 'Free'}
                                    </span>
                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${item.is_published ? 'bg-green-100 text-green-700' : 'bg-[#F4F4F8] text-[#9AA2B1]'}`}>
                                        {item.is_published ? 'Pubblicato' : 'Bozza'}
                                    </span>
                                </div>
                            </div>
                            <div className="flex gap-1 flex-shrink-0">
                                <button
                                    onClick={() => { setFormItem(item); setShowForm(true); }}
                                    className="w-8 h-8 flex items-center justify-center rounded-xl bg-[#F4EEFF] text-[#7B5CF6] active:scale-90 transition-transform"
                                >
                                    <Edit2 size={14} />
                                </button>
                                <button
                                    onClick={() => setDeleteId(item.id)}
                                    className="w-8 h-8 flex items-center justify-center rounded-xl bg-red-50 text-red-500 active:scale-90 transition-transform"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Delete confirm */}
            {deleteId && (
                <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/40 p-4">
                    <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl">
                        <p className="font-black text-[#1C1C1E] text-lg mb-2">Elimina elemento</p>
                        <p className="text-[#9AA2B1] text-sm mb-5">Questa azione è irreversibile. I file caricati non saranno eliminati dallo storage.</p>
                        <div className="flex gap-3">
                            <button onClick={() => setDeleteId(null)} className="flex-1 h-11 bg-[#F4F4F8] rounded-2xl font-black text-sm text-[#1C1C1E]">Annulla</button>
                            <button onClick={() => handleDelete(deleteId)} disabled={deleting} className="flex-1 h-11 bg-red-500 rounded-2xl font-black text-sm text-white disabled:opacity-50">
                                {deleting ? '…' : 'Elimina'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showForm && (
                <LibraryFormModal
                    initial={formItem as LibraryItem | null}
                    onClose={() => setShowForm(false)}
                    onSaved={() => { setShowForm(false); load(); }}
                />
            )}
        </div>
    );
}

/* ══════════════════════════════════════════════════════════
   MAIN DASHBOARD
   ═══════════════════════════════════════════════════════════ */
// ── Sezione Newsletter ──────────────────────────────────────────────────────
/* ─── Email Marketing — sezione completa ────────────────────── */

const TRIGGER_LABELS: Record<string, string> = {
    first_login: '🎉 Primo accesso',
    event_booked: '📅 Prenotazione evento',
    premium_purchased: '💎 Piano Premium',
    inactive_14d: '😴 Inattivo 14 giorni',
    never_booked_7d: '🎯 Mai prenotato (7gg)',
    bug_reported: '🐛 Bug segnalato',
    manual_youtube: '🎬 Nuovo tutorial YouTube',
    manual_update: '🚀 Aggiornamento app',
    new_event: '📣 Nuovo evento',
    new_library_item: '📚 Nuovo schema/libro',
}
const MANUAL_TRIGGERS = ['manual_youtube', 'manual_update']
const STATUS_COLORS: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-500',
    approved: 'bg-amber-100 text-amber-700',
    sending: 'bg-blue-100 text-blue-700',
    sent: 'bg-green-100 text-green-700',
}
const STATUS_LABELS: Record<string, string> = { draft: 'Bozza', approved: 'Approvata', sending: 'Invio...', sent: 'Inviata' }

type EmailTab = 'campagne' | 'sequenze' | 'inviate' | 'ricevute'

function SectionEmailMarketing({ onBack }: { onBack: () => void }) {
    const [tab, setTab] = useState<EmailTab>('campagne')
    const [unreadCount, setUnreadCount] = useState(0)

    // Fetch unread count once
    useEffect(() => {
        getReceivedEmails().then(emails => setUnreadCount(emails.filter(e => !e.is_read).length)).catch(() => {})
    }, [])

    const TABS: { key: EmailTab; label: string; badge?: number }[] = [
        { key: 'campagne', label: 'Campagne' },
        { key: 'sequenze', label: 'Sequenze' },
        { key: 'inviate', label: 'Inviate' },
        { key: 'ricevute', label: 'Ricevute', badge: unreadCount },
    ]

    return (
        <div>
            <div className="flex items-center gap-3 mb-5">
                <button onClick={onBack} className="w-10 h-10 flex items-center justify-center bg-white border border-[#EEF0F4] rounded-xl text-[#9AA2B1] active:scale-95 transition-transform flex-shrink-0">
                    <ArrowLeft size={20} />
                </button>
                <h2 className="text-xl font-black text-[#1C1C1E] flex-1">Email Marketing</h2>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-[#F4F4F8] rounded-2xl p-1 mb-5">
                {TABS.map(t => (
                    <button key={t.key} onClick={() => setTab(t.key)}
                        className={`flex-1 py-2 rounded-xl text-xs font-black transition-all relative ${tab === t.key ? 'bg-white text-[#1C1C1E] shadow-sm' : 'text-[#9AA2B1]'}`}>
                        {t.label}
                        {t.badge && t.badge > 0 ? (
                            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-[9px] font-black flex items-center justify-center">{t.badge}</span>
                        ) : null}
                    </button>
                ))}
            </div>

            {tab === 'campagne' && <TabCampaigns />}
            {tab === 'sequenze' && <TabSequences />}
            {tab === 'inviate' && <TabLogs />}
            {tab === 'ricevute' && <TabReceived onUnreadChange={setUnreadCount} />}
        </div>
    )
}

/* ─── Tab: Campagne ─────────────────────────────────────────── */
function TabCampaigns() {
    const [campaigns, setCampaigns] = useState<EmailCampaign[]>([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [editCampaign, setEditCampaign] = useState<EmailCampaign | null>(null)
    const [busy, setBusy] = useState<Record<string, boolean>>({})
    const [notice, setNotice] = useState('')

    const load = useCallback(async () => {
        getCampaigns().then(data => { setCampaigns(data); setLoading(false) }).catch(() => setLoading(false))
    }, [])
    useEffect(() => { load() }, [load])

    const handleApprove = async (id: string) => {
        setBusy(b => ({ ...b, [id]: true }))
        try {
            const { recipientCount } = await approveCampaign(id)
            setNotice(`Campagna approvata — sarà inviata a ${recipientCount} destinatari`)
            await load()
        } catch (e: any) { alert(e.message) } finally { setBusy(b => ({ ...b, [id]: false })) }
    }
    const handleSend = async (id: string) => {
        if (!confirm('Inviare la campagna ora a tutti i destinatari?')) return
        setBusy(b => ({ ...b, [id + '_send']: true }))
        try {
            const { sent, errors } = await sendCampaignNow(id)
            setNotice(`✓ Inviata a ${sent} destinatari${errors > 0 ? ` (${errors} errori)` : ''}`)
            await load()
        } catch (e: any) { alert(e.message) } finally { setBusy(b => ({ ...b, [id + '_send']: false })) }
    }
    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`Eliminare la campagna "${name}"?`)) return
        await deleteCampaign(id).catch(e => alert(e.message))
        await load()
    }

    return (
        <div className="space-y-3">
            {notice && <div className="bg-green-50 border border-green-200 rounded-2xl px-4 py-3 text-green-700 text-sm font-bold">{notice}</div>}
            <button onClick={() => { setEditCampaign(null); setShowModal(true) }}
                className="w-full py-3 bg-[#7B5CF6] text-white rounded-2xl font-bold text-sm flex items-center justify-center gap-2 shadow-sm">
                <Plus size={15} /> Nuova Campagna
            </button>
            {loading ? <p className="text-center text-[#9AA2B1] font-bold py-6">Caricamento...</p> : campaigns.length === 0 ? (
                <p className="text-center text-[#9AA2B1] text-sm italic py-6">Nessuna campagna creata</p>
            ) : campaigns.map(c => (
                <div key={c.id} className="bg-white rounded-[20px] border border-[#EEF0F4] p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-2 mb-1">
                        <p className="font-black text-[#1C1C1E] text-sm">{c.name}</p>
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full flex-shrink-0 ${STATUS_COLORS[c.status] ?? 'bg-gray-100 text-gray-500'}`}>
                            {STATUS_LABELS[c.status] ?? c.status}
                        </span>
                    </div>
                    <p className="text-[#9AA2B1] text-xs font-medium mb-1 truncate">{c.subject || '(Nessun oggetto)'}</p>
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] text-[#9AA2B1] font-bold">{c.target}</span>
                        {c.recipient_count != null && <span className="text-[10px] text-[#9AA2B1] font-bold">· {c.recipient_count} destinatari</span>}
                        {c.sent_at && <span className="text-[10px] text-[#9AA2B1] font-bold">· {new Date(c.sent_at).toLocaleDateString('it-IT')}</span>}
                        <div className="flex-1" />
                        {c.status === 'draft' && (
                            <>
                                <button onClick={() => { setEditCampaign(c); setShowModal(true) }} className="w-7 h-7 flex items-center justify-center bg-[#FAFAFC] text-[#9AA2B1] hover:text-[#7B5CF6] rounded-lg">
                                    <Edit2 size={13} />
                                </button>
                                <button onClick={() => handleApprove(c.id)} disabled={busy[c.id]} className="px-2.5 py-1 bg-amber-500 text-white rounded-lg text-[10px] font-black disabled:opacity-50">
                                    {busy[c.id] ? '...' : '✓ Approva'}
                                </button>
                            </>
                        )}
                        {c.status === 'approved' && (
                            <button onClick={() => handleSend(c.id)} disabled={busy[c.id + '_send']}
                                className="px-2.5 py-1 bg-[#7B5CF6] text-white rounded-lg text-[10px] font-black disabled:opacity-50 flex items-center gap-1">
                                <Send size={10} /> {busy[c.id + '_send'] ? 'Invio...' : 'Invia ora'}
                            </button>
                        )}
                        {c.status !== 'sending' && (
                            <button onClick={() => handleDelete(c.id, c.name)} className="w-7 h-7 flex items-center justify-center bg-red-50 text-red-400 rounded-lg">
                                <Trash2 size={13} />
                            </button>
                        )}
                    </div>
                </div>
            ))}
            {showModal && (
                <CampaignModal
                    initial={editCampaign}
                    onClose={() => { setShowModal(false); setEditCampaign(null) }}
                    onSaved={async () => { setShowModal(false); setEditCampaign(null); await load() }}
                />
            )}
        </div>
    )
}

/* ─── Campaign Modal ─────────────────────────────────────────── */
function CampaignModal({ initial, onClose, onSaved }: { initial?: EmailCampaign | null; onClose: () => void; onSaved: () => void }) {
    const [name, setName] = useState(initial?.name ?? '')
    const [subject, setSubject] = useState(initial?.subject ?? '')
    const [body, setBody] = useState(initial?.body_html ?? '')
    const [target, setTarget] = useState<'newsletter' | 'marketing' | 'all'>(initial?.target as any ?? 'newsletter')
    const [saving, setSaving] = useState(false)
    const [err, setErr] = useState('')
    const [improvingField, setImprovingField] = useState<'subject' | 'body' | null>(null)

    const improveField = async (field: 'subject' | 'body') => {
        const text = field === 'subject' ? subject : body
        if (!text.trim()) return
        setImprovingField(field)
        try {
            const res = await fetch('/api/ai/improve-text', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, type: field === 'subject' ? 'title' : 'description' }),
            })
            const data = await res.json()
            if (data.success) { if (field === 'subject') setSubject(data.text); else setBody(data.text) }
        } catch {} finally { setImprovingField(null) }
    }

    const handleSave = async () => {
        if (!name.trim() || !subject.trim()) { setErr('Nome e oggetto sono obbligatori'); return }
        setSaving(true); setErr('')
        try {
            const payload = { name, subject, body_html: body.includes('<') ? body : `<p style="margin:0 0 16px;font-size:15px;color:#1C1C1E;line-height:1.7;">${body.replace(/\n/g, '<br>')}</p>`, target }
            if (initial) await updateCampaign(initial.id, payload)
            else await createCampaign(payload)
            onSaved()
        } catch (e: any) { setErr(e.message) } finally { setSaving(false) }
    }

    return (
        <div className="fixed inset-0 z-[10000] flex items-end justify-center bg-black/40" onClick={onClose}>
            <div className="w-full max-w-2xl bg-white rounded-t-[32px] p-6 pb-10 shadow-2xl animate-in slide-in-from-bottom duration-300 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="w-12 h-1.5 bg-[#EEF0F4] rounded-full mx-auto mb-5" />
                <div className="flex items-center justify-between mb-5">
                    <h3 className="text-xl font-black">{initial ? 'Modifica Campagna' : 'Nuova Campagna'}</h3>
                    <button onClick={onClose}><X size={20} className="text-[#9AA2B1]" /></button>
                </div>
                {err && <p className="text-red-500 text-sm font-bold mb-3 bg-red-50 p-3 rounded-xl">{err}</p>}
                <div className="space-y-4">
                    <div>
                        <label className="text-xs font-black text-[#9AA2B1] uppercase tracking-wider block mb-1">Nome campagna *</label>
                        <input value={name} onChange={e => setName(e.target.value)} placeholder="es. Newsletter marzo 2026" className="w-full h-12 px-4 bg-[#FAFAFC] border border-[#E6DAFF] rounded-xl outline-none focus:border-[#7B5CF6] font-medium" />
                    </div>
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <label className="text-xs font-black text-[#9AA2B1] uppercase tracking-wider">Oggetto *</label>
                            <button type="button" onClick={() => improveField('subject')} disabled={!subject.trim() || improvingField === 'subject'}
                                className="flex items-center gap-1 text-[#7B5CF6] text-[11px] font-bold disabled:opacity-40">
                                <Sparkles size={11} className={improvingField === 'subject' ? 'animate-pulse' : ''} />
                                {improvingField === 'subject' ? 'Migliorando...' : 'Migliora con AI'}
                            </button>
                        </div>
                        <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="es. ✨ Novità di marzo per te" className="w-full h-12 px-4 bg-[#FAFAFC] border border-[#E6DAFF] rounded-xl outline-none focus:border-[#7B5CF6] font-medium" />
                    </div>
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <label className="text-xs font-black text-[#9AA2B1] uppercase tracking-wider">Corpo email</label>
                            <button type="button" onClick={() => improveField('body')} disabled={!body.trim() || improvingField === 'body'}
                                className="flex items-center gap-1 text-[#7B5CF6] text-[11px] font-bold disabled:opacity-40">
                                <Sparkles size={11} className={improvingField === 'body' ? 'animate-pulse' : ''} />
                                {improvingField === 'body' ? 'Migliorando...' : 'Migliora con AI'}
                            </button>
                        </div>
                        <textarea value={body} onChange={e => setBody(e.target.value)} rows={7} placeholder="Scrivi il corpo dell'email. Usa {{nome}}, {{cara}}, {{benvenut}} per personalizzare." className="w-full px-4 py-3 bg-[#FAFAFC] border border-[#E6DAFF] rounded-xl outline-none focus:border-[#7B5CF6] font-medium resize-none text-sm" />
                        <p className="text-[10px] text-[#9AA2B1] mt-0.5">Merge tag: {'{{nome}}'} {'{{cara}}'} {'{{benvenut}}'}</p>
                    </div>
                    <div>
                        <label className="text-xs font-black text-[#9AA2B1] uppercase tracking-wider block mb-2">Destinatari</label>
                        <div className="flex gap-2 flex-wrap">
                            {(['newsletter', 'marketing', 'all'] as const).map(t => (
                                <button key={t} type="button" onClick={() => setTarget(t)}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${target === t ? 'bg-[#7B5CF6] text-white border-[#7B5CF6]' : 'bg-white text-[#9AA2B1] border-[#EEF0F4]'}`}>
                                    {t === 'newsletter' ? '📧 Aggiornamenti' : t === 'marketing' ? '🎯 Promozioni' : '🌐 Tutte'}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
                <div className="flex gap-3 mt-6">
                    <button onClick={onClose} className="flex-1 h-12 bg-white border border-[#EEF0F4] rounded-2xl font-bold text-[#9AA2B1]">Annulla</button>
                    <button onClick={handleSave} disabled={saving} className="flex-[2] h-12 bg-[#7B5CF6] text-white rounded-2xl font-bold flex items-center justify-center gap-2 disabled:opacity-60">
                        <Save size={15} /> {saving ? 'Salvataggio...' : 'Salva bozza'}
                    </button>
                </div>
            </div>
        </div>
    )
}

/* ─── Tab: Sequenze ─────────────────────────────────────────── */
function TabSequences() {
    const [sequences, setSequences] = useState<EmailSequence[]>([])
    const [steps, setSteps] = useState<Record<string, EmailSequenceStep[]>>({})
    const [expanded, setExpanded] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const [showNew, setShowNew] = useState(false)
    const [newName, setNewName] = useState('')
    const [newTrigger, setNewTrigger] = useState('first_login')
    const [creating, setCreating] = useState(false)
    const [notice, setNotice] = useState('')
    // Linked entity state
    const [linkedEventId, setLinkedEventId] = useState('')
    const [linkedLibItemId, setLinkedLibItemId] = useState('')
    const [linkedYoutubeUrl, setLinkedYoutubeUrl] = useState('')
    const [eventsList, setEventsList] = useState<{ id: string; title: string; description: string | null }[]>([])
    const [libList, setLibList] = useState<{ id: string; title: string; description: string }[]>([])
    // Audience counts
    const [audience, setAudience] = useState<{ newsletter: number; marketing: number; all: number } | null>(null)

    const load = useCallback(async () => {
        getSequences().then(data => { setSequences(data); setLoading(false) }).catch(() => setLoading(false))
    }, [])
    useEffect(() => { load() }, [load])
    useEffect(() => {
        getAudienceCounts().then(setAudience).catch(() => {})
        getAdminEvents().then(evs => setEventsList(evs.map(e => ({ id: e.id, title: e.title, description: e.description })))).catch(() => {})
        getAdminLibraryItems().then(items => setLibList(items.map(i => ({ id: i.id, title: i.title, description: i.description })))).catch(() => {})
    }, [])

    const loadSteps = async (seqId: string) => {
        const data = await getSequenceSteps(seqId)
        setSteps(s => ({ ...s, [seqId]: data }))
    }

    const handleExpand = (id: string) => {
        if (expanded === id) { setExpanded(null); return }
        setExpanded(id)
        if (!steps[id]) loadSteps(id)
    }

    const handleCreate = async () => {
        if (!newName.trim()) return
        setCreating(true)
        try {
            // Resolve linked entity info
            let linked_event_id: string | null = null
            let linked_library_item_id: string | null = null
            let linked_youtube_url: string | null = null
            let linked_entity_title: string | null = null
            let linked_entity_description: string | null = null

            if (newTrigger === 'new_event' && linkedEventId) {
                const ev = eventsList.find(e => e.id === linkedEventId)
                linked_event_id = linkedEventId
                linked_entity_title = ev?.title ?? null
                linked_entity_description = ev?.description ?? null
            } else if (newTrigger === 'new_library_item' && linkedLibItemId) {
                const item = libList.find(i => i.id === linkedLibItemId)
                linked_library_item_id = linkedLibItemId
                linked_entity_title = item?.title ?? null
                linked_entity_description = item?.description ?? null
            } else if (newTrigger === 'manual_youtube' && linkedYoutubeUrl.trim()) {
                linked_youtube_url = linkedYoutubeUrl.trim()
            }

            await createSequence({
                name: newName, trigger_type: newTrigger,
                linked_event_id, linked_library_item_id, linked_youtube_url,
                linked_entity_title, linked_entity_description,
            })
            setNewName(''); setLinkedEventId(''); setLinkedLibItemId(''); setLinkedYoutubeUrl('')
            setShowNew(false); await load()
        } catch (e: any) { alert(e.message) } finally { setCreating(false) }
    }

    const handleToggle = async (id: string, current: boolean) => {
        await toggleSequenceActive(id, !current).catch(e => alert(e.message))
        await load()
    }

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`Eliminare la sequenza "${name}"?`)) return
        await deleteSequence(id).catch(e => alert(e.message))
        setSteps(s => { const n = { ...s }; delete n[id]; return n })
        if (expanded === id) setExpanded(null)
        await load()
    }

    const handleSendManual = async (id: string, name: string) => {
        if (!confirm(`Inviare "${name}" immediatamente a tutti gli iscritti alla newsletter?`)) return
        try {
            const { sent } = await sendManualSequenceToAll(id)
            setNotice(`✓ Inviata a ${sent} utenti`)
        } catch (e: any) { alert(e.message) }
    }

    return (
        <div className="space-y-3">
            {notice && <div className="bg-green-50 border border-green-200 rounded-2xl px-4 py-3 text-green-700 text-sm font-bold">{notice}</div>}

            {/* Audience summary */}
            {audience && (
                <div className="bg-[#FAFAFC] rounded-2xl border border-[#EEF0F4] px-4 py-3 flex gap-4 text-[11px] font-bold text-[#9AA2B1]">
                    <span>📧 Newsletter: <strong className="text-[#1C1C1E]">{audience.newsletter}</strong></span>
                    <span>🎯 Promozioni: <strong className="text-[#1C1C1E]">{audience.marketing}</strong></span>
                    <span>👥 Totale: <strong className="text-[#1C1C1E]">{audience.all}</strong></span>
                </div>
            )}

            <button onClick={() => setShowNew(v => !v)} className="w-full py-3 bg-[#7B5CF6] text-white rounded-2xl font-bold text-sm flex items-center justify-center gap-2">
                <Plus size={15} /> Nuova Sequenza
            </button>
            {showNew && (
                <div className="bg-white rounded-[20px] border border-[#EEF0F4] p-4 shadow-sm space-y-3">
                    <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Nome sequenza" className="w-full h-11 px-4 bg-[#FAFAFC] border border-[#E6DAFF] rounded-xl outline-none focus:border-[#7B5CF6] font-medium text-sm" />
                    <select value={newTrigger} onChange={e => { setNewTrigger(e.target.value); setLinkedEventId(''); setLinkedLibItemId(''); setLinkedYoutubeUrl('') }}
                        className="w-full h-11 px-3 bg-[#FAFAFC] border border-[#E6DAFF] rounded-xl outline-none focus:border-[#7B5CF6] font-medium text-sm">
                        {Object.entries(TRIGGER_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                    {/* Linked entity picker */}
                    {newTrigger === 'new_event' && (
                        <div>
                            <label className="text-[10px] font-black text-[#9AA2B1] uppercase tracking-wider block mb-1">Associa evento</label>
                            <select value={linkedEventId} onChange={e => setLinkedEventId(e.target.value)}
                                className="w-full h-11 px-3 bg-[#FAFAFC] border border-[#E6DAFF] rounded-xl outline-none focus:border-[#7B5CF6] font-medium text-sm">
                                <option value="">— Seleziona evento (opzionale)</option>
                                {eventsList.map(ev => <option key={ev.id} value={ev.id}>{ev.title}</option>)}
                            </select>
                            {linkedEventId && (() => { const ev = eventsList.find(e => e.id === linkedEventId); return ev?.description ? <p className="text-[10px] text-[#9AA2B1] mt-1 line-clamp-2">{ev.description}</p> : null })()}
                        </div>
                    )}
                    {newTrigger === 'new_library_item' && (
                        <div>
                            <label className="text-[10px] font-black text-[#9AA2B1] uppercase tracking-wider block mb-1">Associa schema/libro</label>
                            <select value={linkedLibItemId} onChange={e => setLinkedLibItemId(e.target.value)}
                                className="w-full h-11 px-3 bg-[#FAFAFC] border border-[#E6DAFF] rounded-xl outline-none focus:border-[#7B5CF6] font-medium text-sm">
                                <option value="">— Seleziona elemento (opzionale)</option>
                                {libList.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
                            </select>
                        </div>
                    )}
                    {newTrigger === 'manual_youtube' && (
                        <div>
                            <label className="text-[10px] font-black text-[#9AA2B1] uppercase tracking-wider block mb-1">Link tutorial YouTube</label>
                            <input value={linkedYoutubeUrl} onChange={e => setLinkedYoutubeUrl(e.target.value)}
                                placeholder="https://youtu.be/..." className="w-full h-11 px-4 bg-[#FAFAFC] border border-[#E6DAFF] rounded-xl outline-none focus:border-[#7B5CF6] font-medium text-sm" />
                        </div>
                    )}
                    <div className="flex gap-2">
                        <button onClick={() => setShowNew(false)} className="flex-1 h-10 bg-white border border-[#EEF0F4] rounded-xl font-bold text-[#9AA2B1] text-sm">Annulla</button>
                        <button onClick={handleCreate} disabled={creating || !newName.trim()} className="flex-[2] h-10 bg-[#7B5CF6] text-white rounded-xl font-bold text-sm disabled:opacity-60">
                            {creating ? 'Creazione...' : 'Crea'}
                        </button>
                    </div>
                </div>
            )}
            {loading ? <p className="text-center text-[#9AA2B1] font-bold py-6">Caricamento...</p> : sequences.length === 0 ? (
                <p className="text-center text-[#9AA2B1] text-sm italic py-6">Nessuna sequenza configurata</p>
            ) : sequences.map(seq => (
                <div key={seq.id} className="bg-white rounded-[20px] border border-[#EEF0F4] shadow-sm overflow-hidden">
                    <div className="flex items-center gap-2 p-4">
                        <div className="flex-1 min-w-0">
                            <p className="font-black text-[#1C1C1E] text-sm">{seq.name}</p>
                            <p className="text-[#9AA2B1] text-[11px] font-bold">{TRIGGER_LABELS[seq.trigger_type] ?? seq.trigger_type}</p>
                            {seq.linked_entity_title && (
                                <p className="text-[#7B5CF6] text-[10px] font-bold truncate">📎 {seq.linked_entity_title}</p>
                            )}
                            {seq.linked_youtube_url && (
                                <p className="text-[#7B5CF6] text-[10px] font-bold truncate">▶ {seq.linked_youtube_url}</p>
                            )}
                        </div>
                        {MANUAL_TRIGGERS.includes(seq.trigger_type) && seq.is_active && (
                            <button onClick={() => handleSendManual(seq.id, seq.name)}
                                className="flex items-center gap-1 px-2 py-1 bg-amber-50 text-amber-600 rounded-lg text-[10px] font-black border border-amber-100">
                                <Send size={10} /> Invia ora
                            </button>
                        )}
                        <button onClick={() => handleToggle(seq.id, seq.is_active)} className={seq.is_active ? 'text-[#7B5CF6]' : 'text-[#9AA2B1]'}>
                            {seq.is_active ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                        </button>
                        <button onClick={() => handleExpand(seq.id)} className="text-[#9AA2B1]">
                            {expanded === seq.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                        <button onClick={() => handleDelete(seq.id, seq.name)} className="w-7 h-7 flex items-center justify-center bg-red-50 text-red-400 rounded-lg">
                            <Trash2 size={12} />
                        </button>
                    </div>
                    {expanded === seq.id && (
                        <div className="border-t border-[#EEF0F4] px-4 pb-4 pt-3">
                            <SequenceStepsEditor seqId={seq.id} seqName={seq.name} trigger={seq.trigger_type}
                                linkedEntityTitle={seq.linked_entity_title ?? undefined}
                                linkedEntityDescription={seq.linked_entity_description ?? undefined}
                                linkedYoutubeUrl={seq.linked_youtube_url ?? undefined}
                                steps={steps[seq.id] ?? []}
                                onRefresh={() => loadSteps(seq.id)} />
                        </div>
                    )}
                </div>
            ))}
        </div>
    )
}

/* ─── Sequence Steps Editor ─────────────────────────────────── */
function SequenceStepsEditor({ seqId, seqName, trigger, steps, onRefresh, linkedEntityTitle, linkedEntityDescription, linkedYoutubeUrl }: {
    seqId: string; seqName: string; trigger: string;
    steps: EmailSequenceStep[]; onRefresh: () => void;
    linkedEntityTitle?: string; linkedEntityDescription?: string; linkedYoutubeUrl?: string;
}) {
    const AIDA_PHASES = [
        { value: 'awareness', label: '👁 Consapevolezza' },
        { value: 'interest', label: '🤔 Interesse' },
        { value: 'desire', label: '🔥 Desiderio' },
        { value: 'action', label: '🎯 Azione' },
        { value: 'retention', label: '💜 Fidelizzazione' },
    ]

    const [adding, setAdding] = useState(false)
    const [editStep, setEditStep] = useState<EmailSequenceStep | null>(null)
    const [generating, setGenerating] = useState<string | null>(null)
    const [stepPhases, setStepPhases] = useState<Record<string, string>>({})

    const handleAdd = async () => {
        setAdding(true)
        try {
            await createSequenceStep(seqId, { step_order: steps.length, delay_days: steps.length === 0 ? 0 : 3, subject: '', body_html: '' })
            onRefresh()
        } catch (e: any) { alert(e.message) } finally { setAdding(false) }
    }

    const handleDelete = async (id: string) => {
        await deleteSequenceStep(id).catch(e => alert(e.message))
        onRefresh()
    }

    const handleGenerate = async (step: EmailSequenceStep) => {
        setGenerating(step.id)
        const selectedPhase = stepPhases[step.id]
        try {
            const res = await fetch('/api/ai/suggest-email', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    triggerType: trigger,
                    stepNumber: step.step_order + 1,
                    totalSteps: steps.length,
                    delayDays: step.delay_days,
                    sequenceName: seqName,
                    linkedEntityTitle,
                    linkedEntityDescription,
                    linkedYoutubeUrl,
                    forcedPhase: selectedPhase || undefined,
                }),
            })
            const data = await res.json()
            if (data.success) {
                await updateSequenceStep(step.id, { subject: data.subject, body_html: data.bodyHtml })
                onRefresh()
            } else { alert(data.error || 'Errore AI') }
        } catch (e: any) { alert(e.message) } finally { setGenerating(null) }
    }

    return (
        <div className="space-y-3">
            {/* Linked entity context banner */}
            {(linkedEntityTitle || linkedYoutubeUrl) && (
                <div className="bg-[#F4EEFF] rounded-xl px-3 py-2 text-[10px] font-bold text-[#7B5CF6]">
                    {linkedEntityTitle && <p>📎 Contesto AI: <span className="font-black">{linkedEntityTitle}</span></p>}
                    {linkedEntityDescription && <p className="text-[#9AA2B1] font-medium mt-0.5 line-clamp-2">{linkedEntityDescription}</p>}
                    {linkedYoutubeUrl && <p>▶ {linkedYoutubeUrl}</p>}
                    <p className="text-[#9AA2B1] mt-0.5 font-medium">L'AI userà questo contesto per generare la sequenza AIDA</p>
                </div>
            )}
            {steps.length === 0 ? (
                <p className="text-[#9AA2B1] text-xs italic text-center py-2">Nessuno step — aggiungi il primo</p>
            ) : steps.map((step, i) => (
                <div key={step.id} className={`rounded-xl border p-3 ${step.is_active ? 'border-[#E6DAFF] bg-[#FAFAFC]' : 'border-[#EEF0F4] bg-white opacity-60'}`}>
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-black text-[#7B5CF6] uppercase tracking-wider">Step {i + 1} · Dopo {step.delay_days} giorn{step.delay_days === 1 ? 'o' : 'i'}</span>
                        <div className="flex items-center gap-1.5">
                            <select
                                value={stepPhases[step.id] || ''}
                                onChange={e => setStepPhases(p => ({ ...p, [step.id]: e.target.value }))}
                                className="h-6 px-1.5 bg-[#F4EEFF] border border-[#E6DAFF] rounded-lg text-[9px] font-bold text-[#7B5CF6] outline-none"
                                title="Fase AIDA per questa email"
                            >
                                <option value="">🤖 Auto AIDA</option>
                                {AIDA_PHASES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                            </select>
                            <button onClick={() => handleGenerate(step)} disabled={!!generating}
                                className="flex items-center gap-1 text-[#7B5CF6] text-[10px] font-black disabled:opacity-50">
                                <Sparkles size={10} className={generating === step.id ? 'animate-pulse' : ''} />
                                {generating === step.id ? 'Generando...' : 'Genera AI'}
                            </button>
                            <button onClick={() => setEditStep(editStep?.id === step.id ? null : step)} className="text-[#9AA2B1]">
                                <Edit2 size={12} />
                            </button>
                            <button onClick={() => handleDelete(step.id)} className="text-red-400">
                                <Trash2 size={12} />
                            </button>
                        </div>
                    </div>
                    {step.subject ? (
                        <p className="text-[#1C1C1E] text-xs font-bold truncate">{step.subject}</p>
                    ) : (
                        <p className="text-[#9AA2B1] text-xs italic">Oggetto non impostato — premi "Genera AI"</p>
                    )}
                    {editStep?.id === step.id && (
                        <StepEditor step={step} onClose={() => setEditStep(null)} onSaved={() => { setEditStep(null); onRefresh() }} />
                    )}
                </div>
            ))}
            <button onClick={handleAdd} disabled={adding}
                className="w-full py-2 border-2 border-dashed border-[#E6DAFF] rounded-xl text-[#7B5CF6] text-xs font-bold hover:bg-[#F4EEFF] transition-colors disabled:opacity-50">
                {adding ? 'Aggiungendo...' : '+ Aggiungi Step'}
            </button>
        </div>
    )
}

/* ─── Step Editor ────────────────────────────────────────────── */
function StepEditor({ step, onClose, onSaved }: { step: EmailSequenceStep; onClose: () => void; onSaved: () => void }) {
    const [delay, setDelay] = useState(step.delay_days)
    const [subject, setSubject] = useState(step.subject)
    const [body, setBody] = useState(step.body_html)
    const [saving, setSaving] = useState(false)
    const [improvingField, setImprovingField] = useState<'subject' | 'body' | null>(null)

    const improve = async (field: 'subject' | 'body') => {
        const text = field === 'subject' ? subject : body
        if (!text.trim()) return
        setImprovingField(field)
        try {
            const res = await fetch('/api/ai/improve-text', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, type: field === 'subject' ? 'title' : 'description' }),
            })
            const data = await res.json()
            if (data.success) { if (field === 'subject') setSubject(data.text); else setBody(data.text) }
        } catch {} finally { setImprovingField(null) }
    }

    const handleSave = async () => {
        setSaving(true)
        try {
            await updateSequenceStep(step.id, { delay_days: delay, subject, body_html: body })
            onSaved()
        } catch (e: any) { alert(e.message) } finally { setSaving(false) }
    }

    return (
        <div className="mt-3 pt-3 border-t border-[#EEF0F4] space-y-3">
            <div>
                <label className="text-[10px] font-black text-[#9AA2B1] uppercase tracking-wider block mb-1">Invia dopo (giorni)</label>
                <input type="number" min="0" value={delay} onChange={e => setDelay(parseInt(e.target.value) || 0)} className="w-24 h-9 px-3 bg-[#FAFAFC] border border-[#E6DAFF] rounded-lg outline-none focus:border-[#7B5CF6] font-medium text-sm" />
            </div>
            <div>
                <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] font-black text-[#9AA2B1] uppercase tracking-wider">Oggetto</label>
                    <button type="button" onClick={() => improve('subject')} disabled={!subject.trim() || !!improvingField}
                        className="flex items-center gap-0.5 text-[#7B5CF6] text-[10px] font-black disabled:opacity-40">
                        <Sparkles size={9} className={improvingField === 'subject' ? 'animate-pulse' : ''} />
                        {improvingField === 'subject' ? '...' : 'AI'}
                    </button>
                </div>
                <input value={subject} onChange={e => setSubject(e.target.value)} className="w-full h-9 px-3 bg-[#FAFAFC] border border-[#E6DAFF] rounded-lg outline-none focus:border-[#7B5CF6] font-medium text-sm" />
            </div>
            <div>
                <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] font-black text-[#9AA2B1] uppercase tracking-wider">Corpo</label>
                    <button type="button" onClick={() => improve('body')} disabled={!body.trim() || !!improvingField}
                        className="flex items-center gap-0.5 text-[#7B5CF6] text-[10px] font-black disabled:opacity-40">
                        <Sparkles size={9} className={improvingField === 'body' ? 'animate-pulse' : ''} />
                        {improvingField === 'body' ? '...' : 'AI'}
                    </button>
                </div>
                <textarea value={body} onChange={e => setBody(e.target.value)} rows={4} className="w-full px-3 py-2 bg-[#FAFAFC] border border-[#E6DAFF] rounded-lg outline-none focus:border-[#7B5CF6] font-medium text-xs resize-none" />
            </div>
            <div className="flex gap-2">
                <button onClick={onClose} className="flex-1 h-9 bg-white border border-[#EEF0F4] rounded-xl font-bold text-[#9AA2B1] text-xs">Annulla</button>
                <button onClick={handleSave} disabled={saving} className="flex-[2] h-9 bg-[#7B5CF6] text-white rounded-xl font-bold text-xs disabled:opacity-60">
                    {saving ? 'Salvataggio...' : 'Salva step'}
                </button>
            </div>
        </div>
    )
}

/* ─── Tab: Inviate (Log) ────────────────────────────────────── */
function TabLogs() {
    const [logs, setLogs] = useState<EmailSendLog[]>([])
    const [loading, setLoading] = useState(true)
    useEffect(() => { getEmailLogs(200).then(data => { setLogs(data); setLoading(false) }).catch(() => setLoading(false)) }, [])

    return (
        <div>
            {loading ? <p className="text-center text-[#9AA2B1] font-bold py-6">Caricamento...</p> : logs.length === 0 ? (
                <p className="text-center text-[#9AA2B1] text-sm italic py-6">Nessuna email inviata ancora</p>
            ) : (
                <div className="space-y-2">
                    {logs.map(log => (
                        <div key={log.id} className="bg-white rounded-[16px] border border-[#EEF0F4] px-4 py-3 flex items-start gap-3">
                            <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${log.status === 'sent' ? 'bg-green-400' : 'bg-red-400'}`} />
                            <div className="flex-1 min-w-0">
                                <p className="text-[#1C1C1E] text-xs font-bold truncate">{log.user_email}</p>
                                <p className="text-[#9AA2B1] text-[11px] font-medium truncate">{log.subject}</p>
                                {log.error && <p className="text-red-400 text-[10px] font-medium">{log.error}</p>}
                            </div>
                            <p className="text-[#9AA2B1] text-[10px] font-bold flex-shrink-0">{new Date(log.sent_at).toLocaleDateString('it-IT')}</p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

/* ─── Tab: Ricevute ─────────────────────────────────────────── */
function TabReceived({ onUnreadChange }: { onUnreadChange: (n: number) => void }) {
    const [emails, setEmails] = useState<ReceivedEmail[]>([])
    const [loading, setLoading] = useState(true)
    const [selected, setSelected] = useState<ReceivedEmail | null>(null)

    const load = useCallback(async () => {
        getReceivedEmails().then(data => {
            setEmails(data)
            setLoading(false)
            onUnreadChange(data.filter(e => !e.is_read).length)
        }).catch(() => setLoading(false))
    }, [onUnreadChange])

    useEffect(() => { load() }, [load])

    const handleOpen = async (email: ReceivedEmail) => {
        setSelected(email)
        if (!email.is_read) {
            await markEmailRead(email.id).catch(() => {})
            await load()
        }
    }

    return (
        <div>
            {loading ? <p className="text-center text-[#9AA2B1] font-bold py-6">Caricamento...</p> : emails.length === 0 ? (
                <div className="text-center py-8">
                    <p className="text-[#9AA2B1] text-sm font-bold">Nessuna email ricevuta</p>
                    <p className="text-[#9AA2B1] text-xs mt-1">Configura il record MX su IONOS per ricevere email a supporto@lurumi.it</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {emails.map(email => (
                        <button key={email.id} onClick={() => handleOpen(email)}
                            className="w-full bg-white rounded-[16px] border border-[#EEF0F4] px-4 py-3 flex items-start gap-3 text-left active:scale-[0.99] transition-transform">
                            {!email.is_read && <div className="w-2 h-2 rounded-full bg-[#7B5CF6] mt-1.5 flex-shrink-0" />}
                            <div className={`flex-1 min-w-0 ${email.is_read ? 'ml-5' : ''}`}>
                                <p className={`text-xs truncate ${email.is_read ? 'text-[#9AA2B1] font-medium' : 'text-[#1C1C1E] font-black'}`}>
                                    {email.from_name || email.from_email}
                                </p>
                                <p className={`text-[11px] truncate ${email.is_read ? 'text-[#9AA2B1] font-medium' : 'text-[#1C1C1E] font-bold'}`}>{email.subject}</p>
                            </div>
                            <p className="text-[#9AA2B1] text-[10px] font-bold flex-shrink-0">{new Date(email.received_at).toLocaleDateString('it-IT')}</p>
                        </button>
                    ))}
                </div>
            )}
            {selected && (
                <div className="fixed inset-0 z-[20000] bg-black/50 flex items-end justify-center" onClick={() => setSelected(null)}>
                    <div className="w-full max-w-2xl bg-white rounded-t-[32px] shadow-2xl animate-in slide-in-from-bottom duration-300 flex flex-col" style={{ maxHeight: '85dvh' }} onClick={e => e.stopPropagation()}>
                        <div className="flex-shrink-0 px-5 pt-4 pb-3 border-b border-[#EEF0F4]">
                            <div className="w-10 h-1 bg-[#EEF0F4] rounded-full mx-auto mb-3" />
                            <div className="flex items-start justify-between">
                                <div className="min-w-0">
                                    <p className="font-black text-[#1C1C1E] text-sm">{selected.subject}</p>
                                    <p className="text-[#9AA2B1] text-xs mt-0.5">{selected.from_name ? `${selected.from_name} <${selected.from_email}>` : selected.from_email}</p>
                                    <p className="text-[#9AA2B1] text-[10px] mt-0.5">{new Date(selected.received_at).toLocaleString('it-IT')}</p>
                                </div>
                                <button onClick={() => setSelected(null)} className="ml-3 w-8 h-8 flex items-center justify-center bg-[#F4F4F8] rounded-xl text-[#9AA2B1] flex-shrink-0"><X size={16} /></button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto px-5 py-4 min-h-0">
                            {selected.body_html ? (
                                <div className="text-sm text-[#1C1C1E] leading-relaxed" dangerouslySetInnerHTML={{ __html: selected.body_html }} />
                            ) : (
                                <p className="text-sm text-[#1C1C1E] leading-relaxed whitespace-pre-wrap">{selected.body_text || '(Corpo vuoto)'}</p>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

function SectionNewsletter({ onBack }: { onBack: () => void }) {
    const [subject, setSubject] = useState('');
    const [body, setBody] = useState('');
    const [target, setTarget] = useState<'newsletter' | 'marketing' | 'all'>('newsletter');
    const [sending, setSending] = useState(false);
    const [result, setResult] = useState<{ sent: number; total: number } | null>(null);
    const [error, setError] = useState('');

    const handleSend = async () => {
        if (!subject.trim() || !body.trim()) { setError('Compila oggetto e testo.'); return; }
        setSending(true); setError(''); setResult(null);
        try {
            const res = await fetch('/api/email/newsletter', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subject, bodyHtml: `<p style="margin:0 0 16px;font-size:15px;color:#1C1C1E;line-height:1.7;">${body.replace(/\n/g, '<br>')}</p>`, target }),
            });
            const data = await res.json();
            if (!res.ok) { setError(data.error ?? 'Errore invio'); return; }
            setResult({ sent: data.sent, total: data.total });
            setSubject(''); setBody('');
        } catch { setError('Errore di rete'); }
        finally { setSending(false); }
    };

    return (
        <>
            <div className="flex items-center gap-3 mb-8">
                <button onClick={onBack} className="w-10 h-10 flex items-center justify-center bg-white border border-[#EEF0F4] rounded-xl text-[#9AA2B1]">
                    <ArrowLeft size={20} />
                </button>
                <div className="flex items-center gap-2">
                    <Mail size={22} className="text-pink-500" />
                    <h2 className="text-2xl font-black text-[#1C1C1E]">Newsletter</h2>
                </div>
            </div>

            <div className="bg-white rounded-[28px] border border-[#EEF0F4] p-6 shadow-sm space-y-4">
                {/* Target */}
                <div>
                    <label className="text-xs font-black text-[#9AA2B1] uppercase tracking-wide mb-2 block">Destinatarie</label>
                    <div className="flex gap-2 flex-wrap">
                        {(['newsletter', 'marketing', 'all'] as const).map(t => (
                            <button key={t} onClick={() => setTarget(t)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${target === t ? 'bg-[#7B5CF6] text-white border-[#7B5CF6]' : 'bg-white text-[#9AA2B1] border-[#EEF0F4]'}`}>
                                {t === 'newsletter' ? '📧 Aggiornamenti prodotto' : t === 'marketing' ? '🎯 Offerte e promozioni' : '🌐 Tutte le iscritte'}
                            </button>
                        ))}
                    </div>
                    <p className="text-[11px] text-[#9AA2B1] font-medium mt-1">
                        {target === 'newsletter' && 'Utenti che hanno attivato "Newsletter e aggiornamenti" nel profilo'}
                        {target === 'marketing' && 'Utenti che hanno attivato "Offerte e promozioni" nel profilo'}
                        {target === 'all' && 'Tutte le utenti con almeno una preferenza email attiva'}
                    </p>
                </div>

                {/* Oggetto */}
                <div>
                    <label className="text-xs font-black text-[#9AA2B1] uppercase tracking-wide mb-2 block">Oggetto email</label>
                    <input
                        value={subject} onChange={e => setSubject(e.target.value)}
                        placeholder="es. Novità di marzo su Lurumi 🧶"
                        className="w-full px-4 py-3 bg-[#FAFAFC] border border-[#EEF0F4] rounded-2xl text-sm font-medium text-[#1C1C1E] focus:outline-none focus:border-[#7B5CF6] transition-colors"
                    />
                </div>

                {/* Body */}
                <div>
                    <label className="text-xs font-black text-[#9AA2B1] uppercase tracking-wide mb-2 block">Testo email</label>
                    <textarea
                        value={body} onChange={e => setBody(e.target.value)} rows={8}
                        placeholder="Scrivi il testo della newsletter. Vai a capo per i paragrafi."
                        className="w-full px-4 py-3 bg-[#FAFAFC] border border-[#EEF0F4] rounded-2xl text-sm font-medium text-[#1C1C1E] focus:outline-none focus:border-[#7B5CF6] transition-colors resize-none"
                    />
                    <p className="text-[10px] text-[#9AA2B1] mt-1 font-medium">Il testo sarà racchiuso nel template Lurumi con logo e footer automaticamente.</p>
                </div>

                {error && <p className="text-red-500 text-xs font-bold">{error}</p>}
                {result && (
                    <div className="bg-green-50 border border-green-200 rounded-2xl px-4 py-3">
                        <p className="text-green-700 text-sm font-bold">✓ Inviate {result.sent} / {result.total} email</p>
                    </div>
                )}

                <button onClick={handleSend} disabled={sending}
                    className="w-full py-3.5 bg-[#7B5CF6] text-white rounded-2xl font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-60">
                    {sending
                        ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Invio in corso...</>
                        : <><Send size={16} /> Invia Newsletter</>
                    }
                </button>
            </div>
        </>
    );
}

/* ─── Coda Validazione Schemi ────────────────────────────────── */

interface TrainingPattern {
    id: string;
    title: string;
    difficulty: string;
    category: string | null;
    parts: { name: string; final_count?: number; rounds?: unknown[] }[];
    admin_notes: string | null;
    submitted_at: string;
    status: string;
    user_id: string;
}

function SectionValidationQueue({ onBack }: { onBack: () => void }) {
    const supabase = createClient();
    const [patterns, setPatterns] = useState<TrainingPattern[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionId, setActionId] = useState<string | null>(null);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [editNotes, setEditNotes] = useState<Record<string, string>>({});

    useEffect(() => {
        loadPatterns();
    }, []);

    const loadPatterns = async () => {
        setLoading(true);
        const { data } = await supabase
            .from('training_patterns')
            .select('id, title, difficulty, category, parts, admin_notes, submitted_at, status, user_id')
            .eq('status', 'pending')
            .order('submitted_at', { ascending: true });
        setPatterns(data ?? []);
        setLoading(false);
    };

    const handleAction = async (id: string, newStatus: 'validated' | 'rejected', notes?: string) => {
        setActionId(id);
        try {
            const { error } = await supabase
                .from('training_patterns')
                .update({
                    status: newStatus,
                    validated_at: new Date().toISOString(),
                    admin_notes: notes || null,
                })
                .eq('id', id);
            if (!error) setPatterns(prev => prev.filter(p => p.id !== id));
        } finally {
            setActionId(null);
        }
    };

    return (
        <>
            <div className="flex items-center gap-3 mb-6">
                <button onClick={onBack} className="w-9 h-9 flex items-center justify-center rounded-xl bg-[#FAFAFC] border border-[#EEF0F4]">
                    <ArrowLeft size={18} className="text-[#1C1C1E]" />
                </button>
                <div>
                    <h2 className="text-xl font-black text-[#1C1C1E]">Coda Validazione</h2>
                    <p className="text-xs text-[#9AA2B1] font-medium">Schemi inviati dagli utenti in attesa di revisione</p>
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="w-8 h-8 border-2 border-[#7B5CF6] border-t-transparent rounded-full animate-spin" />
                </div>
            ) : patterns.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
                    <div className="w-16 h-16 rounded-3xl bg-green-50 border border-green-100 flex items-center justify-center">
                        <CheckCircle2 size={28} className="text-green-400" />
                    </div>
                    <p className="font-black text-[#1C1C1E]">Coda vuota</p>
                    <p className="text-sm text-[#9AA2B1]">Nessuno schema in attesa di validazione.</p>
                </div>
            ) : (
                <div className="flex flex-col gap-4">
                    {patterns.map(p => {
                        const isExpanded = expandedId === p.id;
                        const isActing = actionId === p.id;
                        const notes = editNotes[p.id] ?? (p.admin_notes || '');
                        return (
                            <div key={p.id} className="bg-white rounded-[24px] border border-[#EEF0F4] shadow-sm overflow-hidden">
                                {/* Header row */}
                                <div
                                    className="flex items-start justify-between px-5 pt-4 pb-3 cursor-pointer"
                                    onClick={() => setExpandedId(isExpanded ? null : p.id)}
                                >
                                    <div className="flex-1 min-w-0">
                                        <p className="font-black text-[#1C1C1E] text-sm truncate">{p.title}</p>
                                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                                                p.difficulty === 'beginner' ? 'bg-green-50 text-green-600' :
                                                p.difficulty === 'intermediate' ? 'bg-amber-50 text-amber-600' :
                                                'bg-red-50 text-red-500'
                                            }`}>
                                                {p.difficulty === 'beginner' ? 'Facile' : p.difficulty === 'intermediate' ? 'Medio' : 'Avanzato'}
                                            </span>
                                            <span className="text-xs text-[#9AA2B1]">{p.parts.length} parti</span>
                                            <span className="text-xs text-[#9AA2B1]">{new Date(p.submitted_at).toLocaleDateString('it-IT')}</span>
                                        </div>
                                    </div>
                                    <ChevronDown size={16} className={`text-[#9AA2B1] mt-1 shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                </div>

                                {/* Expanded detail */}
                                {isExpanded && (
                                    <div className="px-5 pb-5 border-t border-[#EEF0F4] pt-3 flex flex-col gap-3">
                                        {/* Parti */}
                                        <div>
                                            <p className="text-xs font-black text-[#9AA2B1] uppercase tracking-widest mb-2">Parti</p>
                                            <div className="bg-[#FAFAFC] rounded-2xl border border-[#EEF0F4] divide-y divide-[#EEF0F4]">
                                                {p.parts.map((part, i) => (
                                                    <div key={i} className="flex items-center justify-between px-4 py-2">
                                                        <span className="text-sm font-bold text-[#1C1C1E]">{part.name}</span>
                                                        {part.final_count !== undefined && (
                                                            <span className="text-sm font-black text-[#7B5CF6]">{part.final_count} giri</span>
                                                        )}
                                                        {part.rounds && part.rounds.length > 0 && (
                                                            <span className="text-xs text-[#9AA2B1]">{part.rounds.length} giri dettagliati</span>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Note admin */}
                                        <div>
                                            <p className="text-xs font-black text-[#9AA2B1] uppercase tracking-widest mb-1.5">Note admin</p>
                                            <textarea
                                                rows={2}
                                                value={notes}
                                                onChange={e => setEditNotes(prev => ({ ...prev, [p.id]: e.target.value }))}
                                                placeholder="Aggiungi note di revisione..."
                                                className="w-full px-3 py-2 bg-[#FAFAFC] border border-[#EEF0F4] rounded-xl text-sm font-medium focus:outline-none focus:border-[#7B5CF6] resize-none"
                                            />
                                        </div>

                                        {/* Azioni */}
                                        <div className="flex gap-2 pt-1">
                                            <button
                                                disabled={isActing}
                                                onClick={() => handleAction(p.id, 'rejected', editNotes[p.id] ?? p.admin_notes ?? undefined)}
                                                className="flex-1 h-10 bg-red-50 text-red-500 border border-red-100 rounded-2xl font-bold text-sm disabled:opacity-50 active:scale-95 transition-all"
                                            >
                                                {isActing ? '...' : 'Rifiuta'}
                                            </button>
                                            <button
                                                disabled={isActing}
                                                onClick={() => handleAction(p.id, 'validated', editNotes[p.id] ?? p.admin_notes ?? undefined)}
                                                className="flex-[2] h-10 bg-green-500 text-white rounded-2xl font-bold text-sm disabled:opacity-50 active:scale-95 transition-all shadow-md"
                                            >
                                                {isActing ? (
                                                    <span className="animate-pulse">Salvataggio...</span>
                                                ) : (
                                                    'Approva schema'
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </>
    );
}

/* ─── fine Coda Validazione ─────────────────────────────────── */

/* ─── Classificatore Foto: Reale vs IA ──────────────────────── */

interface ClassifyResult {
    label: 'REALE' | 'IA';
    confidence: 'high' | 'medium' | 'low';
    reasons: string[];
    isReal: boolean;
}

function SectionImageClassifier({ onBack }: { onBack: () => void }) {
    const [imageUrl, setImageUrl] = useState('');
    const [previewUrl, setPreviewUrl] = useState('');
    const [analyzing, setAnalyzing] = useState(false);
    const [result, setResult] = useState<ClassifyResult | null>(null);
    const [error, setError] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFile = (file: File) => {
        const reader = new FileReader();
        reader.onload = e => {
            const dataUrl = e.target?.result as string;
            setImageUrl(dataUrl);
            setPreviewUrl(dataUrl);
            setResult(null);
            setError('');
        };
        reader.readAsDataURL(file);
    };

    const handleAnalyze = async () => {
        const url = imageUrl.trim();
        if (!url) return;
        setAnalyzing(true);
        setResult(null);
        setError('');
        try {
            const res = await fetch('/api/training/classify-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ imageUrl: url }),
            });
            const json = await res.json();
            if (json.success) {
                setResult(json);
            } else {
                setError(json.error ?? 'Errore sconosciuto');
            }
        } catch (e: any) {
            setError(e.message);
        } finally {
            setAnalyzing(false);
        }
    };

    const confidenceLabel = (c: string) =>
        c === 'high' ? 'Alta certezza' : c === 'medium' ? 'Certezza media' : 'Bassa certezza';

    return (
        <>
            <div className="flex items-center gap-3 mb-6">
                <button onClick={onBack} className="w-9 h-9 flex items-center justify-center rounded-xl bg-[#FAFAFC] border border-[#EEF0F4]">
                    <ArrowLeft size={18} className="text-[#1C1C1E]" />
                </button>
                <div>
                    <h2 className="text-xl font-black text-[#1C1C1E]">Classificatore Immagini</h2>
                    <p className="text-xs text-[#9AA2B1] font-medium">Analizza se una foto di amigurumi è reale o generata da IA</p>
                </div>
            </div>

            <div className="flex flex-col gap-5">
                {/* Upload / URL input */}
                <div className="bg-white rounded-[24px] border border-[#EEF0F4] shadow-sm p-5 flex flex-col gap-4">
                    <div>
                        <label className="text-xs font-black text-[#1C1C1E] uppercase tracking-widest mb-1.5 block">URL immagine</label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={imageUrl.startsWith('data:') ? '' : imageUrl}
                                onChange={e => {
                                    setImageUrl(e.target.value);
                                    setPreviewUrl(e.target.value);
                                    setResult(null);
                                    setError('');
                                }}
                                placeholder="https://... oppure carica da file sotto"
                                className="flex-1 h-11 px-4 bg-[#FAFAFC] border border-[#EEF0F4] rounded-xl text-sm font-medium focus:outline-none focus:border-[#7B5CF6]"
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="flex-1 h-px bg-[#EEF0F4]" />
                        <span className="text-xs text-[#9AA2B1] font-bold">oppure</span>
                        <div className="flex-1 h-px bg-[#EEF0F4]" />
                    </div>

                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full h-11 border-2 border-dashed border-[#E6DAFF] rounded-2xl text-sm font-bold text-[#7B5CF6] hover:bg-[#F4EEFF] transition-colors"
                    >
                        Carica immagine dal dispositivo
                    </button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={e => {
                            const f = e.target.files?.[0];
                            if (f) handleFile(f);
                            e.target.value = '';
                        }}
                    />
                </div>

                {/* Preview */}
                {previewUrl && (
                    <div className="bg-white rounded-[24px] border border-[#EEF0F4] shadow-sm p-4 flex flex-col gap-3">
                        <p className="text-xs font-black text-[#9AA2B1] uppercase tracking-widest">Anteprima</p>
                        <div className="w-full aspect-square max-h-64 rounded-2xl overflow-hidden bg-[#FAFAFC] flex items-center justify-center">
                            <img
                                src={previewUrl}
                                alt="preview"
                                className="max-w-full max-h-full object-contain"
                                onError={() => setPreviewUrl('')}
                            />
                        </div>
                        <button
                            onClick={handleAnalyze}
                            disabled={analyzing || !imageUrl.trim()}
                            className="w-full h-12 bg-[#7B5CF6] text-white rounded-2xl font-bold text-sm shadow-md disabled:opacity-50 flex items-center justify-center gap-2 active:scale-95 transition-all"
                        >
                            {analyzing ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    Analisi in corso...
                                </>
                            ) : (
                                <>
                                    <Sparkles size={16} />
                                    Analizza immagine
                                </>
                            )}
                        </button>
                    </div>
                )}

                {!previewUrl && imageUrl.trim() && (
                    <button
                        onClick={handleAnalyze}
                        disabled={analyzing}
                        className="w-full h-12 bg-[#7B5CF6] text-white rounded-2xl font-bold text-sm shadow-md disabled:opacity-50 flex items-center justify-center gap-2 active:scale-95 transition-all"
                    >
                        {analyzing ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                Analisi in corso...
                            </>
                        ) : (
                            <>
                                <Sparkles size={16} />
                                Analizza immagine
                            </>
                        )}
                    </button>
                )}

                {/* Errore */}
                {error && (
                    <div className="bg-red-50 border border-red-100 rounded-2xl px-4 py-3 text-sm font-bold text-red-500">
                        {error}
                    </div>
                )}

                {/* Risultato */}
                {result && (
                    <div className={`rounded-[24px] border shadow-sm p-5 flex flex-col gap-4 ${result.isReal ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                        {/* Badge principale */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-md ${result.isReal ? 'bg-green-500' : 'bg-red-400'}`}>
                                    <span className="text-white text-2xl font-black">
                                        {result.isReal ? '✓' : '✗'}
                                    </span>
                                </div>
                                <div>
                                    <p className={`text-2xl font-black ${result.isReal ? 'text-green-700' : 'text-red-600'}`}>
                                        {result.label}
                                    </p>
                                    <p className={`text-xs font-bold ${result.isReal ? 'text-green-600' : 'text-red-400'}`}>
                                        {confidenceLabel(result.confidence)}
                                    </p>
                                </div>
                            </div>
                            <div className={`px-3 py-1 rounded-full text-xs font-black ${
                                result.confidence === 'high'
                                    ? result.isReal ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-700'
                                    : 'bg-[#EEF0F4] text-[#9AA2B1]'
                            }`}>
                                {result.confidence.toUpperCase()}
                            </div>
                        </div>

                        {/* Motivazioni */}
                        {result.reasons.length > 0 && (
                            <div>
                                <p className={`text-xs font-black uppercase tracking-widest mb-2 ${result.isReal ? 'text-green-700' : 'text-red-600'}`}>
                                    Motivazioni
                                </p>
                                <div className="flex flex-col gap-1.5">
                                    {result.reasons.map((r, i) => (
                                        <div key={i} className={`flex items-start gap-2 text-sm font-medium ${result.isReal ? 'text-green-800' : 'text-red-700'}`}>
                                            <span className="mt-0.5 shrink-0">{result.isReal ? '✓' : '✗'}</span>
                                            <span>{r}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Azioni */}
                        <div className="flex gap-2 pt-1">
                            <button
                                onClick={() => { setResult(null); setImageUrl(''); setPreviewUrl(''); }}
                                className="flex-1 h-10 bg-white border border-[#EEF0F4] rounded-2xl font-bold text-sm text-[#6B7280] active:scale-95 transition-all"
                            >
                                Analizza altra
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}

/* ─── fine Classificatore ────────────────────────────────────── */

/* ─── Pannello Test Modello + Feedback RLHF ─────────────────── */

type ModelPart = {
    name: string;
    color?: string;
    start_type?: string;
    rounds: { round: number | string; instruction: string; stitch_count: number }[];
};

function SectionModelTest({ onBack }: { onBack: () => void }) {
    const [prompt, setPrompt] = useState('');
    const [generating, setGenerating] = useState(false);
    const [modelParts, setModelParts] = useState<ModelPart[] | null>(null);
    const [editedParts, setEditedParts] = useState<ModelPart[] | null>(null);
    const [correcting, setCorrecting] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [genError, setGenError] = useState('');

    // Lazy import di validatePart per non aumentare il bundle iniziale
    const [validatePart, setValidatePart] = useState<((rounds: ModelPart['rounds']) => { valid: boolean; rounds: { round: number | string; ok: boolean; errors: string[] }[]; totalErrors: number }) | null>(null);

    useEffect(() => {
        import('@/lib/pattern-math').then(m => setValidatePart(() => m.validatePart));
    }, []);

    const validations = useMemo(() => {
        if (!validatePart || !modelParts) return null;
        return (correcting ? editedParts : modelParts)?.map(part => validatePart(part.rounds));
    }, [validatePart, modelParts, editedParts, correcting]);

    const totalMathErrors = useMemo(() =>
        validations?.reduce((s, v) => s + v.totalErrors, 0) ?? 0
    , [validations]);

    const handleGenerate = async () => {
        if (!prompt.trim()) return;
        setGenerating(true);
        setModelParts(null);
        setEditedParts(null);
        setCorrecting(false);
        setSaved(false);
        setGenError('');
        try {
            const res = await fetch('/api/training/generate-schema', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: prompt.trim() }),
            });
            const json = await res.json();
            if (json.success) {
                setModelParts(json.parts);
                setEditedParts(JSON.parse(JSON.stringify(json.parts)));
            } else {
                setGenError(json.error ?? 'Errore generazione');
            }
        } finally {
            setGenerating(false);
        }
    };

    const handleSaveFeedback = async (isCorrect: boolean) => {
        if (!modelParts) return;
        setSaving(true);
        try {
            const correctedResponse = !isCorrect && correcting ? editedParts : null;
            await fetch('/api/training/save-feedback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: prompt.trim(),
                    model_response: modelParts,
                    is_correct: isCorrect,
                    corrected_response: correctedResponse,
                    math_check_passed: totalMathErrors === 0,
                    math_errors: validations?.flatMap((v, pi) =>
                        v.rounds.filter(r => !r.ok).map(r => ({
                            part: modelParts[pi]?.name,
                            round: r.round,
                            errors: r.errors,
                        }))
                    ) ?? [],
                }),
            });
            setSaved(true);
            setModelParts(null);
            setEditedParts(null);
            setCorrecting(false);
        } finally {
            setSaving(false);
        }
    };

    const updateRoundField = (partIdx: number, roundIdx: number, field: 'instruction' | 'stitch_count', value: string | number) => {
        if (!editedParts) return;
        const updated = editedParts.map((p, pi) =>
            pi !== partIdx ? p : {
                ...p,
                rounds: p.rounds.map((r, ri) =>
                    ri !== roundIdx ? r : { ...r, [field]: field === 'stitch_count' ? Number(value) : value }
                ),
            }
        );
        setEditedParts(updated);
    };

    const displayParts = correcting ? editedParts : modelParts;

    return (
        <>
            <div className="flex items-center gap-3 mb-6">
                <button onClick={onBack} className="w-9 h-9 flex items-center justify-center rounded-xl bg-[#FAFAFC] border border-[#EEF0F4]">
                    <ArrowLeft size={18} className="text-[#1C1C1E]" />
                </button>
                <div>
                    <h2 className="text-xl font-black text-[#1C1C1E]">Test Modello + Feedback</h2>
                    <p className="text-xs text-[#9AA2B1] font-medium">Testa la generazione schemi e costruisci dati di training correttivi</p>
                </div>
            </div>

            <div className="flex flex-col gap-5">
                {/* Prompt input */}
                <div className="bg-white rounded-[24px] border border-[#EEF0F4] shadow-sm p-5 flex flex-col gap-3">
                    <label className="text-xs font-black text-[#1C1C1E] uppercase tracking-widest">Prompt</label>
                    <textarea
                        rows={3}
                        value={prompt}
                        onChange={e => setPrompt(e.target.value)}
                        placeholder="Es: schema sfera 5cm cotone 2.5mm, oppure: testa coniglio con orecchie lunghe..."
                        className="w-full px-4 py-3 bg-[#FAFAFC] border border-[#EEF0F4] rounded-2xl text-sm font-medium focus:outline-none focus:border-[#7B5CF6] resize-none"
                        onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') handleGenerate(); }}
                    />
                    <button
                        onClick={handleGenerate}
                        disabled={generating || !prompt.trim()}
                        className="w-full h-12 bg-[#7B5CF6] text-white rounded-2xl font-bold text-sm shadow-md disabled:opacity-50 flex items-center justify-center gap-2 active:scale-95 transition-all"
                    >
                        {generating ? (
                            <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Generazione...</>
                        ) : (
                            <><Sparkles size={16} />Genera schema</>
                        )}
                    </button>
                    {genError && <p className="text-xs font-bold text-red-500">{genError}</p>}
                </div>

                {/* Saved confirmation */}
                {saved && (
                    <div className="bg-green-50 border border-green-200 rounded-[24px] p-5 flex items-center gap-3">
                        <CheckCircle2 size={24} className="text-green-500 shrink-0" />
                        <div>
                            <p className="font-black text-green-700">Feedback salvato!</p>
                            <p className="text-xs text-green-600 mt-0.5">Il dato è stato aggiunto al dataset di training. Inserisci un nuovo prompt per continuare.</p>
                        </div>
                    </div>
                )}

                {/* Schema generato */}
                {displayParts && (
                    <>
                        {/* Math summary */}
                        <div className={`rounded-[20px] px-4 py-3 flex items-center gap-3 ${totalMathErrors === 0 ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                            <span className={`text-lg font-black ${totalMathErrors === 0 ? 'text-green-600' : 'text-red-500'}`}>
                                {totalMathErrors === 0 ? '✓' : '✗'}
                            </span>
                            <p className={`text-sm font-bold ${totalMathErrors === 0 ? 'text-green-700' : 'text-red-600'}`}>
                                {totalMathErrors === 0
                                    ? 'Schema matematicamente corretto'
                                    : `${totalMathErrors} error${totalMathErrors === 1 ? 'e' : 'i'} matematico${totalMathErrors === 1 ? '' : 'i'} trovato${totalMathErrors === 1 ? '' : 'i'}`}
                            </p>
                            {correcting && (
                                <span className="ml-auto text-xs font-black text-[#7B5CF6] uppercase">Modalità correzione</span>
                            )}
                        </div>

                        {/* Parti */}
                        {displayParts.map((part, partIdx) => {
                            const partValidation = validations?.[partIdx];
                            return (
                                <div key={partIdx} className="bg-white rounded-[24px] border border-[#EEF0F4] shadow-sm overflow-hidden">
                                    <div className="px-5 py-3 border-b border-[#EEF0F4] bg-[#FAFAFC] flex items-center gap-2">
                                        <span className="font-black text-sm text-[#1C1C1E]">{part.name}</span>
                                        {part.color && <span className="text-xs text-[#9AA2B1]">· {part.color}</span>}
                                        {part.start_type && (
                                            <span className="ml-auto text-xs font-bold text-[#7B5CF6] px-2 py-0.5 rounded-full bg-[#F4EEFF]">
                                                {part.start_type === 'magic_ring' ? 'AM' : 'catena'}
                                            </span>
                                        )}
                                    </div>

                                    <div className="divide-y divide-[#EEF0F4]">
                                        {part.rounds.map((r, roundIdx) => {
                                            const rv = partValidation?.rounds[roundIdx];
                                            const isOk = rv?.ok ?? true;
                                            return (
                                                <div key={roundIdx} className={`flex items-start gap-2 px-4 py-2 ${!isOk ? 'bg-red-50' : ''}`}>
                                                    {/* Numero giro */}
                                                    <span className="text-xs font-black text-[#9AA2B1] w-8 shrink-0 mt-2">
                                                        G{r.round}
                                                    </span>

                                                    {/* Istruzione */}
                                                    {correcting ? (
                                                        <input
                                                            type="text"
                                                            value={r.instruction}
                                                            onChange={e => updateRoundField(partIdx, roundIdx, 'instruction', e.target.value)}
                                                            className="flex-1 text-sm font-medium bg-white border border-[#EEF0F4] rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#7B5CF6]"
                                                        />
                                                    ) : (
                                                        <span className="flex-1 text-sm font-medium text-[#1C1C1E] py-1.5">{r.instruction}</span>
                                                    )}

                                                    {/* Conteggio */}
                                                    {correcting ? (
                                                        <input
                                                            type="number"
                                                            value={r.stitch_count}
                                                            onChange={e => updateRoundField(partIdx, roundIdx, 'stitch_count', e.target.value)}
                                                            className={`w-14 text-sm font-black text-center border rounded-lg px-1 py-1.5 focus:outline-none ${isOk ? 'border-[#EEF0F4] text-[#7B5CF6] focus:border-[#7B5CF6]' : 'border-red-300 text-red-600 bg-red-50 focus:border-red-400'}`}
                                                        />
                                                    ) : (
                                                        <span className={`text-sm font-black w-12 text-right py-1.5 ${isOk ? 'text-[#7B5CF6]' : 'text-red-500'}`}>
                                                            [{r.stitch_count}]
                                                        </span>
                                                    )}

                                                    {/* Badge validazione */}
                                                    <div className="w-6 shrink-0 flex items-center justify-center mt-1.5" title={rv?.errors?.join(' | ')}>
                                                        {isOk
                                                            ? <span className="text-green-500 text-sm">✓</span>
                                                            : <span className="text-red-500 text-sm">✗</span>}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Errori per la parte */}
                                    {partValidation && partValidation.totalErrors > 0 && (
                                        <div className="px-4 pb-3 pt-1 bg-red-50 border-t border-red-100">
                                            {partValidation.rounds.filter(r => !r.ok).map((r, i) => (
                                                <p key={i} className="text-xs font-medium text-red-600 mt-1">
                                                    <span className="font-black">G{r.round}:</span> {r.errors.join(' · ')}
                                                </p>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        {/* Azioni feedback */}
                        {!correcting ? (
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setCorrecting(true)}
                                    disabled={saving}
                                    className="flex-1 h-12 bg-red-50 text-red-500 border border-red-200 rounded-2xl font-bold text-sm active:scale-95 transition-all"
                                >
                                    ✗ Sbagliato — correggi
                                </button>
                                <button
                                    onClick={() => handleSaveFeedback(true)}
                                    disabled={saving}
                                    className="flex-[2] h-12 bg-green-500 text-white rounded-2xl font-bold text-sm shadow-md active:scale-95 transition-all flex items-center justify-center gap-2"
                                >
                                    {saving ? <span className="animate-pulse">Salvataggio...</span> : '✓ Corretto — salva'}
                                </button>
                            </div>
                        ) : (
                            <div className="flex gap-3">
                                <button
                                    onClick={() => { setCorrecting(false); setEditedParts(JSON.parse(JSON.stringify(modelParts))); }}
                                    className="flex-1 h-12 bg-[#FAFAFC] text-[#6B7280] border border-[#EEF0F4] rounded-2xl font-bold text-sm"
                                >
                                    Annulla
                                </button>
                                <button
                                    onClick={async () => {
                                        if (totalMathErrors > 0) {
                                            const ok = confirm(`Il validatore segnala ancora ${totalMathErrors} errore${totalMathErrors !== 1 ? 'i' : ''} matematico${totalMathErrors !== 1 ? 'i' : ''}. Salvare comunque la correzione?`);
                                            if (!ok) return;
                                        }
                                        handleSaveFeedback(false);
                                    }}
                                    disabled={saving}
                                    className={`flex-[2] h-12 text-white rounded-2xl font-bold text-sm shadow-md disabled:opacity-50 active:scale-95 transition-all flex items-center justify-center gap-2 ${totalMathErrors > 0 ? 'bg-orange-500' : 'bg-[#7B5CF6]'}`}
                                >
                                    {saving ? (
                                        <span className="animate-pulse">Salvataggio...</span>
                                    ) : totalMathErrors > 0 ? (
                                        `⚠ Salva comunque (${totalMathErrors} err.)`
                                    ) : (
                                        'Salva risposta corretta'
                                    )}
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </>
    );
}

/* ─── fine Test Modello ──────────────────────────────────────── */

/* ─── Dataset Stats ──────────────────────────────────────────── */

function SectionDatasetStats({ onBack }: { onBack: () => void }) {
    const supabase = createClient();
    const [stats, setStats] = useState<{
        ground_truth: number;
        validated: number;
        pending: number;
        rejected: number;
        feedback_correct: number;
        feedback_corrected: number;
        total_training_ready: number;
    } | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        (async () => {
            const [
                { count: ground_truth },
                { count: validated },
                { count: pending },
                { count: rejected },
                { count: feedback_correct },
                { count: feedback_corrected },
            ] = await Promise.all([
                supabase.from('training_patterns').select('id', { count: 'exact', head: true }).eq('status', 'ground_truth'),
                supabase.from('training_patterns').select('id', { count: 'exact', head: true }).eq('status', 'validated'),
                supabase.from('training_patterns').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
                supabase.from('training_patterns').select('id', { count: 'exact', head: true }).eq('status', 'rejected'),
                supabase.from('model_feedback').select('id', { count: 'exact', head: true }).eq('is_correct', true),
                supabase.from('model_feedback').select('id', { count: 'exact', head: true }).eq('is_correct', false),
            ]);

            const gt = ground_truth ?? 0;
            const val = validated ?? 0;
            const fc = feedback_correct ?? 0;
            const fCorr = feedback_corrected ?? 0;

            setStats({
                ground_truth: gt,
                validated: val,
                pending: pending ?? 0,
                rejected: rejected ?? 0,
                feedback_correct: fc,
                feedback_corrected: fCorr,
                total_training_ready: gt + val + fc + fCorr,
            });
            setLoading(false);
        })();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const MIN_FOR_FINETUNE = 100;
    const pct = stats ? Math.min(100, Math.round((stats.total_training_ready / MIN_FOR_FINETUNE) * 100)) : 0;

    return (
        <>
            <div className="flex items-center gap-3 mb-6">
                <button onClick={onBack} className="w-9 h-9 flex items-center justify-center rounded-xl bg-[#FAFAFC] border border-[#EEF0F4]">
                    <ArrowLeft size={18} className="text-[#1C1C1E]" />
                </button>
                <div>
                    <h2 className="text-xl font-black text-[#1C1C1E]">Dataset Stats</h2>
                    <p className="text-xs text-[#9AA2B1] font-medium">Stato del dataset di training per il modello AI Lurumi</p>
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="w-8 h-8 border-2 border-[#7B5CF6] border-t-transparent rounded-full animate-spin" />
                </div>
            ) : stats && (
                <div className="flex flex-col gap-4">
                    {/* Progress bar verso fine-tuning */}
                    <div className="bg-white rounded-[24px] border border-[#EEF0F4] shadow-sm p-5">
                        <div className="flex items-center justify-between mb-3">
                            <p className="font-black text-sm text-[#1C1C1E]">Progresso verso fine-tuning</p>
                            <span className={`text-sm font-black ${pct >= 100 ? 'text-green-600' : 'text-[#7B5CF6]'}`}>{pct}%</span>
                        </div>
                        <div className="w-full h-3 bg-[#EEF0F4] rounded-full overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-green-500' : 'bg-[#7B5CF6]'}`}
                                style={{ width: `${pct}%` }}
                            />
                        </div>
                        <p className="text-xs text-[#9AA2B1] mt-2 font-medium">
                            {stats.total_training_ready} / {MIN_FOR_FINETUNE} esempi minimi per avviare il fine-tuning
                        </p>
                        {pct >= 100 && (
                            <p className="text-xs font-black text-green-600 mt-1">🚀 Dataset pronto! Esegui lo script di export e avvia il training su RunPod.</p>
                        )}
                    </div>

                    {/* Training patterns */}
                    <div className="bg-white rounded-[24px] border border-[#EEF0F4] shadow-sm p-5">
                        <p className="text-xs font-black text-[#9AA2B1] uppercase tracking-widest mb-4">Schemi (training_patterns)</p>
                        <div className="grid grid-cols-2 gap-3">
                            {[
                                { label: 'Ground Truth (Erika)', value: stats.ground_truth, color: 'text-[#7B5CF6]', bg: 'bg-[#F4EEFF]' },
                                { label: 'Validati da utenti', value: stats.validated, color: 'text-green-600', bg: 'bg-green-50' },
                                { label: 'In coda', value: stats.pending, color: 'text-amber-600', bg: 'bg-amber-50' },
                                { label: 'Rifiutati', value: stats.rejected, color: 'text-red-500', bg: 'bg-red-50' },
                            ].map(item => (
                                <div key={item.label} className={`${item.bg} rounded-2xl p-4`}>
                                    <p className={`text-3xl font-black ${item.color}`}>{item.value}</p>
                                    <p className="text-xs font-bold text-[#6B7280] mt-1">{item.label}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Feedback RLHF */}
                    <div className="bg-white rounded-[24px] border border-[#EEF0F4] shadow-sm p-5">
                        <p className="text-xs font-black text-[#9AA2B1] uppercase tracking-widest mb-4">Feedback RLHF (model_feedback)</p>
                        <div className="grid grid-cols-2 gap-3">
                            {[
                                { label: 'Feedback positivi', value: stats.feedback_correct, color: 'text-green-600', bg: 'bg-green-50' },
                                { label: 'Dati correttivi', value: stats.feedback_corrected, color: 'text-blue-600', bg: 'bg-blue-50' },
                            ].map(item => (
                                <div key={item.label} className={`${item.bg} rounded-2xl p-4`}>
                                    <p className={`text-3xl font-black ${item.color}`}>{item.value}</p>
                                    <p className="text-xs font-bold text-[#6B7280] mt-1">{item.label}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Totale training-ready */}
                    <div className={`rounded-[24px] border shadow-sm p-5 ${stats.total_training_ready >= MIN_FOR_FINETUNE ? 'bg-green-50 border-green-200' : 'bg-[#F4EEFF] border-[#E6DAFF]'}`}>
                        <p className="text-xs font-black text-[#9AA2B1] uppercase tracking-widest mb-1">Totale esempi pronti per training</p>
                        <p className={`text-5xl font-black ${stats.total_training_ready >= MIN_FOR_FINETUNE ? 'text-green-600' : 'text-[#7B5CF6]'}`}>
                            {stats.total_training_ready}
                        </p>
                        <p className="text-xs text-[#9AA2B1] mt-1 font-medium">
                            = {stats.ground_truth} GT + {stats.validated} validati + {stats.feedback_correct + stats.feedback_corrected} feedback
                        </p>
                    </div>

                    <button
                        onClick={() => { setLoading(true); setStats(null); setTimeout(() => { setLoading(false); }, 500); location.reload(); }}
                        className="w-full h-11 bg-[#FAFAFC] border border-[#EEF0F4] rounded-2xl font-bold text-sm text-[#6B7280] active:scale-95 transition-all"
                    >
                        Aggiorna
                    </button>
                </div>
            )}
        </>
    );
}

/* ─── fine Dataset Stats ─────────────────────────────────────── */

/* ─── AI Training Group (collassabile) ──────────────────────── */
function AiTrainingGroup({ onNavigate }: { onNavigate: (s: Section) => void }) {
    const [open, setOpen] = useState(false);
    return (
        <div className="bg-white rounded-[24px] border border-[#EEF0F4] shadow-sm overflow-hidden">
            <button
                onClick={() => setOpen(o => !o)}
                className="w-full flex items-center gap-4 px-5 py-4 active:scale-[0.98] transition-transform text-left"
            >
                <div className="w-11 h-11 rounded-2xl bg-[#F4EEFF] flex items-center justify-center flex-shrink-0">
                    <Sparkles size={20} className="text-[#7B5CF6]" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="font-black text-[#1C1C1E] text-[15px]">Modello AI Training</p>
                    <p className="text-[#9AA2B1] text-xs font-medium mt-0.5">Schema Creator, Validazione, Test e Dataset</p>
                </div>
                {open ? <ChevronUp size={18} className="text-[#9AA2B1] flex-shrink-0" /> : <ChevronDown size={18} className="text-[#9AA2B1] flex-shrink-0" />}
            </button>
            {open && (
                <div className="border-t border-[#EEF0F4] divide-y divide-[#EEF0F4]">
                    {[
                        { icon: <Sparkles size={18} className="text-[#7B5CF6]" />, title: 'Schema Creator', subtitle: 'Crea schemi con validator matematico live', action: () => { window.location.href = '/admin/schema-creator' } },
                        { icon: <FileText size={18} className="text-green-500" />, title: 'Coda Validazione', subtitle: 'Revisiona gli schemi inviati dagli utenti', action: () => onNavigate('validation-queue') },
                        { icon: <Shield size={18} className="text-amber-500" />, title: 'Classificatore Immagini', subtitle: 'Analizza foto amigurumi: reale o AI?', action: () => onNavigate('image-classifier') },
                        { icon: <MessageSquare size={18} className="text-[#7B5CF6]" />, title: 'Test Modello + Feedback', subtitle: 'Genera schemi e correggi errori per il training', action: () => onNavigate('model-test') },
                        { icon: <BarChart2 size={18} className="text-blue-500" />, title: 'Dataset Stats', subtitle: 'Contatori live: GT, validati, feedback RLHF', action: () => onNavigate('dataset-stats') },
                    ].map(item => (
                        <button key={item.title} onClick={item.action} className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-[#FAFAFC] active:bg-[#F4EEFF] transition-colors text-left">
                            <div className="w-8 h-8 rounded-xl bg-[#F4EEFF] flex items-center justify-center flex-shrink-0">{item.icon}</div>
                            <div className="flex-1 min-w-0">
                                <p className="font-bold text-[#1C1C1E] text-sm">{item.title}</p>
                                <p className="text-[#9AA2B1] text-[11px] font-medium truncate">{item.subtitle}</p>
                            </div>
                            <ChevRight size={15} className="text-[#9AA2B1] flex-shrink-0" />
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

type Section = null | 'peak' | 'users' | 'events' | 'ai-costs' | 'support' | 'library' | 'newsletter' | 'email' | 'validation-queue' | 'image-classifier' | 'model-test' | 'dataset-stats';

export function AdminDashboard() {
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [activeSection, setActiveSection] = useState<Section>(null);

    const loadStats = useCallback(async () => {
        try {
            const s = await getAdminStats();
            setStats(s);
        } catch (e: any) { setError(e.message); } finally { setLoading(false); }
    }, []);

    useEffect(() => { loadStats(); }, [loadStats]);

    if (loading) return <div className="p-10 text-center font-bold text-[#9AA2B1]">Caricamento...</div>;
    if (error) return <div className="p-10 text-center text-red-500 font-bold">{error}</div>;

    /* ── Sezione dettaglio attiva ── */
    if (activeSection === 'peak' && stats) {
        return (
            <div className="max-w-2xl mx-auto px-4 pt-6 pb-24">
                <SectionPeakHours stats={stats} onBack={() => setActiveSection(null)} />
            </div>
        );
    }
    if (activeSection === 'users') {
        return (
            <div className="max-w-2xl mx-auto px-4 pt-6 pb-24">
                <SectionAdminUsers onBack={() => setActiveSection(null)} />
            </div>
        );
    }
    if (activeSection === 'events') {
        return (
            <div className="max-w-2xl mx-auto px-4 pt-6 pb-24">
                <SectionEvents onBack={() => setActiveSection(null)} />
            </div>
        );
    }
    if (activeSection === 'ai-costs') {
        return (
            <div className="max-w-2xl mx-auto px-4 pt-6 pb-24">
                <SectionAiCosts onBack={() => setActiveSection(null)} />
            </div>
        );
    }
    if (activeSection === 'support') {
        return (
            <div className="max-w-2xl mx-auto px-4 pt-6 pb-24">
                <SectionSupport onBack={() => setActiveSection(null)} />
            </div>
        );
    }
    if (activeSection === 'library') {
        return (
            <div className="max-w-2xl mx-auto px-4 pt-6 pb-24">
                <SectionLibrary onBack={() => setActiveSection(null)} />
            </div>
        );
    }

    if (activeSection === 'newsletter') {
        return (
            <div className="max-w-2xl mx-auto px-4 pt-6 pb-24">
                <SectionNewsletter onBack={() => setActiveSection(null)} />
            </div>
        );
    }

    if (activeSection === 'email') {
        return (
            <div className="max-w-2xl mx-auto px-4 pt-6 pb-24">
                <SectionEmailMarketing onBack={() => setActiveSection(null)} />
            </div>
        );
    }

    if (activeSection === 'validation-queue') {
        return (
            <div className="max-w-2xl mx-auto px-4 pt-6 pb-24">
                <SectionValidationQueue onBack={() => setActiveSection(null)} />
            </div>
        );
    }

    if (activeSection === 'image-classifier') {
        return (
            <div className="max-w-2xl mx-auto px-4 pt-6 pb-24">
                <SectionImageClassifier onBack={() => setActiveSection(null)} />
            </div>
        );
    }

    if (activeSection === 'model-test') {
        return (
            <div className="max-w-2xl mx-auto px-4 pt-6 pb-24">
                <SectionModelTest onBack={() => setActiveSection(null)} />
            </div>
        );
    }

    if (activeSection === 'dataset-stats') {
        return (
            <div className="max-w-2xl mx-auto px-4 pt-6 pb-24">
                <SectionDatasetStats onBack={() => setActiveSection(null)} />
            </div>
        );
    }

    /* ── Home Dashboard ── */
    return (
        <div className="max-w-2xl mx-auto px-4 pt-6 pb-24">
            {/* Header */}
            <div className="flex items-center gap-3 mb-8">
                <Link href="/" className="w-10 h-10 flex items-center justify-center bg-white border border-[#EEF0F4] rounded-xl text-[#9AA2B1]">
                    <ArrowLeft size={20} />
                </Link>
                <div className="flex items-center gap-2">
                    <Shield size={22} className="text-[#7B5CF6]" />
                    <h1 className="text-2xl font-black text-[#1C1C1E]">Dashboard Admin</h1>
                </div>
            </div>

            {/* Stats — sempre visibili, compatte */}
            <div className="grid grid-cols-2 gap-3 mb-6">
                <StatCard label="Utenti totali" value={stats?.totalUsers ?? 0} />
                <StatCard label="Abbonati Premium" value={stats?.premiumCount ?? 0} />
                <StatCard label="Sessioni oggi" value={stats?.todaySessions ?? 0} />
                <StatCard label="Durata media" value={`${stats?.avgMinutes ?? 0} min`} sub="per sessione" />
            </div>

            {/* Sezioni a card cliccabili */}
            <div className="flex flex-col gap-3">
                <SectionCard
                    icon={<BarChart2 size={20} className="text-[#7B5CF6]" />}
                    title="Orari di Punta"
                    subtitle="Grafico attività ultimi 7 giorni"
                    onClick={() => setActiveSection('peak')}
                />
                <SectionCard
                    icon={<UserCheck size={20} className="text-[#7B5CF6]" />}
                    title="Gestione Admin"
                    subtitle="Promuovi o revoca privilegi admin"
                    onClick={() => setActiveSection('users')}
                />
                <SectionCard
                    icon={<CalendarDays size={20} className="text-[#7B5CF6]" />}
                    title="Gestione Eventi"
                    subtitle="Crea, modifica e monitora i corsi"
                    onClick={() => setActiveSection('events')}
                />
                <SectionCard
                    icon={<BarChart2 size={20} className="text-emerald-500" />}
                    title="Costi AI"
                    subtitle="Spesa, budget e controllo servizi AI"
                    onClick={() => setActiveSection('ai-costs')}
                />
                <SectionCard
                    icon={<Bug size={20} className="text-orange-500" />}
                    title="Segnalazioni"
                    subtitle="Gestisci e rispondi ai ticket di supporto"
                    onClick={() => setActiveSection('support')}
                />
                <SectionCard
                    icon={<BookOpen size={20} className="text-[#7B5CF6]" />}
                    title="Libreria"
                    subtitle="Carica e gestisci libri e schemi"
                    onClick={() => setActiveSection('library')}
                />
                <SectionCard
                    icon={<Mail size={20} className="text-pink-500" />}
                    title="Email Marketing"
                    subtitle="Campagne, sequenze nurturing e inbox ricevute"
                    onClick={() => setActiveSection('email')}
                />
                {/* ── Modello AI Training (collassabile) ── */}
                <AiTrainingGroup onNavigate={setActiveSection} />
            </div>
        </div>
    );
}
