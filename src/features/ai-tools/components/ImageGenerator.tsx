'use client'

import React, { useState, useRef, useEffect } from 'react'
import { ArrowLeft, Dice5, Sparkles, Upload, X, Download, Share2, Zap, Crown } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { useUserProfile } from '@/hooks/useUserProfile'
import { AiCreditsBar } from '@/components/AiCreditsBar'

const SUGGESTIONS = [
    'Un coniglietto amigurumi con orecchie lunghe e fiocco rosa',
    'Un orsetto kawaii con maglione a righe colorate',
    'Una borsa all\'uncinetto con motivi floreali estivi',
    'Un cactus amigurumi in vaso tondo stile boho',
    'Una coperta granny square in colori pastello',
]

export const ImageGenerator: React.FC = () => {
    const { user } = useAuth()
    const { aiCredits } = useUserProfile()
    const [aspectRatio, setAspectRatio] = useState('1:1')
    const [prompt, setPrompt] = useState('')
    const [referenceImage, setReferenceImage] = useState<string | null>(null)
    const [generating, setGenerating] = useState(false)
    const [generatedImage, setGeneratedImage] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [showSuggestions, setShowSuggestions] = useState(false)
    const [hdMode, setHdMode] = useState(false)
    const refImageInput = useRef<HTMLInputElement>(null)

    const handleReferenceImage = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        const reader = new FileReader()
        reader.onloadend = () => setReferenceImage(reader.result as string)
        reader.readAsDataURL(file)
    }

    const handleGenerate = async () => {
        if (!prompt.trim()) { setError('Inserisci una descrizione prima di generare.'); return }
        setGenerating(true)
        setError(null)
        try {
            const res = await fetch('/api/generate-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt,
                    aspectRatio,
                    referenceImageBase64: referenceImage ?? undefined,
                    hd: hdMode,
                }),
            })
            const result = await res.json()
            if (result.success && result.imageUrl) {
                setGeneratedImage(result.imageUrl)
            } else {
                setError(
                    res.status === 429
                        ? result.error || 'Troppe richieste. Aspetta qualche secondo prima di riprovare.'
                        : result.creditsExhausted
                            ? `Crediti AI esauriti. ${result.error}`
                            : result.error || 'Errore durante la generazione'
                )
            }
        } catch (err: any) {
            setError(err.message || 'Errore di connessione')
        } finally {
            setGenerating(false)
        }
    }

    const handleDownload = async () => {
        if (!generatedImage) return
        try {
            const res = await fetch(generatedImage)
            const blob = await res.blob()
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = 'lurumi-ispirazione.webp'
            a.click()
            URL.revokeObjectURL(url)
        } catch {
            // fallback: apri in nuova tab
            window.open(generatedImage, '_blank')
        }
    }

    const handleShare = async () => {
        if (!generatedImage) return
        try {
            const res = await fetch(generatedImage)
            const blob = await res.blob()
            const file = new File([blob], 'lurumi-ispirazione.webp', { type: blob.type || 'image/webp' })
            if (navigator.canShare?.({ files: [file] })) {
                await navigator.share({ files: [file], title: 'Lurumi Design' })
            } else if (navigator.share) {
                await navigator.share({ title: 'Lurumi - Ispirazione', url: generatedImage })
            } else {
                await navigator.clipboard.writeText(generatedImage)
                alert('Link copiato negli appunti!')
            }
        } catch (e: any) {
            if (e?.name !== 'AbortError') {
                await navigator.clipboard.writeText(generatedImage).catch(() => {})
                alert('Link copiato negli appunti!')
            }
        }
    }

    return (
        <div className="flex flex-col min-h-screen bg-white pb-36">
            <div className="px-4 pt-4">
                <Link href="/tools" className="inline-flex items-center gap-2 text-[#9AA2B1] font-bold text-sm hover:text-[#7B5CF6] transition-colors">
                    <ArrowLeft size={18} />
                    Torna agli Utensili
                </Link>
            </div>

            <div className="p-4 space-y-6">
                <header>
                    <h1 className="text-3xl font-black mb-1">Designer AI</h1>
                    <p className="text-[#9AA2B1] text-sm">Genera immagini di ispirazione per il tuo uncinetto</p>
                </header>

                {user && aiCredits && (
                    <AiCreditsBar credits={aiCredits} />
                )}

                {error && (
                    <div className="bg-red-50 border border-red-100 p-4 rounded-2xl text-red-600 text-sm font-bold animate-in fade-in">
                        {error}
                    </div>
                )}

                {generating && (
                    <div className="rounded-2xl border border-[#EEF0F4] bg-[#F4EEFF] flex flex-col items-center justify-center gap-5 py-16 animate-in fade-in duration-300">
                        <div className="relative w-20 h-20">
                            <div className="absolute inset-0 rounded-2xl overflow-hidden border-2 border-[#7B5CF6]/20 p-2">
                                <img src="/images/logo/isotipo.png" alt="Lurumi" className="w-full h-full object-contain opacity-80" />
                            </div>
                            <div className="absolute inset-0 rounded-2xl border-4 border-[#7B5CF6] border-t-transparent animate-spin" />
                        </div>
                        <div className="text-center space-y-1">
                            <p className="font-black text-[#7B5CF6] text-base">Creando la tua ispirazione...</p>
                            <p className="text-[#9AA2B1] text-sm">Può richiedere qualche secondo</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 bg-[#7B5CF6] rounded-full animate-bounce" style={{ animationDelay: '0ms', animationDuration: '0.9s' }} />
                            <span className="w-2 h-2 bg-[#B39DDB] rounded-full animate-bounce" style={{ animationDelay: '180ms', animationDuration: '0.9s' }} />
                            <span className="w-2 h-2 bg-[#D9B9F9] rounded-full animate-bounce" style={{ animationDelay: '360ms', animationDuration: '0.9s' }} />
                        </div>
                    </div>
                )}

                {generatedImage && !generating && (
                    <div className="space-y-3 animate-in fade-in zoom-in duration-300">
                        <div className="rounded-2xl overflow-hidden shadow-lg border border-[#EEF0F4]">
                            <img src={generatedImage} alt="Ispirazione generata" className="w-full h-auto" />
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={handleDownload}
                                className="flex-1 flex items-center justify-center gap-2 py-3 bg-[#F4EEFF] text-[#7B5CF6] rounded-2xl font-bold text-sm active:scale-95 transition-transform"
                            >
                                <Download size={18} />
                                Scarica
                            </button>
                            <button
                                onClick={handleShare}
                                className="flex-1 flex items-center justify-center gap-2 py-3 bg-white border border-[#EEF0F4] text-[#1C1C1E] rounded-2xl font-bold text-sm active:scale-95 transition-transform"
                            >
                                <Share2 size={18} />
                                Condividi
                            </button>
                        </div>
                    </div>
                )}

                {/* Prompt + reference image */}
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#EEF0F4] focus-within:border-[#7B5CF6]/50 transition-all">
                    {referenceImage && (
                        <div className="flex items-center gap-3 mb-3 pb-3 border-b border-[#FAFAFC]">
                            <div className="relative w-14 h-14 rounded-xl overflow-hidden border-2 border-[#7B5CF6] flex-shrink-0">
                                <img src={referenceImage} alt="Riferimento" className="w-full h-full object-cover" />
                                <button
                                    onClick={() => setReferenceImage(null)}
                                    className="absolute top-0 right-0 bg-black/50 text-white p-0.5 rounded-bl-lg"
                                >
                                    <X size={12} />
                                </button>
                            </div>
                            <p className="text-xs font-bold text-[#7B5CF6]">Immagine di riferimento caricata</p>
                        </div>
                    )}
                    <textarea
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        className="w-full bg-transparent border-none focus:outline-none text-[#1C1C1E] text-[15px] leading-relaxed resize-none h-28"
                        placeholder="Progetta un modello all'uncinetto estivo in stile Granny Square..."
                    />
                    <div className="flex items-center justify-between pt-2 border-t border-[#FAFAFC]">
                        <div className="flex items-center gap-2">
                            <input ref={refImageInput} type="file" accept="image/*" onChange={handleReferenceImage} className="hidden" />
                            <button
                                onClick={() => refImageInput.current?.click()}
                                className="flex items-center gap-1.5 text-[#9AA2B1] text-[13px] font-bold px-3 py-1.5 bg-[#FAFAFC] rounded-full hover:bg-[#F4EEFF] hover:text-[#7B5CF6] transition-colors"
                            >
                                <Upload size={14} />
                                Riferimento
                            </button>
                        </div>
                        <div className="relative">
                            <button
                                onClick={() => setShowSuggestions(s => !s)}
                                className="flex items-center gap-1.5 text-[#7B5CF6] text-[13px] font-bold px-3 py-1.5 bg-[#F4EEFF] rounded-full hover:bg-[#EAE7FB] transition-colors"
                            >
                                <Dice5 size={16} />
                                Suggerimenti
                            </button>
                            {showSuggestions && (
                                <>
                                    <div className="fixed inset-0 z-10" onClick={() => setShowSuggestions(false)} />
                                    <div className="absolute right-0 bottom-10 z-20 bg-white rounded-2xl shadow-xl border border-[#EEF0F4] p-2 w-72 space-y-1">
                                        {SUGGESTIONS.map((s, i) => (
                                            <button
                                                key={i}
                                                onClick={() => { setPrompt(s); setShowSuggestions(false); }}
                                                className="w-full text-left p-2.5 rounded-xl text-sm font-medium text-[#1C1C1E] hover:bg-[#F4EEFF] transition-colors"
                                            >
                                                {s}
                                            </button>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Qualità immagine */}
                <section className="space-y-3">
                    <h3 className="text-[15px] font-bold text-[#1C1C1E] flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#7B5CF6]" />
                        Qualità
                    </h3>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setHdMode(false)}
                            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 text-sm font-bold transition-all ${!hdMode ? 'border-[#7B5CF6] bg-[#F4EEFF] text-[#7B5CF6]' : 'border-[#EEF0F4] bg-white text-[#9AA2B1]'}`}
                        >
                            <Zap size={15} />
                            Veloce <span className="text-[11px] opacity-70">8 crediti</span>
                        </button>
                        <button
                            onClick={() => setHdMode(true)}
                            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 text-sm font-bold transition-all ${hdMode ? 'border-[#7B5CF6] bg-[#F4EEFF] text-[#7B5CF6]' : 'border-[#EEF0F4] bg-white text-[#9AA2B1]'}`}
                        >
                            <Crown size={15} />
                            HD <span className="text-[11px] opacity-70">20 crediti</span>
                        </button>
                    </div>
                    {hdMode && (
                        <p className="text-[11px] text-[#9AA2B1] font-medium px-1">
                            {referenceImage
                                ? 'Modalità HD con riferimento — mantiene la somiglianza al personaggio con più dettagli e qualità superiore.'
                                : 'Modalità HD usa DALL-E 3 — qualità superiore, dettagli del filato più realistici.'}
                        </p>
                    )}
                </section>

                {/* Formato immagine */}
                <section className="space-y-3">
                    <h3 className="text-[15px] font-bold text-[#1C1C1E] flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#7B5CF6]" />
                        Formato Immagine
                    </h3>
                    <div className="flex gap-2">
                        {['1:1', '2:3', '3:2'].map((ratio) => (
                            <button
                                key={ratio}
                                onClick={() => setAspectRatio(ratio)}
                                className={`flex-1 py-3 rounded-xl border-2 text-sm font-bold transition-all ${aspectRatio === ratio ? 'border-[#7B5CF6] bg-[#F4EEFF] text-[#7B5CF6]' : 'border-[#EEF0F4] bg-white text-[#9AA2B1]'}`}
                            >
                                {ratio}
                            </button>
                        ))}
                    </div>
                </section>
            </div>

            {/* Floating Generate Button */}
            <div className="fixed bottom-[calc(90px+env(safe-area-inset-bottom))] left-0 right-0 p-4 z-[9999] bg-gradient-to-t from-white via-white/80 to-transparent pt-10">
                <button
                    onClick={handleGenerate}
                    disabled={generating}
                    className={`w-full max-w-xl mx-auto py-4 rounded-2xl font-black text-[17px] shadow-2xl active:scale-95 transition-all text-white flex items-center justify-center gap-2 pointer-events-auto ${generating ? 'bg-[#D9B9F9] cursor-not-allowed' : 'bg-[#7B5CF6] shadow-[0_12px_24px_rgba(123,92,246,0.35)]'}`}
                >
                    {generating ? (
                        <><div className="animate-spin rounded-full h-5 w-5 border-2 border-white/30 border-t-white" />{hdMode ? 'Generazione HD in corso...' : 'Generazione in corso...'}</>
                    ) : (
                        <><Sparkles size={20} />Genera {hdMode ? 'HD' : 'Ispirazione'}<span className="text-[13px] opacity-75 ml-1">({hdMode ? 20 : 8} crediti)</span></>
                    )}
                </button>
            </div>
        </div>
    )
}
