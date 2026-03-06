"use client";

import React from "react";
import { X, ImageOff } from "lucide-react";

interface CounterImagePickerProps {
    imageUrls: string[];          // URL/objectURL di ogni immagine (stesso ordine di project.images)
    imageIds: string[];           // ID corrispondenti
    currentImageId?: string;      // imageId attualmente associato al contatore
    onSelect: (imageId: string) => void;
    onRemove: () => void;
    onClose: () => void;
}

export const CounterImagePicker: React.FC<CounterImagePickerProps> = ({
    imageUrls,
    imageIds,
    currentImageId,
    onSelect,
    onRemove,
    onClose,
}) => {
    return (
        <div
            className="fixed inset-0 z-[10000] flex items-end justify-center bg-black/50"
            onClick={onClose}
        >
            <div
                className="w-full max-w-2xl bg-white rounded-t-[32px] p-6 pb-10 shadow-2xl animate-in slide-in-from-bottom duration-300"
                onClick={e => e.stopPropagation()}
            >
                <div className="w-12 h-1.5 bg-[#EEF0F4] rounded-full mx-auto mb-4" />
                <div className="flex items-center justify-between mb-5">
                    <h3 className="text-xl font-black text-[#1C1C1E]">Associa immagine</h3>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#FAFAFC] border border-[#EEF0F4] text-[#9AA2B1]"
                    >
                        <X size={16} />
                    </button>
                </div>

                {imageUrls.length === 0 ? (
                    <div className="text-center py-10 text-[#9AA2B1]">
                        <ImageOff size={32} className="mx-auto mb-3 opacity-40" />
                        <p className="text-sm font-medium">Nessuna immagine nel progetto</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-3 gap-3 max-h-72 overflow-y-auto">
                        {imageUrls.map((url, i) => {
                            const imgId = imageIds[i]
                            const isSelected = imgId === currentImageId
                            return (
                                <button
                                    key={imgId}
                                    onClick={() => onSelect(imgId)}
                                    className={`relative aspect-square rounded-2xl overflow-hidden border-2 transition-all active:scale-95 ${
                                        isSelected
                                            ? 'border-[#7B5CF6] shadow-[0_0_0_3px_rgba(123,92,246,0.2)]'
                                            : 'border-transparent hover:border-[#D4C5FF]'
                                    }`}
                                >
                                    <img
                                        src={url}
                                        alt={`Immagine ${i + 1}`}
                                        className="w-full h-full object-cover"
                                    />
                                    {isSelected && (
                                        <div className="absolute inset-0 bg-[#7B5CF6]/20 flex items-center justify-center">
                                            <div className="w-6 h-6 bg-[#7B5CF6] rounded-full flex items-center justify-center">
                                                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                                                    <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                                </svg>
                                            </div>
                                        </div>
                                    )}
                                </button>
                            )
                        })}
                    </div>
                )}

                {currentImageId && (
                    <button
                        onClick={onRemove}
                        className="mt-4 w-full h-11 border border-red-200 text-red-500 rounded-2xl font-bold text-sm"
                    >
                        Rimuovi associazione
                    </button>
                )}
            </div>
        </div>
    );
};
