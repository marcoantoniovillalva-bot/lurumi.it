"use client";

import React, { useEffect, useState, useRef } from "react";
import { Check, ArrowLeft, Gem, CheckCircle2, XCircle, Loader2, RefreshCw, Clock } from "lucide-react";
import { createCheckoutSession, createBillingPortalSession } from "../actions/stripe";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useUserProfile, broadcastProfileRefresh } from "@/hooks/useUserProfile";

const features = {
    free: [
        "Contatori illimitati",
        "Fino a 5 pattern PDF",
        "Viewer PDF base",
        "Storage locale garantito",
        "50 crediti AI / mese",
    ],
    premium: [
        "Pattern PDF illimitati",
        "Galleria foto illimitata",
        "300 crediti AI / mese",
        "Immagini HD con DALL-E 3",
        "Backup nel Cloud",
        "Supporto prioritario",
    ],
}

function isNextRedirect(e: unknown): boolean {
    if (!e || typeof e !== 'object') return false
    const err = e as Record<string, unknown>
    return (
        err.message === 'NEXT_REDIRECT' ||
        (typeof err.digest === 'string' && err.digest.startsWith('NEXT_REDIRECT'))
    )
}

function formatDate(unixTs: number): string {
    return new Date(unixTs * 1000).toLocaleDateString('it-IT', {
        day: 'numeric', month: 'long', year: 'numeric',
    })
}

interface SyncResult {
    tier: 'free' | 'premium'
    cancelAtPeriodEnd: boolean
    currentPeriodEnd: number | null
}

export const Pricing: React.FC = () => {
    const searchParams = useSearchParams()
    const { profile, loading, refreshProfile } = useUserProfile()
    const isPremium = profile?.tier === 'premium'

    const [checkoutLoading, setCheckoutLoading] = useState(false)
    const [cancelLoading, setCancelLoading] = useState(false)
    const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
    const [syncing, setSyncing] = useState<'activating' | 'verifying' | false>(false)
    // Stato abbonamento in cancellazione (cancel_at_period_end)
    const [cancelingAt, setCancelingAt] = useState<number | null>(null)
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

    const successParam = searchParams.get('success')
    const sessionId = searchParams.get('session_id')
    const canceledParam = searchParams.get('canceled')
    const portalReturnParam = searchParams.get('portal_return')

    // ── Banner iniziale ──────────────────────────────────────
    useEffect(() => {
        if (successParam === 'true') {
            setNotice({ type: 'success', text: 'Pagamento completato! Attivazione Premium in corso...' })
        } else if (canceledParam === 'true') {
            setNotice({ type: 'error', text: 'Pagamento annullato. Puoi riprovare quando vuoi.' })
        } else if (portalReturnParam === 'true') {
            setNotice({ type: 'success', text: 'Verifica abbonamento in corso...' })
        }
    }, [successParam, canceledParam, portalReturnParam])

    // ── Attivazione dopo pagamento ───────────────────────────
    useEffect(() => {
        if (successParam !== 'true') return
        if (isPremium) return

        setSyncing('activating')

        async function activate() {
            if (sessionId) {
                try {
                    const res = await fetch(`/api/stripe/confirm-subscription?session_id=${sessionId}`)
                    const json = await res.json()
                    if (json.activated) {
                        broadcastProfileRefresh()
                        setSyncing(false)
                        return
                    }
                } catch { /* fallback al polling */ }
            }

            const start = Date.now()
            pollRef.current = setInterval(async () => {
                await refreshProfile()
                if (Date.now() - start >= 15_000) {
                    clearInterval(pollRef.current!)
                    pollRef.current = null
                    setSyncing(false)
                    if (sessionId) {
                        try {
                            const res = await fetch(`/api/stripe/confirm-subscription?session_id=${sessionId}`)
                            const json = await res.json()
                            if (json.activated) broadcastProfileRefresh()
                        } catch {}
                    }
                }
            }, 2000)
        }

        activate()
        return () => { if (pollRef.current) clearInterval(pollRef.current) }
    }, [successParam, sessionId]) // eslint-disable-line react-hooks/exhaustive-deps

    // ── Sync dopo ritorno dal Billing Portal ─────────────────
    useEffect(() => {
        if (portalReturnParam !== 'true') return
        runSync()
    }, [portalReturnParam]) // eslint-disable-line react-hooks/exhaustive-deps

    // ── Auto-sync silenzioso al caricamento ──────────────────
    useEffect(() => {
        if (loading) return
        if (profile?.tier !== 'premium') return
        if (successParam === 'true' || portalReturnParam === 'true') return
        if (syncing) return

        runSync()
    }, [loading, profile?.tier]) // eslint-disable-line react-hooks/exhaustive-deps

    // ── Ferma polling quando tier diventa premium ────────────
    useEffect(() => {
        if (!isPremium) return
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
        setSyncing(false)
        if (successParam === 'true') {
            setNotice({ type: 'success', text: 'Piano Premium attivato! Benvenuta in Lurumi Premium ✦' })
        }
    }, [isPremium]) // eslint-disable-line react-hooks/exhaustive-deps

    // ── Funzione sync condivisa ───────────────────────────────
    function runSync() {
        setSyncing('verifying')
        fetch('/api/stripe/sync-subscription')
            .then(r => r.json())
            .then(async (json: SyncResult & { error?: string }) => {
                if (json.error) throw new Error(json.error)

                // Aggiorna tutte le istanze di useUserProfile (Header incluso)
                broadcastProfileRefresh()

                setCancelingAt(json.cancelAtPeriodEnd && json.currentPeriodEnd ? json.currentPeriodEnd : null)

                if (portalReturnParam === 'true') {
                    if (json.tier === 'free') {
                        setNotice({ type: 'success', text: 'Abbonamento annullato. Sei passata al piano Free.' })
                    } else if (json.cancelAtPeriodEnd && json.currentPeriodEnd) {
                        setNotice({
                            type: 'success',
                            text: `Cancellazione confermata. Resterai Premium fino al ${formatDate(json.currentPeriodEnd)}.`,
                        })
                    } else {
                        setNotice({ type: 'success', text: 'Abbonamento attivo. Nessuna modifica.' })
                    }
                }
            })
            .catch(() => setNotice({ type: 'error', text: 'Errore di sincronizzazione. Riprova.' }))
            .finally(() => setSyncing(false))
    }

    const handleManualSync = () => { setNotice(null); runSync() }

    // ── Handlers pagamento ────────────────────────────────────
    const handleUpgrade = async () => {
        const priceId = process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_PREMIUM
        if (!priceId || priceId.startsWith('INSERISCI')) {
            setNotice({ type: 'error', text: 'Pagamento non ancora configurato. Contatta il supporto.' })
            return
        }
        setCheckoutLoading(true)
        try {
            await createCheckoutSession(priceId)
        } catch (e: unknown) {
            if (isNextRedirect(e)) throw e
            setNotice({ type: 'error', text: (e as Error)?.message || 'Errore durante il pagamento. Riprova.' })
            setCheckoutLoading(false)
        }
    }

    const handleCancelSubscription = async () => {
        setCancelLoading(true)
        try {
            await createBillingPortalSession()
        } catch (e: unknown) {
            if (isNextRedirect(e)) throw e
            setNotice({ type: 'error', text: (e as Error)?.message || 'Errore. Riprova.' })
            setCancelLoading(false)
        }
    }

    const buttonLoading = loading || syncing !== false

    // ── Render ───────────────────────────────────────────────
    return (
        <div className="max-w-2xl mx-auto px-5 pt-6 pb-24">
            <Link href="/tools" className="w-10 h-10 flex items-center justify-center bg-white border border-[#EEF0F4] rounded-xl text-[#9AA2B1] mb-6">
                <ArrowLeft size={20} />
            </Link>

            <header className="text-center mb-10">
                <h1 className="text-3xl font-black mb-2">Il tuo piano</h1>
                <p className="text-[#9AA2B1] text-sm font-medium">Scegli come vivere la tua passione</p>
            </header>

            {notice && (
                <div className={`flex items-start gap-3 p-4 rounded-2xl mb-6 text-sm font-bold animate-in fade-in ${notice.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                    {notice.type === 'success'
                        ? <CheckCircle2 size={20} className="flex-shrink-0 mt-0.5" />
                        : <XCircle size={20} className="flex-shrink-0 mt-0.5" />}
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
                    {isPremium ? (
                        <div className="block w-full py-4 rounded-2xl font-black text-[15px] text-center bg-[#FAFAFC] text-[#9AA2B1]/50 border border-[#EEF0F4]">
                            Piano precedente
                        </div>
                    ) : (
                        <Link href="/" className="block w-full py-4 rounded-2xl font-black text-[15px] text-center bg-[#FAFAFC] text-[#9AA2B1] border border-[#EEF0F4] active:scale-[0.97] transition-all">
                            Piano attuale
                        </Link>
                    )}
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
                        <span className="text-3xl font-black text-[#1C1C1E]">€7,99</span>
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

                    {buttonLoading ? (
                        <div className="w-full py-4 rounded-2xl font-bold text-[15px] text-center bg-[#7B5CF6]/10 text-[#7B5CF6] border border-[#7B5CF6]/20 flex items-center justify-center gap-2">
                            <Loader2 size={16} className="animate-spin" />
                            {syncing === 'activating' ? 'Attivazione in corso...' : 'Verifica...'}
                        </div>
                    ) : isPremium ? (
                        <div className="space-y-3">
                            <div className="w-full py-4 rounded-2xl font-black text-[15px] text-center bg-[#7B5CF6]/15 text-[#7B5CF6] border border-[#7B5CF6]/30">
                                ✦ Piano attuale: Premium
                            </div>

                            {/* Chip scadenza se cancellazione già pianificata */}
                            {cancelingAt && (
                                <div className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-[13px] bg-amber-50 text-amber-600 border border-amber-200">
                                    <Clock size={14} />
                                    Scade il {formatDate(cancelingAt)}
                                </div>
                            )}

                            {/* Bottone portale Stripe — sempre visibile */}
                            <button
                                onClick={handleCancelSubscription}
                                disabled={cancelLoading}
                                className="w-full py-3 rounded-2xl font-bold text-[14px] border border-red-200 text-red-500 hover:bg-red-50 active:scale-[0.97] transition-all disabled:opacity-50"
                            >
                                {cancelLoading
                                    ? 'Reindirizzamento...'
                                    : cancelingAt
                                        ? 'Gestisci abbonamento'
                                        : 'Disdici abbonamento'}
                            </button>

                            {/* Recupero manuale */}
                            <button
                                onClick={handleManualSync}
                                className="w-full flex items-center justify-center gap-1.5 text-[12px] text-[#9AA2B1] font-bold py-2 hover:text-[#7B5CF6] transition-colors"
                            >
                                <RefreshCw size={12} />
                                Non sei abbonata? Aggiorna stato
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={handleUpgrade}
                            disabled={checkoutLoading}
                            className="w-full py-4 rounded-2xl font-black text-[15px] bg-[#7B5CF6] text-white shadow-lg shadow-[#7B5CF6]/30 active:scale-[0.97] transition-all disabled:opacity-60"
                        >
                            {checkoutLoading ? 'Reindirizzamento...' : 'Passa a Premium'}
                        </button>
                    )}
                </div>
            </div>

            <p className="text-xs text-center text-[#9AA2B1] mt-6 font-medium">
                Pagamento sicuro tramite Stripe · Disdici in qualsiasi momento
            </p>
        </div>
    );
};
