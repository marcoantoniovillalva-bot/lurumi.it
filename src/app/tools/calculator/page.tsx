"use client";

import React, { useState } from "react";
import { ArrowLeft, Calculator as CalcIcon, RefreshCw, ChevronRight } from "lucide-react";
import Link from "next/link";

export default function CalculatorPage() {
    const [currentStitches, setCurrentStitches] = useState<string>("");
    const [targetStitches, setTargetStitches] = useState<string>("");
    const [result, setResult] = useState<{ instruction: string; steps: string[] } | null>(null);

    const calculate = () => {
        const current = parseInt(currentStitches);
        const target = parseInt(targetStitches);

        if (isNaN(current) || isNaN(target) || current <= 0 || target <= 0) {
            alert("Inserisci numeri validi maggiori di zero.");
            return;
        }

        if (current === target) {
            setResult({ instruction: "Nessun cambiamento necessario.", steps: ["Lavora un punto in ogni punto del giro precedente."] });
            return;
        }

        if (target > current) {
            // Increase Logic
            const diff = target - current;
            const groupSize = Math.floor(current / diff);
            const remainder = current % diff;
            const scBetween = groupSize - 1;

            let steps = [];
            if (remainder === 0) {
                steps.push(`(Lavora ${scBetween} MB, 1 Aumento) per ${diff} volte.`);
            } else {
                steps.push(`(Lavora ${scBetween} MB, 1 Aumento) per ${diff - remainder} volte.`);
                steps.push(`(Lavora ${scBetween + 1} MB, 1 Aumento) per ${remainder} volte.`);
            }
            setResult({ instruction: `Aumenta da ${current} a ${target} punti`, steps });
        } else {
            // Decrease Logic
            const diff = current - target;
            const groupSize = Math.floor(current / diff);
            const remainder = current % diff;
            const scBetween = groupSize - 2;

            let steps = [];
            if (remainder === 0) {
                steps.push(`(Lavora ${scBetween >= 0 ? scBetween : 0} MB, 1 Diminuzione) per ${diff} volte.`);
            } else {
                steps.push(`(Lavora ${scBetween >= 0 ? scBetween : 0} MB, 1 Diminuzione) per ${diff - remainder} volte.`);
                steps.push(`(Lavora ${(scBetween >= 0 ? scBetween : 0) + 1} MB, 1 Diminuzione) per ${remainder} volte.`);
            }
            setResult({ instruction: `Diminuisci da ${current} a ${target} punti`, steps });
        }
    };

    return (
        <div className="max-w-2xl mx-auto px-4 pt-6 pb-20 bg-[#FAFAFC] min-h-screen">
            <div className="mb-6">
                <Link href="/tools" className="inline-flex items-center gap-2 text-[#9AA2B1] font-bold text-sm hover:text-[#7B5CF6] transition-colors">
                    <ArrowLeft size={18} />
                    Torna agli Utensili
                </Link>
            </div>

            <header className="mb-8">
                <h1 className="text-3xl font-black text-[#1C1C1E] mb-1">Calcolatore Punti</h1>
                <p className="text-[#9AA2B1] text-sm font-medium">Gestione perfetta di aumenti e diminuzioni</p>
            </header>

            <div className="bg-white rounded-[32px] p-8 shadow-sm border border-[#EEF0F4] mb-6">
                <div className="grid grid-cols-2 gap-4 mb-8">
                    <div className="space-y-2">
                        <label className="text-xs font-black text-[#9AA2B1] uppercase tracking-widest pl-1">Punti Attuali</label>
                        <input
                            type="number"
                            value={currentStitches}
                            onChange={(e) => setCurrentStitches(e.target.value)}
                            placeholder="Es. 24"
                            className="w-full h-14 bg-[#FAFAFC] border border-[#EEF0F4] rounded-2xl px-4 text-lg font-bold text-[#1C1C1E] focus:outline-none focus:border-[#7B5CF6] transition-colors"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-black text-[#9AA2B1] uppercase tracking-widest pl-1">Punti Desiderati</label>
                        <input
                            type="number"
                            value={targetStitches}
                            onChange={(e) => setTargetStitches(e.target.value)}
                            placeholder="Es. 30"
                            className="w-full h-14 bg-[#FAFAFC] border border-[#EEF0F4] rounded-2xl px-4 text-lg font-bold text-[#1C1C1E] focus:outline-none focus:border-[#7B5CF6] transition-colors"
                        />
                    </div>
                </div>

                <button
                    onClick={calculate}
                    className="w-full h-14 bg-[#7B5CF6] text-white rounded-2xl font-black text-lg shadow-[0_8px_20px_rgba(123,92,246,0.3)] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                    <CalcIcon size={22} />
                    Calcola Schema
                </button>
            </div>

            {result && (
                <div className="bg-[#F4EEFF] rounded-[32px] p-8 border border-[#7B5CF6]/10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 bg-[#7B5CF6] text-white rounded-xl flex items-center justify-center">
                            <RefreshCw size={20} />
                        </div>
                        <div>
                            <h3 className="text-sm font-black text-[#7B5CF6] uppercase tracking-widest">Risultato</h3>
                            <p className="text-lg font-black text-[#1C1C1E]">{result.instruction}</p>
                        </div>
                    </div>

                    <div className="space-y-3">
                        {result.steps.map((step, i) => (
                            <div key={i} className="flex items-start gap-3 bg-white/60 p-4 rounded-2xl border border-white">
                                <ChevronRight size={18} className="text-[#7B5CF6] mt-0.5" />
                                <p className="text-[#1C1C1E] font-bold text-[15px]">{step}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
