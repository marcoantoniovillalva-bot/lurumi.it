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

- [ ] **A1** — Estendere l'interfaccia `Project` con i campi YouTube opzionali (`videoId?`, `playlistId?`, `thumbUrl?`, `transcriptData?`) e aggiungere `type: 'tutorial' | 'blank'`
- [ ] **A2** — Aggiungere funzione di migrazione client-side in `useProjectStore`: al mount, se `tutorials[]` non è vuoto, convertire ogni Tutorial in Project e spostarlo in `projects[]`, poi svuotare `tutorials[]`
- [ ] **A3** — Aggiungere redirect `/tutorials/[id]` → `/projects/[id]` (file `src/app/tutorials/[id]/route.ts` oppure `page.tsx` con redirect)

### FASE B — Tabbar

- [ ] **B1** — Sostituire tab Tutorial con tab Profilo in `Tabbar.tsx` (`/tutorials` → `/profilo`, icona `Youtube` → `User`)
- [ ] **B2** — Aggiornare `isActive` logic per Profilo

### FASE C — Modal "+" nei Progetti

- [ ] **C1** — Nella pagina progetti (`/`, presumibilmente `src/app/page.tsx`), sostituire l'attuale FAB "+" con un FAB che apre un **modal di scelta tipo** in stile Lurumi (bottom sheet)
- [ ] **C2** — Modal 3 opzioni:
  - **PDF / Immagine** → comportamento attuale (apre file picker / fotocamera)
  - **Tutorial YouTube** → apre sheet con input URL YouTube + titolo (comportamento attuale di `/tutorials`)
  - **Solo titolo** → input titolo → crea progetto `type='blank'`
- [ ] **C3** — Logica creazione progetto YouTube: parsing URL, creazione Project con `type='tutorial'`, salvataggio in tabella `projects` Supabase

### FASE D — Pagina progetto (`/projects/[id]`)

- [ ] **D1** — Aggiungere rendering condizionale per `type='tutorial'`: mostra il player YouTube embed (come attuale `/tutorials/[id]`)
- [ ] **D2** — Aggiungere rendering per `type='blank'`: layout identico a immagini ma galleria vuota con pulsante "Aggiungi prima immagine"
- [ ] **D3** — Aggiungere funzione "Aggiungi video YouTube" ai progetti PDF/immagini: bottone nel menu azioni che permette di associare un videoId al progetto esistente (aggiorna `type` e aggiunge campi YouTube)
- [ ] **D4** — Trascript: se `type='tutorial'` (o project con `videoId`), mostrare il pannello trascrizione come in `/tutorials/[id]`
- [ ] **D5** — Gestire il "Contribuisci schema" anche per progetti di tipo tutorial e blank (se hanno secs)

### FASE E — Pagina lista Progetti (`/`)

- [ ] **E1** — Le card dei progetti mostrano icona diversa per tipo:
  - PDF: icona documento rosso (come ora)
  - Immagini: icona immagine viola (come ora)
  - Tutorial: thumbnail YouTube con icona play
  - Blank: icona cartella vuota
- [ ] **E2** — Il menu "..." dei progetti tutorial include "Apri su YouTube" (come ora nei tutorial)

### FASE F — Share target

- [ ] **F1** — Aggiornare `/app/api/share-target/route.ts`: i link YouTube ora reindirizzano a `/share?type=youtube&url=...&title=...` invece di `/tutorials/share`
- [ ] **F2** — Aggiornare `/app/share/page.tsx`: gestire `type=youtube` → crea Project con `type='tutorial'` → redirect a `/projects/[id]`
- [ ] **F3** — Rimuovere (o rendere redirect) la pagina `/tutorials/share`
- [ ] **F4** — Verificare che la condivisione da telefono di PDF, immagini e link YouTube funzioni end-to-end
- [ ] **F5** — Fix bug share: nella pagina `image-pick-project` (step `image-pick-project` in `/share`), aggiungere anche progetti `type='tutorial'` e `type='blank'` come destinazioni valide per le immagini

### FASE G — Realtime sync

- [ ] **G1** — Nel listener Realtime attuale per `tutorials` (in `tutorials/page.tsx`) → spostarlo nella pagina principale progetti (`/`) e adattarlo per leggere dalla tabella `projects` con `type='tutorial'`
- [ ] **G2** — Verificare che INSERT/UPDATE/DELETE su `projects` con `type='tutorial'` si propaghino correttamente a tutti i dispositivi

### FASE H — Pulizia

- [ ] **H1** — Rimuovere `src/app/tutorials/page.tsx` (o convertirlo in redirect a `/`)
- [ ] **H2** — Decidere se mantenere `src/app/tutorials/[id]/page.tsx` come redirect o rimuoverlo dopo la migrazione
- [ ] **H3** — Mantenere la tabella `tutorials` in Supabase (non droppare — dati storici), ma smettere di scrivere nuovi record lì
- [ ] **H4** — Aggiornare `robots.txt` e `sitemap.ts` per riflettere le nuove URL

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
