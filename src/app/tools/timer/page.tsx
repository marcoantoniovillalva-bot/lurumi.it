"use client";

import React, { useState, useEffect, useRef } from "react";
import { Timer, ArrowLeft, RotateCcw, Plus, Minus, Play, Pause } from "lucide-react";
import Link from "next/link";

const STORAGE_KEY = 'lurumi-timer-state';

export default function TimerPage() {
    const [count, setCount] = useState(0);
    const [elapsed, setElapsed] = useState(0);
    const [running, setRunning] = useState(false);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    // Load persisted state
    useEffect(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const { count: c, elapsed: e } = JSON.parse(saved);
                if (typeof c === 'number') setCount(c);
                if (typeof e === 'number') setElapsed(e);
            }
        } catch {}
    }, []);

    // Persist state
    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ count, elapsed }));
    }, [count, elapsed]);

    // Timer interval
    useEffect(() => {
        if (running) {
            intervalRef.current = setInterval(() => setElapsed(s => s + 1), 1000);
        } else {
            if (intervalRef.current) clearInterval(intervalRef.current);
        }
        return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    }, [running]);

    const formatTime = (s: number) => {
        const h = Math.floor(s / 3600);
        const m = Math.floor((s % 3600) / 60);
        const sec = s % 60;
        return [h, m, sec].map(v => String(v).padStart(2, '0')).join(':');
    };

    const resetTimer = () => { setRunning(false); setElapsed(0); };

    return (
        <div className="max-w-2xl mx-auto px-4 pt-6 pb-20">
            <div className="mb-6">
                <Link href="/tools" className="inline-flex items-center gap-2 text-[#9AA2B1] font-bold text-sm hover:text-[#7B5CF6] transition-colors">
                    <ArrowLeft size={18} />
                    Torna agli Utensili
                </Link>
            </div>

            <h1 className="text-3xl font-black mb-1">Timer & Giri</h1>
            <p className="text-[#9AA2B1] text-sm mb-8">Conta i tuoi punti e il tuo tempo</p>

            {/* Counter */}
            <div className="bg-white rounded-3xl p-8 shadow-[0_4px_24px_rgba(0,0,0,0.06)] border border-[#EEF0F4] text-center mb-6">
                <p className="text-[11px] font-bold text-[#9AA2B1] uppercase tracking-widest mb-4">Contatore Giri</p>
                <div className="text-[80px] font-black text-[#1C1C1E] leading-none mb-8">{count}</div>
                <div className="flex items-center justify-center gap-4">
                    <button onClick={() => setCount(Math.max(0, count - 1))} className="w-16 h-16 flex items-center justify-center bg-[#FAFAFC] border border-[#EEF0F4] rounded-2xl text-[#1C1C1E] active:scale-90 transition-transform">
                        <Minus size={24} />
                    </button>
                    <button onClick={() => setCount(count + 1)} className="w-24 h-24 flex items-center justify-center bg-[#7B5CF6] text-white rounded-[32px] shadow-[0_12px_24px_rgba(123,92,246,0.3)] active:scale-95 transition-transform">
                        <Plus size={36} />
                    </button>
                    <button onClick={() => setCount(0)} className="w-16 h-16 flex items-center justify-center bg-[#FAFAFC] border border-[#EEF0F4] rounded-2xl text-[#9AA2B1] active:scale-90 transition-transform">
                        <RotateCcw size={24} />
                    </button>
                </div>
            </div>

            {/* Cronometro */}
            <div className="bg-white rounded-3xl p-8 shadow-[0_4px_24px_rgba(0,0,0,0.06)] border border-[#EEF0F4] text-center">
                <p className="text-[11px] font-bold text-[#9AA2B1] uppercase tracking-widest mb-4">Cronometro</p>
                <div className={`text-[64px] font-black leading-none mb-8 tabular-nums tracking-tight ${running ? 'text-[#7B5CF6]' : 'text-[#1C1C1E]'}`}>
                    {formatTime(elapsed)}
                </div>
                <div className="flex items-center justify-center gap-4">
                    <button
                        onClick={() => setRunning(r => !r)}
                        className={`flex items-center gap-3 px-8 h-14 rounded-2xl font-bold text-base transition-all ${running ? 'bg-red-50 text-red-500 border border-red-100' : 'bg-[#7B5CF6] text-white shadow-[0_8px_20px_rgba(123,92,246,0.3)]'}`}
                    >
                        {running ? <Pause size={22} /> : <Play size={22} />}
                        {running ? 'Pausa' : 'Avvia'}
                    </button>
                    <button onClick={resetTimer} className="w-14 h-14 flex items-center justify-center bg-[#FAFAFC] border border-[#EEF0F4] rounded-2xl text-[#9AA2B1] active:scale-90 transition-transform">
                        <RotateCcw size={22} />
                    </button>
                </div>
            </div>
        </div>
    );
}
