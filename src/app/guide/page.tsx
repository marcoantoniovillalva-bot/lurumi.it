"use client";

import React from "react";
import { ArrowLeft, BookOpen, Lightbulb, Youtube, PenTool } from "lucide-react";
import Link from "next/link";

export default function GuidePage() {
    return (
        <div className="max-w-2xl mx-auto px-5 pt-6 pb-24">
            <Link href="/tools" className="w-10 h-10 flex items-center justify-center bg-white border border-[#EEF0F4] rounded-xl text-[#9AA2B1] mb-6">
                <ArrowLeft size={20} />
            </Link>

            <h1 className="text-3xl font-black mb-8">Guida all'uso</h1>

            <div className="space-y-6">
                <section className="bg-white p-6 rounded-3xl border border-[#EEF0F4] shadow-sm">
                    <div className="w-12 h-12 bg-[#F1E9FF] rounded-2xl flex items-center justify-center text-[#7B5CF6] mb-4">
                        <PenTool size={24} />
                    </div>
                    <h2 className="text-xl font-black mb-2">Designer AI</h2>
                    <p className="text-[#9AA2B1] text-sm leading-relaxed">
                        Usa il Designer AI per generare schemi e immagini di ispirazione per i tuoi amigurumi. Descrivi ciò che vuoi creare e lascia che Lurumi faccia il resto.
                    </p>
                </section>

                <section className="bg-white p-6 rounded-3xl border border-[#EEF0F4] shadow-sm">
                    <div className="w-12 h-12 bg-[#B9E5F9]/30 rounded-2xl flex items-center justify-center text-[#2D9CDB] mb-4">
                        <BookOpen size={24} />
                    </div>
                    <h2 className="text-xl font-black mb-2">Gestione Progetti</h2>
                    <p className="text-[#9AA2B1] text-sm leading-relaxed">
                        Puoi caricare pattern in PDF o immagini. Usa i contatori integrati per tenere traccia dei giri e il timer per monitorare il tuo tempo di lavoro.
                    </p>
                </section>

                <section className="bg-white p-6 rounded-3xl border border-[#EEF0F4] shadow-sm">
                    <div className="w-12 h-12 bg-[#D9B9F9]/30 rounded-2xl flex items-center justify-center text-[#9B51E0] mb-4">
                        <Youtube size={24} />
                    </div>
                    <h2 className="text-xl font-black mb-2">Tutorial</h2>
                    <p className="text-[#9AA2B1] text-sm leading-relaxed">
                        Incolla un link YouTube per importare un video. Potrai guardarlo direttamente nell'app mentre usi i contatori dedicati per non perdere mai il segno.
                    </p>
                </section>

                <section className="bg-[#FAF7FF] p-6 rounded-3xl border border-[#E6DAFF] border-dashed text-center">
                    <Lightbulb size={32} className="mx-auto text-[#7B5CF6] mb-2" />
                    <h3 className="font-bold text-[#1C1C1E]">Consiglio</h3>
                    <p className="text-[#7B5CF6] text-xs font-medium">Installa Lurumi come PWA sul tuo smartphone per un'esperienza a tutto schermo.</p>
                </section>
            </div>
        </div>
    );
}
