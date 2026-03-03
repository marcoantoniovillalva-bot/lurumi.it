"use client";

import React, { useRef, useState, useEffect } from "react";
import { Search, ListFilter, Plus, MoreVertical, Pencil, Trash2, Share2, Check, X, ExternalLink } from "lucide-react";
import { useProjectStore, Project } from "@/features/projects/store/useProjectStore";
import { luDB } from "@/lib/db";
import Link from "next/link";
import { SocialBar } from "@/components/SocialBar";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { loadPdfjs } from "@/lib/pdfjs";
import { useCharacterTheme } from "@/hooks/useCharacterTheme";

function EmptyProjectsState() {
  const { getUrl } = useCharacterTheme();
  return (
    <div className="flex flex-col items-center justify-center pt-10 pb-12 text-center">
      <img
        src={getUrl('projects_empty')}
        alt="Inizia un progetto"
        className="w-40 h-40 object-contain mb-4 animate-character-float"
        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
        suppressHydrationWarning
      />
      <h3 className="text-xl font-black text-[#1C1C1E] mb-2">Cominciamo un progetto?</h3>
      <p className="text-[#9AA2B1] text-sm max-w-[240px] font-medium leading-relaxed">
        Carica un pattern o un'immagine per iniziare a creare oggi stesso.
      </p>
    </div>
  );
}

export default function Home() {
  const { projects, addProject, deleteProject, updateProject } = useProjectStore();
  const { user } = useAuth();
  const { getUrl } = useCharacterTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  // Realtime: sincronizza lista progetti da altri dispositivi/tab
  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`projects-list-${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'projects', filter: `user_id=eq.${user.id}` }, (payload) => {
        if (!payload.new?.id) return;
        const p = payload.new as Record<string, any>;
        const exists = useProjectStore.getState().projects.some(x => x.id === p.id);
        if (!exists) {
          addProject({
            id: p.id, title: p.title,
            type: (p.type ?? 'pdf') as 'pdf' | 'images',
            kind: (p.type === 'pdf' ? 'pdf' : 'image') as 'pdf' | 'image',
            createdAt: p.created_at ? new Date(p.created_at).getTime() : Date.now(),
            size: p.size ?? 0, counter: p.counter ?? 0, timer: p.timer_seconds ?? 0,
            secs: p.secs ?? [], notesHtml: p.notes_html ?? '',
            thumbDataURL: p.thumb_url ?? undefined,
            url: p.file_url ?? undefined,
            images: (p.images ?? []).map((img: any) => ({ id: typeof img === 'string' ? img : (img.id ?? '') })),
          });
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'projects', filter: `user_id=eq.${user.id}` }, (payload) => {
        if (!payload.new?.id) return;
        const p = payload.new as Record<string, any>;
        updateProject(p.id, {
          title: p.title,
          counter: p.counter ?? 0,
          timer: p.timer_seconds ?? 0,
          secs: p.secs ?? [],
          notesHtml: p.notes_html ?? '',
          // Sincronizza anche url e thumbnail — fondamentali per PDF su secondo dispositivo
          url: p.file_url ?? undefined,
          thumbDataURL: p.thumb_url ?? undefined,
          images: (p.images ?? []).map((img: any) => ({ id: typeof img === 'string' ? img : (img.id ?? '') })),
        });
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'projects' }, (payload) => {
        if (!payload.old?.id) return;
        deleteProject(payload.old.id);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pending file waiting for name
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingName, setPendingName] = useState('');
  const [pendingThumb, setPendingThumb] = useState('');

  // Search + sort
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [sortOrder, setSortOrder] = useState<'recent' | 'oldest' | 'alpha'>('recent');
  const [showSortMenu, setShowSortMenu] = useState(false);

  // Three-dots menu
  const [menuId, setMenuId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [canvaConnected, setCanvaConnected] = useState(false);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    supabase.from('profiles').select('canva_token').eq('id', user.id).single().then(({ data }) => {
      setCanvaConnected(!!(data as any)?.canva_token);
    });
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Small 120px JPEG thumbnail — avoids localStorage quota issues
  const generateThumbnail = (file: File): Promise<string> =>
    new Promise((resolve) => {
      const img = new window.Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const maxDim = 120;
        const scale = Math.min(maxDim / img.width, maxDim / img.height, 1);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.src = url;
    });

  // Genera thumbnail dalla prima pagina di un PDF (120px max)
  const generatePdfThumbnail = async (file: File): Promise<string> => {
    try {
      const pdfjsLib = await loadPdfjs();
      const arrayBuffer = await file.arrayBuffer();
      const doc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const page = await doc.getPage(1);
      const maxDim = 120;
      const viewport = page.getViewport({ scale: 1 });
      const scale = Math.min(maxDim / viewport.width, maxDim / viewport.height);
      const scaled = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(scaled.width);
      canvas.height = Math.round(scaled.height);
      await page.render({ canvasContext: canvas.getContext('2d')!, viewport: scaled }).promise;
      return canvas.toDataURL('image/jpeg', 0.7);
    } catch {
      return '';
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    const isPdf = file.type === "application/pdf";
    const isImage = file.type.startsWith("image/");
    if (!isPdf && !isImage) { alert("Carica solo PDF o Immagini"); return; }

    let thumb = '';
    if (isImage) thumb = await generateThumbnail(file);
    else if (isPdf) thumb = await generatePdfThumbnail(file);

    setPendingFile(file);
    setPendingName(file.name.replace(/\.[^/.]+$/, ''));
    setPendingThumb(thumb);
  };

  const handleCreateProject = async () => {
    if (!pendingFile || !pendingName.trim()) return;
    const file = pendingFile;
    const isPdf = file.type === "application/pdf";
    const isImage = file.type.startsWith("image/");
    const id = Math.random().toString(36).slice(2, 9);

    const newProject: Project = {
      id,
      title: pendingName.trim(),
      type: isPdf ? 'pdf' : 'images',
      kind: isPdf ? 'pdf' : 'image',
      createdAt: Date.now(),
      size: file.size,
      counter: 0,
      timer: 0,
      secs: [],
      notesHtml: "",
      thumbDataURL: pendingThumb,
      images: isImage ? [{ id }] : [] // blob stored in IDB; dataURL excluded from localStorage
    };

    try {
      await luDB.saveFile({ id, blob: file });
      addProject(newProject);

      // Sync to Supabase in background if logged in
      if (user) {
        const storagePath = `${user.id}/${id}/main`;
        supabase.storage.from('project-files').upload(storagePath, file, { upsert: true })
          .then(({ error: storageErr }) => {
            if (storageErr) { console.warn('Storage upload failed:', storageErr.message); return; }
            const { data: { publicUrl } } = supabase.storage.from('project-files').getPublicUrl(storagePath);
            supabase.from('projects').upsert({
              id,
              user_id: user.id,
              title: newProject.title,
              type: newProject.type,
              file_url: publicUrl,
              thumb_url: newProject.thumbDataURL ?? null,
              size: newProject.size,
              counter: 0,
              timer_seconds: 0,
              notes_html: '',
              secs: [],
              images: newProject.images ?? [],
            }).then(({ error }) => { if (error) console.warn('Project upsert failed:', error.message); });
          });
      }
    } catch (err) {
      console.error("Save to IDB failed", err);
    }

    setPendingFile(null);
    setPendingName('');
    setPendingThumb('');
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Eliminare questo progetto?')) return;
    deleteProject(id);
    try { await luDB.deleteFile(id); } catch {}
    setMenuId(null);

    // Sync delete to Supabase in background
    if (user) {
      supabase.storage.from('project-files').remove([`${user.id}/${id}/main`]).catch(() => {});
      supabase.from('projects').delete().eq('id', id).eq('user_id', user.id).then(({ error }) => {
        if (error) console.warn('Project delete failed:', error.message);
      });
    }
  };

  const startRename = (project: Project) => {
    setRenamingId(project.id);
    setRenameValue(project.title);
    setMenuId(null);
  };

  const saveRename = (id: string) => {
    if (!renameValue.trim()) return;
    const newTitle = renameValue.trim();
    updateProject(id, { title: newTitle });
    setRenamingId(null);

    if (user) {
      supabase.from('projects').update({ title: newTitle }).eq('id', id).eq('user_id', user.id).then(({ error }) => {
        if (error) console.warn('Project rename sync failed:', error.message);
      });
    }
  };

  const handleShare = (project: Project) => {
    if (navigator.share) {
      navigator.share({ title: project.title, text: `Progetto Lurumi: ${project.title}` });
    } else {
      navigator.clipboard.writeText(project.title);
      alert('Nome progetto copiato!');
    }
    setMenuId(null);
  };

  const sortLabels: Record<string, string> = { recent: 'Recenti', oldest: 'Meno recenti', alpha: 'A → Z' };

  const displayed = projects
    .filter(p => p.title.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      if (sortOrder === 'alpha') return a.title.localeCompare(b.title);
      if (sortOrder === 'oldest') return a.createdAt - b.createdAt;
      return b.createdAt - a.createdAt;
    });

  return (
    <div className="max-w-2xl mx-auto px-4 pt-6 pb-36 lg:pb-20">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <img
            src={getUrl('welcome')}
            alt="Benvenuta"
            className="w-14 h-14 object-contain animate-character-bounce flex-shrink-0"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
            suppressHydrationWarning
          />
          <div>
            <h1 className="text-3xl font-black text-[#1C1C1E] mb-1">Progetti</h1>
            <p className="text-[#9AA2B1] text-sm font-medium">I tuoi lavori attivi</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setShowSearch(s => !s); if (showSearch) setSearchQuery(''); }}
            className={`w-10 h-10 flex items-center justify-center border rounded-xl transition-all active:scale-90 ${showSearch ? 'bg-[#7B5CF6] border-[#7B5CF6] text-white' : 'bg-white border-[#EEF0F4] text-[#9AA2B1]'}`}
          >
            <Search size={20} />
          </button>
          <div className="relative">
            <button
              onClick={() => setShowSortMenu(s => !s)}
              className="w-10 h-10 flex items-center justify-center bg-white border border-[#EEF0F4] rounded-xl text-[#9AA2B1] transition-transform active:scale-90"
            >
              <ListFilter size={20} />
            </button>
            {showSortMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowSortMenu(false)} />
                <div className="absolute right-0 top-12 z-20 bg-white rounded-2xl shadow-xl border border-[#EEF0F4] p-1.5 w-44 animate-in fade-in zoom-in duration-150">
                  {(['recent', 'oldest', 'alpha'] as const).map(opt => (
                    <button
                      key={opt}
                      onClick={() => { setSortOrder(opt); setShowSortMenu(false); }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-bold rounded-xl transition-colors ${sortOrder === opt ? 'bg-[#F4EEFF] text-[#7B5CF6]' : 'text-[#1C1C1E] hover:bg-[#F4F4F8]'}`}
                    >
                      {sortLabels[opt]}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Search bar */}
      {showSearch && (
        <div className="relative mb-4 animate-in fade-in slide-in-from-top-2 duration-200">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7B5CF6]" size={18} />
          <input
            autoFocus
            type="text"
            placeholder="Cerca progetto..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full h-11 pl-10 pr-10 bg-white border border-[#E6DAFF] rounded-xl outline-none focus:border-[#7B5CF6] transition-colors font-medium text-[#1C1C1E]"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center text-[#9AA2B1]">
              <X size={16} />
            </button>
          )}
        </div>
      )}

      {/* Name dialog */}
      {pendingFile && (
        <div className="fixed inset-0 z-[10000] flex items-end justify-center bg-black/40" onClick={() => setPendingFile(null)}>
          <div className="w-full max-w-2xl bg-white rounded-t-[32px] p-6 pb-10 shadow-2xl animate-in slide-in-from-bottom duration-300" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-1.5 bg-[#EEF0F4] rounded-full mx-auto mb-6" />
            <h3 className="text-2xl font-black mb-2">Dai un nome al progetto</h3>
            <p className="text-[#9AA2B1] text-sm mb-5">Puoi cambiarlo in qualsiasi momento.</p>
            {pendingThumb && (
              <div className="w-20 h-20 rounded-2xl overflow-hidden mb-4 border border-[#EEF0F4]">
                <img src={pendingThumb} alt="" className="w-full h-full object-cover" />
              </div>
            )}
            <input
              autoFocus
              type="text"
              value={pendingName}
              onChange={e => setPendingName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreateProject()}
              className="w-full h-12 px-4 bg-[#FAFAFC] border border-[#E6DAFF] rounded-xl outline-none focus:border-[#7B5CF6] font-medium mb-5 text-[#1C1C1E]"
            />
            <div className="flex gap-3">
              <button onClick={() => setPendingFile(null)} className="flex-1 h-13 py-3.5 bg-white border border-[#EEF0F4] rounded-2xl font-bold text-[#9AA2B1]">Annulla</button>
              <button onClick={handleCreateProject} className="flex-[2] h-13 py-3.5 bg-[#7B5CF6] text-white rounded-2xl font-bold shadow-lg shadow-[#7B5CF6]/30 active:scale-95 transition-transform">Crea Progetto</button>
            </div>
          </div>
        </div>
      )}

      {/* Projects grid */}
      {displayed.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {displayed.map((project) => (
            <div
              key={project.id}
              className="flex items-center gap-4 bg-white p-3 rounded-[24px] shadow-sm border border-[#EEF0F4] animate-in fade-in slide-in-from-bottom-2 duration-300 active:scale-[0.98] transition-all"
            >
              <Link href={`/projects/${project.id}`} className="flex-1 flex items-center gap-4 min-w-0">
                <div className="w-16 h-16 rounded-2xl bg-[#F4EEFF] flex-shrink-0 overflow-hidden flex items-center justify-center">
                  {project.thumbDataURL ? (
                    <img src={project.thumbDataURL} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xs font-bold text-[#7B5CF6] uppercase">{project.type}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  {renamingId === project.id ? (
                    <div className="flex items-center gap-1.5" onClick={e => e.preventDefault()}>
                      <input
                        autoFocus
                        value={renameValue}
                        onChange={e => setRenameValue(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') saveRename(project.id); if (e.key === 'Escape') setRenamingId(null); }}
                        className="flex-1 h-7 px-2 border border-[#7B5CF6] rounded-lg text-sm font-bold outline-none"
                      />
                      <button onClick={() => saveRename(project.id)} className="text-green-500 p-1"><Check size={14} /></button>
                      <button onClick={() => setRenamingId(null)} className="text-[#9AA2B1] p-1"><X size={14} /></button>
                    </div>
                  ) : (
                    <>
                      <h3 className="text-[17px] font-bold text-[#1C1C1E] truncate mb-0.5">{project.title}</h3>
                      <p className="text-[12px] font-bold text-[#9AA2B1] uppercase tracking-widest flex items-center gap-2">
                        {new Date(project.createdAt).toLocaleDateString('it-IT')}
                        <span className="w-1 h-1 rounded-full bg-[#EEF0F4]" />
                        {project.counter} giri
                      </p>
                    </>
                  )}
                </div>
              </Link>

              {/* Three-dots menu */}
              <div className="relative flex-shrink-0">
                <button
                  onClick={() => setMenuId(menuId === project.id ? null : project.id)}
                  className="w-9 h-9 flex items-center justify-center rounded-xl bg-[#FAFAFC] text-[#9AA2B1] hover:text-[#1C1C1E] transition-colors"
                >
                  <MoreVertical size={18} />
                </button>
                {menuId === project.id && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setMenuId(null)} />
                    <div className="absolute right-0 top-10 z-20 bg-white rounded-2xl shadow-xl border border-[#EEF0F4] p-1.5 w-44 animate-in fade-in zoom-in duration-150">
                      <button
                        onClick={() => startRename(project)}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-bold text-[#1C1C1E] hover:bg-[#F4F4F8] rounded-xl"
                      >
                        <Pencil size={15} className="text-[#7B5CF6]" />
                        Rinomina
                      </button>
                      <button
                        onClick={() => handleShare(project)}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-bold text-[#1C1C1E] hover:bg-[#F4F4F8] rounded-xl"
                      >
                        <Share2 size={15} className="text-[#7B5CF6]" />
                        Condividi
                      </button>
                      {canvaConnected && (
                        <Link
                          href={`/projects/${project.id}?canvaExport=1`}
                          onClick={() => setMenuId(null)}
                          className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-bold text-[#008B8F] hover:bg-[#00C4CC]/10 rounded-xl"
                        >
                          <ExternalLink size={15} className="text-[#00C4CC]" />
                          Esporta su Canva
                        </Link>
                      )}
                      <div className="h-px bg-[#F4F4F8] my-1" />
                      <button
                        onClick={() => handleDelete(project.id)}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-bold text-red-500 hover:bg-red-50 rounded-xl"
                      >
                        <Trash2 size={15} />
                        Elimina
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : searchQuery ? (
        <div className="flex flex-col items-center justify-center pt-10 pb-12 text-center">
          <p className="text-[#9AA2B1] font-bold text-sm">Nessun progetto trovato per "{searchQuery}"</p>
        </div>
      ) : (
        <EmptyProjectsState />
      )}

      <div className="mt-10 pt-6 border-t border-[#EEF0F4]">
        <SocialBar />
      </div>

      <div className="fixed bottom-[calc(80px+env(safe-area-inset-bottom))] right-5 z-50 lg:right-[calc(50%-640px+20px)]">
        <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" accept="application/pdf,image/*" />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-16 h-16 bg-[#7B5CF6] text-white rounded-[24px] shadow-[0_8px_24px_rgba(123,92,246,0.35)] flex items-center justify-center active:scale-90 transition-transform"
          aria-label="Carica Progetto"
        >
          <Plus size={32} />
        </button>
      </div>
    </div>
  );
}
