"use client";

import React from "react";
import { LayoutGrid, FolderOpen, Youtube } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export const Tabbar = () => {
    const pathname = usePathname();

    const tabs = [
        { name: "Utensili", icon: LayoutGrid, path: "/tools", id: "utensili" },
        { name: "Progetti", icon: FolderOpen, path: "/", id: "pdf" },
        { name: "Tutorial", icon: Youtube, path: "/tutorials", id: "progetti" },
    ];

    return (
        <nav className="lu-tabbar lu-gradient-header fixed bottom-0 left-0 right-0 z-[9999] px-4 pb-[calc(8px+env(safe-area-inset-bottom))] pt-2 shadow-[0_-2px_10px_rgba(0,0,0,0.05)] border-t border-white/20">
            <div className="mx-auto flex max-w-sm sm:max-w-md justify-around gap-1">
                {tabs.map((tab) => {
                    const isActive = (tab.path === "/" && (pathname === "/" || pathname.startsWith("/projects"))) ||
                        (tab.path === "/tutorials" && pathname.startsWith("/tutorials")) ||
                        (tab.path === "/tools" && pathname.startsWith("/tools"));

                    return (
                        <Link
                            key={tab.id}
                            href={tab.path}
                            className={`flex flex-1 flex-col items-center gap-1 rounded-xl py-1.5 transition-all active:scale-95 ${isActive ? "text-[#1C1C1E]" : "text-[#1C1C1E]/50 hover:bg-white/20"
                                }`}
                        >
                            <tab.icon
                                size={22}
                                className={isActive ? "opacity-100" : "opacity-60"}
                                strokeWidth={isActive ? 2.5 : 2}
                            />
                            <span className={`text-[11px] font-black tracking-wide ${isActive ? "opacity-100" : "opacity-60"}`}>
                                {tab.name}
                            </span>
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
};
