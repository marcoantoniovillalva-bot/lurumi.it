"use client";

import React, { useState } from "react";
import { User, LogIn, LogOut, Cookie, UserCircle } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/hooks/useAuth";
import { useUserProfile } from "@/hooks/useUserProfile";
import { createClient } from "@/lib/supabase/client";
import { useCookieConsent } from "@/hooks/useCookieConsent";
import { CookiePreferencesModal } from "@/components/CookiePreferencesModal";

export const Header = () => {
    const { user, loading } = useAuth();
    const { profile } = useUserProfile();
    const [showUserMenu, setShowUserMenu] = useState(false);
    const [showCookieModal, setShowCookieModal] = useState(false);
    const supabase = createClient();
    const { consent, saveCustom } = useCookieConsent();

    const handleLogin = () => {
        // Flow OAuth manuale: il server genera l'URL Google con redirect_uri=lurumi.it
        window.location.href = '/api/auth/google';
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        setShowUserMenu(false);
    };

    return (
    <>
        <header className="lu-gradient-header sticky top-0 z-[9999] px-5 py-2 shadow-[0_2px_6px_rgba(0,0,0,0.08)] transition-all">
            <div className="max-w-2xl mx-auto flex items-center justify-between">
                {/* Left: Spacer */}
                <div className="w-10" />

                {/* Center: Logo */}
                <Link href="/" className="flex items-center">
                    <Image
                        src="/images/logo/isologo-horizontal.png"
                        alt="Lurumi"
                        height={44}
                        width={132}
                        style={{ width: 'auto' }}
                        className="object-contain h-8 md:h-11"
                        priority
                    />
                </Link>

                {/* Right: Auth Button */}
                <div className="relative">
                    {!loading && (
                        user ? (
                            <button
                                onClick={() => setShowUserMenu(!showUserMenu)}
                                className="w-10 h-10 rounded-full border-2 border-white/50 overflow-hidden shadow-sm active:scale-95 transition-transform"
                            >
                                {user.user_metadata.avatar_url ? (
                                    <img src={user.user_metadata.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full bg-white flex items-center justify-center text-[#7B5CF6]">
                                        <User size={20} />
                                    </div>
                                )}
                            </button>
                        ) : (
                            <button
                                onClick={handleLogin}
                                className="w-10 h-10 flex items-center justify-center bg-white/40 backdrop-blur-md rounded-xl text-[#1C1C1E] active:scale-90 transition-transform"
                            >
                                <LogIn size={20} />
                            </button>
                        )
                    )}

                    {/* User Menu Dropdown */}
                    {showUserMenu && user && (
                        <>
                            <div className="fixed inset-0 z-[-1]" onClick={() => setShowUserMenu(false)} />
                            <div className="absolute right-0 mt-3 w-48 bg-white rounded-2xl shadow-xl border border-[#EEF0F4] p-2 animate-in fade-in zoom-in duration-200">
                                <div className="px-3 py-2 border-b border-[#F4EEFF] mb-1">
                                    <p className="text-xs font-bold text-[#9AA2B1] uppercase tracking-wider">Account</p>
                                    <p className="text-sm font-bold text-[#1C1C1E] truncate">{user.email}</p>
                                    <span className={`text-[11px] font-black px-2 py-0.5 rounded-full ${profile?.tier === 'premium' ? 'bg-[#7B5CF6] text-white' : 'bg-[#F4F4F8] text-[#9AA2B1]'}`}>
                                        {profile?.tier === 'premium' ? '✦ Premium' : 'Free'}
                                    </span>
                                </div>
                                <Link
                                    href="/profilo"
                                    onClick={() => setShowUserMenu(false)}
                                    className="w-full flex items-center gap-3 px-3 py-2.5 text-[#1C1C1E] font-bold text-sm hover:bg-[#F4F4F8] rounded-xl transition-colors"
                                >
                                    <UserCircle size={18} className="text-[#7B5CF6]" />
                                    Profilo
                                </Link>
                                <button
                                    onClick={() => { setShowCookieModal(true); setShowUserMenu(false); }}
                                    className="w-full flex items-center gap-3 px-3 py-2.5 text-[#9AA2B1] font-bold text-sm hover:bg-[#F4F4F8] rounded-xl transition-colors"
                                >
                                    <Cookie size={18} />
                                    Gestisci cookie
                                </button>
                                <div className="flex gap-2 px-3 py-1.5 border-t border-[#F4EEFF] mt-1">
                                    <Link href="/privacy" onClick={() => setShowUserMenu(false)} className="text-[10px] font-bold text-[#9AA2B1] hover:text-[#7B5CF6] transition-colors">Privacy</Link>
                                    <span className="text-[#EEF0F4]">·</span>
                                    <Link href="/cookie-policy" onClick={() => setShowUserMenu(false)} className="text-[10px] font-bold text-[#9AA2B1] hover:text-[#7B5CF6] transition-colors">Cookie</Link>
                                </div>
                                <button
                                    onClick={handleLogout}
                                    className="w-full flex items-center gap-3 px-3 py-2.5 text-red-500 font-bold text-sm hover:bg-red-50 rounded-xl transition-colors"
                                >
                                    <LogOut size={18} />
                                    Esci
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </header>

        {showCookieModal && (
            <CookiePreferencesModal
                current={consent}
                onSave={(cats) => { saveCustom(cats); setShowCookieModal(false); }}
                onClose={() => setShowCookieModal(false)}
            />
        )}
    </>
    );
};
