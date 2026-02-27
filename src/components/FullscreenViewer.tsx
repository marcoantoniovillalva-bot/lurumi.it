'use client'

import React, { useEffect, useRef, useState, useCallback } from 'react'
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
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const renderTaskRef = useRef<any>(null)
    const touchStartXRef = useRef<number | null>(null)

    // Close on Escape, prevent body scroll
    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
        window.addEventListener('keydown', handler)
        document.body.style.overflow = 'hidden'
        return () => {
            window.removeEventListener('keydown', handler)
            document.body.style.overflow = ''
        }
    }, [onClose])

    // Render la pagina corrente del PDF — cancella il render precedente prima di iniziarne uno nuovo
    const renderPdfPage = useCallback(async (pageNum: number) => {
        if (!pdfDoc || !canvasRef.current) return

        // Cancella render in corso
        if (renderTaskRef.current) {
            try { renderTaskRef.current.cancel() } catch {}
            renderTaskRef.current = null
        }

        try {
            const pg = await pdfDoc.getPage(pageNum)
            const canvas = canvasRef.current
            if (!canvas) return

            const containerWidth = canvas.parentElement?.clientWidth ?? window.innerWidth
            const scale = Math.min((containerWidth - 32) / pg.getViewport({ scale: 1 }).width, 2.5)
            const viewport = pg.getViewport({ scale })

            canvas.width = viewport.width
            canvas.height = viewport.height

            const ctx = canvas.getContext('2d')!
            const task = pg.render({ canvasContext: ctx, viewport })
            renderTaskRef.current = task
            await task.promise
            renderTaskRef.current = null
        } catch (e: any) {
            // 'Rendering cancelled' è normale durante la navigazione rapida
            if (e?.name !== 'RenderingCancelledException') {
                console.warn('FullscreenViewer render error:', e?.message)
            }
        }
    }, [pdfDoc])

    useEffect(() => {
        if (type === 'pdf') renderPdfPage(page)
    }, [type, page, renderPdfPage])

    // Cleanup: cancella render quando il viewer si smonta
    useEffect(() => {
        return () => {
            if (renderTaskRef.current) {
                try { renderTaskRef.current.cancel() } catch {}
            }
        }
    }, [])

    const goTo = (n: number) => setPage(Math.max(1, Math.min(totalPages || images.length, n)))

    const handleTouchStart = (e: React.TouchEvent) => { touchStartXRef.current = e.touches[0].clientX }
    const handleTouchEnd = (e: React.TouchEvent) => {
        if (touchStartXRef.current === null) return
        const diff = touchStartXRef.current - e.changedTouches[0].clientX
        if (Math.abs(diff) > 50) goTo(diff > 0 ? page + 1 : page - 1)
        touchStartXRef.current = null
    }

    const total = type === 'pdf' ? totalPages : images.length

    return (
        <div className="fixed inset-0 z-[99999] bg-black flex flex-col">
            {/* Top bar */}
            <div className="flex items-center justify-between px-4 py-3 bg-black/80 flex-shrink-0">
                <span className="text-white/60 text-sm font-bold">{page} / {total}</span>
                <button
                    onClick={onClose}
                    className="w-10 h-10 flex items-center justify-center text-white bg-white/10 rounded-full active:scale-90 transition-transform"
                >
                    <X size={22} />
                </button>
            </div>

            {/* Content */}
            <div
                className="flex-1 relative flex items-center justify-center overflow-hidden"
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
            >
                {/* PDF */}
                {type === 'pdf' && (
                    <div className="w-full h-full flex items-center justify-center overflow-auto px-2 py-2">
                        <canvas
                            ref={canvasRef}
                            className="max-w-full rounded-lg shadow-lg"
                            style={{ height: 'auto' }}
                        />
                    </div>
                )}

                {/* Images */}
                {type === 'images' && images.length > 0 && (
                    <img
                        src={images[page - 1]}
                        alt={`Immagine ${page}`}
                        className="max-w-full max-h-full object-contain select-none"
                        draggable={false}
                    />
                )}

                {/* Frecce navigazione (PDF e immagini) */}
                {total > 1 && (
                    <>
                        <button
                            onClick={() => goTo(page - 1)}
                            disabled={page <= 1}
                            className="absolute left-3 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center bg-black/50 text-white rounded-full disabled:opacity-20 active:scale-90 transition-all z-10"
                        >
                            <ChevronLeft size={24} />
                        </button>
                        <button
                            onClick={() => goTo(page + 1)}
                            disabled={page >= total}
                            className="absolute right-3 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center bg-black/50 text-white rounded-full disabled:opacity-20 active:scale-90 transition-all z-10"
                        >
                            <ChevronRight size={24} />
                        </button>
                    </>
                )}
            </div>
        </div>
    )
}
