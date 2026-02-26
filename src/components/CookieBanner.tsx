'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Cookie } from 'lucide-react'
import { useCookieConsent } from '@/hooks/useCookieConsent'
import { CookiePreferencesModal } from './CookiePreferencesModal'

export function CookieBanner() {
    const { loaded, hasDecided, acceptAll, rejectAll, saveCustom, consent } = useCookieConsent()
    const [showModal, setShowModal] = useState(false)

    // Mostra banner solo dopo hydration e solo se l'utente non ha ancora deciso
    if (!loaded || hasDecided) return null

    return (
        <>
            {/* Overlay scuro dietro il banner */}
            <div className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-[9998]" />

            {/* Banner */}
            <div
                role="dialog"
                aria-modal="true"
                aria-label="Informativa sull'uso dei cookie"
                className="fixed bottom-0 left-0 right-0 z-[9999] p-4 animate-in fade-in slide-in-from-bottom-4 duration-400"
            >
                <div className="max-w-2xl mx-auto bg-white rounded-[24px] shadow-2xl shadow-black/15 border border-[#EEF0F4] p-5">
                    {/* Titolo */}
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-9 h-9 rounded-xl bg-[#F4EEFF] flex items-center justify-center flex-shrink-0">
                            <Cookie size={18} className="text-[#7B5CF6]" />
                        </div>
                        <h2 className="text-[15px] font-black text-[#1C1C1E]">
                            Usiamo i cookie
                        </h2>
                    </div>

                    {/* Testo */}
                    <p className="text-[13px] text-[#9AA2B1] font-medium leading-relaxed mb-4">
                        Utilizziamo cookie tecnici necessari al funzionamento del sito e, con il tuo consenso, cookie per funzionalità, analisi e marketing. Puoi accettare tutto, rifiutare i non essenziali o personalizzare le tue scelte.{' '}
                        <Link href="/cookie-policy" className="text-[#7B5CF6] underline font-bold">
                            Cookie Policy
                        </Link>
                        {' '}e{' '}
                        <Link href="/privacy" className="text-[#7B5CF6] underline font-bold">
                            Privacy Policy
                        </Link>.
                    </p>

                    {/* Azioni — accetta e rifiuta hanno stessa prominenza (Garante 2021) */}
                    <div className="flex flex-col gap-2">
                        <div className="flex gap-2">
                            {/* Rifiuta — stessa prominenza di Accetta */}
                            <button
                                onClick={rejectAll}
                                className="flex-1 py-3 rounded-2xl border-2 border-[#EEF0F4] text-sm font-bold text-[#1C1C1E] active:scale-95 transition-transform hover:border-[#7B5CF6]/30"
                            >
                                Rifiuta non essenziali
                            </button>
                            {/* Accetta tutto */}
                            <button
                                onClick={acceptAll}
                                className="flex-1 py-3 lu-btn-primary text-sm active:scale-95 transition-transform"
                            >
                                Accetta tutti
                            </button>
                        </div>

                        {/* Personalizza — link secondario */}
                        <button
                            onClick={() => setShowModal(true)}
                            className="w-full py-2.5 text-sm font-bold text-[#9AA2B1] hover:text-[#7B5CF6] transition-colors"
                        >
                            Personalizza le preferenze
                        </button>
                    </div>
                </div>
            </div>

            {/* Modal preferenze */}
            {showModal && (
                <CookiePreferencesModal
                    current={consent}
                    onSave={(cats) => { saveCustom(cats); setShowModal(false) }}
                    onClose={() => setShowModal(false)}
                />
            )}
        </>
    )
}
