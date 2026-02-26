"use client";

import React, { useState } from "react";
import { Minus, Plus, MoreVertical, Pencil, Trash2, Check, X } from "lucide-react";

interface RoundCounterProps {
    id: string;
    name: string;
    value: number;
    onIncrement: (id: string) => void;
    onDecrement: (id: string) => void;
    onRename: (id: string, newName: string) => void;
    onDelete: (id: string) => void;
}

export const RoundCounter: React.FC<RoundCounterProps> = ({
    id,
    name,
    value,
    onIncrement,
    onDecrement,
    onRename,
    onDelete,
}) => {
    const [showMenu, setShowMenu] = useState(false);
    const [isRenaming, setIsRenaming] = useState(false);
    const [renameValue, setRenameValue] = useState(name);

    const handleSaveRename = () => {
        if (!renameValue.trim()) return;
        onRename(id, renameValue.trim());
        setIsRenaming(false);
    };

    return (
        <div className="bg-white border border-[#D9F3E0] rounded-2xl p-4 shadow-sm">
            {/* Header */}
            <div className="flex items-center justify-between gap-2 mb-3">
                {isRenaming ? (
                    <div className="flex items-center gap-2 flex-1">
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
                    <span className="font-bold text-[#8187A1] text-sm truncate flex-1">{name}</span>
                )}

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
                                <div className="absolute right-0 top-9 z-20 bg-white rounded-2xl shadow-xl border border-[#EEF0F4] p-1.5 w-40 animate-in fade-in zoom-in duration-150">
                                    <button
                                        onClick={() => { setRenameValue(name); setIsRenaming(true); setShowMenu(false); }}
                                        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm font-bold text-[#1C1C1E] hover:bg-[#F4F4F8] rounded-xl"
                                    >
                                        <Pencil size={14} className="text-[#7B5CF6]" />
                                        Rinomina
                                    </button>
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
    );
};
