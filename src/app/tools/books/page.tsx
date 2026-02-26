"use client";

import React from "react";
import { BookOpen, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function BooksPage() {
    return (
        <div className="max-w-2xl mx-auto px-4 pt-6 pb-20">
            <div className="mb-6">
                <Link href="/tools" className="inline-flex items-center gap-2 text-[#9AA2B1] font-bold text-sm hover:text-[#7B5CF6] transition-colors">
                    <ArrowLeft size={18} />
                    Torna agli Utensili
                </Link>
            </div>

            <h1 className="text-3xl font-black mb-1">I miei Libri</h1>
            <p className="text-[#9AA2B1] text-sm mb-8">La tua libreria digitale di pattern</p>

            <div className="bg-white rounded-2xl p-6 border border-[#EEF0F4] text-center opacity-70">
                <div className="w-16 h-16 bg-[#FFF3E0] text-[#E65100] rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <BookOpen size={32} />
                </div>
                <h3 className="text-lg font-bold text-[#1C1C1E]">Nessun libro salvato</h3>
                <p className="text-[#9AA2B1] text-sm">Carica i tuoi PDF o acquista nuovi pattern</p>
            </div>
        </div>
    );
}
