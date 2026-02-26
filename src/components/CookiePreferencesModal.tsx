'use client'

import { useState } from 'react'
import { X, ShieldCheck, BarChart2, Megaphone, Settings2 } from 'lucide-react'
import type { CookieConsentData } from '@/hooks/useCookieConsent'

interface Props {
    current: CookieConsentData | null
    onSave: (categories: CookieConsentData['categories']) => void
    onClose: () => void
}

const categories = [
    {
        key: 'functional' as const,
        icon: Settings2,
        label: 'Funzionali',
        description:
            'Memorizzano le tue preferenze (tema, lingua, impostazioni) per migliorare l\'esperienza d\'uso. Disabilitandoli, alcune funzionalità potrebbero non funzionare correttamente.',
        required: false,
    },
    {
        key: 'analytics' as const,
        icon: BarChart2,
        label: 'Analitici',
        description:
            'Ci aiutano a capire come usi l\'app per migliorarla. I dati sono aggregati e anonimi. Non vengono usati per identificarti.',
        required: false,
    },
    {
        key: 'marketing' as const,
        icon: Megaphone,
        label: 'Marketing',
        description:
            'Usati per mostrare contenuti e offerte pertinenti ai tuoi interessi. Disabilitandoli potresti vedere comunicazioni meno rilevanti.',
        required: false,
    },
]

export function CookiePreferencesModal({ current, onSave, onClose }: Props) {
    const [prefs, setPrefs] = useState({
        functional: current?.categories.functional ?? false,
        analytics: current?.categories.analytics ?? false,
        marketing: current?.categories.marketing ?? false,
    })

    const toggle = (key: keyof typeof prefs) =>
        setPrefs(p => ({ ...p, [key]: !p[key] }))

    return (
        <div className="fixed inset-0 z-[10001] flex items-end sm:items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative w-full max-w-md bg-white rounded-[28px] shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-300 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-[#EEF0F4]">
                    <div>
                        <h2 className="text-lg font-black text-[#1C1C1E]">Preferenze Cookie</h2>
                        <p className="text-xs text-[#9AA2B1] font-medium mt-0.5">
                            Personalizza le tue scelte
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-9 h-9 flex items-center justify-center rounded-xl bg-[#F4F4F8] text-[#9AA2B1] hover:text-[#1C1C1E] transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="px-6 py-4 max-h-[60vh] overflow-y-auto space-y-3 no-scrollbar">
                    {/* Necessary — always on */}
                    <div className="lu-card p-4">
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3">
                                <div className="w-9 h-9 rounded-xl bg-green-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                                    <ShieldCheck size={18} className="text-green-600" />
                                </div>
                                <div>
                                    <p className="text-sm font-black text-[#1C1C1E]">Tecnici necessari</p>
                                    <p className="text-xs text-[#9AA2B1] font-medium mt-1 leading-relaxed">
                                        Indispensabili per il funzionamento del sito (autenticazione, sicurezza, sessione). Non richiedono consenso ai sensi dell'art. 122 D.Lgs. 196/2003.
                                    </p>
                                </div>
                            </div>
                            {/* Fixed toggle */}
                            <div className="flex-shrink-0 mt-1">
                                <div className="w-11 h-6 bg-green-500 rounded-full flex items-center justify-end px-0.5 opacity-60 cursor-not-allowed">
                                    <div className="w-5 h-5 bg-white rounded-full shadow-sm" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Optional categories */}
                    {categories.map(({ key, icon: Icon, label, description }) => (
                        <div key={key} className="lu-card p-4">
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex items-start gap-3">
                                    <div className="w-9 h-9 rounded-xl bg-[#F4EEFF] flex items-center justify-center flex-shrink-0 mt-0.5">
                                        <Icon size={18} className="text-[#7B5CF6]" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-black text-[#1C1C1E]">{label}</p>
                                        <p className="text-xs text-[#9AA2B1] font-medium mt-1 leading-relaxed">
                                            {description}
                                        </p>
                                    </div>
                                </div>
                                {/* Toggle */}
                                <button
                                    onClick={() => toggle(key)}
                                    className={`flex-shrink-0 mt-1 w-11 h-6 rounded-full transition-colors duration-200 flex items-center px-0.5 ${
                                        prefs[key]
                                            ? 'bg-[#7B5CF6] justify-end'
                                            : 'bg-[#EEF0F4] justify-start'
                                    }`}
                                    role="switch"
                                    aria-checked={prefs[key]}
                                    aria-label={`Abilita cookie ${label}`}
                                >
                                    <div className="w-5 h-5 bg-white rounded-full shadow-sm transition-transform" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Footer */}
                <div className="px-6 pb-6 pt-4 border-t border-[#EEF0F4] flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 rounded-2xl border-2 border-[#EEF0F4] text-sm font-bold text-[#9AA2B1] active:scale-95 transition-transform"
                    >
                        Annulla
                    </button>
                    <button
                        onClick={() => onSave(prefs)}
                        className="flex-1 py-3 lu-btn-primary text-sm active:scale-95 transition-transform"
                    >
                        Salva scelte
                    </button>
                </div>
            </div>
        </div>
    )
}
