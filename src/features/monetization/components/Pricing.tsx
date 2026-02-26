"use client";

import React, { useEffect, useState } from "react";
import { Check, ArrowLeft, Gem, CheckCircle2, XCircle } from "lucide-react";
import { createCheckoutSession } from "../actions/stripe";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

const features = {
    free: [
        "Contatori illimitati",
        "Fino a 5 pattern PDF",
        "Viewer PDF base",
        "Storage locale garantito",
    ],
    premium: [
        "Pattern PDF illimitati",
        "Galleria foto illimitata",
        "Designer AI illimitato",
        "Chat AI illimitata",
        "Backup nel Cloud",
        "Supporto prioritario",
    ],
}

export const Pricing: React.FC = () => {
    const searchParams = useSearchParams()
    const [loading, setLoading] = useState(false)
    const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

    useEffect(() => {
        if (searchParams.get('success') === 'true') {
            setNotice({ type: 'success', text: 'Abbonamento attivato! Benvenuta in Lurumi Premium 🎉' })
        } else if (searchParams.get('canceled') === 'true') {
            setNotice({ type: 'error', text: 'Pagamento annullato. Puoi riprovare quando vuoi.' })
        }
    }, [searchParams])

    const handleUpgrade = async () => {
        const priceId = process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_PREMIUM
        if (!priceId || priceId.startsWith('INSERISCI')) {
            setNotice({ type: 'error', text: 'Pagamento non ancora configurato. Contatta il supporto.' })
            return
        }
        setLoading(true)
        try {
            await createCheckoutSession(priceId)
        } catch (e: any) {
            setNotice({ type: 'error', text: e.message || 'Errore durante il pagamento. Riprova.' })
            setLoading(false)
        }
    }

    return (
        <div className="max-w-2xl mx-auto px-5 pt-6 pb-24">
            <Link href="/tools" className="w-10 h-10 flex items-center justify-center bg-white border border-[#EEF0F4] rounded-xl text-[#9AA2B1] mb-6">
                <ArrowLeft size={20} />
            </Link>

            <header className="text-center mb-10">
                <h1 className="text-3xl font-black mb-2">Il tuo piano</h1>
                <p className="text-[#9AA2B1] text-sm font-medium">Scegli come vivere la tua passione</p>
            </header>

            {/* Feedback banner */}
            {notice && (
                <div className={`flex items-start gap-3 p-4 rounded-2xl mb-6 text-sm font-bold animate-in fade-in ${notice.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                    {notice.type === 'success' ? <CheckCircle2 size={20} className="flex-shrink-0 mt-0.5" /> : <XCircle size={20} className="flex-shrink-0 mt-0.5" />}
                    {notice.text}
                </div>
            )}

            <div className="grid gap-6 md:grid-cols-2">
                {/* Free */}
                <div className="p-8 rounded-[32px] border-2 border-[#EEF0F4] bg-white">
                    <h2 className="text-xl font-black text-[#1C1C1E] mb-1">Lurumi Free</h2>
                    <div className="flex items-baseline gap-1 mb-4">
                        <span className="text-3xl font-black text-[#1C1C1E]">€0</span>
                    </div>
                    <p className="text-[#9AA2B1] text-sm mb-6 leading-relaxed">Perfetto per chi sta iniziando.</p>
                    <ul className="space-y-3.5 mb-8">
                        {features.free.map((feat) => (
                            <li key={feat} className="flex items-start gap-3 text-sm font-bold text-[#1C1C1E]">
                                <div className="mt-0.5 bg-[#F4EEFF] p-1 rounded-full text-[#7B5CF6]">
                                    <Check size={12} strokeWidth={4} />
                                </div>
                                {feat}
                            </li>
                        ))}
                    </ul>
                    <Link
                        href="/"
                        className="block w-full py-4 rounded-2xl font-black text-[15px] text-center bg-[#FAFAFC] text-[#9AA2B1] border border-[#EEF0F4] active:scale-[0.97] transition-all"
                    >
                        Piano attuale
                    </Link>
                </div>

                {/* Premium */}
                <div className="p-8 rounded-[32px] border-2 border-[#7B5CF6] bg-[#FAF7FF] shadow-[0_12px_40px_rgba(123,92,246,0.1)]">
                    <div className="flex justify-start mb-4">
                        <span className="px-3 py-1 bg-[#D9B9F9] text-white text-[10px] font-black rounded-full uppercase tracking-widest flex items-center gap-1">
                            <Gem size={10} /> Consigliato
                        </span>
                    </div>
                    <h2 className="text-xl font-black text-[#1C1C1E] mb-1">Lurumi Premium</h2>
                    <div className="flex items-baseline gap-1 mb-4">
                        <span className="text-3xl font-black text-[#1C1C1E]">€4,99</span>
                        <span className="text-[#9AA2B1] font-bold text-sm">/mese</span>
                    </div>
                    <p className="text-[#9AA2B1] text-sm mb-6 leading-relaxed">Per le crafter più appassionate.</p>
                    <ul className="space-y-3.5 mb-8">
                        {features.premium.map((feat) => (
                            <li key={feat} className="flex items-start gap-3 text-sm font-bold text-[#1C1C1E]">
                                <div className="mt-0.5 bg-[#F4EEFF] p-1 rounded-full text-[#7B5CF6]">
                                    <Check size={12} strokeWidth={4} />
                                </div>
                                {feat}
                            </li>
                        ))}
                    </ul>
                    <button
                        onClick={handleUpgrade}
                        disabled={loading}
                        className="w-full py-4 rounded-2xl font-black text-[15px] bg-[#7B5CF6] text-white shadow-lg shadow-[#7B5CF6]/30 active:scale-[0.97] transition-all disabled:opacity-60"
                    >
                        {loading ? 'Reindirizzamento...' : 'Passa a Premium'}
                    </button>
                </div>
            </div>

            <p className="text-xs text-center text-[#9AA2B1] mt-6 font-medium">
                Pagamento sicuro tramite Stripe · Disdici in qualsiasi momento
            </p>
        </div>
    );
};
