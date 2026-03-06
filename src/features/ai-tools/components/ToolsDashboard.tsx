"use client";

import React from "react";
import { BookOpen, MessageSquare, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useCharacterTheme, type CharacterSlot } from "@/hooks/useCharacterTheme";

const toolGrid: { title: string; desc: string; color: string; href: string; slot: CharacterSlot }[] = [
    { title: "Designer AI", desc: "Crea pattern unici",    color: "#E3F2FD", href: "/tools/designer", slot: "tool_designer" },
    { title: "Chat AI",     desc: "Chiedi aiuto a Lurumi", color: "#F3E5F5", href: "/tools/chat",     slot: "tool_chat"     },
    { title: "Libri",       desc: "Libri e Schemi",        color: "#FFF3E0", href: "/tools/books",    slot: "tool_books"    },
    { title: "Timer",       desc: "Cronometri e Giri",     color: "#FFEBEE", href: "/tools/timer",    slot: "tool_timer"    },
    { title: "Note",        desc: "Agenda creativa",       color: "#E0F7FA", href: "/tools/notes",    slot: "tool_notes"    },
    { title: "Corsi",       desc: "Corsi e Workshop",      color: "#EDE7F6", href: "/eventi",         slot: "tool_courses"  },
];

export const ToolsDashboard: React.FC = () => {
    const { getUrl } = useCharacterTheme();

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
                            className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3 overflow-hidden"
                            style={{ backgroundColor: tool.color }}
                        >
                            <img
                                src={getUrl(tool.slot)}
                                alt={tool.title}
                                className="w-12 h-12 object-contain animate-character-breathe"
                                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                                suppressHydrationWarning
                            />
                        </div>
                        <div className="flex-1">
                            <h3 className="text-[15px] font-bold text-[#1C1C1E] mb-0.5 line-clamp-1">{tool.title}</h3>
                            <p className="text-[11px] font-bold text-[#9AA2B1] uppercase tracking-wider">{tool.desc}</p>
                        </div>
                    </Link>
                ))}
            </div>

            <div className="mt-8 space-y-2.5">
                {[
                    { title: "Guida all'uso", icon: BookOpen,      href: "/guide"   },
                    { title: "Supporto",      icon: MessageSquare, href: "/support" },
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
