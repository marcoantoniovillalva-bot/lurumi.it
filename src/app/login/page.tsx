'use client'

import { useState, useTransition } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Mail, Lock, Eye, EyeOff, ArrowRight, ArrowLeft, AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
    const [tab, setTab] = useState<'login' | 'signup'>('login')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [error, setError] = useState('')
    const [message, setMessage] = useState('')
    const [isPending, startTransition] = useTransition()

    // Mostra errore da redirect OAuth (es. ?auth_error=apple)
    useState(() => {
        if (typeof window !== 'undefined' && window.location.search.includes('auth_error')) {
            setError('Accesso social non riuscito. Riprova o usa email e password.')
        }
    })

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setMessage('')
        const supabase = createClient()

        startTransition(async () => {
            if (tab === 'login') {
                const { error } = await supabase.auth.signInWithPassword({ email, password })
                if (error) setError(getErrorMessage(error.message))
                else window.location.href = '/'
            } else {
                const { error } = await supabase.auth.signUp({
                    email,
                    password,
                    options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
                })
                if (error) setError(getErrorMessage(error.message))
                else setMessage('Controlla la tua email per confermare la registrazione!')
            }
        })
    }

    const handleGoogle = () => {
        window.location.href = '/api/auth/google'
    }

    const handleApple = () => {
        window.location.href = '/api/auth/apple'
    }

    return (
        <div className="min-h-screen lu-gradient-header flex flex-col items-center justify-center p-5">
            {/* Brand */}
            <div className="mb-8 text-center">
                <Image
                    src="/images/logo/isologo-horizontal.png"
                    alt="Lurumi"
                    width={220}
                    height={74}
                    className="object-contain mx-auto mb-3"
                    priority
                />
                <p className="text-[#1C1C1E]/50 text-sm font-medium">AI Powered Crafting</p>
            </div>

            {/* Card */}
            <div className="w-full max-w-sm bg-white rounded-[28px] shadow-2xl shadow-black/10 border border-white/60 p-6">
                {/* Tab switcher */}
                <div className="flex bg-[#F4F4F8] rounded-2xl p-1 mb-6">
                    {(['login', 'signup'] as const).map((t) => (
                        <button
                            key={t}
                            onClick={() => { setTab(t); setError(''); setMessage('') }}
                            className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all duration-200 ${
                                tab === t
                                    ? 'bg-white shadow-sm text-[#1C1C1E]'
                                    : 'text-[#9AA2B1] hover:text-[#1C1C1E]'
                            }`}
                        >
                            {t === 'login' ? 'Accedi' : 'Registrati'}
                        </button>
                    ))}
                </div>

                <form onSubmit={handleSubmit} className="space-y-3">
                    {/* Email */}
                    <div className="relative">
                        <Mail size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9AA2B1] pointer-events-none" />
                        <input
                            type="email"
                            placeholder="Email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            required
                            autoComplete="email"
                            className="w-full pl-11 pr-4 py-3.5 bg-[#FAFAFC] border border-[#EEF0F4] rounded-2xl text-sm font-medium text-[#1C1C1E] placeholder-[#C0C7D4] focus:outline-none focus:border-[#7B5CF6] focus:bg-white transition-all"
                        />
                    </div>

                    {/* Password */}
                    <div className="relative">
                        <Lock size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9AA2B1] pointer-events-none" />
                        <input
                            type={showPassword ? 'text' : 'password'}
                            placeholder="Password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            required
                            minLength={6}
                            autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
                            className="w-full pl-11 pr-12 py-3.5 bg-[#FAFAFC] border border-[#EEF0F4] rounded-2xl text-sm font-medium text-[#1C1C1E] placeholder-[#C0C7D4] focus:outline-none focus:border-[#7B5CF6] focus:bg-white transition-all"
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-[#9AA2B1] hover:text-[#7B5CF6] transition-colors"
                        >
                            {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                        </button>
                    </div>

                    {/* Feedback */}
                    {error && (
                        <p className="text-red-500 text-xs font-medium px-1 animate-in fade-in slide-in-from-top-1 duration-200">
                            {error}
                        </p>
                    )}
                    {message && (
                        <p className="text-green-600 text-xs font-medium px-1 animate-in fade-in slide-in-from-top-1 duration-200">
                            {message}
                        </p>
                    )}

                    {/* Submit */}
                    <button
                        type="submit"
                        disabled={isPending}
                        className="w-full lu-btn-primary py-3.5 text-sm flex items-center justify-center gap-2 mt-2 active:scale-95 transition-transform disabled:opacity-60"
                    >
                        {isPending
                            ? <span className="animate-pulse">Caricamento...</span>
                            : (
                                <>
                                    {tab === 'login' ? 'Accedi' : 'Crea account'}
                                    <ArrowRight size={17} />
                                </>
                            )
                        }
                    </button>
                </form>

                {/* Divider */}
                <div className="flex items-center gap-3 my-5">
                    <div className="flex-1 h-px bg-[#EEF0F4]" />
                    <span className="text-xs text-[#9AA2B1] font-medium">oppure</span>
                    <div className="flex-1 h-px bg-[#EEF0F4]" />
                </div>

                {/* Google OAuth */}
                <button
                    onClick={handleGoogle}
                    className="w-full flex items-center justify-center gap-3 py-3.5 bg-white border-2 border-[#EEF0F4] rounded-2xl text-sm font-bold text-[#1C1C1E] active:scale-95 transition-all hover:border-[#7B5CF6]/40 hover:shadow-sm"
                >
                    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
                        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                    </svg>
                    Continua con Google
                </button>

                {/* Apple Sign In */}
                <button
                    onClick={handleApple}
                    className="w-full flex items-center justify-center gap-3 py-3.5 bg-[#1C1C1E] rounded-2xl text-sm font-bold text-white active:scale-95 transition-all hover:opacity-90 mt-2"
                >
                    <svg width="17" height="21" viewBox="0 0 814 1000" aria-hidden="true" fill="white">
                        <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-37.3-166.2-120C12 406.7 0 210.7 0 204.1C0 94.2 68.2 37.3 135.1 37.3c35.7 0 82.4 27.6 111 27.6 27.6 0 80.3-29.4 124.5-29.4 20.3 0 107.8 1.9 163.4 99.5zm-119.7-219.6c-7.7 34.6-25.8 71.9-54.1 100.2-27.6 27.6-71.5 47.9-109.8 47.9-2.6 0-4.5-.6-5.8-1.3-1.3-1.3-1.3-3.2-1.3-5.8 0-32 16.5-70.9 44.8-101.4 27.6-29.4 73.2-52.1 113.3-56 2.6-.6 5.1-.6 5.8-.6 2.6 0 5.1.6 5.8 1.3 1.3 1.3 1.3 3.2 1.3 5.8z"/>
                    </svg>
                    Continua con Apple
                </button>
            </div>

            <p className="mt-6 text-xs text-[#1C1C1E]/40 text-center max-w-xs">
                Accedendo accetti i nostri Termini di Servizio e la Privacy Policy
            </p>

            {/* Back to app without login */}
            <div className="mt-6 w-full max-w-sm">
                <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 mb-3 flex items-start gap-2.5">
                    <AlertTriangle size={15} className="text-amber-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-700 font-medium leading-relaxed">
                        <span className="font-bold">Attenzione:</span> senza accesso i tuoi file vengono salvati solo sul dispositivo corrente e potrebbero andare persi.
                    </p>
                </div>
                <Link
                    href="/"
                    className="w-full flex items-center justify-center gap-2 py-3 text-[#9AA2B1] font-bold text-sm hover:text-[#7B5CF6] transition-colors"
                >
                    <ArrowLeft size={16} />
                    Continua senza accedere
                </Link>
            </div>
        </div>
    )
}

function getErrorMessage(msg: string): string {
    if (msg.includes('Invalid login credentials')) return 'Email o password errati.'
    if (msg.includes('Email not confirmed')) return 'Conferma la tua email prima di accedere.'
    if (msg.includes('User already registered')) return 'Email già registrata. Prova ad accedere.'
    if (msg.includes('Password should be at least')) return 'La password deve avere almeno 6 caratteri.'
    if (msg.includes('rate limit')) return 'Troppi tentativi. Riprova tra qualche minuto.'
    return msg
}
