"use client";

import React, { useRef } from "react";
import { Bold, Italic, Underline, List, ListOrdered, Save } from "lucide-react";

interface NotesEditorProps {
    initialHtml: string;
    onSave: (html: string) => void;
}

export const NotesEditor: React.FC<NotesEditorProps> = ({ initialHtml, onSave }) => {
    const editorRef = useRef<HTMLDivElement>(null);

    const execCommand = (command: string, value: string | undefined = undefined) => {
        document.execCommand(command, false, value);
        editorRef.current?.focus();
    };

    return (
        <div className="h-full flex flex-col">
            {/* Toolbar */}
            <div className="flex items-center gap-1.5 p-2 bg-white border border-[#EEF0F4] rounded-2xl mb-4 overflow-x-auto no-scrollbar shadow-sm">
                <button onClick={() => execCommand('bold')} className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-[#F4EEFF] text-[#1C1C1E]"><Bold size={18} /></button>
                <button onClick={() => execCommand('italic')} className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-[#F4EEFF] text-[#1C1C1E]"><Italic size={18} /></button>
                <button onClick={() => execCommand('underline')} className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-[#F4EEFF] text-[#1C1C1E]"><Underline size={18} /></button>
                <div className="w-px h-6 bg-[#EEF0F4] mx-1" />
                <button onClick={() => execCommand('insertUnorderedList')} className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-[#F4EEFF] text-[#1C1C1E]"><List size={18} /></button>
                <button onClick={() => execCommand('insertOrderedList')} className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-[#F4EEFF] text-[#1C1C1E]"><ListOrdered size={18} /></button>
                <button
                    onClick={() => onSave(editorRef.current?.innerHTML || "")}
                    className="ml-auto w-9 h-9 flex items-center justify-center rounded-lg bg-[#7B5CF6] text-white shadow-md active:scale-95 transition-transform"
                >
                    <Save size={18} />
                </button>
            </div>

            {/* Editable Area */}
            <div
                ref={editorRef}
                contentEditable
                dangerouslySetInnerHTML={{ __html: initialHtml }}
                className="flex-1 bg-white border border-[#EEF0F4] rounded-2xl p-6 outline-none focus:border-[#7B5CF6] transition-colors min-h-[300px] text-[#1C1C1E] leading-relaxed prose prose-sm max-w-none"
                data-placeholder="Annota i tuoi progressi qui..."
            />
        </div>
    );
};
