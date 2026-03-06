"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
    CalendarDays, Users, ExternalLink, X,
    CheckCircle2, XCircle, Wallet, ChevronDown, ChevronUp,
    ChevronLeft, ChevronRight, Clock, Bell, MessageSquare, Send,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useSearchParams } from "next/navigation";
import {
    bookEventWithCredit, cancelBooking, submitEventInterest,
    getMyEventInterests, getUserInterestMessages, sendUserMessage,
} from "@/features/events/actions/events";

/* ─── Types ──────────────────────────────────────────────── */
interface LEvent {
    id: string; title: string; description: string | null;
    image_url: string | null; image_urls: string[] | null;
    cost: number; event_date: string;
    access_link: string | null; max_participants: number | null;
    is_active: boolean; created_at: string;
    booking_count?: number;
    duration_minutes?: number | null;
}

interface Booking {
    id: string; event_id: string; amount_paid: number;
    credit_used: number; status: string;
}

/* ─── Helpers ────────────────────────────────────────────── */
function fmtDuration(minutes: number | null | undefined): string {
    if (!minutes) return '';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h === 0) return `${m} min`;
    if (m === 0) return `${h} h`;
    return `${h} h ${m} min`;
}

/* ─── Event Image Viewer ─────────────────────────────────── */
function EventImageViewer({
    images, event, initialIndex = 0, onClose,
}: {
    images: string[]; event: LEvent; initialIndex?: number; onClose: () => void;
}) {
    const [idx, setIdx] = useState(initialIndex);
    const touchStartX = useRef<number | null>(null);

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
            <div className="flex items-center justify-between px-4 py-3 bg-black/70 flex-shrink-0">
                <span className="text-white/60 text-sm font-bold">{idx + 1} / {images.length}</span>
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
                <img src={images[idx]} alt={event.title} className="max-w-full max-h-full object-contain select-none" draggable={false} />
                {images.length > 1 && (
                    <>
                        <button onClick={() => setIdx(i => Math.max(0, i - 1))} disabled={idx <= 0}
                            className="absolute left-3 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center bg-black/50 text-white rounded-full disabled:opacity-20 active:scale-90 transition-all">
                            <ChevronLeft size={24} />
                        </button>
                        <button onClick={() => setIdx(i => Math.min(images.length - 1, i + 1))} disabled={idx >= images.length - 1}
                            className="absolute right-3 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center bg-black/50 text-white rounded-full disabled:opacity-20 active:scale-90 transition-all">
                            <ChevronRight size={24} />
                        </button>
                    </>
                )}
            </div>
            <div className="bg-black/80 px-5 py-4 flex-shrink-0">
                <h3 className="text-white font-black text-lg leading-tight">{event.title}</h3>
                <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                    <span className="text-white/70 text-sm font-medium flex items-center gap-1.5">
                        <CalendarDays size={14} className="text-[#7B5CF6]" />
                        {new Date(event.event_date).toLocaleString('it-IT', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className="text-[#7B5CF6] font-black text-sm">
                        {event.cost === 0 ? 'Gratis' : `€${Number(event.cost).toFixed(2)}`}
                    </span>
                    {event.max_participants && (
                        <span className="text-white/70 text-sm font-medium flex items-center gap-1.5">
                            <Users size={14} />
                            {event.booking_count ?? 0} / {event.max_participants} posti
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}

/* ─── Interest Modal ─────────────────────────────────────── */
function InterestModal({ event, onClose, onSent }: {
    event: LEvent; onClose: () => void; onSent: () => void;
}) {
    const [preferredDate, setPreferredDate] = useState('');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState('');

    const handleSend = async () => {
        setLoading(true); setErr('');
        try {
            await submitEventInterest(event.id, preferredDate, message);
            onSent();
        } catch (e: any) {
            setErr(e.message);
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[10000] flex items-end justify-center bg-black/40" onClick={onClose}>
            <div className="w-full max-w-2xl bg-white rounded-t-[32px] p-6 pb-10 shadow-2xl animate-in slide-in-from-bottom duration-300"
                onClick={e => e.stopPropagation()}>
                <div className="w-12 h-1.5 bg-[#EEF0F4] rounded-full mx-auto mb-5" />
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-black text-[#1C1C1E]">Sono interessato</h3>
                    <button onClick={onClose}><X size={20} className="text-[#9AA2B1]" /></button>
                </div>

                <div className="bg-amber-50 rounded-2xl p-4 mb-4 border border-amber-100">
                    <p className="font-black text-[#1C1C1E]">{event.title}</p>
                    <p className="text-amber-700 text-sm font-bold mt-1">Registra il tuo interesse per una nuova data</p>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="text-xs font-black text-[#9AA2B1] uppercase tracking-wider block mb-1">Data preferita (opzionale)</label>
                        <input
                            value={preferredDate}
                            onChange={e => setPreferredDate(e.target.value)}
                            placeholder="es. prima settimana di aprile, fine marzo..."
                            className="w-full h-12 px-4 bg-[#FAFAFC] border border-[#EEF0F4] rounded-xl outline-none focus:border-[#7B5CF6] font-medium text-sm"
                        />
                    </div>
                    <div>
                        <label className="text-xs font-black text-[#9AA2B1] uppercase tracking-wider block mb-1">Messaggio (opzionale)</label>
                        <textarea
                            value={message}
                            onChange={e => setMessage(e.target.value)}
                            rows={3}
                            placeholder="Aggiungi un messaggio per l'organizzatore..."
                            className="w-full px-4 py-3 bg-[#FAFAFC] border border-[#EEF0F4] rounded-xl outline-none focus:border-[#7B5CF6] font-medium text-sm resize-none"
                        />
                    </div>
                </div>

                {err && <p className="text-red-500 text-sm font-bold mt-4 bg-red-50 p-3 rounded-xl">{err}</p>}

                <button onClick={handleSend} disabled={loading}
                    className="w-full mt-5 py-4 rounded-2xl font-black text-[15px] bg-amber-500 text-white shadow-lg shadow-amber-500/30 active:scale-[0.97] transition-all disabled:opacity-60 flex items-center justify-center gap-2">
                    <Send size={16} /> {loading ? 'Invio...' : 'Invia interesse'}
                </button>
            </div>
        </div>
    );
}

/* ─── Booking Modal ──────────────────────────────────────── */
function BookingModal({
    event, userCredit, onClose, onBooked,
}: {
    event: LEvent; userCredit: number; onClose: () => void; onBooked: () => void;
}) {
    const cost = Number(event.cost ?? 0);
    const [creditToUse, setCreditToUse] = useState(Math.min(userCredit, cost));
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState('');
    const chargeAmount = Math.max(0, cost - creditToUse);
    const isFree = chargeAmount === 0;

    const handleBook = async () => {
        setLoading(true); setErr('');
        try {
            if (isFree) {
                await bookEventWithCredit(event.id);
                onBooked();
            } else {
                const res = await fetch('/api/stripe/event-checkout', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ eventId: event.id, creditToUse }),
                });
                const data = await res.json();
                if (data.error) throw new Error(data.error);
                window.location.href = data.url;
            }
        } catch (e: any) {
            setErr(e.message || 'Errore. Riprova.');
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[10000] flex items-end justify-center bg-black/40" onClick={onClose}>
            <div className="w-full max-w-2xl bg-white rounded-t-[32px] p-6 pb-10 shadow-2xl animate-in slide-in-from-bottom duration-300"
                onClick={e => e.stopPropagation()}>
                <div className="w-12 h-1.5 bg-[#EEF0F4] rounded-full mx-auto mb-5" />
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-black text-[#1C1C1E]">Prenota</h3>
                    <button onClick={onClose}><X size={20} className="text-[#9AA2B1]" /></button>
                </div>

                <div className="bg-[#FAFAFC] rounded-2xl p-4 mb-4">
                    <p className="font-black text-[#1C1C1E]">{event.title}</p>
                    <p className="text-[#9AA2B1] text-sm font-medium">
                        {new Date(event.event_date).toLocaleString('it-IT', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                    <p className="text-[#7B5CF6] font-black text-lg mt-1">
                        {cost === 0 ? 'Gratis' : `€${cost.toFixed(2)}`}
                    </p>
                </div>

                {userCredit > 0 && cost > 0 && (
                    <div className="mb-4">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-1.5 text-[#7B5CF6]">
                                <Wallet size={16} />
                                <span className="font-bold text-sm">Credito disponibile: €{userCredit.toFixed(2)}</span>
                            </div>
                            <span className="text-xs text-[#9AA2B1] font-bold">Usa: €{creditToUse.toFixed(2)}</span>
                        </div>
                        <input type="range" min={0} max={Math.min(userCredit, cost)} step={0.01}
                            value={creditToUse} onChange={e => setCreditToUse(parseFloat(e.target.value))}
                            className="w-full accent-[#7B5CF6]" />
                        <div className="flex justify-between text-xs text-[#9AA2B1] font-bold mt-1">
                            <span>Credito usato: €{creditToUse.toFixed(2)}</span>
                            <span>Da pagare: €{chargeAmount.toFixed(2)}</span>
                        </div>
                    </div>
                )}

                <div className="bg-[#F4F4F8] rounded-2xl p-4 mb-5 text-[11px] text-[#9AA2B1] font-medium leading-relaxed">
                    <p className="font-black text-[#9AA2B1] mb-1 uppercase tracking-wider text-[10px]">Condizioni di acquisto</p>
                    Il pagamento non è rimborsabile sulla carta di credito. In caso di cancellazione (almeno 24h prima
                    dell'evento), l'importo verrà accreditato come credito eventi riutilizzabile per altri corsi.
                </div>

                {err && <p className="text-red-500 text-sm font-bold mb-4 bg-red-50 p-3 rounded-xl">{err}</p>}

                <button onClick={handleBook} disabled={loading}
                    className="w-full py-4 rounded-2xl font-black text-[15px] bg-[#7B5CF6] text-white shadow-lg shadow-[#7B5CF6]/30 active:scale-[0.97] transition-all disabled:opacity-60">
                    {loading ? 'Reindirizzamento...' : isFree ? 'Prenota gratis' : `Paga €${chargeAmount.toFixed(2)}`}
                </button>
            </div>
        </div>
    );
}

/* ─── Tipi chat interessi ─────────────────────────────────── */
interface UserInterest { id: string; event_id: string; preferred_date: string | null; message: string | null; created_at: string; }
interface InterestMsg { id: string; sender_role: string; content: string; created_at: string; }

/* ─── User Interest Chat Modal ───────────────────────────── */
function UserInterestChatModal({ interest, onClose }: { interest: UserInterest; onClose: () => void }) {
    const [messages, setMessages] = useState<InterestMsg[]>([]);
    const [loading, setLoading] = useState(true);
    const [text, setText] = useState('');
    const [sending, setSending] = useState(false);
    const bottomRef = useRef<HTMLDivElement>(null);

    const load = useCallback(async () => {
        try {
            const data = await getUserInterestMessages(interest.id);
            setMessages(data);
            setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
        } finally { setLoading(false); }
    }, [interest.id]);

    useEffect(() => { load(); }, [load]);

    useEffect(() => {
        const supabase = createClient();
        const ch = supabase.channel(`imsg-user-${interest.id}`)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'interest_messages', filter: `interest_id=eq.${interest.id}` }, () => load())
            .subscribe();
        return () => { supabase.removeChannel(ch); };
    }, [interest.id, load]);

    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = ''; };
    }, []);

    const handleSend = async () => {
        if (!text.trim() || sending) return;
        setSending(true);
        const content = text.trim();
        setText(''); // svuota subito l'input
        try {
            await sendUserMessage(interest.id, content);
            await load(); // ricarica i messaggi dopo l'invio
        }
        catch (e: any) { setText(content); alert(e.message); } // ripristina testo se errore
        finally { setSending(false); }
    };

    return (
        <div className="fixed inset-0 z-[10000] flex items-end justify-center bg-black/50" onClick={onClose}>
            <div
                className="w-full max-w-2xl bg-white rounded-t-[32px] shadow-2xl animate-in slide-in-from-bottom duration-300 flex flex-col"
                style={{ maxHeight: '82dvh' }}
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex-shrink-0 px-5 pt-4 pb-3 border-b border-[#EEF0F4]">
                    <div className="w-10 h-1 bg-[#EEF0F4] rounded-full mx-auto mb-3" />
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <h3 className="text-[17px] font-black text-[#1C1C1E]">Messaggi con l'organizzatore</h3>
                            <p className="text-[#9AA2B1] text-xs font-medium mt-0.5">Visibile solo a te e all'organizzatore</p>
                        </div>
                        <button onClick={onClose} className="flex-shrink-0 w-9 h-9 flex items-center justify-center bg-[#F4F4F8] rounded-xl text-[#9AA2B1]">
                            <X size={16} />
                        </button>
                    </div>
                    {interest.message && (
                        <div className="mt-3 bg-amber-50 rounded-xl p-3 border border-amber-100">
                            <p className="text-amber-700 text-[10px] font-black uppercase tracking-wider mb-0.5">Il tuo messaggio iniziale</p>
                            <p className="text-[#1C1C1E] text-xs leading-relaxed break-words">{interest.message}</p>
                        </div>
                    )}
                </div>

                {/* Messaggi */}
                <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2 min-h-0">
                    {loading ? (
                        <p className="text-[#9AA2B1] text-sm text-center py-6">Caricamento...</p>
                    ) : messages.length === 0 ? (
                        <p className="text-[#9AA2B1] text-sm italic text-center py-6 leading-relaxed">
                            Nessun messaggio ancora.<br />L'organizzatore ti risponderà qui.
                        </p>
                    ) : messages.map(m => (
                        <div key={m.id} className={`flex ${m.sender_role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[78%] flex flex-col gap-0.5 min-w-0 ${m.sender_role === 'user' ? 'items-end' : 'items-start'}`}>
                                <span className="text-[10px] font-bold text-[#9AA2B1] px-1">
                                    {m.sender_role === 'user' ? 'Tu' : 'Organizzatore'}
                                </span>
                                <div className={`px-4 py-2.5 rounded-2xl text-sm font-medium leading-relaxed break-words ${m.sender_role === 'user' ? 'bg-[#7B5CF6] text-white rounded-br-sm' : 'bg-[#F4F4F8] text-[#1C1C1E] rounded-bl-sm'}`}>
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
                        <Send size={16} />
                    </button>
                </div>
            </div>
        </div>
    );
}

/* ─── Event Card ─────────────────────────────────────────── */
function EventCard({
    event, userBooking, userCredit, isLoggedIn, userInterest, onBook, onCancel, onInterest, onOpenChat,
}: {
    event: LEvent; userBooking: Booking | null;
    userCredit: number; isLoggedIn: boolean;
    userInterest: UserInterest | null;
    onBook: () => void; onCancel: (bookingId: string) => void;
    onInterest: () => void; onOpenChat: () => void;
}) {
    const isPast = new Date(event.event_date) < new Date();
    const isFull = event.max_participants !== null && (event.booking_count ?? 0) >= event.max_participants;
    const isConfirmed = userBooking?.status === 'confirmed';
    const hoursUntil = isConfirmed ? (new Date(event.event_date).getTime() - Date.now()) / 3_600_000 : 0;
    const canCancel = isConfirmed && hoursUntil >= 24;

    const allImages: string[] = event.image_urls?.length
        ? event.image_urls
        : (event.image_url ? [event.image_url] : []);
    const [viewer, setViewer] = useState<{ open: boolean; index: number }>({ open: false, index: 0 });
    const [descExpanded, setDescExpanded] = useState(false);
    const DESC_LIMIT = 160;

    return (
        <div className="bg-white rounded-[28px] border border-[#EEF0F4] overflow-hidden shadow-sm">
            {/* Image(s) */}
            {allImages.length > 0 && (
                <div
                    className="relative w-full cursor-pointer select-none"
                    onClick={() => setViewer({ open: true, index: 0 })}
                >
                    <img src={allImages[0]} alt={event.title} className="w-full h-auto block" />
                    {allImages.length > 1 && (
                        <span className="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                            +{allImages.length - 1} foto
                        </span>
                    )}
                </div>
            )}

            <div className="p-5">
                <div className="flex items-start justify-between gap-2 mb-2">
                    <h2 className="text-xl font-black text-[#1C1C1E] leading-tight">{event.title}</h2>
                    <span className="text-xl font-black text-[#7B5CF6] flex-shrink-0">
                        {event.cost === 0 ? 'Gratis' : `€${Number(event.cost).toFixed(2)}`}
                    </span>
                </div>

                {event.description && (
                    <div className="mb-3">
                        <p className="text-[#9AA2B1] text-sm font-medium leading-relaxed">
                            {descExpanded || event.description.length <= DESC_LIMIT
                                ? event.description
                                : event.description.slice(0, DESC_LIMIT) + '…'}
                        </p>
                        {event.description.length > DESC_LIMIT && (
                            <button
                                onClick={() => setDescExpanded(v => !v)}
                                className="text-[#7B5CF6] text-xs font-bold mt-1"
                            >
                                {descExpanded ? 'Mostra meno' : 'Leggi di più'}
                            </button>
                        )}
                    </div>
                )}

                <div className="flex items-center gap-4 text-xs text-[#9AA2B1] font-bold mb-4 flex-wrap">
                    <div className="flex items-center gap-1">
                        <CalendarDays size={13} />
                        {new Date(event.event_date).toLocaleString('it-IT', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </div>
                    {event.duration_minutes ? (
                        <div className="flex items-center gap-1">
                            <Clock size={13} />
                            {fmtDuration(event.duration_minutes)}
                        </div>
                    ) : null}
                    {event.max_participants && (
                        <div className="flex items-center gap-1">
                            <Users size={13} />
                            {event.booking_count ?? 0} / {event.max_participants} posti
                        </div>
                    )}
                </div>

                {/* Access link for confirmed bookings */}
                {isConfirmed && event.access_link && (
                    <a href={event.access_link} target="_blank"
                        className="flex items-center gap-1 text-[#7B5CF6] font-bold text-sm hover:underline mb-3">
                        <ExternalLink size={14} /> Accedi al corso
                    </a>
                )}

                {/* CTA principale */}
                {isConfirmed ? (
                    <div className="flex items-center gap-2">
                        <div className="flex-1 py-3 rounded-2xl font-black text-[14px] text-center bg-green-50 text-green-700 border border-green-100 flex items-center justify-center gap-1.5">
                            <CheckCircle2 size={16} /> Prenotato ✓
                        </div>
                        {canCancel && (
                            <button
                                onClick={() => onCancel(userBooking!.id)}
                                className="px-3 py-3 rounded-2xl font-black text-[13px] bg-red-50 text-red-400 hover:text-red-600 border border-red-100 transition-colors"
                            >
                                Disdici
                            </button>
                        )}
                    </div>
                ) : !userBooking || userBooking.status === 'cancelled' ? (
                    isPast ? (
                        <div className="w-full py-3 rounded-2xl font-bold text-[14px] text-center bg-[#FAFAFC] text-[#9AA2B1] border border-[#EEF0F4]">
                            Evento terminato
                        </div>
                    ) : isFull ? (
                        <button
                            onClick={isLoggedIn ? onInterest : () => { window.location.href = '/api/auth/google'; }}
                            className="w-full py-3 rounded-2xl font-black text-[14px] bg-amber-50 text-amber-700 border border-amber-200 active:scale-[0.97] transition-all flex items-center justify-center gap-2"
                        >
                            <MessageSquare size={16} /> Posti esauriti — Sono interessato
                        </button>
                    ) : (
                        <button
                            onClick={isLoggedIn ? onBook : () => { window.location.href = '/api/auth/google'; }}
                            className="w-full py-3 rounded-2xl font-black text-[14px] bg-[#7B5CF6] text-white shadow-lg shadow-[#7B5CF6]/20 active:scale-[0.97] transition-all"
                        >
                            {isLoggedIn ? 'Prenota' : 'Accedi per prenotare'}
                        </button>
                    )
                ) : null}

                {/* Bottone interesse — sempre visibile se l'evento non è passato e non è sold-out */}
                {!isPast && !isFull && (
                    <button
                        onClick={isLoggedIn ? onInterest : () => { window.location.href = '/api/auth/google'; }}
                        className="w-full mt-2 py-2.5 rounded-2xl font-bold text-[13px] bg-amber-50 text-amber-600 border border-amber-100 active:scale-[0.97] transition-all flex items-center justify-center gap-1.5"
                    >
                        <MessageSquare size={14} /> Sono interessato a un'altra data
                    </button>
                )}

                {/* Bottone messaggi — appare se l'utente ha un interesse registrato */}
                {userInterest && (
                    <button
                        onClick={onOpenChat}
                        className="w-full mt-2 py-2.5 rounded-2xl font-bold text-[13px] bg-[#F4EEFF] text-[#7B5CF6] border border-[#E6DAFF] active:scale-[0.97] transition-all flex items-center justify-center gap-1.5"
                    >
                        <MessageSquare size={14} /> Messaggi con l'organizzatore
                    </button>
                )}
            </div>

            {/* Fullscreen image viewer */}
            {viewer.open && allImages.length > 0 && (
                <EventImageViewer
                    images={allImages}
                    event={event}
                    initialIndex={viewer.index}
                    onClose={() => setViewer({ open: false, index: 0 })}
                />
            )}
        </div>
    );
}

/* ─── My Bookings Accordion ──────────────────────────────── */
function MyBookings({ bookings, events, onCancel }: {
    bookings: Booking[]; events: LEvent[];
    onCancel: (bookingId: string) => void;
}) {
    const [open, setOpen] = useState(false);
    const confirmed = bookings.filter(b => b.status === 'confirmed');
    if (confirmed.length === 0) return null;

    return (
        <div className="bg-white rounded-[28px] border border-[#EEF0F4] overflow-hidden shadow-sm mb-6">
            <button onClick={() => setOpen(o => !o)}
                className="w-full flex items-center justify-between px-5 py-4">
                <span className="font-black text-[#1C1C1E]">Le mie prenotazioni ({confirmed.length})</span>
                {open ? <ChevronUp size={18} className="text-[#9AA2B1]" /> : <ChevronDown size={18} className="text-[#9AA2B1]" />}
            </button>
            {open && (
                <div className="px-5 pb-5 flex flex-col gap-3 border-t border-[#EEF0F4] pt-4">
                    {confirmed.map(b => {
                        const ev = events.find(e => e.id === b.event_id);
                        if (!ev) return null;
                        const hoursUntil = (new Date(ev.event_date).getTime() - Date.now()) / 3_600_000;
                        const canCancel = hoursUntil >= 24;
                        return (
                            <div key={b.id} className="bg-[#FAFAFC] rounded-2xl p-4">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <p className="font-black text-[#1C1C1E] text-sm">{ev.title}</p>
                                        <p className="text-[#9AA2B1] text-xs font-medium">
                                            {new Date(ev.event_date).toLocaleString('it-IT', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                        {ev.access_link && (
                                            <a href={ev.access_link} target="_blank"
                                                className="flex items-center gap-1 text-[#7B5CF6] font-bold text-xs mt-1 hover:underline">
                                                <ExternalLink size={12} /> Accedi al corso
                                            </a>
                                        )}
                                    </div>
                                    {canCancel && (
                                        <button onClick={() => onCancel(b.id)}
                                            className="text-[10px] font-black text-red-400 hover:text-red-600 px-2 py-1 bg-red-50 rounded-lg">
                                            Cancella
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

/* ─── Main Page ──────────────────────────────────────────── */
export default function EventiPage() {
    const { user } = useAuth();
    const { profile, refreshProfile } = useUserProfile();
    const searchParams = useSearchParams();
    const [events, setEvents] = useState<LEvent[]>([]);
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [myInterests, setMyInterests] = useState<UserInterest[]>([]);
    const [loading, setLoading] = useState(true);
    const [notice, setNotice] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
    const [bookingModal, setBookingModal] = useState<LEvent | null>(null);
    const [interestModal, setInterestModal] = useState<LEvent | null>(null);
    const [chatInterest, setChatInterest] = useState<UserInterest | null>(null);
    // Per la notifica promozione ad admin
    const prevIsAdmin = useRef<boolean | null>(null);

    const loadEvents = useCallback(async () => {
        const supabase = createClient();
        const { data } = await supabase
            .from('events')
            .select('*')
            .eq('is_active', true)
            .order('event_date', { ascending: true });

        if (!data) { setLoading(false); return; }

        // booking_count è mantenuto da un trigger Postgres su event_bookings:
        // quando cambia, aggiorna events.booking_count → il Realtime su events
        // notifica tutti i client connessi senza problemi di RLS
        setEvents(data as LEvent[]);
        setLoading(false);
    }, []);

    const loadBookings = useCallback(async () => {
        if (!user) return;
        const supabase = createClient();
        const { data } = await supabase
            .from('event_bookings')
            .select('id, event_id, amount_paid, credit_used, status')
            .eq('user_id', user.id);
        setBookings((data ?? []) as Booking[]);
    }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

    const loadMyInterests = useCallback(async () => {
        if (!user) return;
        const data = await getMyEventInterests();
        setMyInterests(data);
    }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => { loadEvents(); }, [loadEvents]);
    useEffect(() => { loadBookings(); }, [loadBookings]);
    useEffect(() => { loadMyInterests(); }, [loadMyInterests]);

    // ─── Gestisci redirect Stripe success ──────────────────────────
    useEffect(() => {
        if (searchParams.get('success') !== 'true' || !user) return;

        const sessionId = searchParams.get('session_id');
        if (!sessionId) {
            // Nessun session_id: ricarica semplicemente le prenotazioni
            setNotice({ type: 'info', text: 'Aggiornamento prenotazione...' });
            loadBookings().then(async () => {
                await loadEvents();
                refreshProfile();
                setNotice({ type: 'success', text: 'Prenotazione confermata! 🎉' });
            });
            return;
        }

        setNotice({ type: 'info', text: 'Conferma prenotazione in corso...' });

        (async () => {
            try {
                const res = await fetch('/api/stripe/confirm-booking', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sessionId }),
                });
                const data = await res.json();

                if (!res.ok) throw new Error(data.error || 'Errore conferma');

                // Aggiorna lo stato locale con la prenotazione confermata
                if (data.booking) {
                    setBookings(prev => {
                        const filtered = prev.filter(b => b.id !== data.booking.id);
                        return [...filtered, data.booking as Booking];
                    });
                }
                await loadEvents();
                refreshProfile();
                setNotice({ type: 'success', text: 'Prenotazione confermata! 🎉' });
            } catch (err: any) {
                setNotice({ type: 'error', text: err.message || 'Errore nella conferma. Ricarica la pagina.' });
            }
        })();
    }, [searchParams, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (searchParams.get('canceled') === 'true') {
            setNotice({ type: 'error', text: 'Pagamento annullato.' });
        }
    }, [searchParams]);

    // ─── Realtime: eventi, prenotazioni, profilo (admin notification) ──
    useEffect(() => {
        const supabase = createClient();
        const channels: ReturnType<typeof supabase.channel>[] = [];

        // Canale eventi e prenotazioni — aggiorna per tutti gli utenti in tempo reale
        const evCh = supabase
            .channel('lurumi-events-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, () => {
                loadEvents();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'event_bookings' }, () => {
                loadEvents();
                if (user) loadBookings();
            })
            .subscribe();
        channels.push(evCh);

        // Canale profilo utente — notifica promozione ad admin in tempo reale
        if (user) {
            const profileCh = supabase
                .channel(`profile-${user.id}`)
                .on('postgres_changes', {
                    event: 'UPDATE', schema: 'public', table: 'profiles',
                    filter: `id=eq.${user.id}`,
                }, (payload: any) => {
                    const newProfile = payload.new;
                    if (
                        newProfile?.is_admin === true &&
                        prevIsAdmin.current === false
                    ) {
                        setNotice({ type: 'success', text: '🛡️ Sei stato promosso ad Admin!' });
                    }
                    prevIsAdmin.current = newProfile?.is_admin ?? false;
                    refreshProfile();
                })
                .subscribe();
            channels.push(profileCh);
        }

        return () => { channels.forEach(ch => supabase.removeChannel(ch)); };
    }, [user?.id, loadEvents, loadBookings]); // eslint-disable-line react-hooks/exhaustive-deps

    // Inizializza prevIsAdmin quando il profilo carica
    useEffect(() => {
        if (profile !== null && prevIsAdmin.current === null) {
            prevIsAdmin.current = (profile as any)?.is_admin ?? false;
        }
    }, [profile]);

    const handleCancelBooking = async (bookingId: string) => {
        if (!confirm('Cancellare la prenotazione? L\'importo verrà accreditato come credito eventi.')) return;
        try {
            const result = await cancelBooking(bookingId);
            setNotice({ type: 'success', text: `Prenotazione cancellata. Credito aggiunto: €${result.creditAdded.toFixed(2)}` });
            await Promise.all([loadBookings(), loadEvents()]);
            refreshProfile();
        } catch (err: any) {
            setNotice({ type: 'error', text: err.message });
        }
    };

    const userCredit = Number(profile?.event_credit ?? 0);

    const noticeColor = notice?.type === 'success'
        ? 'bg-green-50 text-green-700'
        : notice?.type === 'info'
            ? 'bg-blue-50 text-blue-700'
            : 'bg-red-50 text-red-600';

    const noticeIcon = notice?.type === 'success'
        ? <CheckCircle2 size={20} className="flex-shrink-0 mt-0.5" />
        : notice?.type === 'info'
            ? <Bell size={20} className="flex-shrink-0 mt-0.5" />
            : <XCircle size={20} className="flex-shrink-0 mt-0.5" />;

    return (
        <div className="max-w-2xl mx-auto px-4 pt-6 pb-24">
            <header className="mb-6">
                <h1 className="text-3xl font-black text-[#1C1C1E] mb-1">Corsi & Workshop</h1>
                <p className="text-[#9AA2B1] text-sm font-medium">Impara con noi dal vivo o online</p>
            </header>

            {notice && (
                <div className={`flex items-start gap-3 p-4 rounded-2xl mb-6 text-sm font-bold animate-in fade-in ${noticeColor}`}>
                    {noticeIcon}
                    {notice.text}
                    <button onClick={() => setNotice(null)} className="ml-auto"><X size={16} /></button>
                </div>
            )}

            {/* Credit badge */}
            {user && userCredit > 0 && (
                <div className="flex items-center gap-2 bg-[#F4EEFF] rounded-2xl px-4 py-3 mb-6">
                    <Wallet size={16} className="text-[#7B5CF6]" />
                    <span className="text-[#7B5CF6] font-black text-sm">
                        Credito disponibile: €{userCredit.toFixed(2)}
                    </span>
                </div>
            )}

            {/* My bookings */}
            {user && bookings.length > 0 && (
                <MyBookings bookings={bookings} events={events} onCancel={handleCancelBooking} />
            )}

            {/* Events list */}
            {loading ? (
                <div className="text-center py-16 text-[#9AA2B1] font-bold">Caricamento...</div>
            ) : events.length === 0 ? (
                <div className="text-center py-16">
                    <div className="w-16 h-16 bg-[#F4EEFF] rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <CalendarDays size={32} className="text-[#7B5CF6]" />
                    </div>
                    <p className="text-[#9AA2B1] font-bold">Nessun evento in programma</p>
                    <p className="text-[#9AA2B1] text-sm font-medium mt-1">Torna presto per scoprire i prossimi corsi!</p>
                </div>
            ) : (
                <div className="flex flex-col gap-5">
                    {events.map(ev => {
                        const interest = myInterests.find(i => i.event_id === ev.id) ?? null;
                        return (
                            <EventCard
                                key={ev.id}
                                event={ev}
                                userBooking={bookings.find(b => b.event_id === ev.id) ?? null}
                                userCredit={userCredit}
                                isLoggedIn={!!user}
                                userInterest={interest}
                                onBook={() => setBookingModal(ev)}
                                onCancel={handleCancelBooking}
                                onInterest={() => setInterestModal(ev)}
                                onOpenChat={() => setChatInterest(interest)}
                            />
                        );
                    })}
                </div>
            )}

            {/* Booking modal */}
            {bookingModal && (
                <BookingModal
                    event={bookingModal}
                    userCredit={userCredit}
                    onClose={() => setBookingModal(null)}
                    onBooked={async () => {
                        setBookingModal(null);
                        setNotice({ type: 'success', text: 'Prenotazione confermata! 🎉' });
                        // Ottimistico: incrementa subito il conteggio
                        setEvents(prev => prev.map(ev =>
                            ev.id === bookingModal.id
                                ? { ...ev, booking_count: (ev.booking_count ?? 0) + 1 }
                                : ev
                        ));
                        setBookings(prev => [...prev, {
                            id: `temp-${Date.now()}`, event_id: bookingModal.id,
                            amount_paid: 0, credit_used: Number(bookingModal.cost),
                            status: 'confirmed',
                        }]);
                        await Promise.all([loadBookings(), loadEvents()]);
                        refreshProfile();
                    }}
                />
            )}

            {/* Interest modal */}
            {interestModal && (
                <InterestModal
                    event={interestModal}
                    onClose={() => setInterestModal(null)}
                    onSent={() => {
                        setInterestModal(null);
                        setNotice({ type: 'success', text: 'Interesse registrato! Puoi seguire la risposta dell\'organizzatore nella card dell\'evento.' });
                        loadMyInterests();
                    }}
                />
            )}

            {/* Chat interesse utente */}
            {chatInterest && (
                <UserInterestChatModal
                    interest={chatInterest}
                    onClose={() => setChatInterest(null)}
                />
            )}
        </div>
    );
}
