"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Palette, CheckCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserProfile } from "@/hooks/useUserProfile";
import { SocialBar } from "@/components/SocialBar";
import { useSearchParams } from "next/navigation";

export default function ProfiloPage() {
    const { user, loading } = useAuth();
    const { profile } = useUserProfile();
    const router = useRouter();
    const searchParams = useSearchParams();
    const canvaStatus = searchParams.get('canva'); // 'success' | 'error' | null
    const [canvaConnected, setCanvaConnected] = useState(false);

    useEffect(() => {
        if (!user) return;
        const supabase = createClient();
        supabase.from('profiles').select('canva_token').eq('id', user.id).single().then(({ data, error }) => {
            if (error) console.warn('[Profilo] canva_token fetch failed:', error.message);
            setCanvaConnected(!!(data as { canva_token?: string })?.canva_token);
        });
    }, [user?.id]);

    useEffect(() => {
        if (!loading && !user) router.push("/login");
    }, [user, loading, router]);

    const sections = [
        { href: "/", label: "Progetti", emoji: "🧶", desc: "I tuoi lavori attivi" },
        { href: "/tools", label: "Strumenti AI", emoji: "✨", desc: "Chat, designer e altro" },
        { href: "/tutorials", label: "Tutorial", emoji: "▶️", desc: "Video e guide" },
        { href: "/guide", label: "Guide", emoji: "📖", desc: "Come usare l'app" },
        { href: "/pricing", label: "Piano", emoji: "💎", desc: "Abbonamento attivo" },
        { href: "/support", label: "Supporto", emoji: "💬", desc: "Hai bisogno di aiuto?" },
    ];

    if (loading) return <div className="p-10 text-center font-bold text-[#9AA2B1]">Caricamento...</div>;
    if (!user) return null;

    const firstName = user.user_metadata?.full_name?.split(" ")[0] ?? null;

    return (
        <div className="max-w-2xl mx-auto px-4 pt-6 pb-24">
            {/* Greeting */}
            <div className="mb-8">
                <h1 className="text-3xl font-black text-[#1C1C1E] mb-1">
                    {firstName ? `Ciao, ${firstName}!` : "Il tuo Profilo"} 👤
                </h1>
                <p className="text-[#9AA2B1] text-sm font-medium">{user.email}</p>
                <span
                    className={`inline-block mt-2 text-[11px] font-black px-2.5 py-1 rounded-full ${
                        profile?.tier === "premium" ? "bg-[#7B5CF6] text-white" : "bg-[#F4F4F8] text-[#9AA2B1]"
                    }`}
                >
                    {profile?.tier === "premium" ? "✦ Premium" : "Free"}
                </span>
            </div>

            {/* Quick nav */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-10">
                {sections.map((item) => (
                    <Link
                        key={item.href}
                        href={item.href}
                        className="lu-card p-5 flex flex-col gap-3 hover:shadow-md transition-shadow"
                    >
                        <span className="text-3xl">{item.emoji}</span>
                        <div>
                            <p className="font-black text-[#1C1C1E] text-[15px]">{item.label}</p>
                            <p className="text-[#9AA2B1] text-xs font-medium mt-0.5">{item.desc}</p>
                        </div>
                    </Link>
                ))}
            </div>

            {/* ── Canva Integration ── */}
            <div className="bg-white rounded-[28px] border border-[#EEF0F4] p-6 shadow-sm mb-6">
                <div className="flex items-start justify-between">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <Palette size={18} className="text-[#7B5CF6]" />
                            <h2 className="text-lg font-black text-[#1C1C1E]">Canva</h2>
                        </div>
                        <p className="text-[#9AA2B1] text-xs font-medium">
                            {canvaConnected ? 'Account connesso — puoi esportare dal Designer AI' : 'Connetti Canva per esportare le immagini AI direttamente'}
                        </p>
                        {canvaStatus === 'success' && (
                            <p className="text-green-600 text-xs font-bold mt-1">✓ Canva connesso con successo!</p>
                        )}
                        {canvaStatus === 'error' && (
                            <p className="text-red-500 text-xs font-bold mt-1">Connessione fallita. Riprova.</p>
                        )}
                    </div>
                    {canvaConnected ? (
                        <div className="flex items-center gap-1.5 text-green-600 font-bold text-sm">
                            <CheckCircle size={16} />
                            Connesso
                        </div>
                    ) : (
                        <a
                            href="/api/canva/auth"
                            className="px-4 py-2.5 bg-[#7B5CF6] text-white rounded-xl font-bold text-sm active:scale-95 transition-transform flex-shrink-0"
                        >
                            Connetti
                        </a>
                    )}
                </div>
            </div>

            {/* Social */}
            <div className="pt-6 border-t border-[#EEF0F4]">
                <SocialBar />
            </div>
        </div>
    );
}
