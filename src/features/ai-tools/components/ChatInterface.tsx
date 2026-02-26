'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Send, Camera, ArrowLeft, X, History, MessageSquare, MoreVertical, Pencil, Trash2, Check } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'

interface Message {
    id: string
    text: string
    sender: 'user' | 'ai'
    image?: string
}

interface ChatInterfaceProps {
    title: string
    placeholder?: string
    suggestions?: string[]
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
    title,
    placeholder = "Chiedi a Lurumi...",
    suggestions = []
}) => {
    const { user } = useAuth()
    const sessionId = useRef(Date.now().toString())
    const [messages, setMessages] = useState<Message[]>([])
    const [input, setInput] = useState('')
    const [loading, setLoading] = useState(false)
    const [selectedImage, setSelectedImage] = useState<string | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const messagesEndRef = useRef<HTMLDivElement>(null)

    // History panel
    const [showHistory, setShowHistory] = useState(false)
    const [historySessions, setHistorySessions] = useState<{ id: string; firstMsg: string; created_at: string; count: number }[]>([])
    const [historyLoading, setHistoryLoading] = useState(false)

    // Session rename/delete
    const [sessionTitles, setSessionTitles] = useState<Record<string, string>>({})
    const [sessionMenuId, setSessionMenuId] = useState<string | null>(null)
    const [renamingSessionId, setRenamingSessionId] = useState<string | null>(null)
    const [renameValue, setRenameValue] = useState('')

    const handleSaveRename = async (sid: string) => {
        if (!renameValue.trim() || !user) return
        const supabase = createClient()
        await supabase.from('chat_sessions').upsert({
            id: sid,
            user_id: user.id,
            title: renameValue.trim(),
            tool_type: title,
        })
        setSessionTitles(prev => ({ ...prev, [sid]: renameValue.trim() }))
        setRenamingSessionId(null)
    }

    const handleDeleteSession = async (sid: string) => {
        if (!user) return
        const supabase = createClient()
        await Promise.all([
            supabase.from('chat_messages').delete().eq('session_id', sid).eq('user_id', user.id),
            supabase.from('chat_sessions').delete().eq('id', sid).eq('user_id', user.id),
        ])
        setHistorySessions(prev => prev.filter(s => s.id !== sid))
        setSessionTitles(prev => { const next = { ...prev }; delete next[sid]; return next })
        setSessionMenuId(null)
    }

    const loadHistory = async () => {
        if (!user) return
        setHistoryLoading(true)
        const supabase = createClient()

        try {
            // Carica messaggi e titoli in parallelo
            const [{ data }, { data: titlesData }] = await Promise.all([
                supabase
                    .from('chat_messages')
                    .select('session_id, created_at, message, sender')
                    .eq('user_id', user.id)
                    .eq('tool_type', title)
                    .order('created_at', { ascending: false }),
                supabase
                    .from('chat_sessions')
                    .select('id, title')
                    .eq('user_id', user.id)
                    .eq('tool_type', title),
            ])
            setHistoryLoading(false)
            if (!data) return

            // Mappa titoli personalizzati
            const titlesMap: Record<string, string> = {}
            titlesData?.forEach(s => { titlesMap[s.id] = s.title })
            setSessionTitles(titlesMap)

            // Raggruppa per session_id
            const map: Record<string, { firstMsg: string; created_at: string; count: number }> = {}
            data.forEach(m => {
                if (!map[m.session_id]) {
                    map[m.session_id] = { firstMsg: m.message || '', created_at: m.created_at, count: 0 }
                }
                map[m.session_id].count++
            })
            setHistorySessions(
                Object.entries(map)
                    .map(([id, d]) => ({ id, ...d }))
                    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                    .slice(0, 20)
            )
        } catch (err) {
            console.error('[loadHistory] failed:', err)
            setHistoryLoading(false)
        }
    }

    const loadConversation = async (sid: string) => {
        if (!user) return
        const supabase = createClient()
        const { data } = await supabase
            .from('chat_messages')
            .select('*')
            .eq('session_id', sid)
            .eq('user_id', user.id)
            .order('created_at')
        if (data) {
            setMessages(data.map(m => ({
                id: m.id,
                text: m.message || '',
                sender: m.sender as 'user' | 'ai',
                image: m.image_url || undefined,
            })))
        }
        sessionId.current = sid
        setShowHistory(false)
    }

    // Auto-scroll to bottom on new messages / loading change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages, loading])

    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            const reader = new FileReader()
            reader.onloadend = () => setSelectedImage(reader.result as string)
            reader.readAsDataURL(file)
        }
        e.target.value = ''
    }

    const handleSend = async () => {
        if ((!input.trim() && !selectedImage) || loading) return

        const imageToSend = selectedImage
        const textToSend = input

        const userMsg: Message = {
            id: Date.now().toString(),
            text: textToSend,
            sender: 'user',
            image: imageToSend || undefined
        }
        setMessages(prev => [...prev, userMsg])
        setInput('')
        setSelectedImage(null)
        setLoading(true)

        try {
            // Use API route to avoid Server Action turbo-stream serialization limits
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: textToSend || 'Analizza questa immagine',
                    imageBase64: imageToSend ?? undefined,
                    toolType: title,
                }),
            })
            const result = await res.json()

            if (result.success && result.text) {
                const aiMsg: Message = {
                    id: (Date.now() + 1).toString(),
                    text: result.text,
                    sender: 'ai'
                }
                setMessages(prev => [...prev, aiMsg])

                // Save to Supabase if logged in
                if (user) {
                    const supabase = createClient()
                    supabase.from('chat_messages').insert([
                        { user_id: user.id, session_id: sessionId.current, sender: 'user', message: textToSend || 'Analizza questa immagine', image_url: imageToSend, tool_type: title },
                        { user_id: user.id, session_id: sessionId.current, sender: 'ai', message: result.text, tool_type: title }
                    ]).then(({ error }) => { if (error) console.warn('Chat save failed:', error.message) })
                }
            } else {
                setMessages(prev => [...prev, {
                    id: (Date.now() + 1).toString(),
                    text: `Spiacente, si è verificato un errore: ${result.error || 'Riprova più tardi.'}`,
                    sender: 'ai'
                }])
            }
        } catch (err: any) {
            setMessages(prev => [...prev, {
                id: (Date.now() + 1).toString(),
                text: 'Errore di connessione. Riprova più tardi.',
                sender: 'ai'
            }])
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="relative flex flex-col h-[calc(100dvh-var(--header-h,64px)-env(safe-area-inset-bottom,0px))] max-w-2xl mx-auto bg-[#FAFAFC]" style={{ '--header-h': '64px' } as React.CSSProperties}>
            <div className="px-4 pt-4 border-b border-[#EEF0F4] pb-4 bg-white flex items-center justify-between">
                <Link href="/tools" className="text-[#9AA2B1] hover:text-[#7B5CF6] transition-colors">
                    <ArrowLeft size={22} />
                </Link>
                <h2 className="text-lg font-bold text-[#1C1C1E]">{title}</h2>
                {user ? (
                    <button
                        onClick={() => { setShowHistory(true); loadHistory(); }}
                        className="w-8 h-8 flex items-center justify-center text-[#9AA2B1] hover:text-[#7B5CF6] transition-colors"
                        title="Storico conversazioni"
                    >
                        <History size={20} />
                    </button>
                ) : (
                    <div className="w-8" />
                )}
            </div>

            {/* History overlay */}
            {showHistory && (
                <div className="absolute inset-0 z-50 bg-white flex flex-col max-w-2xl mx-auto">
                    <div className="px-4 pt-4 pb-4 border-b border-[#EEF0F4] flex items-center justify-between">
                        <button onClick={() => setShowHistory(false)} className="text-[#9AA2B1] hover:text-[#7B5CF6] transition-colors">
                            <ArrowLeft size={22} />
                        </button>
                        <h2 className="text-lg font-bold text-[#1C1C1E]">Storico chat</h2>
                        <div className="w-8" />
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
                        {historyLoading && (
                            <div className="text-center py-10 text-[#9AA2B1] text-sm font-medium">Caricamento...</div>
                        )}
                        {!historyLoading && historySessions.length === 0 && (
                            <div className="text-center py-10 text-[#9AA2B1] text-sm font-medium">Nessuna conversazione salvata.</div>
                        )}
                        {historySessions.map(s => (
                            <div key={s.id}>
                                {renamingSessionId === s.id ? (
                                    /* ── Rinomina inline ── */
                                    <div className="bg-[#FAFAFC] border border-[#7B5CF6] rounded-2xl p-4">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 bg-[#F4EEFF] rounded-full flex items-center justify-center flex-shrink-0">
                                                <MessageSquare size={14} className="text-[#7B5CF6]" />
                                            </div>
                                            <input
                                                autoFocus
                                                value={renameValue}
                                                onChange={e => setRenameValue(e.target.value)}
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter') handleSaveRename(s.id)
                                                    if (e.key === 'Escape') setRenamingSessionId(null)
                                                }}
                                                className="flex-1 h-9 px-3 border border-[#E6DAFF] rounded-xl text-sm font-bold outline-none focus:border-[#7B5CF6]"
                                            />
                                            <button onClick={() => handleSaveRename(s.id)} className="text-green-500 p-1 flex-shrink-0">
                                                <Check size={16} />
                                            </button>
                                            <button onClick={() => setRenamingSessionId(null)} className="text-[#9AA2B1] p-1 flex-shrink-0">
                                                <X size={16} />
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    /* ── Riga normale ── */
                                    <div className="flex items-center gap-2 bg-[#FAFAFC] border border-[#EEF0F4] rounded-2xl p-4 hover:border-[#D9B9F9] transition-colors">
                                        <button
                                            onClick={() => loadConversation(s.id)}
                                            className="flex items-start gap-3 flex-1 min-w-0 text-left"
                                        >
                                            <div className="w-8 h-8 bg-[#F4EEFF] rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                                <MessageSquare size={14} className="text-[#7B5CF6]" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[#1C1C1E] font-medium text-sm truncate">
                                                    {sessionTitles[s.id] ?? (s.firstMsg || '(messaggio vuoto)')}
                                                </p>
                                                <p className="text-[#9AA2B1] text-xs mt-0.5">
                                                    {new Date(s.created_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })} · {s.count} messaggi
                                                </p>
                                            </div>
                                        </button>

                                        {/* Three-dots menu */}
                                        <div className="relative flex-shrink-0">
                                            <button
                                                onClick={() => setSessionMenuId(sessionMenuId === s.id ? null : s.id)}
                                                className="w-8 h-8 flex items-center justify-center rounded-lg text-[#9AA2B1] hover:bg-[#F4F4F8] transition-colors"
                                            >
                                                <MoreVertical size={16} />
                                            </button>
                                            {sessionMenuId === s.id && (
                                                <>
                                                    <div className="fixed inset-0 z-10" onClick={() => setSessionMenuId(null)} />
                                                    <div className="absolute right-0 top-9 z-20 bg-white rounded-2xl shadow-xl border border-[#EEF0F4] p-1.5 w-40 animate-in fade-in zoom-in duration-150">
                                                        <button
                                                            onClick={() => {
                                                                setRenamingSessionId(s.id)
                                                                setRenameValue(sessionTitles[s.id] ?? s.firstMsg ?? '')
                                                                setSessionMenuId(null)
                                                            }}
                                                            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm font-bold text-[#1C1C1E] hover:bg-[#F4F4F8] rounded-xl"
                                                        >
                                                            <Pencil size={14} className="text-[#7B5CF6]" />
                                                            Rinomina
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteSession(s.id)}
                                                            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm font-bold text-red-500 hover:bg-red-50 rounded-xl"
                                                        >
                                                            <Trash2 size={14} />
                                                            Elimina
                                                        </button>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
                {messages.length === 0 && !loading && suggestions.length > 0 && (
                    <div className="pt-8 text-center">
                        <div className="inline-flex items-center justify-center w-16 h-16 bg-[#F4EEFF] text-[#7B5CF6] rounded-full mb-4 shadow-sm border border-[#EEF0F4]">
                            <Image src="/images/logo/isotipo.png" width={64} height={64} alt="Lurumi" className="rounded-full object-contain" />
                        </div>
                        <p className="text-[#9AA2B1] text-sm mb-6 max-w-[200px] mx-auto italic">Inizia una conversazione con l'assistente Lurumi.</p>
                        <div className="grid grid-cols-1 gap-2">
                            {suggestions.map((s, i) => (
                                <button
                                    key={i}
                                    onClick={() => setInput(s)}
                                    className="text-left p-3.5 rounded-2xl bg-white border border-[#EEF0F4] text-[#1C1C1E] text-sm font-medium hover:border-[#D9B9F9] transition-all shadow-sm"
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {messages.map((m) => (
                    <div key={m.id} className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] p-4 rounded-2xl shadow-sm space-y-2 ${m.sender === 'user'
                            ? 'bg-[#7B5CF6] text-white rounded-tr-none'
                            : 'bg-white text-[#1C1C1E] border border-[#EEF0F4] rounded-tl-none'
                            }`}>
                            {m.image && (
                                <img src={m.image} alt="Upload" className="w-full h-auto rounded-lg mb-1 shadow-sm border border-white/20" />
                            )}
                            {m.text && <div className="text-[15px] font-medium leading-relaxed">{m.text}</div>}
                        </div>
                    </div>
                ))}

                {/* Typing indicator */}
                {loading && (
                    <div className="flex justify-start">
                        <div className="bg-white border border-[#EEF0F4] rounded-2xl rounded-tl-none px-5 py-4 shadow-sm flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 bg-[#7B5CF6] rounded-full animate-bounce" style={{ animationDelay: '0ms', animationDuration: '0.9s' }} />
                            <span className="w-2.5 h-2.5 bg-[#B39DDB] rounded-full animate-bounce" style={{ animationDelay: '180ms', animationDuration: '0.9s' }} />
                            <span className="w-2.5 h-2.5 bg-[#D9B9F9] rounded-full animate-bounce" style={{ animationDelay: '360ms', animationDuration: '0.9s' }} />
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {selectedImage && (
                <div className="px-4 py-2 bg-white border-t border-[#EEF0F4] flex items-center gap-3">
                    <div className="relative w-14 h-14 rounded-xl overflow-hidden border-2 border-[#7B5CF6] flex-shrink-0">
                        <img src={selectedImage} alt="Preview" className="w-full h-full object-cover" />
                        <button
                            onClick={() => setSelectedImage(null)}
                            className="absolute top-0 right-0 bg-black/60 text-white rounded-bl-lg p-0.5"
                        >
                            <X size={12} />
                        </button>
                    </div>
                    <span className="text-xs font-bold text-[#7B5CF6]">Immagine pronta per l'analisi</span>
                </div>
            )}

            <div className="p-4 bg-white border-t border-[#EEF0F4]">
                <div className="flex items-center gap-2.5">
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleImageSelect}
                        accept="image/*"
                        className="hidden"
                    />
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="w-11 h-11 flex items-center justify-center bg-[#FAFAFC] text-[#9AA2B1] rounded-full border border-[#EEF0F4] hover:text-[#7B5CF6] transition-colors active:scale-90"
                    >
                        <Camera size={20} />
                    </button>
                    <div className="flex-1 relative">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                            placeholder={placeholder}
                            className="w-full h-11 pl-4 pr-12 bg-[#FAFAFC] border border-[#EEF0F4] rounded-full text-[#1C1C1E] text-[15px] focus:outline-none focus:border-[#7B5CF6] transition-colors"
                        />
                        <button
                            onClick={handleSend}
                            disabled={(!input.trim() && !selectedImage) || loading}
                            className={`absolute right-1 top-1 w-9 h-9 flex items-center justify-center rounded-full transition-all ${(input.trim() || selectedImage) && !loading ? 'bg-[#7B5CF6] text-white shadow-lg active:scale-90' : 'bg-transparent text-[#9AA2B1]'}`}
                        >
                            <Send size={18} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
