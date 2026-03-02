"use client";

import React, { useState, useRef } from "react";
import { Minus, Plus, MoreVertical, Pencil, Trash2, Check, X, Image, X as XIcon } from "lucide-react";

interface RoundCounterProps {
    id: string;
    name: string;
    value: number;
    imageId?: string;
    imageUrl?: string;      // URL/objectURL dell'immagine associata (caricata dal parent)
    onIncrement: (id: string) => void;
    onDecrement: (id: string) => void;
    onRename: (id: string, newName: string) => void;
    onDelete: (id: string) => void;
    onAssociateImage: (id: string) => void;   // apre il picker
    onRemoveImage: (id: string) => void;
}

export const RoundCounter: React.FC<RoundCounterProps> = ({
    id,
    name,
    value,
    imageId,
    imageUrl,
    onIncrement,
    onDecrement,
    onRename,
    onDelete,
    onAssociateImage,
    onRemoveImage,
}) => {
    const [showMenu, setShowMenu] = useState(false);
    const [isRenaming, setIsRenaming] = useState(false);
    const [renameValue, setRenameValue] = useState(name);
    const [showFullscreen, setShowFullscreen] = useState(false);
    const lastTapRef = useRef(0);

    const handleSaveRename = () => {
        if (!renameValue.trim()) return;
        onRename(id, renameValue.trim());
        setIsRenaming(false);
    };

    const handleThumbnailDoubleTap = (e: React.TouchEvent) => {
        const now = Date.now();
        if (now - lastTapRef.current < 300) {
            e.preventDefault();
            setShowFullscreen(true);
        }
        lastTapRef.current = now;
    };

    return (
        <>
            <div className="bg-white border border-[#D9F3E0] rounded-2xl p-4 shadow-sm">
                {/* Header */}
                <div className="flex items-center justify-between gap-2 mb-3">
                    {/* Thumbnail a sinistra del nome */}
                    {imageUrl && (
                        <button
                            className="flex-shrink-0 w-12 h-12 rounded-xl overflow-hidden border-2 border-[#D9F3E0] active:scale-95 transition-transform"
                            onDoubleClick={() => setShowFullscreen(true)}
                            onTouchEnd={handleThumbnailDoubleTap}
                            title="Doppio click per schermo intero"
                        >
                            <img src={imageUrl} alt="Immagine associata" className="w-full h-full object-cover" />
                        </button>
                    )}

                    <div className="flex-1 min-w-0">
                        {isRenaming ? (
                            <div className="flex items-center gap-2">
                                <input
                                    autoFocus
                                    value={renameValue}
                                    onChange={e => setRenameValue(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter') handleSaveRename();
                                        if (e.key === 'Escape') setIsRenaming(false);
                                    }}
                                    className="flex-1 h-8 px-2 border border-[#7B5CF6] rounded-lg text-sm font-bold outline-none"
                                />
                                <button onClick={handleSaveRename} className="text-green-500 flex-shrink-0">
                                    <Check size={15} />
                                </button>
                                <button onClick={() => setIsRenaming(false)} className="text-[#9AA2B1] flex-shrink-0">
                                    <X size={15} />
                                </button>
                            </div>
                        ) : (
                            <span className="font-bold text-[#8187A1] text-sm truncate block">{name}</span>
                        )}
                    </div>

                    {!isRenaming && (
                        <div className="relative flex-shrink-0">
                            <button
                                onClick={() => setShowMenu(m => !m)}
                                className="w-8 h-8 flex items-center justify-center rounded-lg border border-[#EEF0F4] bg-white text-[#9599AA] active:bg-[#F4EEFF]"
                            >
                                <MoreVertical size={16} />
                            </button>
                            {showMenu && (
                                <>
                                    <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                                    <div className="absolute right-0 top-9 z-20 bg-white rounded-2xl shadow-xl border border-[#EEF0F4] p-1.5 w-48 animate-in fade-in zoom-in duration-150">
                                        <button
                                            onClick={() => { setRenameValue(name); setIsRenaming(true); setShowMenu(false); }}
                                            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm font-bold text-[#1C1C1E] hover:bg-[#F4F4F8] rounded-xl"
                                        >
                                            <Pencil size={14} className="text-[#7B5CF6]" />
                                            Rinomina
                                        </button>
                                        <button
                                            onClick={() => { onAssociateImage(id); setShowMenu(false); }}
                                            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm font-bold text-[#1C1C1E] hover:bg-[#F4F4F8] rounded-xl"
                                        >
                                            <Image size={14} className="text-[#7B5CF6]" />
                                            {imageId ? 'Cambia immagine' : 'Associa immagine'}
                                        </button>
                                        {imageId && (
                                            <button
                                                onClick={() => { onRemoveImage(id); setShowMenu(false); }}
                                                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm font-bold text-orange-500 hover:bg-orange-50 rounded-xl"
                                            >
                                                <XIcon size={14} />
                                                Rimuovi immagine
                                            </button>
                                        )}
                                        <button
                                            onClick={() => { onDelete(id); setShowMenu(false); }}
                                            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm font-bold text-red-500 hover:bg-red-50 rounded-xl"
                                        >
                                            <Trash2 size={14} />
                                            Elimina
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>

                {/* Counter */}
                <div className="flex items-center justify-center gap-6">
                    <button
                        onClick={() => onDecrement(id)}
                        className="w-11 h-11 flex items-center justify-center bg-[#F1E9FF] border border-[#E6DAFF] rounded-full text-[#7B5CF6] active:scale-95 transition-transform"
                    >
                        <Minus size={18} />
                    </button>
                    <span className="text-2xl font-black text-[#1C1C1E] min-w-[2ch] text-center">{value}</span>
                    <button
                        onClick={() => onIncrement(id)}
                        className="w-11 h-11 flex items-center justify-center bg-[#F1E9FF] border border-[#E6DAFF] rounded-full text-[#7B5CF6] active:scale-95 transition-transform"
                    >
                        <Plus size={18} />
                    </button>
                </div>
            </div>

            {/* Fullscreen overlay — doppio click thumbnail */}
            {showFullscreen && imageUrl && (
                <div
                    className="fixed inset-0 z-[20000] bg-black flex flex-col"
                    onClick={() => setShowFullscreen(false)}
                >
                    {/* Header responsive — gestisce nomi lunghi su tutti i dispositivi */}
                    <div className="flex items-start gap-3 px-4 sm:px-6 pt-6 pb-4">
                        {/* Giro (nome scritto nella card) — cresce e tronca se troppo lungo */}
                        <div className="flex-1 min-w-0">
                            <p className="text-white/60 text-[10px] sm:text-xs font-bold uppercase tracking-widest mb-0.5">Giro</p>
                            <p className="text-white font-black text-base sm:text-lg leading-snug break-words">{name}</p>
                        </div>
                        {/* Contatore (valore numerico) + chiudi — sempre visibili, no shrink */}
                        <div className="flex items-center gap-3 flex-shrink-0">
                            <div className="text-right">
                                <p className="text-white/60 text-[10px] sm:text-xs font-bold uppercase tracking-widest mb-0.5">Contatore</p>
                                <p className="text-white font-black text-2xl sm:text-3xl leading-none">{value}</p>
                            </div>
                            <button
                                onClick={() => setShowFullscreen(false)}
                                className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-2xl bg-white/10 text-white flex-shrink-0"
                            >
                                <XIcon size={18} />
                            </button>
                        </div>
                    </div>
                    {/* Immagine — occupa tutto lo spazio restante, min-h-0 permette al flex di shrinkare correttamente */}
                    <div
                        className="flex-1 min-h-0 flex items-center justify-center p-4 sm:p-8"
                        onClick={e => e.stopPropagation()}
                    >
                        <img
                            src={imageUrl}
                            alt={name}
                            className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl"
                        />
                    </div>
                    <p className="text-white/30 text-xs text-center pb-8 font-medium">Tocca fuori per chiudere</p>
                </div>
            )}
        </>
    );
};
