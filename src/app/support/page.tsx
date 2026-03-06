"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { ArrowLeft, Mail, ExternalLink, Archive, RotateCcw, Bug, CheckCircle, Trash2, Send, MessageCircle, ChevronDown, ChevronUp } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { submitBugReport } from "@/app/actions/bugReport";
import { sendUserSupportMessage } from "@/app/actions/supportTickets";
import { useProjectStore } from "@/features/projects/store/useProjectStore";

interface BackupRow {
    id: string;
    name: string;
    data_json: { projects: any[]; tutorials: any[]; createdAt: number };
    created_at: string;
}

interface Ticket {
    id: string;
    description: string;
    status: string;
    created_at: string;
}

interface SupportMessage {
    id: string;
    bug_report_id: string;
    sender_type: "user" | "admin";
    content: string;
    created_at: string;
}

// ── Thread conversazione per un ticket ──────────────────────────────────────
function TicketThread({
    ticket,
    onBack,
    userId,
}: {
    ticket: Ticket;
    onBack: () => void;
    userId: string;
}) {
    const [messages, setMessages] = useState<SupportMessage[]>([]);
    const [loading, setLoading] = useState(true);
    const [text, setText] = useState("");
    const [sending, setSending] = useState(false);
    const bottomRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const load = useCallback(async () => {
        const supabase = createClient();
        const { data } = await supabase
            .from("support_messages")
            .select("*")
            .eq("bug_report_id", ticket.id)
            .order("created_at", { ascending: true });
        setMessages((data ?? []) as SupportMessage[]);
        setLoading(false);
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
    }, [ticket.id]);

    useEffect(() => { load(); }, [load]);

    // Realtime: ascolta nuovi messaggi
    useEffect(() => {
        const supabase = createClient();
        const ch = supabase
            .channel(`support-user-${ticket.id}`)
            .on("postgres_changes", {
                event: "INSERT",
                schema: "public",
                table: "support_messages",
                filter: `bug_report_id=eq.${ticket.id}`,
            }, () => load())
            .subscribe();
        return () => { supabase.removeChannel(ch); };
    }, [ticket.id, load]);

    const handleSend = async () => {
        if (!text.trim() || sending) return;
        setSending(true);
        const content = text.trim();
        setText("");
        try {
            await sendUserSupportMessage(ticket.id, content);
            await load();
        } catch (e: any) {
            setText(content);
            alert(e.message);
        } finally {
            setSending(false);
        }
    };

    const isClosed = ticket.status === "closed";

    return (
        <div className="bg-white rounded-[28px] border border-[#EEF0F4] shadow-sm mb-6 overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-[#EEF0F4]">
                <button
                    onClick={onBack}
                    className="w-8 h-8 flex items-center justify-center bg-[#F4F4F8] rounded-xl text-[#9AA2B1] active:scale-95 transition-transform flex-shrink-0"
                >
                    <ArrowLeft size={16} />
                </button>
                <div className="flex-1 min-w-0">
                    <p className="font-black text-[#1C1C1E] text-sm truncate">{ticket.description}</p>
                    <p className="text-[10px] text-[#9AA2B1] font-medium mt-0.5">
                        {new Date(ticket.created_at).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" })}
                    </p>
                </div>
                <span className={`text-[10px] font-black px-2.5 py-1 rounded-full flex-shrink-0 ${isClosed ? "bg-[#F4F4F8] text-[#9AA2B1]" : "bg-green-100 text-green-700"}`}>
                    {isClosed ? "Chiuso" : "Aperto"}
                </span>
            </div>

            {/* Messaggi */}
            <div className="flex flex-col gap-2 px-4 py-4 min-h-[120px] max-h-[340px] overflow-y-auto">
                {loading ? (
                    <p className="text-center text-[#9AA2B1] text-sm py-6">Caricamento...</p>
                ) : messages.length === 0 ? (
                    <p className="text-center text-[#9AA2B1] text-sm italic py-6">
                        Segnalazione inviata. Ti risponderemo al più presto!
                    </p>
                ) : (
                    messages.map((m) => (
                        <div key={m.id} className={`flex ${m.sender_type === "user" ? "justify-end" : "justify-start"}`}>
                            <div className={`max-w-[80%] flex flex-col gap-0.5 ${m.sender_type === "user" ? "items-end" : "items-start"}`}>
                                <span className="text-[10px] font-bold text-[#9AA2B1] px-1">
                                    {m.sender_type === "user" ? "Tu" : "Supporto Lurumi"}
                                </span>
                                <div className={`px-3 py-2 rounded-2xl text-sm font-medium leading-relaxed break-words min-w-0 ${m.sender_type === "user" ? "bg-[#7B5CF6] text-white rounded-br-sm" : "bg-[#F4F4F8] text-[#1C1C1E] rounded-bl-sm"}`}>
                                    {m.content}
                                </div>
                                <span className="text-[9px] text-[#C0C7D4] font-medium px-1">
                                    {new Date(m.created_at).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}
                                </span>
                            </div>
                        </div>
                    ))
                )}
                <div ref={bottomRef} />
            </div>

            {/* Input — solo se il ticket è aperto */}
            {!isClosed && (
                <div className="flex gap-2 px-4 py-3 border-t border-[#EEF0F4]">
                    <input
                        ref={inputRef}
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                        placeholder="Aggiungi un messaggio..."
                        className="flex-1 h-10 px-3 text-sm bg-[#FAFAFC] border border-[#EEF0F4] rounded-xl outline-none focus:border-[#7B5CF6] font-medium"
                    />
                    <button
                        onClick={handleSend}
                        disabled={!text.trim() || sending}
                        className="h-10 w-10 flex items-center justify-center bg-[#7B5CF6] text-white rounded-xl disabled:opacity-40 flex-shrink-0 active:scale-90 transition-transform"
                    >
                        <Send size={14} />
                    </button>
                </div>
            )}
            {isClosed && (
                <div className="px-5 py-3 border-t border-[#EEF0F4] bg-[#FAFAFC]">
                    <p className="text-xs text-[#9AA2B1] font-medium text-center">
                        Questo ticket è stato chiuso dal supporto.
                    </p>
                </div>
            )}
        </div>
    );
}

// ── Pagina principale ────────────────────────────────────────────────────────
export default function SupportPage() {
    const { user } = useAuth();
    const { projects, tutorials, addProject, addTutorial } = useProjectStore();
    const supabase = createClient();

    // ── Backup ──────────────────────────────────────────────
    const [backups, setBackups] = useState<BackupRow[]>([]);
    const [creatingBackup, setCreatingBackup] = useState(false);

    useEffect(() => {
        if (!user) return;
        supabase
            .from("backups")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .then(({ data }) => { if (data) setBackups(data as BackupRow[]); });
    }, [user?.id]);

    const handleCreateBackup = async () => {
        if (!user) return;
        setCreatingBackup(true);
        try {
            const state = { projects, tutorials, createdAt: Date.now() };
            const { data, error } = await supabase
                .from("backups")
                .insert({ user_id: user.id, name: `Backup ${new Date().toLocaleDateString("it-IT")}`, data_json: state })
                .select()
                .single();
            if (!error && data) setBackups((prev) => [data as BackupRow, ...prev]);
        } finally {
            setCreatingBackup(false);
        }
    };

    const handleRestore = (backup: BackupRow) => {
        const bProjects = backup.data_json?.projects ?? [];
        const bTutorials = backup.data_json?.tutorials ?? [];
        const localPIds = new Set(projects.map((p) => p.id));
        const localTIds = new Set(tutorials.map((t) => t.id));
        const addedP = bProjects.filter((p: any) => !localPIds.has(p.id));
        const addedT = bTutorials.filter((t: any) => !localTIds.has(t.id));
        addedP.forEach((p: any) => addProject(p));
        addedT.forEach((t: any) => addTutorial(t));
        alert(`Ripristino completato! Aggiunti ${addedP.length} progetti e ${addedT.length} tutorial.`);
    };

    const handleDeleteBackup = async (id: string) => {
        if (!user) return;
        await supabase.from("backups").delete().eq("id", id).eq("user_id", user.id);
        setBackups((prev) => prev.filter((b) => b.id !== id));
    };

    // ── Ticket di supporto ───────────────────────────────────
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);
    const [showNewForm, setShowNewForm] = useState(false);
    const [ticketsExpanded, setTicketsExpanded] = useState(false);

    const loadTickets = useCallback(async () => {
        if (!user) return;
        const { data } = await supabase
            .from("bug_reports")
            .select("id, description, status, created_at")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false });
        setTickets((data ?? []) as Ticket[]);
    }, [user?.id]);

    useEffect(() => { loadTickets(); }, [loadTickets]);

    // Realtime: aggiorna lo stato del ticket attivo (es. quando admin lo chiude)
    useEffect(() => {
        if (!user) return;
        const ch = supabase.channel("support-tickets-user")
            .on("postgres_changes", {
                event: "UPDATE",
                schema: "public",
                table: "bug_reports",
                filter: `user_id=eq.${user.id}`,
            }, () => loadTickets())
            .subscribe();
        return () => { supabase.removeChannel(ch); };
    }, [user?.id, loadTickets]);

    // Aggiorna il ticket attivo quando i ticket cambiano (es. lo stato cambia a "closed")
    useEffect(() => {
        if (activeTicket) {
            const updated = tickets.find((t) => t.id === activeTicket.id);
            if (updated && updated.status !== activeTicket.status) {
                setActiveTicket(updated);
            }
        }
    }, [tickets]);

    // ── Nuovo bug report ─────────────────────────────────────
    const [bugDescription, setBugDescription] = useState("");
    const [bugSteps, setBugSteps] = useState("");
    const [bugSending, setBugSending] = useState(false);

    const handleSendBugReport = async () => {
        if (!bugDescription.trim()) return;
        setBugSending(true);
        try {
            const id = await submitBugReport(
                user?.id ?? null,
                bugDescription,
                bugSteps || null,
                navigator.userAgent,
                user?.email ?? null,
            );
            setBugDescription("");
            setBugSteps("");
            setShowNewForm(false);
            await loadTickets();
            // Apri subito il thread del nuovo ticket
            if (id) {
                const newTicket: Ticket = {
                    id,
                    description: bugDescription,
                    status: "open",
                    created_at: new Date().toISOString(),
                };
                setActiveTicket(newTicket);
            }
        } catch (e) {
            console.warn("Bug report failed:", e);
        } finally {
            setBugSending(false);
        }
    };

    const openTickets = tickets.filter((t) => t.status === "open");
    const closedTickets = tickets.filter((t) => t.status === "closed");

    return (
        <div className="max-w-2xl mx-auto px-5 pt-6 pb-24">
            <Link href="/profilo" className="w-10 h-10 flex items-center justify-center bg-white border border-[#EEF0F4] rounded-xl text-[#9AA2B1] mb-6">
                <ArrowLeft size={20} />
            </Link>

            <h1 className="text-3xl font-black mb-8">Supporto</h1>

            <p className="text-[#9AA2B1] mb-8 font-medium">
                Siamo qui per aiutarti. Contattaci o invia una segnalazione — ti risponderemo direttamente qui.
            </p>

            {/* Email contact */}
            <div className="mb-6">
                <a
                    href="mailto:lurumi@marketizzati.it"
                    className="bg-white p-5 rounded-3xl border border-[#EEF0F4] shadow-sm flex items-center gap-4 active:scale-[0.98] transition-transform"
                >
                    <div className="w-12 h-12 bg-[#F4EEFF] rounded-2xl flex items-center justify-center text-[#7B5CF6]">
                        <Mail size={24} />
                    </div>
                    <div className="flex-1">
                        <h3 className="font-bold text-[#1C1C1E]">Email</h3>
                        <p className="text-xs text-[#9AA2B1]">lurumi@marketizzati.it — rispondiamo entro 24 ore</p>
                    </div>
                    <ExternalLink size={18} className="text-[#EEF0F4]" />
                </a>
            </div>

            {/* FAQ */}
            <h2 className="text-xl font-black mb-4">Domande Frequenti</h2>
            <div className="space-y-4 mb-10">
                {[
                    { q: "Perché i miei file non vengono salvati?", a: "I file vengono salvati localmente nel tuo browser. Se cancelli la cronologia o i dati del sito, i file potrebbero andare persi. Esegui il login per sincronizzarli." },
                    { q: "Come posso passare al piano Premium?", a: "Puoi gestire il tuo abbonamento dalla sezione Impostazioni nel tuo profilo." },
                ].map((item, i) => (
                    <div key={i} className="bg-[#FAF7FF] p-4 rounded-2xl border border-[#F4EEFF]">
                        <p className="font-bold text-sm text-[#7B5CF6] mb-1">{item.q}</p>
                        <p className="text-sm text-[#1C1C1E] leading-relaxed">{item.a}</p>
                    </div>
                ))}
            </div>

            {/* ── Sezione segnalazioni ── */}
            {activeTicket ? (
                /* Thread di conversazione */
                <TicketThread
                    ticket={activeTicket}
                    onBack={() => setActiveTicket(null)}
                    userId={user?.id ?? ""}
                />
            ) : showNewForm ? (
                /* Form nuovo ticket */
                <div className="bg-white rounded-[28px] border border-[#EEF0F4] p-6 shadow-sm mb-6">
                    <div className="flex items-center gap-2 mb-1">
                        <Bug size={18} className="text-[#9AA2B1]" />
                        <h2 className="text-lg font-black text-[#1C1C1E]">Nuova segnalazione</h2>
                        <button
                            onClick={() => setShowNewForm(false)}
                            className="ml-auto text-[#9AA2B1] text-xs font-bold hover:text-[#1C1C1E]"
                        >
                            Annulla
                        </button>
                    </div>
                    <p className="text-[#9AA2B1] text-xs font-medium mb-5">
                        Descrivici il problema e lo risolveremo il prima possibile.
                    </p>
                    <div className="space-y-3">
                        <textarea
                            value={bugDescription}
                            onChange={(e) => setBugDescription(e.target.value)}
                            placeholder="Descrivi il problema che hai riscontrato..."
                            className="w-full h-24 px-4 py-3 bg-[#FAFAFC] border border-[#EEF0F4] rounded-2xl text-sm text-[#1C1C1E] outline-none focus:border-[#7B5CF6] resize-none"
                        />
                        <textarea
                            value={bugSteps}
                            onChange={(e) => setBugSteps(e.target.value)}
                            placeholder="Passi per riprodurlo (opzionale)..."
                            className="w-full h-16 px-4 py-3 bg-[#FAFAFC] border border-[#EEF0F4] rounded-2xl text-sm text-[#1C1C1E] outline-none focus:border-[#7B5CF6] resize-none"
                        />
                        <button
                            onClick={handleSendBugReport}
                            disabled={!bugDescription.trim() || bugSending}
                            className="w-full py-3 bg-[#1C1C1E] text-white rounded-2xl font-bold text-sm active:scale-95 transition-transform disabled:opacity-40"
                        >
                            {bugSending ? "Invio in corso..." : "Invia Segnalazione"}
                        </button>
                    </div>
                </div>
            ) : (
                /* Lista ticket + pulsante nuovo */
                <div className="bg-white rounded-[28px] border border-[#EEF0F4] p-6 shadow-sm mb-6">
                    <div className="flex items-center gap-2 mb-1">
                        <Bug size={18} className="text-[#9AA2B1]" />
                        <h2 className="text-lg font-black text-[#1C1C1E]">Le tue segnalazioni</h2>
                        <button
                            onClick={() => setShowNewForm(true)}
                            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-[#7B5CF6] text-white rounded-xl font-bold text-xs active:scale-95 transition-transform"
                        >
                            + Nuova
                        </button>
                    </div>
                    <p className="text-[#9AA2B1] text-xs font-medium mb-5">
                        Hai trovato un problema? Invialo — ti risponderemo qui in tempo reale.
                    </p>

                    {tickets.length === 0 ? (
                        <button
                            onClick={() => setShowNewForm(true)}
                            className="w-full py-4 border-2 border-dashed border-[#EEF0F4] rounded-2xl text-[#9AA2B1] text-sm font-bold hover:border-[#7B5CF6] hover:text-[#7B5CF6] transition-colors"
                        >
                            Nessuna segnalazione — clicca per crearne una
                        </button>
                    ) : (
                        <div className="space-y-2">
                            {/* Ticket aperti */}
                            {openTickets.map((t) => (
                                <button
                                    key={t.id}
                                    onClick={() => setActiveTicket(t)}
                                    className="w-full flex items-center gap-3 p-3.5 bg-[#FAFAFC] rounded-xl border border-[#EEF0F4] text-left hover:border-[#7B5CF6] transition-colors active:scale-[0.98]"
                                >
                                    <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0 mt-0.5" />
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-[#1C1C1E] text-sm truncate">{t.description}</p>
                                        <p className="text-[#9AA2B1] text-xs font-medium mt-0.5">
                                            {new Date(t.created_at).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" })}
                                        </p>
                                    </div>
                                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-green-100 text-green-700 flex-shrink-0">Aperto</span>
                                </button>
                            ))}

                            {/* Ticket chiusi (collassabili) */}
                            {closedTickets.length > 0 && (
                                <>
                                    <button
                                        onClick={() => setTicketsExpanded(!ticketsExpanded)}
                                        className="w-full flex items-center justify-between px-3 py-2 text-[#9AA2B1] text-xs font-bold"
                                    >
                                        <span>{closedTickets.length} ticket chiusi</span>
                                        {ticketsExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                    </button>
                                    {ticketsExpanded && closedTickets.map((t) => (
                                        <button
                                            key={t.id}
                                            onClick={() => setActiveTicket(t)}
                                            className="w-full flex items-center gap-3 p-3.5 bg-[#FAFAFC] rounded-xl border border-[#EEF0F4] text-left hover:border-[#D9B9F9] transition-colors active:scale-[0.98]"
                                        >
                                            <div className="w-2 h-2 rounded-full bg-[#C0C7D4] flex-shrink-0 mt-0.5" />
                                            <div className="flex-1 min-w-0">
                                                <p className="font-bold text-[#9AA2B1] text-sm truncate">{t.description}</p>
                                                <p className="text-[#9AA2B1] text-xs font-medium mt-0.5">
                                                    {new Date(t.created_at).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" })}
                                                </p>
                                            </div>
                                            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-[#F4F4F8] text-[#9AA2B1] flex-shrink-0">Chiuso</span>
                                        </button>
                                    ))}
                                </>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* ── Backup & Ripristino ── */}
            {user && (
                <div className="bg-white rounded-[28px] border border-[#EEF0F4] p-6 shadow-sm mb-6">
                    <div className="flex items-start justify-between mb-5">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <Archive size={18} className="text-[#7B5CF6]" />
                                <h2 className="text-lg font-black text-[#1C1C1E]">Backup & Ripristino</h2>
                            </div>
                            <p className="text-[#9AA2B1] text-xs font-medium">
                                {projects.length} progetti · {tutorials.length} tutorial salvati in locale
                            </p>
                        </div>
                        <button
                            onClick={handleCreateBackup}
                            disabled={creatingBackup}
                            className="px-4 py-2.5 bg-[#7B5CF6] text-white rounded-xl font-bold text-sm active:scale-95 transition-transform disabled:opacity-50 flex-shrink-0"
                        >
                            {creatingBackup ? "Salvo..." : "Crea Backup"}
                        </button>
                    </div>

                    {backups.length > 0 ? (
                        <div className="space-y-2.5">
                            {backups.map((b) => (
                                <div
                                    key={b.id}
                                    className="flex items-center justify-between bg-[#FAFAFC] rounded-xl p-3.5 border border-[#EEF0F4]"
                                >
                                    <div className="min-w-0 flex-1">
                                        <p className="font-bold text-[#1C1C1E] text-sm truncate">{b.name}</p>
                                        <p className="text-[#9AA2B1] text-xs mt-0.5">
                                            {b.data_json?.projects?.length ?? 0} progetti ·{" "}
                                            {b.data_json?.tutorials?.length ?? 0} tutorial ·{" "}
                                            {new Date(b.created_at).toLocaleDateString("it-IT", {
                                                day: "2-digit", month: "short", year: "numeric",
                                            })}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                                        <button
                                            onClick={() => handleRestore(b)}
                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#EEF0F4] rounded-lg font-bold text-xs text-[#7B5CF6] active:scale-95 transition-transform"
                                        >
                                            <RotateCcw size={12} />
                                            Ripristina
                                        </button>
                                        <button
                                            onClick={() => handleDeleteBackup(b.id)}
                                            className="w-7 h-7 flex items-center justify-center text-[#C0C7D4] hover:text-red-500 transition-colors"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-[#9AA2B1] text-sm italic text-center py-4">
                            Nessun backup creato. Usa "Crea Backup" per salvare i tuoi dati sul cloud.
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}
