"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
    ArrowLeft, Plus, Trash2, CheckCircle2, XCircle,
    AlertTriangle, Save, ChevronDown, ChevronUp, GripVertical, Loader2,
} from "lucide-react";
import { validatePart, validateSyntax, type Round } from "@/lib/pattern-math";

// ─── Tipi locali ─────────────────────────────────────────────────────────────

interface RoundInput {
    id: string;
    round: string;          // numero o range es. "1", "8-11"
    instruction: string;
    stitch_count: string;   // stringa per gestire input vuoto
    modifier?: string;
    note?: string;
}

interface PartInput {
    id: string;
    name: string;
    color: string;
    start_type: 'magic_ring' | 'chain';
    chain_count: string;
    rounds: RoundInput[];
    collapsed: boolean;
}

interface SchemaForm {
    title: string;
    difficulty: 'beginner' | 'intermediate' | 'advanced';
    category: string;
    yarn_weight: string;
    hook_size: string;
    finished_size_cm: string;
    admin_notes: string;
}

// ─── Helper: ID univoco ───────────────────────────────────────────────────────

function uid() { return Math.random().toString(36).slice(2, 9); }

// ─── Colori badge ─────────────────────────────────────────────────────────────

function ValidationBadge({ ok, error }: { ok: boolean; error?: string }) {
    if (ok) return (
        <span className="flex items-center gap-1 text-green-600 text-xs font-bold whitespace-nowrap">
            <CheckCircle2 size={14} /> OK
        </span>
    );
    return (
        <span className="flex items-center gap-1 text-red-500 text-xs font-bold" title={error}>
            <XCircle size={14} /> ERRORE
        </span>
    );
}

// ─── Componente principale ────────────────────────────────────────────────────

export function SchemaCreatorClient() {
    const router = useRouter();

    const [form, setForm] = useState<SchemaForm>({
        title: '',
        difficulty: 'beginner',
        category: '',
        yarn_weight: 'fingering',
        hook_size: '2.5mm',
        finished_size_cm: '',
        admin_notes: '',
    });

    const [parts, setParts] = useState<PartInput[]>([]);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [saved, setSaved] = useState(false);

    // ── Validazione live ────────────────────────────────────────────────────
    const validationResults = useMemo(() => {
        return parts.map(part => {
            const rounds: Round[] = part.rounds
                .filter(r => r.instruction.trim() && r.stitch_count.trim())
                .map(r => ({
                    round: r.round || '?',
                    instruction: r.instruction,
                    stitch_count: parseInt(r.stitch_count) || 0,
                    modifier: r.modifier,
                    note: r.note,
                }));
            return validatePart(rounds);
        });
    }, [parts]);

    const totalErrors = validationResults.reduce((s, r) => s + r.totalErrors, 0);
    const hasEnoughData = form.title.trim().length > 0 && parts.length > 0 &&
        parts.every(p => p.rounds.length > 0 && p.rounds.every(r => r.instruction.trim() && r.stitch_count.trim()));
    const canSave = hasEnoughData;

    // ── Part handlers ───────────────────────────────────────────────────────
    const addPart = () => {
        setParts(prev => [...prev, {
            id: uid(), name: '', color: '', start_type: 'magic_ring',
            chain_count: '10', rounds: [], collapsed: false,
        }]);
    };

    const removePart = (pid: string) => {
        setParts(prev => prev.filter(p => p.id !== pid));
    };

    const updatePart = (pid: string, changes: Partial<PartInput>) => {
        setParts(prev => prev.map(p => p.id === pid ? { ...p, ...changes } : p));
    };

    const toggleCollapse = (pid: string) => {
        setParts(prev => prev.map(p => p.id === pid ? { ...p, collapsed: !p.collapsed } : p));
    };

    // ── Round handlers ──────────────────────────────────────────────────────
    const addRound = (pid: string) => {
        setParts(prev => prev.map(p => {
            if (p.id !== pid) return p;
            const lastRound = p.rounds[p.rounds.length - 1];
            const nextNum = lastRound
                ? (parseInt(String(lastRound.round).split('-').pop() || '0') + 1).toString()
                : '1';
            return {
                ...p,
                rounds: [...p.rounds, {
                    id: uid(), round: nextNum, instruction: '', stitch_count: '', modifier: '', note: '',
                }],
            };
        }));
    };

    const removeRound = (pid: string, rid: string) => {
        setParts(prev => prev.map(p =>
            p.id === pid ? { ...p, rounds: p.rounds.filter(r => r.id !== rid) } : p
        ));
    };

    const updateRound = (pid: string, rid: string, changes: Partial<RoundInput>) => {
        setParts(prev => prev.map(p =>
            p.id === pid
                ? { ...p, rounds: p.rounds.map(r => r.id === rid ? { ...r, ...changes } : r) }
                : p
        ));
    };

    const moveRound = (pid: string, fromIdx: number, toIdx: number) => {
        setParts(prev => prev.map(p => {
            if (p.id !== pid) return p;
            const rounds = [...p.rounds];
            const [moved] = rounds.splice(fromIdx, 1);
            rounds.splice(toIdx, 0, moved);
            return { ...p, rounds };
        }));
    };

    // ── Salva ────────────────────────────────────────────────────────────────
    const handleSave = async () => {
        if (!canSave) return;
        if (totalErrors > 0) {
            const ok = confirm(`Lo schema ha ${totalErrors} errore${totalErrors !== 1 ? 'i' : ''} di validazione matematica. Salvare comunque come ground truth?`);
            if (!ok) return;
        }
        setSaving(true);
        setSaveError(null);

        const payload = {
            ...form,
            parts: parts.map(p => ({
                name: p.name,
                color: p.color,
                start_type: p.start_type,
                ...(p.start_type === 'chain' ? { chain_count: parseInt(p.chain_count) || 10 } : {}),
                rounds: p.rounds.map(r => ({
                    round: r.round.includes('-') ? r.round : parseInt(r.round),
                    instruction: r.instruction.trim(),
                    stitch_count: parseInt(r.stitch_count),
                    ...(r.modifier ? { modifier: r.modifier } : {}),
                    ...(r.note ? { note: r.note } : {}),
                })),
            })),
        };

        try {
            const res = await fetch('/api/training/save-pattern', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error || 'Errore salvataggio');
            setSaved(true);
            setTimeout(() => router.push('/admin'), 1500);
        } catch (e: any) {
            setSaveError(e.message);
        } finally {
            setSaving(false);
        }
    };

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-[#F7F7FA] pb-20">
            {/* Header */}
            <div className="bg-white border-b border-[#EEF0F4] sticky top-0 z-40">
                <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
                    <button
                        onClick={() => router.push('/admin')}
                        className="w-9 h-9 flex items-center justify-center bg-[#FAFAFC] border border-[#EEF0F4] rounded-xl text-[#9AA2B1]"
                    >
                        <ArrowLeft size={18} />
                    </button>
                    <div className="text-center">
                        <p className="text-xs text-[#9AA2B1] font-bold uppercase tracking-widest">AI Training</p>
                        <p className="text-base font-black text-[#1C1C1E]">Schema Creator</p>
                    </div>
                    <button
                        onClick={handleSave}
                        disabled={!canSave || saving || saved}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all ${
                            saved ? 'bg-green-500 text-white'
                            : canSave && totalErrors > 0 ? 'bg-orange-500 text-white active:scale-95'
                            : canSave ? 'bg-[#7B5CF6] text-white active:scale-95'
                            : 'bg-[#EEF0F4] text-[#9AA2B1] cursor-not-allowed'
                        }`}
                    >
                        {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                        {saved ? 'Salvato!' : 'Salva'}
                    </button>
                </div>
            </div>

            <div className="max-w-3xl mx-auto px-4 pt-6 space-y-6">

                {/* Validation summary */}
                {parts.length > 0 && (
                    <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl border text-sm font-bold ${
                        totalErrors === 0
                            ? 'bg-green-50 border-green-200 text-green-700'
                            : 'bg-red-50 border-red-200 text-red-600'
                    }`}>
                        {totalErrors === 0
                            ? <><CheckCircle2 size={18} /> Schema matematicamente valido — pronto per il salvataggio</>
                            : <><XCircle size={18} /> {totalErrors} errore{totalErrors !== 1 ? 'i' : ''} — correggi prima di salvare</>
                        }
                    </div>
                )}

                {saveError && (
                    <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-2xl text-red-600 text-sm font-bold">
                        <AlertTriangle size={16} /> {saveError}
                    </div>
                )}

                {/* ── Metadati ── */}
                <div className="bg-white rounded-[24px] border border-[#EEF0F4] shadow-sm p-6">
                    <h2 className="text-base font-black text-[#1C1C1E] mb-4 uppercase tracking-widest text-xs text-[#7B5CF6]">Metadati Schema</h2>

                    <div className="space-y-3">
                        <div>
                            <label className="text-xs font-black text-[#9AA2B1] uppercase tracking-wider block mb-1">Titolo *</label>
                            <input
                                value={form.title}
                                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                                placeholder="es. Sfera standard 5cm, Testa Luly..."
                                className="w-full h-11 px-4 bg-[#FAFAFC] border border-[#EEF0F4] rounded-xl outline-none focus:border-[#7B5CF6] font-medium text-sm"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs font-black text-[#9AA2B1] uppercase tracking-wider block mb-1">Difficoltà</label>
                                <select
                                    value={form.difficulty}
                                    onChange={e => setForm(f => ({ ...f, difficulty: e.target.value as any }))}
                                    className="w-full h-11 px-3 bg-[#FAFAFC] border border-[#EEF0F4] rounded-xl outline-none focus:border-[#7B5CF6] font-medium text-sm"
                                >
                                    <option value="beginner">Beginner</option>
                                    <option value="intermediate">Intermediate</option>
                                    <option value="advanced">Advanced</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-black text-[#9AA2B1] uppercase tracking-wider block mb-1">Categoria</label>
                                <input
                                    value={form.category}
                                    onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                                    placeholder="es. character_part, accessory..."
                                    className="w-full h-11 px-4 bg-[#FAFAFC] border border-[#EEF0F4] rounded-xl outline-none focus:border-[#7B5CF6] font-medium text-sm"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                            <div>
                                <label className="text-xs font-black text-[#9AA2B1] uppercase tracking-wider block mb-1">Filato</label>
                                <input
                                    value={form.yarn_weight}
                                    onChange={e => setForm(f => ({ ...f, yarn_weight: e.target.value }))}
                                    placeholder="fingering, DK..."
                                    className="w-full h-11 px-4 bg-[#FAFAFC] border border-[#EEF0F4] rounded-xl outline-none focus:border-[#7B5CF6] font-medium text-sm"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-black text-[#9AA2B1] uppercase tracking-wider block mb-1">Uncinetto</label>
                                <input
                                    value={form.hook_size}
                                    onChange={e => setForm(f => ({ ...f, hook_size: e.target.value }))}
                                    placeholder="2.5mm..."
                                    className="w-full h-11 px-4 bg-[#FAFAFC] border border-[#EEF0F4] rounded-xl outline-none focus:border-[#7B5CF6] font-medium text-sm"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-black text-[#9AA2B1] uppercase tracking-wider block mb-1">Misura finale</label>
                                <input
                                    value={form.finished_size_cm}
                                    onChange={e => setForm(f => ({ ...f, finished_size_cm: e.target.value }))}
                                    placeholder="es. 5cm diametro"
                                    className="w-full h-11 px-4 bg-[#FAFAFC] border border-[#EEF0F4] rounded-xl outline-none focus:border-[#7B5CF6] font-medium text-sm"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-black text-[#9AA2B1] uppercase tracking-wider block mb-1">Note admin</label>
                            <textarea
                                value={form.admin_notes}
                                onChange={e => setForm(f => ({ ...f, admin_notes: e.target.value }))}
                                placeholder="Fonte, note tecniche, avvertenze..."
                                rows={2}
                                className="w-full px-4 py-3 bg-[#FAFAFC] border border-[#EEF0F4] rounded-xl outline-none focus:border-[#7B5CF6] font-medium text-sm resize-none"
                            />
                        </div>
                    </div>
                </div>

                {/* ── Parti ── */}
                {parts.map((part, partIdx) => {
                    const validation = validationResults[partIdx];
                    return (
                        <div key={part.id} className="bg-white rounded-[24px] border border-[#EEF0F4] shadow-sm overflow-hidden">
                            {/* Part header */}
                            <div className="px-6 py-4 border-b border-[#EEF0F4] flex items-center gap-3">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="text-[10px] font-black text-[#7B5CF6] uppercase tracking-widest">Parte {partIdx + 1}</span>
                                        {validation && (
                                            validation.valid
                                                ? <span className="flex items-center gap-1 text-green-600 text-[10px] font-black"><CheckCircle2 size={12} /> Valida</span>
                                                : <span className="flex items-center gap-1 text-red-500 text-[10px] font-black"><XCircle size={12} /> {validation.totalErrors} errori</span>
                                        )}
                                    </div>
                                    <div className="flex gap-2">
                                        <input
                                            value={part.name}
                                            onChange={e => updatePart(part.id, { name: e.target.value })}
                                            placeholder="Nome parte (es. Testa, Braccio...)"
                                            className="flex-1 h-9 px-3 bg-[#FAFAFC] border border-[#EEF0F4] rounded-xl outline-none focus:border-[#7B5CF6] font-medium text-sm"
                                        />
                                        <input
                                            value={part.color}
                                            onChange={e => updatePart(part.id, { color: e.target.value })}
                                            placeholder="Colore"
                                            className="w-28 h-9 px-3 bg-[#FAFAFC] border border-[#EEF0F4] rounded-xl outline-none focus:border-[#7B5CF6] font-medium text-sm"
                                        />
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <button
                                        onClick={() => toggleCollapse(part.id)}
                                        className="w-8 h-8 flex items-center justify-center bg-[#FAFAFC] border border-[#EEF0F4] rounded-lg text-[#9AA2B1]"
                                    >
                                        {part.collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                                    </button>
                                    <button
                                        onClick={() => removePart(part.id)}
                                        className="w-8 h-8 flex items-center justify-center bg-red-50 rounded-lg text-red-400"
                                    >
                                        <Trash2 size={15} />
                                    </button>
                                </div>
                            </div>

                            {!part.collapsed && (
                                <div className="px-6 py-4">
                                    {/* Start type */}
                                    <div className="flex items-center gap-2 mb-4">
                                        <span className="text-xs font-black text-[#9AA2B1] uppercase tracking-wider">Avviamento:</span>
                                        <button
                                            onClick={() => updatePart(part.id, { start_type: 'magic_ring' })}
                                            className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${part.start_type === 'magic_ring' ? 'bg-[#7B5CF6] text-white' : 'bg-[#FAFAFC] border border-[#EEF0F4] text-[#9AA2B1]'}`}
                                        >
                                            Anello Magico
                                        </button>
                                        <button
                                            onClick={() => updatePart(part.id, { start_type: 'chain' })}
                                            className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${part.start_type === 'chain' ? 'bg-[#7B5CF6] text-white' : 'bg-[#FAFAFC] border border-[#EEF0F4] text-[#9AA2B1]'}`}
                                        >
                                            Catenelle
                                        </button>
                                        {part.start_type === 'chain' && (
                                            <input
                                                type="number"
                                                value={part.chain_count}
                                                onChange={e => updatePart(part.id, { chain_count: e.target.value })}
                                                className="w-16 h-7 px-2 bg-[#FAFAFC] border border-[#EEF0F4] rounded-lg text-xs font-bold outline-none focus:border-[#7B5CF6] text-center"
                                                placeholder="N"
                                                min={1}
                                            />
                                        )}
                                    </div>

                                    {/* Rounds table */}
                                    {part.rounds.length > 0 && (
                                        <div className="mb-3">
                                            {/* Intestazione */}
                                            <div className="grid grid-cols-[48px_1fr_80px_70px_32px] gap-2 mb-1 px-1">
                                                <span className="text-[10px] font-black text-[#9AA2B1] uppercase">Giro</span>
                                                <span className="text-[10px] font-black text-[#9AA2B1] uppercase">Istruzione</span>
                                                <span className="text-[10px] font-black text-[#9AA2B1] uppercase text-center">Maglie</span>
                                                <span className="text-[10px] font-black text-[#9AA2B1] uppercase text-center">Check</span>
                                                <span />
                                            </div>

                                            {part.rounds.map((round, roundIdx) => {
                                                // trova il risultato di validazione per questo giro
                                                const roundResult = validation?.rounds.find(r => {
                                                    const rNum = parseInt(String(round.round).split('-')[0]);
                                                    return r.round === rNum || r.round === round.round;
                                                });
                                                const isValid = !round.instruction.trim() || !round.stitch_count.trim()
                                                    ? null
                                                    : roundResult?.ok ?? true;

                                                const syntaxResult = round.instruction.trim() ? validateSyntax(round.instruction) : null;
                                                const hasSyntaxError = syntaxResult && !syntaxResult.ok;

                                                return (
                                                    <div key={round.id} className="mb-1.5">
                                                        <div
                                                            className={`grid grid-cols-[48px_1fr_80px_70px_32px] gap-2 items-center px-1 py-1 rounded-xl transition-colors ${
                                                                isValid === false ? 'bg-red-50' : hasSyntaxError ? 'bg-orange-50' : isValid === true ? 'bg-green-50/50' : ''
                                                            }`}
                                                        >
                                                            {/* Numero giro */}
                                                            <input
                                                                value={round.round}
                                                                onChange={e => updateRound(part.id, round.id, { round: e.target.value })}
                                                                className="h-8 px-2 bg-white border border-[#EEF0F4] rounded-lg text-xs font-black text-center outline-none focus:border-[#7B5CF6]"
                                                                placeholder="1"
                                                            />
                                                            {/* Istruzione */}
                                                            <input
                                                                value={round.instruction}
                                                                onChange={e => updateRound(part.id, round.id, { instruction: e.target.value })}
                                                                className={`h-8 px-3 bg-white border rounded-lg text-xs font-medium outline-none ${hasSyntaxError ? 'border-orange-300 focus:border-orange-400' : 'border-[#EEF0F4] focus:border-[#7B5CF6]'}`}
                                                                placeholder="es. (1pb, aum) ×6"
                                                            />
                                                            {/* Conteggio dichiarato */}
                                                            <input
                                                                type="number"
                                                                value={round.stitch_count}
                                                                onChange={e => updateRound(part.id, round.id, { stitch_count: e.target.value })}
                                                                className="h-8 px-2 bg-white border border-[#EEF0F4] rounded-lg text-xs font-black text-center outline-none focus:border-[#7B5CF6]"
                                                                placeholder="[N]"
                                                                min={0}
                                                            />
                                                            {/* Badge validazione */}
                                                            <div className="flex justify-center">
                                                                {isValid === null ? (
                                                                    <span className="text-[#9AA2B1] text-xs">—</span>
                                                                ) : hasSyntaxError ? (
                                                                    <span className="text-orange-400 text-xs font-black" title={syntaxResult.errors.join('; ')}>⚠</span>
                                                                ) : (
                                                                    <ValidationBadge
                                                                        ok={isValid}
                                                                        error={roundResult?.errors.join('; ')}
                                                                    />
                                                                )}
                                                            </div>
                                                            {/* Elimina */}
                                                            <button
                                                                onClick={() => removeRound(part.id, round.id)}
                                                                className="w-7 h-7 flex items-center justify-center bg-white border border-[#EEF0F4] rounded-lg text-[#9AA2B1] hover:text-red-400 hover:border-red-200 transition-colors"
                                                            >
                                                                <Trash2 size={12} />
                                                            </button>
                                                        </div>
                                                        {/* Suggerimento sintassi con pulsante correggi automaticamente */}
                                                        {hasSyntaxError && syntaxResult.suggestion && (
                                                            <div className="mx-1 mt-1 flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-lg px-3 py-1.5">
                                                                <span className="text-xs text-orange-700 flex-1 min-w-0">
                                                                    <span className="font-black">Sintassi: </span>{syntaxResult.errors[0]}
                                                                    <span className="font-mono ml-1 text-orange-600">→ {syntaxResult.suggestion}</span>
                                                                </span>
                                                                <button
                                                                    onClick={() => updateRound(part.id, round.id, { instruction: syntaxResult.suggestion! })}
                                                                    className="shrink-0 text-xs font-black text-orange-600 bg-orange-100 hover:bg-orange-200 px-2 py-0.5 rounded-lg transition-colors"
                                                                >
                                                                    Correggi
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}

                                            {/* Errori dettagliati */}
                                            {validation && !validation.valid && (
                                                <div className="mt-2 space-y-1">
                                                    {validation.rounds.filter(r => !r.ok).map((r, i) => (
                                                        <div key={i} className="flex items-start gap-2 px-3 py-2 bg-red-50 rounded-xl text-xs text-red-600">
                                                            <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                                                            <span><strong>G{r.round}:</strong> {r.errors.join('; ')}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    <button
                                        onClick={() => addRound(part.id)}
                                        className="w-full h-9 flex items-center justify-center gap-2 bg-[#F4EEFF] text-[#7B5CF6] rounded-xl font-bold text-xs hover:bg-[#EDE6FF] transition-colors"
                                    >
                                        <Plus size={14} strokeWidth={3} /> Aggiungi giro
                                    </button>
                                </div>
                            )}
                        </div>
                    );
                })}

                {/* Aggiungi parte */}
                <button
                    onClick={addPart}
                    className="w-full h-12 flex items-center justify-center gap-2 bg-white border-2 border-dashed border-[#7B5CF6]/30 text-[#7B5CF6] rounded-[20px] font-bold text-sm hover:border-[#7B5CF6] hover:bg-[#F4EEFF]/50 transition-colors"
                >
                    <Plus size={18} strokeWidth={3} /> Aggiungi parte
                </button>

                {/* Salva (bottom) */}
                {parts.length > 0 && (
                    <div className="sticky bottom-4">
                        <button
                            onClick={handleSave}
                            disabled={!canSave || saving || saved}
                            className={`w-full h-14 flex items-center justify-center gap-3 rounded-[20px] font-black text-base shadow-xl transition-all ${
                                saved ? 'bg-green-500 text-white'
                                : canSave && totalErrors > 0 ? 'bg-orange-500 text-white active:scale-[0.98]'
                                : canSave ? 'bg-[#7B5CF6] text-white active:scale-[0.98]'
                                : 'bg-[#EEF0F4] text-[#9AA2B1] cursor-not-allowed'
                            }`}
                        >
                            {saving ? (
                                <><Loader2 size={20} className="animate-spin" /> Salvataggio in corso...</>
                            ) : saved ? (
                                <><CheckCircle2 size={20} /> Salvato come ground truth!</>
                            ) : totalErrors > 0 ? (
                                <><AlertTriangle size={20} /> {totalErrors} errore{totalErrors !== 1 ? 'i' : ''} — Salva comunque</>
                            ) : !hasEnoughData ? (
                                <><AlertTriangle size={20} /> Completa tutti i campi obbligatori</>
                            ) : (
                                <><Save size={20} /> Salva come Ground Truth</>
                            )}
                        </button>
                    </div>
                )}

            </div>
        </div>
    );
}
