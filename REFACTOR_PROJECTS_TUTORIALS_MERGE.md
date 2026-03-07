# Piano: Merge Tutorial → Progetti + Tab Profilo

> File di continuità per il refactor. Creato 2026-03-07.
> Aggiornare man mano che i task vengono completati.

---

## Obiettivo

Unificare la sezione Tutorial dentro Progetti.
Sostituire il tab Tutorial con il tab Profilo.
Il "+" in Progetti apre un modal che permette di scegliere il tipo di progetto.

---

## ❓ DOMANDE APERTE — rispondere prima di iniziare il codice

> Queste decisioni bloccano l'implementazione. Devono essere confermate dall'utente.

### D1 — Migrazione tutorial esistenti
I tutorial già salvati dagli utenti (in Zustand localStorage + tabella `tutorials` su Supabase) devono **migrare automaticamente** nella sezione Progetti, oppure restano separati e l'utente li vede sparire?

- **Opzione A (consigliata):** Migrazione automatica trasparente — al primo caricamento dopo l'aggiornamento, i tutorial esistenti vengono convertiti in "progetti con YouTube" e appaiono nella lista Progetti senza che l'utente debba fare nulla. I vecchi URL `/tutorials/[id]` reindirizzano a `/projects/[id]`.
- **Opzione B:** Nessuna migrazione — i tutorial esistenti scompaiono (non consigliato, perdita dati percepita).

### D2 — Layout progetto con YouTube + PDF/Immagine insieme
Se un utente ha un progetto con PDF o immagini e successivamente aggiunge anche un video YouTube, **quale layout mostra la pagina del progetto?**

- **Opzione A:** Il player YouTube appare in cima (come il layout tutorial attuale), seguito dalla galleria immagini/PDF. Entrambi visibili.
- **Opzione B:** Un toggle in alto che permette di switchare tra "Vista PDF/Immagini" e "Vista YouTube". Un contenuto alla volta.
- **Opzione C:** Il tipo principale non cambia — se il progetto è nato come PDF rimane PDF, il YouTube è solo un link accessorio (non player embeddato, solo link).

### D3 — Transcript YouTube nei progetti
I tutorial attualmente hanno la funzione di **trascrizione automatica** del video YouTube (già implementata). Quando i progetti con YouTube ereditano questa funzione?

- **Opzione A (consigliata):** Sì, tutti i progetti con YouTube hanno accesso alla trascrizione, come i tutorial attuali.
- **Opzione B:** No, la trascrizione resta solo per i "vecchi tutorial migrati", non per nuovi progetti con YouTube aggiunti in seguito.

### D4 — Tabbar: quante tab dopo il merge?
Attualmente: 3 tab (Utensili, Progetti, Tutorial).
Dopo il merge: Tutorial viene rimosso e Profilo prende il suo posto → ancora **3 tab** (Utensili, Progetti, Profilo).
Confermi che vuoi 3 tab e non 4?

---

## Stato attuale dell'architettura

### Store Zustand (`useProjectStore`)
```
projects: Project[]   → type: 'pdf' | 'images'
tutorials: Tutorial[] → videoId, playlistId, thumbUrl, transcriptData, ...
```
Due array separati, due interfacce separate.

### Supabase
- Tabella `projects` — PDF e immagini
- Tabella `tutorials` — video YouTube

### Tab bar
- Utensili (`/tools`)
- Progetti (`/`)
- Tutorial (`/tutorials`)

### Share target
- File (PDF/immagini) → `/share`
- YouTube URL → `/tutorials/share` → crea tutorial → `/tutorials/[id]`

---

## Architettura proposta (post-merge)

### Store Zustand — interfaccia estesa
```typescript
export interface Project {
  id: string
  title: string
  type: 'pdf' | 'images' | 'tutorial' | 'blank'  // 'blank' = solo titolo
  kind: 'pdf' | 'image' | 'tutorial' | 'blank'
  createdAt: number
  size: number
  counter: number
  timer: number
  secs: RoundCounter[]
  notesHtml: string
  images: ProjectImage[]
  coverImageId?: string
  thumbDataURL?: string
  // Campi YouTube (opzionali — solo per progetti con video)
  videoId?: string
  playlistId?: string
  thumbUrl?: string
  transcriptData?: TranscriptData | null
}
```

### Supabase — solo tabella `projects`
I nuovi progetti con YouTube vengono salvati in `projects` con `type='tutorial'`.
I vecchi tutorial in `tutorials` restano lì ma vengono letti e presentati come Projects.

### Tab bar
- Utensili (`/tools`)
- Progetti (`/`)
- Profilo (`/profilo`)

---

## Passi di implementazione

> Seguire l'ordine. Non saltare step. Spuntare quando completato.

### FASE A — Preparazione (nessun impatto visibile sull'utente)

- [x] **A1** — Estendere l'interfaccia `Project` con i campi YouTube opzionali (`videoId?`, `playlistId?`, `thumbUrl?`, `transcriptData?`) e aggiungere `type: 'tutorial' | 'blank'`
- [x] **A2** — Aggiungere funzione di migrazione client-side in `useProjectStore`: al mount, se `tutorials[]` non è vuoto, convertire ogni Tutorial in Project e spostarlo in `projects[]`, poi svuotare `tutorials[]`
- [x] **A3** — Redirect `/tutorials/[id]` → `/projects/[id]` via `page.tsx` con `router.replace`

### FASE B — Tabbar

- [x] **B1** — Sostituire tab Tutorial con tab Profilo in `Tabbar.tsx` (`/tutorials` → `/profilo`, icona `Youtube` → `User`)
- [x] **B2** — Aggiornare `isActive` logic per Profilo

### FASE C — Modal "+" nei Progetti

- [x] **C1** — Nella pagina progetti (`/`, presumibilmente `src/app/page.tsx`), sostituire l'attuale FAB "+" con un FAB che apre un **modal di scelta tipo** in stile Lurumi (bottom sheet)
- [x] **C2** — Modal 3 opzioni:
  - **PDF / Immagine** → comportamento attuale (apre file picker / fotocamera)
  - **Tutorial YouTube** → apre sheet con input URL YouTube + titolo (comportamento attuale di `/tutorials`)
  - **Solo titolo** → input titolo → crea progetto `type='blank'`
- [x] **C3** — Logica creazione progetto YouTube: parsing URL, creazione Project con `type='tutorial'`, salvataggio in tabella `projects` Supabase

### FASE D — Pagina progetto (`/projects/[id]`)

- [x] **D1** — Rendering condizionale per `type='tutorial'`: player YouTube embed in cima + pannello trascrizione
- [x] **D2** — `type='blank'`: layout identico a immagini (galleria vuota con empty state Camera)
- [ ] **D3** — "Aggiungi video YouTube" ai progetti PDF/immagini: bottone per associare videoId (non ancora implementato)
- [x] **D4** — Trascrizione per tutti i progetti con `videoId`: fetch + traduzione + sync Supabase a `projects` table
- [x] **D5** — "Contribuisci schema" funziona per tutti i tipi (controllo `secs.length > 0` già presente)

### FASE E — Pagina lista Progetti (`/`)

- [x] **E1** — Card con icona per tipo: PDF (FileText rosso), Immagini (testo), Tutorial (thumbnail YouTube + icona play), Blank (FolderOpen viola)
- [x] **E2** — Menu "..." dei tutorial include "Apri su YouTube"

### FASE F — Share target

- [x] **F1** — `api/share-target/route.ts`: YouTube → `/share?type=youtube&...`
- [x] **F2** — `share/page.tsx`: gestisce `type=youtube` → crea Project tutorial → `/projects/[id]`
- [x] **F3** — `tutorials/share/page.tsx`: riscritta per creare Project (non Tutorial) — retrocompat SW vecchi
- [ ] **F4** — Test end-to-end condivisione da telefono (da verificare manualmente)
- [x] **F5** — `image-pick-project` ora include tutorial e blank come destinazioni valide

### FASE G — Realtime sync

- [ ] **G1** — Nel listener Realtime attuale per `tutorials` (in `tutorials/page.tsx`) → spostarlo nella pagina principale progetti (`/`) e adattarlo per leggere dalla tabella `projects` con `type='tutorial'`
- [ ] **G2** — Verificare che INSERT/UPDATE/DELETE su `projects` con `type='tutorial'` si propaghino correttamente a tutti i dispositivi

### FASE H — Pulizia

- [x] **H1** — `tutorials/page.tsx` → redirect a `/`
- [x] **H2** — `tutorials/[id]/page.tsx` → redirect a `/projects/[id]`
- [x] **H3** — Tabella `tutorials` mantenuta (non droppata); nuovi progetti YouTube vanno in `projects`
- [ ] **H4** — Aggiornare `robots.txt` e `sitemap.ts` (non urgente)

---

## Rischi e note

### Rischio 1 — Perdita dati localStorage
Zustand usa `persist` con localStorage. La migrazione `tutorials → projects` deve essere fatta **una sola volta** e marcata come completata (es. con un flag `tutorialsMigrated: boolean` nello store). Se non marcata, ogni reload ricopia i tutorial.

### Rischio 2 — URL vecchi nei link condivisi
Utenti potrebbero avere link `/tutorials/[id]` salvati. Il redirect deve restare attivo a lungo.

### Rischio 3 — `type` non retrocompatibile
`Project.type` era `'pdf' | 'images'`. Aggiungendo `'tutorial' | 'blank'`, le parti di codice che fanno `if (project.type === 'pdf')` continuano a funzionare. Le parti che fanno switch devono gestire i nuovi casi.

### Rischio 4 — Tabella Supabase `projects` — colonne mancanti
La tabella `projects` non ha le colonne `video_id`, `playlist_id`, `thumb_url`, `transcript_data`. Serve una migration SQL.

---

## Migration SQL necessaria

```sql
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS video_id TEXT,
  ADD COLUMN IF NOT EXISTS playlist_id TEXT,
  ADD COLUMN IF NOT EXISTS thumb_url TEXT,
  ADD COLUMN IF NOT EXISTS transcript_data JSONB;
```

---

## Suggerimenti aggiuntivi (non bloccanti)

1. **Filtro per tipo nella lista progetti**: aggiungere un filtro "Tutti / PDF / Immagini / Tutorial / Vuoti" nella barra in cima ai progetti.
2. **Icona diversa nel tab Progetti quando ci sono tutorial**: non necessario, ma migliora UX.
3. **"Aggiungi YouTube" come onboarding suggerito**: nei progetti blank, mostrare un banner "Hai già un tutorial YouTube per questo schema? Aggiungilo!" che rimanda alla funzione di aggiunta video.
4. **Contribuisci schema funziona anche per tutorial**: già implementato (controlla `secs.length > 0`), nessuna modifica necessaria.

---

## Log completamento

| Data | Step | Note |
|------|------|------|
| 2026-03-07 | Piano creato | In attesa risposte D1-D4 |
| 2026-03-07 | Fasi A–H completate (escluso D3, G1-G2, H4) | TS 0 errori · SQL migration · Store esteso · Tabbar · Redirect · Modal + · Share target · Trascrizione · YouTube player |
