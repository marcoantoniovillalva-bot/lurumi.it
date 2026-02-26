"use client";

import React, { useState, useEffect, useRef } from "react";
import {
    ArrowLeft, Minus, Plus, RotateCcw, Timer, Share2,
    ChevronLeft, ChevronRight, StickyNote, Trash2,
    Plus as PlusIcon, Camera, Save, Maximize2, Archive
} from "lucide-react";
import { useProjectStore, Project, RoundCounter as RoundCounterType, ProjectImage } from "@/features/projects/store/useProjectStore";
import { luDB } from "@/lib/db";
import { useParams } from "next/navigation";
import Link from "next/link";
import { RoundCounter } from "@/features/projects/components/RoundCounter";
import { FullscreenViewer } from "@/components/FullscreenViewer";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export default function ProjectDetail() {
    const { id } = useParams();
    const { projects, updateProject } = useProjectStore();
    const { user } = useAuth();
    const project = projects.find(p => p.id === id);

    const syncProject = (fields: Record<string, unknown>) => {
        if (!user || !id) return;
        const supabase = createClient();
        supabase.from('projects')
            .update(fields)
            .eq('id', id)
            .eq('user_id', user.id)
            .then(({ error }) => { if (error) console.warn('project sync failed:', error.message); });
    };

    const syncSecs = (newSecs: RoundCounterType[]) => syncProject({ secs: newSecs });

    const [pdfDoc, setPdfDoc] = useState<any>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(0);
    const [isTimerRunning, setIsTimerRunning] = useState(false);
    const [elapsedTime, setElapsedTime] = useState(0);
    const [isEditingNotes, setIsEditingNotes] = useState(false);
    const [notes, setNotes] = useState("");
    const [showNewCounterModal, setShowNewCounterModal] = useState(false);
    const [newCounterName, setNewCounterName] = useState("");
    const [fullscreen, setFullscreen] = useState(false);
    const [hintVisible, setHintVisible] = useState(true);
    // Image data URLs loaded from IndexedDB (NOT stored in Zustand/localStorage)
    const [imageUrls, setImageUrls] = useState<string[]>([]);

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const elapsedRef = useRef(0);

    useEffect(() => {
        if (!project) return;
        setElapsedTime(project.timer || 0);
        elapsedRef.current = project.timer || 0;
        setNotes(project.notesHtml || "");

        const loadContent = async () => {
            try {
                if (project.type === 'pdf') {
                    const dbRecord = await luDB.getFile(id as string);
                    if (dbRecord?.blob) {
                        const pdfjsLib = await import('pdfjs-dist/build/pdf.mjs');
                        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
                        const doc = await pdfjsLib.getDocument({ data: await dbRecord.blob.arrayBuffer() }).promise;
                        setPdfDoc(doc);
                        setTotalPages(doc.numPages);
                    }
                } else {
                    // Load all images from IndexedDB by their stored IDs
                    const imgs = project.images ?? [];
                    const urls: string[] = [];
                    for (const img of imgs) {
                        const record = await luDB.getFile(img.id);
                        if (record?.blob) {
                            urls.push(URL.createObjectURL(record.blob));
                        } else if (img.dataURL) {
                            urls.push(img.dataURL); // fallback for legacy data
                        }
                    }
                    setImageUrls(urls);
                    setTotalPages(urls.length);
                }
            } catch (err) {
                console.error("Failed to load project content", err);
            }
        };
        loadContent();

        const t = setTimeout(() => setHintVisible(false), 4000);
        return () => clearTimeout(t);
    }, [id, project?.type]);

    useEffect(() => {
        if (!pdfDoc || !canvasRef.current || project?.type !== 'pdf') return;
        const renderPage = async () => {
            const page = await pdfDoc.getPage(currentPage);
            const viewport = page.getViewport({ scale: 1.3 });
            const canvas = canvasRef.current!;
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            await page.render({ canvasContext: context!, viewport }).promise;
        };
        renderPage();
    }, [pdfDoc, currentPage, project?.type]);

    // Timer — sync to store + Supabase every 5s
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isTimerRunning) {
            interval = setInterval(() => {
                elapsedRef.current += 1;
                setElapsedTime(elapsedRef.current);
                if (elapsedRef.current % 5 === 0) {
                    updateProject(id as string, { timer: elapsedRef.current });
                    syncProject({ timer_seconds: elapsedRef.current });
                }
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [isTimerRunning, id, updateProject]); // eslint-disable-line react-hooks/exhaustive-deps

    if (!project) return <div className="p-10 text-center font-bold">Progetto non trovato</div>;

    const formatTime = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return [h, m, s].map(v => String(v).padStart(2, '0')).join(':');
    };

    const handleAddImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        // Save blob to IndexedDB — NOT as base64 in Zustand/localStorage
        const imgId = `${project.id}_img_${Date.now()}`;
        await luDB.saveFile({ id: imgId, blob: file });
        const objectUrl = URL.createObjectURL(file);
        const updatedImages = [...(project.images || []), { id: imgId }];
        updateProject(project.id, { images: updatedImages });
        setImageUrls(prev => [...prev, objectUrl]);
        setTotalPages(updatedImages.length);
    };

    const handleDeleteCurrentImage = async () => {
        if (!project.images || project.images.length === 0) return;
        if (!confirm("Eliminare questa immagine?")) return;
        const imgId = project.images[currentPage - 1]?.id;
        if (imgId && imgId !== project.id) {
            luDB.deleteFile(imgId).catch(() => {}); // delete from IDB (keep main file)
        }
        const updatedImages = project.images.filter((_, i) => i !== (currentPage - 1));
        updateProject(project.id, { images: updatedImages });
        setImageUrls(prev => prev.filter((_, i) => i !== (currentPage - 1)));
        setTotalPages(updatedImages.length);
        setCurrentPage(p => Math.max(1, Math.min(updatedImages.length, p)));
    };

    const handleSaveNotes = () => {
        updateProject(project.id, { notesHtml: notes });
        syncProject({ notes_html: notes });
        setIsEditingNotes(false);
    };

    const handleExportZip = async () => {
        const { zipSync, strToU8 } = await import('fflate');
        const infoLines = [
            `Progetto: ${project.title}`,
            `Creato: ${new Date(project.createdAt).toLocaleDateString('it-IT')}`,
            `Timer: ${formatTime(project.timer)}`,
            `Giri principali: ${project.counter}`,
            project.secs.length > 0
                ? `Giri secondari: ${project.secs.map(s => `${s.name}: ${s.value}`).join(', ')}`
                : '',
            project.notesHtml ? `Note: ${project.notesHtml}` : '',
            '',
            'Made with lurumi.it',
        ].filter(Boolean).join('\n');

        const files: Record<string, Uint8Array> = {
            'info.txt': strToU8(infoLines),
        };

        try {
            const record = await luDB.getFile(id as string);
            if (record?.blob) {
                const buf = await record.blob.arrayBuffer();
                const ext = project.type === 'pdf' ? 'pdf' : 'jpg';
                files[`progetto.${ext}`] = new Uint8Array(buf);
            }
        } catch {}

        const zipped = zipSync(files);
        const blob = new Blob([zipped.buffer as ArrayBuffer], { type: 'application/zip' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${project.title.replace(/[^a-zA-Z0-9]/g, '-')}.zip`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="max-w-2xl mx-auto px-4 pt-6 pb-20 bg-[#FAFAFC] min-h-screen">
            {fullscreen && (
                <FullscreenViewer
                    type={project.type === 'pdf' ? 'pdf' : 'images'}
                    images={imageUrls}
                    pdfDoc={pdfDoc}
                    totalPages={totalPages}
                    initialPage={currentPage}
                    onClose={() => setFullscreen(false)}
                />
            )}

            {/* Nav */}
            <div className="flex items-center justify-between mb-6">
                <Link href="/" className="w-10 h-10 flex items-center justify-center bg-white border border-[#EEF0F4] rounded-xl text-[#9AA2B1] active:scale-95 transition-transform">
                    <ArrowLeft size={20} />
                </Link>
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setIsTimerRunning(r => !r)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-full font-black text-xs shadow-sm transition-all ${isTimerRunning ? 'bg-red-50 text-red-500 border border-red-100' : 'bg-[#F4EEFF] text-[#7B5CF6]'}`}
                        >
                            <Timer size={14} strokeWidth={3} />
                            <span>{formatTime(elapsedTime)}</span>
                        </button>
                        <button
                            onClick={() => {
                                setIsTimerRunning(false);
                                setElapsedTime(0);
                                elapsedRef.current = 0;
                                updateProject(id as string, { timer: 0 });
                                syncProject({ timer_seconds: 0 });
                            }}
                            className="w-7 h-7 flex items-center justify-center text-[#9AA2B1] hover:text-red-400 active:scale-90 transition-all"
                            title="Azzera timer"
                        >
                            <RotateCcw size={13} strokeWidth={3} />
                        </button>
                    </div>
                    <button
                        onClick={handleExportZip}
                        className="w-10 h-10 flex items-center justify-center bg-white border border-[#EEF0F4] rounded-xl text-[#7B5CF6] active:scale-95 transition-transform shadow-sm"
                        title="Esporta ZIP"
                    >
                        <Archive size={20} />
                    </button>
                </div>
            </div>

            <header className="mb-6">
                <h1 className="text-3xl font-black text-[#1C1C1E] mb-1">{project.title}</h1>
                <p className="text-[#9AA2B1] text-sm font-bold uppercase tracking-widest">
                    {project.type === 'pdf' ? 'Pattern PDF' : 'Galleria Immagini'}
                </p>
            </header>

            {/* Main Counter — più compatto su mobile */}
            <div className="bg-white rounded-xl md:rounded-2xl p-2 md:p-4 shadow-[0_12px_40px_rgba(0,0,0,0.03)] border border-[#EEF0F4] text-center mb-6">
                <p className="text-[10px] md:text-[11px] font-black text-[#9AA2B1] uppercase tracking-[0.2em] mb-1 md:mb-2">Contatore Principale</p>
                <div className="text-[28px] md:text-[48px] font-black text-[#1C1C1E] leading-none mb-2 md:mb-4 tracking-tighter">{project.counter}</div>
                <div className="flex items-center justify-center gap-4 md:gap-6">
                    <button
                        onClick={() => {
                            const v = Math.max(0, project.counter - 1);
                            updateProject(project.id, { counter: v });
                            syncProject({ counter: v });
                        }}
                        className="w-6 h-6 md:w-9 md:h-9 flex items-center justify-center bg-[#FAFAFC] border border-[#EEF0F4] rounded-lg text-[#1C1C1E] active:scale-90 transition-transform"
                    >
                        <Minus size={12} strokeWidth={3} />
                    </button>
                    <button
                        onClick={() => {
                            const v = project.counter + 1;
                            updateProject(project.id, { counter: v });
                            syncProject({ counter: v });
                        }}
                        className="w-9 h-9 md:w-14 md:h-14 flex items-center justify-center bg-[#7B5CF6] text-white rounded-[12px] md:rounded-[18px] shadow-[0_6px_14px_rgba(123,92,246,0.3)] active:scale-95 transition-transform"
                    >
                        <Plus size={16} strokeWidth={3} />
                    </button>
                    <button
                        onClick={() => {
                            updateProject(project.id, { counter: 0 });
                            syncProject({ counter: 0 });
                        }}
                        className="w-6 h-6 md:w-9 md:h-9 flex items-center justify-center bg-[#FAFAFC] border border-[#EEF0F4] rounded-lg text-[#9AA2B1] active:scale-90 transition-transform"
                    >
                        <RotateCcw size={10} strokeWidth={3} />
                    </button>
                </div>
            </div>

            {/* Viewer */}
            <div className="bg-white rounded-[32px] border border-[#EEF0F4] overflow-hidden shadow-sm mb-8">
                {/* Toolbar — no zoom buttons */}
                <div className="p-3 bg-white border-b border-[#EEF0F4] flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                        <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} className="w-9 h-9 flex items-center justify-center bg-[#FAFAFC] rounded-lg text-[#1C1C1E] active:scale-90 transition-all">
                            <ChevronLeft size={20} strokeWidth={3} />
                        </button>
                        <span className="text-[13px] font-black text-[#1C1C1E] bg-[#FAFAFC] px-3 py-1.5 rounded-lg border border-[#EEF0F4]">
                            {currentPage} / {totalPages || 1}
                        </span>
                        <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} className="w-9 h-9 flex items-center justify-center bg-[#FAFAFC] rounded-lg text-[#1C1C1E] active:scale-90 transition-all">
                            <ChevronRight size={20} strokeWidth={3} />
                        </button>
                    </div>
                    <div className="flex items-center gap-2">
                        {project.type !== 'pdf' && (
                            <>
                                <input type="file" ref={fileInputRef} onChange={handleAddImage} className="hidden" accept="image/*" />
                                <button onClick={() => fileInputRef.current?.click()} className="w-9 h-9 flex items-center justify-center bg-[#F4EEFF] text-[#7B5CF6] rounded-lg">
                                    <PlusIcon size={18} strokeWidth={3} />
                                </button>
                                <button onClick={handleDeleteCurrentImage} className="w-9 h-9 flex items-center justify-center bg-red-50 text-red-500 rounded-lg">
                                    <Trash2 size={18} strokeWidth={3} />
                                </button>
                            </>
                        )}
                        <button
                            onClick={() => setFullscreen(true)}
                            className="w-9 h-9 flex items-center justify-center bg-[#FAFAFC] text-[#9AA2B1] hover:text-[#7B5CF6] rounded-lg transition-colors"
                            title="Apri a schermo intero"
                        >
                            <Maximize2 size={18} />
                        </button>
                    </div>
                </div>

                {/* Content — double click to fullscreen */}
                <div
                    className="overflow-auto bg-[#FAFAFC] flex justify-center relative cursor-pointer"
                    onDoubleClick={() => setFullscreen(true)}
                >
                    {project.type === 'pdf' ? (
                        <canvas ref={canvasRef} className="max-w-full h-auto shadow-sm" />
                    ) : (
                        <div className="w-full flex items-center justify-center p-4">
                            {imageUrls.length > 0 ? (
                                <img
                                    src={imageUrls[currentPage - 1] || project.thumbDataURL}
                                    alt="Project"
                                    className="max-w-full object-contain shadow-2xl rounded-2xl"
                                />
                            ) : (
                                <div className="text-center p-12">
                                    <div className="w-16 h-16 bg-[#F4EEFF] rounded-2xl flex items-center justify-center mx-auto mb-4 text-[#7B5CF6]">
                                        <Camera size={32} />
                                    </div>
                                    <p className="text-[#9AA2B1] font-bold text-sm">Nessuna immagine</p>
                                </div>
                            )}
                        </div>
                    )}
                    {/* Hint */}
                    {hintVisible && (imageUrls.length > 0 || pdfDoc) && (
                        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/50 text-white text-xs font-bold px-3 py-1.5 rounded-full pointer-events-none animate-in fade-in">
                            Doppio click per schermo intero
                        </div>
                    )}
                </div>
            </div>

            {/* Secondary Counters */}
            <div className="mb-8">
                <div className="flex items-center justify-between mb-4 px-2">
                    <h2 className="text-xl font-black text-[#1C1C1E]">Contatori Giri</h2>
                    <button
                        onClick={() => { setNewCounterName(""); setShowNewCounterModal(true); }}
                        className="bg-[#7B5CF6]/10 text-[#7B5CF6] px-3 py-1.5 rounded-xl font-black text-xs flex items-center gap-2"
                    >
                        <PlusIcon size={14} strokeWidth={3} />
                        NUOVO
                    </button>
                </div>
                <div className="flex flex-col gap-3">
                    {project.secs.map(sec => (
                        <RoundCounter
                            key={sec.id}
                            {...sec}
                            onIncrement={(sid) => {
                                const updated = project.secs.map(s => s.id === sid ? { ...s, value: s.value + 1 } : s);
                                updateProject(project.id, { secs: updated });
                                syncSecs(updated);
                            }}
                            onDecrement={(sid) => {
                                const updated = project.secs.map(s => s.id === sid ? { ...s, value: Math.max(1, s.value - 1) } : s);
                                updateProject(project.id, { secs: updated });
                                syncSecs(updated);
                            }}
                            onRename={(sid, newName) => {
                                const updated = project.secs.map(s => s.id === sid ? { ...s, name: newName } : s);
                                updateProject(project.id, { secs: updated });
                                syncSecs(updated);
                            }}
                            onDelete={(sid) => {
                                const updated = project.secs.filter(s => s.id !== sid);
                                updateProject(project.id, { secs: updated });
                                syncSecs(updated);
                            }}
                        />
                    ))}
                    {project.secs.length === 0 && (
                        <div className="text-center p-6 bg-[#FAFAFC] rounded-2xl border border-dashed border-[#EEF0F4] text-[#9AA2B1] text-sm font-medium">
                            Nessun contatore secondario aggiunto
                        </div>
                    )}
                </div>
            </div>

            {/* Modal nuovo contatore */}
            {showNewCounterModal && (
                <div className="fixed inset-0 z-[10000] flex items-end justify-center bg-black/40" onClick={() => setShowNewCounterModal(false)}>
                    <div className="w-full max-w-2xl bg-white rounded-t-[32px] p-6 pb-10 shadow-2xl animate-in slide-in-from-bottom duration-300" onClick={e => e.stopPropagation()}>
                        <div className="w-12 h-1.5 bg-[#EEF0F4] rounded-full mx-auto mb-6" />
                        <h3 className="text-2xl font-black mb-4">Nuovo Contatore</h3>
                        <input
                            autoFocus
                            type="text"
                            placeholder="Nome del contatore (es. Giro Manica)..."
                            value={newCounterName}
                            onChange={e => setNewCounterName(e.target.value)}
                            onKeyDown={e => {
                                if (e.key === 'Enter' && newCounterName.trim()) {
                                    const updated = [...project.secs, { id: Date.now().toString(), name: newCounterName.trim(), value: 1 }];
                                    updateProject(project.id, { secs: updated });
                                    syncSecs(updated);
                                    setShowNewCounterModal(false);
                                }
                            }}
                            className="w-full h-12 px-4 bg-[#FAFAFC] border border-[#E6DAFF] rounded-xl outline-none focus:border-[#7B5CF6] font-medium mb-4"
                        />
                        <div className="flex gap-3">
                            <button onClick={() => setShowNewCounterModal(false)} className="flex-1 h-12 bg-white border border-[#EEF0F4] rounded-2xl font-bold text-[#9AA2B1]">Annulla</button>
                            <button
                                onClick={() => {
                                    if (!newCounterName.trim()) return;
                                    const updated = [...project.secs, { id: Date.now().toString(), name: newCounterName.trim(), value: 1 }];
                                    updateProject(project.id, { secs: updated });
                                    syncSecs(updated);
                                    setShowNewCounterModal(false);
                                }}
                                className="flex-[2] h-12 bg-[#7B5CF6] text-white rounded-2xl font-bold shadow-lg"
                            >
                                Crea
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Notes */}
            <div className="bg-white rounded-[32px] p-6 border border-[#EEF0F4] shadow-sm mb-10">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2 text-[#7B5CF6]">
                        <StickyNote size={20} strokeWidth={3} />
                        <h3 className="font-black text-sm uppercase tracking-widest">Note di Lavoro</h3>
                    </div>
                    {isEditingNotes ? (
                        <button onClick={handleSaveNotes} className="flex items-center gap-1.5 text-green-500 font-bold text-xs uppercase">
                            <Save size={14} /> Salva
                        </button>
                    ) : (
                        <button onClick={() => setIsEditingNotes(true)} className="text-[#9AA2B1] font-bold text-xs uppercase hover:text-[#7B5CF6]">
                            Modifica
                        </button>
                    )}
                </div>
                {isEditingNotes ? (
                    <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        autoFocus
                        className="w-full h-32 bg-[#FAFAFC] rounded-2xl p-4 text-[#1C1C1E] font-medium text-sm focus:outline-none border border-[#EEF0F4]"
                        placeholder="Scrivi qui le tue annotazioni, filati usati o modifiche allo schema..."
                    />
                ) : (
                    <div className="text-sm font-medium text-[#1C1C1E] leading-relaxed whitespace-pre-wrap">
                        {project.notesHtml || <span className="text-[#9AA2B1] italic">Nessuna nota salvata per questo progetto.</span>}
                    </div>
                )}
            </div>
        </div>
    );
}
