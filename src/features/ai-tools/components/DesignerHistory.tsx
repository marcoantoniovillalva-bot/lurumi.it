'use client'

import React, { useState, useEffect, useTransition } from 'react'
import { Trash2, ImageIcon, ChevronDown, ChevronUp, Expand, Download } from 'lucide-react'
import { FullscreenViewer } from '@/components/FullscreenViewer'
import { getDesignerHistory, deleteDesignerGeneration, type DesignerGeneration } from '../actions/designer'

interface Props {
    refreshTrigger?: number
}

export function DesignerHistory({ refreshTrigger }: Props) {
    const [items, setItems] = useState<DesignerGeneration[]>([])
    const [loading, setLoading] = useState(true)
    const [expanded, setExpanded] = useState(false)
    const [fullscreenIndex, setFullscreenIndex] = useState<number | null>(null)
    const [deletingId, setDeletingId] = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()

    useEffect(() => {
        setLoading(true)
        getDesignerHistory().then(data => {
            setItems(data)
            setLoading(false)
        })
    }, [refreshTrigger])

    const handleDownload = async (e: React.MouseEvent, imageUrl: string) => {
        e.stopPropagation()
        try {
            const res = await fetch(imageUrl)
            const blob = await res.blob()
            const ext = blob.type.includes('png') ? 'png' : blob.type.includes('webp') ? 'webp' : 'jpg'
            const blobUrl = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = blobUrl
            a.download = `lurumi-ispirazione.${ext}`
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            URL.revokeObjectURL(blobUrl)
        } catch {
            window.open(imageUrl, '_blank')
        }
    }

    const handleDelete = (e: React.MouseEvent, id: string) => {
        e.stopPropagation()
        setDeletingId(id)
        startTransition(async () => {
            try {
                await deleteDesignerGeneration(id)
                setItems(prev => prev.filter(i => i.id !== id))
            } catch { /* ignora */ }
            setDeletingId(null)
        })
    }

    if (loading) {
        return (
            <div className="space-y-3">
                <div className="h-5 w-40 bg-[#F4EEFF] rounded-lg animate-pulse" />
                <div className="grid grid-cols-3 gap-2">
                    {[...Array(6)].map((_, i) => (
                        <div key={i} className="aspect-square rounded-xl bg-[#F4EEFF] animate-pulse" />
                    ))}
                </div>
            </div>
        )
    }

    if (items.length === 0) return null

    const visibleItems = expanded ? items : items.slice(0, 3)
    const fullscreenImages = items.map(i => i.imageUrl)

    return (
        <section className="space-y-3">
            <button
                onClick={() => setExpanded(e => !e)}
                className="w-full flex items-center justify-between"
            >
                <h3 className="text-[15px] font-bold text-[#1C1C1E] flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#7B5CF6]" />
                    Le mie creazioni
                    <span className="text-xs font-bold text-[#9AA2B1] bg-[#F4EEFF] px-2 py-0.5 rounded-full">
                        {items.length}
                    </span>
                </h3>
                {expanded
                    ? <ChevronUp size={16} className="text-[#9AA2B1]" />
                    : <ChevronDown size={16} className="text-[#9AA2B1]" />
                }
            </button>

            <div className="grid grid-cols-3 gap-2">
                {visibleItems.map((item, idx) => (
                    <div
                        key={item.id}
                        className="relative aspect-square rounded-xl overflow-hidden bg-[#F4EEFF] cursor-pointer group"
                        onClick={() => setFullscreenIndex(idx)}
                    >
                        <img
                            src={item.imageUrl}
                            alt={item.prompt}
                            className="w-full h-full object-cover"
                            loading="lazy"
                        />
                        {/* Overlay su hover/press */}
                        <div className="absolute inset-0 bg-black/0 group-active:bg-black/20 transition-colors flex items-center justify-center">
                            <Expand size={20} className="text-white opacity-0 group-active:opacity-100 transition-opacity" />
                        </div>
                        {/* Badge HD */}
                        {item.hd && (
                            <span className="absolute top-1.5 left-1.5 bg-[#7B5CF6] text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">
                                HD
                            </span>
                        )}
                        {/* Tasti download + elimina — sempre visibili */}
                        <div className="absolute top-1.5 right-1.5 flex flex-col gap-1">
                            <button
                                onClick={(e) => handleDownload(e, item.imageUrl)}
                                className="bg-black/50 text-white p-1.5 rounded-lg"
                            >
                                <Download size={11} />
                            </button>
                            <button
                                onClick={(e) => handleDelete(e, item.id)}
                                disabled={deletingId === item.id || isPending}
                                className="bg-black/50 text-white p-1.5 rounded-lg disabled:opacity-40"
                            >
                                {deletingId === item.id
                                    ? <div className="w-2.5 h-2.5 border border-white/50 border-t-white rounded-full animate-spin" />
                                    : <Trash2 size={11} />
                                }
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {items.length > 3 && (
                <button
                    onClick={() => setExpanded(e => !e)}
                    className="w-full py-2.5 rounded-xl border border-[#EEF0F4] text-[#9AA2B1] text-sm font-bold hover:bg-[#F4EEFF] hover:text-[#7B5CF6] transition-colors"
                >
                    {expanded ? 'Mostra meno' : `Mostra tutte (${items.length})`}
                </button>
            )}

            {fullscreenIndex !== null && (
                <FullscreenViewer
                    type="images"
                    images={fullscreenImages}
                    initialPage={fullscreenIndex + 1}
                    onClose={() => setFullscreenIndex(null)}
                />
            )}
        </section>
    )
}
