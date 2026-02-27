"use client";

import React from "react";
import { Palette, MessageSquare, BookOpen, Timer, StickyNote, ChevronRight, CalendarDays } from "lucide-react";
import Link from "next/link";

const toolGrid = [
    { title: "Designer AI", desc: "Crea pattern unici", icon: Palette, color: "#E3F2FD", text: "#1976D2", href: "/tools/designer" },
    { title: "Chat AI", desc: "Chiedi aiuto a Lurumi", icon: MessageSquare, color: "#F3E5F5", text: "#7B1FA2", href: "/tools/chat" },
    { title: "Libri", desc: "Libri e Riviste", icon: BookOpen, color: "#FFF3E0", text: "#E65100", href: "/tools/books" },
    { title: "Timer", desc: "Cronometri e Giri", icon: Timer, color: "#FFEBEE", text: "#C62828", href: "/tools/timer" },
    { title: "Note", desc: "Agenda creativa", icon: StickyNote, color: "#E0F7FA", text: "#00838F", href: "/tools/notes" },
    { title: "Corsi", desc: "Corsi e Workshop", icon: CalendarDays, color: "#EDE7F6", text: "#6A1B9A", href: "/eventi" },
];

export const ToolsDashboard: React.FC = () => {
    return (
        <div className="max-w-2xl mx-auto px-4 pt-6 pb-20">
            <h1 className="text-3xl font-black mb-1">Utensili</h1>
            <p className="text-[#9AA2B1] text-sm mb-6">Tutti gli Utensili</p>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-3.5">
                {toolGrid.map((tool) => (
                    <Link
                        key={tool.href}
                        href={tool.href}
                        className="bg-white p-4 rounded-2xl shadow-[0_4px_12px_rgba(0,0,0,0.05)] border border-[#EEF0F4] active:scale-[0.97] transition-all flex flex-col items-start text-left"
                    >
                        <div
                            className="w-11 h-11 rounded-xl flex items-center justify-center mb-4 transition-transform group-active:scale-95"
                            style={{ backgroundColor: tool.color, color: tool.text }}
                        >
                            <tool.icon size={22} strokeWidth={2.5} />
                        </div>
                        <div className="flex-1">
                            <h3 className="text-[15px] font-bold text-[#1C1C1E] mb-0.5 line-clamp-1">{tool.title}</h3>
                            <p className="text-[11px] font-bold text-[#9AA2B1] uppercase tracking-wider">{tool.desc}</p>
                        </div>
                    </Link>
                ))}
            </div>

            {/* List items for other potential tools */}
            <div className="mt-8 space-y-2.5">
                {[
                    { title: "Guida all'uso", icon: BookOpen, href: "/guide" },
                    { title: "Supporto", icon: MessageSquare, href: "/support" }
                ].map((item) => (
                    <Link
                        key={item.href}
                        href={item.href}
                        className="flex items-center gap-3.5 bg-white p-4 rounded-2xl border border-[#EEF0F4] shadow-sm active:bg-[#FAF7FF] transition-colors"
                    >
                        <div className="w-10 h-10 flex items-center justify-center bg-[#F4EEFF] text-[#7B5CF6] rounded-xl">
                            <item.icon size={20} />
                        </div>
                        <span className="flex-1 font-bold text-[#1C1C1E]">{item.title}</span>
                        <ChevronRight size={18} className="text-[#9AA2B1]" />
                    </Link>
                ))}
            </div>
        </div>
    );
};
