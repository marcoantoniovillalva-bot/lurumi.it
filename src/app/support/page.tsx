"use client";

import React, { useState, useEffect } from "react";
import { ArrowLeft, MessageCircle, Mail, ExternalLink, Archive, RotateCcw, Bug, CheckCircle, Trash2 } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { submitBugReport } from "@/app/actions/bugReport";
import { useProjectStore } from "@/features/projects/store/useProjectStore";

interface BackupRow {
    id: string;
    name: string;
    data_json: { projects: any[]; tutorials: any[]; createdAt: number };
    created_at: string;
}

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

    // ── Bug Report ───────────────────────────────────────────
    const [bugDescription, setBugDescription] = useState("");
    const [bugSteps, setBugSteps] = useState("");
    const [bugSending, setBugSending] = useState(false);
    const [bugSent, setBugSent] = useState(false);

    const handleSendBugReport = async () => {
        if (!bugDescription.trim()) return;
        setBugSending(true);
        try {
            await submitBugReport(
                user?.id ?? null,
                bugDescription,
                bugSteps || null,
                navigator.userAgent,
            );
            setBugSent(true);
            setBugDescription("");
            setBugSteps("");
        } catch (e) {
            console.warn("Bug report failed:", e);
        } finally {
            setBugSending(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto px-5 pt-6 pb-24">
            <Link href="/tools" className="w-10 h-10 flex items-center justify-center bg-white border border-[#EEF0F4] rounded-xl text-[#9AA2B1] mb-6">
                <ArrowLeft size={20} />
            </Link>

            <h1 className="text-3xl font-black mb-8">Supporto</h1>

            <p className="text-[#9AA2B1] mb-8 font-medium">
                Siamo qui per aiutarti. Scegli il metodo che preferisci per contattarci o risolvere i tuoi dubbi.
            </p>

            <div className="grid gap-4 mb-10">
                <a href="mailto:support@lurumi.app" className="bg-white p-5 rounded-3xl border border-[#EEF0F4] shadow-sm flex items-center gap-4 active:scale-[0.98] transition-transform">
                    <div className="w-12 h-12 bg-[#F4EEFF] rounded-2xl flex items-center justify-center text-[#7B5CF6]">
                        <Mail size={24} />
                    </div>
                    <div className="flex-1">
                        <h3 className="font-bold text-[#1C1C1E]">Email</h3>
                        <p className="text-xs text-[#9AA2B1]">Rispondiamo entro 24 ore</p>
                    </div>
                    <ExternalLink size={18} className="text-[#EEF0F4]" />
                </a>

                <div className="bg-white p-5 rounded-3xl border border-[#EEF0F4] shadow-sm flex items-center gap-4 active:scale-[0.98] transition-transform">
                    <div className="w-12 h-12 bg-[#F4EEFF] rounded-2xl flex items-center justify-center text-[#7B5CF6]">
                        <MessageCircle size={24} />
                    </div>
                    <div className="flex-1">
                        <h3 className="font-bold text-[#1C1C1E]">Chat Live</h3>
                        <p className="text-xs text-[#9AA2B1]">Disponibile per utenti Premium</p>
                    </div>
                    <span className="px-2.5 py-1 bg-[#D9B9F9] text-white text-[10px] font-black rounded-full uppercase">PRO</span>
                </div>
            </div>

            <h2 className="text-xl font-black mb-4">Domande Frequenti</h2>
            <div className="space-y-4 mb-10">
                {[
                    { q: "Perché i miei file non vengono salvati?", a: "I file vengono salvati localmente nel tuo browser. Se cancelli la cronologia o i dati del sito, i file potrebbero andare persi. Esegui il login per sincronizzarli." },
                    { q: "Come posso passare al piano Premium?", a: "Puoi gestire il tuo abbonamento dalla sezione Impostazioni nel tuo profilo." }
                ].map((item, i) => (
                    <div key={i} className="bg-[#FAF7FF] p-4 rounded-2xl border border-[#F4EEFF]">
                        <p className="font-bold text-sm text-[#7B5CF6] mb-1">{item.q}</p>
                        <p className="text-sm text-[#1C1C1E] leading-relaxed">{item.a}</p>
                    </div>
                ))}
            </div>

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

            {/* ── Segnalazione Bug ── */}
            <div className="bg-white rounded-[28px] border border-[#EEF0F4] p-6 shadow-sm mb-10">
                <div className="flex items-center gap-2 mb-1">
                    <Bug size={18} className="text-[#9AA2B1]" />
                    <h2 className="text-lg font-black text-[#1C1C1E]">Hai trovato un problema?</h2>
                </div>
                <p className="text-[#9AA2B1] text-xs font-medium mb-5">
                    Descrivici il problema e lo risolveremo il prima possibile.
                </p>

                {bugSent ? (
                    <div className="bg-green-50 border border-green-100 text-green-700 font-bold text-sm p-4 rounded-2xl text-center flex items-center justify-center gap-2">
                        <CheckCircle size={16} />
                        Segnalazione inviata! Grazie per il feedback.
                    </div>
                ) : (
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
                )}
            </div>
        </div>
    );
}
