'use client'

import React, { useEffect, useRef, useState } from 'react'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'

interface FullscreenViewerProps {
    type: 'images' | 'pdf'
    images?: string[]
    pdfDoc?: any
    totalPages?: number
    initialPage?: number
    onClose: () => void
}

export function FullscreenViewer({ type, images = [], pdfDoc, totalPages = 0, initialPage = 1, onClose }: FullscreenViewerProps) {
    const [page, setPage] = useState(initialPage)
    const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([])
    const containerRef = useRef<HTMLDivElement>(null)

    // Close on Escape
    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [onClose])

    // Prevent body scroll
    useEffect(() => {
        document.body.style.overflow = 'hidden'
        return () => { document.body.style.overflow = '' }
    }, [])

    // Render all PDF pages
    useEffect(() => {
        if (type !== 'pdf' || !pdfDoc) return
        const renderAll = async () => {
            for (let i = 1; i <= totalPages; i++) {
                const canvas = canvasRefs.current[i - 1]
                if (!canvas) continue
                const pg = await pdfDoc.getPage(i)
                const viewport = pg.getViewport({ scale: 1.6 })
                canvas.width = viewport.width
                canvas.height = viewport.height
                const ctx = canvas.getContext('2d')
                if (ctx) await pg.render({ canvasContext: ctx, viewport }).promise
            }
        }
        renderAll()
    }, [pdfDoc, totalPages, type])

    return (
        <div className="fixed inset-0 z-[99999] bg-black flex flex-col" onClick={onClose}>
            {/* Top bar */}
            <div className="flex items-center justify-between px-4 py-3 bg-black/80 flex-shrink-0" onClick={e => e.stopPropagation()}>
                {type === 'images' && (
                    <span className="text-white/60 text-sm font-bold">{page} / {images.length}</span>
                )}
                {type === 'pdf' && (
                    <span className="text-white/60 text-sm font-bold">{totalPages} pagine</span>
                )}
                <button
                    onClick={onClose}
                    className="ml-auto w-10 h-10 flex items-center justify-center text-white bg-white/10 rounded-full active:scale-90 transition-transform"
                >
                    <X size={22} />
                </button>
            </div>

            {/* Content */}
            {type === 'images' && images.length > 0 && (
                <div className="flex-1 relative flex items-center justify-center" onClick={e => e.stopPropagation()}>
                    <img
                        src={images[page - 1]}
                        alt={`Immagine ${page}`}
                        className="max-w-full max-h-full object-contain select-none"
                        draggable={false}
                    />
                    {images.length > 1 && (
                        <>
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page <= 1}
                                className="absolute left-3 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center bg-black/50 text-white rounded-full disabled:opacity-20 active:scale-90 transition-all"
                            >
                                <ChevronLeft size={24} />
                            </button>
                            <button
                                onClick={() => setPage(p => Math.min(images.length, p + 1))}
                                disabled={page >= images.length}
                                className="absolute right-3 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center bg-black/50 text-white rounded-full disabled:opacity-20 active:scale-90 transition-all"
                            >
                                <ChevronRight size={24} />
                            </button>
                        </>
                    )}
                </div>
            )}

            {type === 'pdf' && (
                <div
                    ref={containerRef}
                    className="flex-1 overflow-y-auto flex flex-col items-center gap-4 py-4 px-2"
                    onClick={e => e.stopPropagation()}
                >
                    {Array.from({ length: totalPages }).map((_, i) => (
                        <canvas
                            key={i}
                            ref={el => { canvasRefs.current[i] = el }}
                            className="max-w-full rounded-lg shadow-lg"
                            style={{ maxWidth: '100%', height: 'auto' }}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}
