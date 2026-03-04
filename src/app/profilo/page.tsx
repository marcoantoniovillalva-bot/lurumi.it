"use client";

import React, { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Palette, CheckCircle, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserProfile, broadcastProfileRefresh } from "@/hooks/useUserProfile";
import { SocialBar } from "@/components/SocialBar";
import { useSearchParams } from "next/navigation";
import {
    useCharacterTheme,
    CHARACTERS,
    getCharacterUrl,
    type CharacterName,
} from "@/hooks/useCharacterTheme";
import { updateCharacterTheme } from "@/app/actions/updateCharacterTheme";

export default function ProfiloPage() {
    const { user, loading } = useAuth();
    const { profile } = useUserProfile();
    const { character, getUrl } = useCharacterTheme();
    const router = useRouter();
    const searchParams = useSearchParams();
    const canvaStatus = searchParams.get('canva');
    const [canvaConnected, setCanvaConnected] = useState(false);
    const [isPending, startTransition] = useTransition();
    const [themeSaved, setThemeSaved] = useState(false);
    const [showAvatarModal, setShowAvatarModal] = useState(false);
    const [emailPrefs, setEmailPrefs] = useState<{ newsletter: boolean; marketing: boolean } | null>(null);
    const [emailPrefsSaved, setEmailPrefsSaved] = useState(false);

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

    useEffect(() => {
        if (profile && emailPrefs === null) {
            setEmailPrefs({
                newsletter: profile.newsletter_opt_in ?? true,
                marketing: profile.marketing_opt_in ?? false,
            });
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [profile?.newsletter_opt_in, profile?.marketing_opt_in]);

    const handleEmailPrefToggle = async (field: 'newsletter' | 'marketing', value: boolean) => {
        if (!user) return;
        const newPrefs = { ...(emailPrefs ?? { newsletter: true, marketing: false }), [field]: value };
        setEmailPrefs(newPrefs);
        const supabase = createClient();
        await supabase.from('profiles').update({
            newsletter_opt_in: newPrefs.newsletter,
            marketing_opt_in: newPrefs.marketing,
        }).eq('id', user.id);
        setEmailPrefsSaved(true);
        setTimeout(() => setEmailPrefsSaved(false), 2000);
    };

    const handleSelectCharacter = (name: CharacterName) => {
        localStorage.setItem('lurumi_character_theme', name);
        if (user?.id) localStorage.setItem(`lurumi_char_${user.id}`, name);
        document.cookie = `lurumi_char=${name}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
        startTransition(async () => {
            await updateCharacterTheme(name);
            broadcastProfileRefresh();
            setThemeSaved(true);
            setTimeout(() => setThemeSaved(false), 2000);
        });
    };

    const sections = [
        { href: "/guide", label: "Guide", emoji: "📖", desc: "Come usare l'app" },
        { href: "/pricing", label: "Piano e Crediti", emoji: "💎", desc: "Abbonamento, AI e corsi" },
        { href: "/support", label: "Supporto", emoji: "💬", desc: "Hai bisogno di aiuto?" },
    ];

    if (loading) return <div className="p-10 text-center font-bold text-[#9AA2B1]">Caricamento...</div>;
    if (!user) return null;

    const firstName = user.user_metadata?.full_name?.split(" ")[0] ?? null;

    return (
        <div className="max-w-2xl mx-auto px-4 pt-6 pb-24">
            {/* Greeting con personaggio */}
            <div className="mb-8 flex items-center gap-4">
                <img
                    src={getUrl('profile')}
                    alt="Il tuo personaggio"
                    className="w-20 h-20 object-contain animate-character-bounce flex-shrink-0"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                    suppressHydrationWarning
                />
                <div>
                    <h1 className="text-3xl font-black text-[#1C1C1E] mb-1">
                        {firstName ? `Ciao, ${firstName}!` : "Il tuo Profilo"}
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
            </div>

            {/* Quick nav */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-10">
                {/* Card Avatar */}
                <button
                    onClick={() => setShowAvatarModal(true)}
                    className="lu-card p-5 flex flex-col gap-3 hover:shadow-md transition-shadow text-left"
                >
                    <img
                        src={getUrl('welcome')}
                        alt="Avatar"
                        className="w-9 h-9 object-contain"
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                        suppressHydrationWarning
                    />
                    <div>
                        <p className="font-black text-[#1C1C1E] text-[15px]">Avatar</p>
                        <p className="text-[#9AA2B1] text-xs font-medium mt-0.5">Il tuo personaggio</p>
                    </div>
                </button>

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

            {/* ── Modal selezione avatar ── */}
            {showAvatarModal && (
                <div
                    className="fixed inset-0 z-[10000] flex items-end justify-center bg-black/40"
                    onClick={() => setShowAvatarModal(false)}
                >
                    <div
                        className="w-full max-w-2xl bg-white rounded-t-[32px] p-6 pb-[calc(2.5rem+env(safe-area-inset-bottom))] shadow-2xl animate-in slide-in-from-bottom duration-300"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="w-12 h-1.5 bg-[#EEF0F4] rounded-full mx-auto mb-5" />
                        <div className="flex items-center gap-2 mb-1">
                            <img
                                src={getUrl('welcome')}
                                alt="Avatar"
                                className="w-8 h-8 object-contain"
                                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                                suppressHydrationWarning
                            />
                            <h2 className="text-xl font-black text-[#1C1C1E]">Il tuo personaggio</h2>
                            {themeSaved && (
                                <span className="ml-auto text-[11px] font-black text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                                    ✓ Salvato
                                </span>
                            )}
                        </div>
                        <p className="text-[#9AA2B1] text-xs font-medium mb-5">
                            Scegli chi ti accompagna nell'app — si aggiorna ovunque in tempo reale
                        </p>
                        <div className="grid grid-cols-4 gap-3">
                            {CHARACTERS.map(({ name, label }) => {
                                const isSelected = character === name;
                                return (
                                    <button
                                        key={name}
                                        onClick={() => handleSelectCharacter(name)}
                                        disabled={isPending}
                                        className={`flex flex-col items-center gap-1.5 p-2 rounded-2xl border-2 transition-all active:scale-95 ${
                                            isSelected
                                                ? 'border-[#7B5CF6] bg-[#F4EEFF]'
                                                : 'border-[#EEF0F4] bg-[#FAFAFC] hover:border-[#D9B9F9]'
                                        }`}
                                    >
                                        <img
                                            src={getCharacterUrl(name, 'welcome')}
                                            alt={label}
                                            className={`w-14 h-14 object-contain transition-transform ${isSelected ? 'animate-character-bounce' : ''}`}
                                            onError={(e) => { (e.currentTarget as HTMLImageElement).style.opacity = '0.3' }}
                                        />
                                        <span className={`text-[11px] font-black ${isSelected ? 'text-[#7B5CF6]' : 'text-[#9AA2B1]'}`}>
                                            {label}
                                        </span>
                                        {isSelected && (
                                            <div className="w-1.5 h-1.5 rounded-full bg-[#7B5CF6]" />
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

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

            {/* ── Preferenze Email ── */}
            <div className="bg-white rounded-[28px] border border-[#EEF0F4] p-6 shadow-sm mb-6">
                <div className="flex items-center gap-2 mb-1">
                    <Mail size={18} className="text-[#7B5CF6]" />
                    <h2 className="text-lg font-black text-[#1C1C1E]">Email</h2>
                    {emailPrefsSaved && (
                        <span className="ml-auto text-[11px] font-black text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                            ✓ Salvato
                        </span>
                    )}
                </div>
                <p className="text-[#9AA2B1] text-xs font-medium mb-4">
                    Gestisci le comunicazioni che vuoi ricevere da Lurumi
                </p>
                <div className="space-y-3">
                    {/* Newsletter toggle */}
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-bold text-[#1C1C1E]">Newsletter e aggiornamenti prodotto</p>
                            <p className="text-xs text-[#9AA2B1] font-medium">Novità, tutorial e nuove funzionalità</p>
                        </div>
                        <button
                            onClick={() => handleEmailPrefToggle('newsletter', !(emailPrefs?.newsletter ?? true))}
                            className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
                                (emailPrefs?.newsletter ?? true) ? 'bg-[#7B5CF6]' : 'bg-[#D1D5DB]'
                            }`}
                            aria-label="Toggle newsletter"
                        >
                            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                                (emailPrefs?.newsletter ?? true) ? 'translate-x-5' : 'translate-x-0'
                            }`} />
                        </button>
                    </div>
                    <div className="h-px bg-[#EEF0F4]" />
                    {/* Marketing toggle */}
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-bold text-[#1C1C1E]">Offerte e promozioni</p>
                            <p className="text-xs text-[#9AA2B1] font-medium">Sconti, eventi speciali e offerte esclusive</p>
                        </div>
                        <button
                            onClick={() => handleEmailPrefToggle('marketing', !(emailPrefs?.marketing ?? false))}
                            className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
                                (emailPrefs?.marketing ?? false) ? 'bg-[#7B5CF6]' : 'bg-[#D1D5DB]'
                            }`}
                            aria-label="Toggle marketing"
                        >
                            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                                (emailPrefs?.marketing ?? false) ? 'translate-x-5' : 'translate-x-0'
                            }`} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Social */}
            <div className="pt-6 border-t border-[#EEF0F4]">
                <SocialBar />
            </div>
        </div>
    );
}
