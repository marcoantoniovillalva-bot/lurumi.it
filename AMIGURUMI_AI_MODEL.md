# Progetto: Modello AI Custom per Pattern Amigurumi
> File di continuità per sessioni multiple con Claude Code
> Ultimo aggiornamento: 2026-03-06

---

## Obiettivo

Creare un modello AI proprietario capace di:
1. **Generare schemi amigurumi affidabili e tecnicamente corretti** (istruzioni giro per giro, stitch count verificati)
2. **Generare immagini che corrispondano ESATTAMENTE allo schema** (forma, proporzioni, colori coerenti)
3. Piena proprietà del modello, legale in Italia/EU, economico

---

## Strategia Dati (Decisione Chiave)

### Principio: Qualità prima di quantità

> "Meglio 200 schemi perfetti che 5000 generati dall'AI e sbagliati"

**Ordine di affidabilità dei dati:**
1. Schemi creati direttamente da Erika (admin esperta) — fonte ground truth
2. Schemi geometrici semplici documentati (sfera, cilindro, ovale, cono) — matematicamente verificabili
3. Schemi utenti validati dall'admin con correzioni
4. Schemi utenti approvati senza modifiche (solo per utenti avanzati fidati)

**NO a dati sintetici generati da AI** come seed — partire sempre da schemi reali verificati

---

## Analisi della Struttura Dati Già Presente in Lurumi

### Cosa esiste già nell'app che è prezioso per il training

Guardando il codice (`useProjectStore.ts`, tabella `projects` su Supabase):

```
Project {
  title: string               ← nome del pezzo
  counter: number             ← giro totale raggiunto
  secs: RoundCounter[]        ← DATI PIU' PREZIOSI (vedi sotto)
  notesHtml: string           ← note libere dell'utente
  images: ProjectImage[]      ← foto del lavoro in corso / finito
  timer: number               ← tempo impiegato
}

RoundCounter {
  id: string
  name: string                ← "Testa", "Corpo", "Braccio sinistro"...
  value: number               ← numero giri/punti contati
  imageId?: string            ← foto associata a quella parte
}
```

**I `secs` (contatori secondari) sono già una struttura dati semi-strutturata di schema amigurumi:**
Un utente che traccia "Testa: 35 giri" + "Corpo: 28" + "Braccio: 15" con foto allegate sta già descrivendo la struttura anatomica di un amigurumi in modo quantitativo.

**Il problema attuale:** questi dati sono sparsi, non validati, e mancano delle istruzioni giro-per-giro (solo il totale, non il dettaglio di ogni round).

---

## Architettura del Sistema di Raccolta Dati

### Flusso proposto

```
[Erika crea schemi] ─────────────────────────────────────► [Dataset validato]
                                                                    │
[Utente lavora su progetto]                                         │
    │                                                               │
    ├─ Riempie secs con nomi parti + valori                        │
    ├─ Associa foto a ogni parte                                   │
    ├─ Scrive note (istruzioni)                                    │
    │                                                               │
    └─ [Bottone "Contribuisci schema"] ──► [Coda validazione] ──► [Admin valida/corregge] ──►┘
                                              (Supabase)
```

### 3 Modalità di Contribuzione

**Modalità A — Schema Semplice (già quasi implementabile)**
L'utente invia il progetto esistente con:
- Titolo, note, secs (parti + giri), foto associate
- Serve solo aggiungere un bottone "Condividi per training AI" nel progetto

**Modalità B — Schema Strutturato (nuovo tool nell'app)**
Un editor dedicato dove l'utente inserisce:
- Ogni giro con la sua formula: `Giro 1: sc x6 (6)`, `Giro 2: inc x6 (12)`...
- Materiali, hook size, colori
- Foto del risultato finale e WIP
- Questo è il dato di training più ricco

**Modalità C — Erika (Admin) crea direttamente**
Erika usa il tool Schema Strutturato con accesso admin che bypassa la coda:
- I suoi schemi entrano direttamente nel dataset come ground truth
- Partenza: forme geometriche pure (sfera 6cm, cilindro 4x6cm, cono...)
- Progressione: animali semplici → medi → complessi

---

## Piano di Sviluppo nell'App (Cosa Costruire)

### Step 1 — Tabelle DB per Training Data

```sql
CREATE TABLE training_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),
  project_id UUID REFERENCES projects(id),     -- progetto Lurumi originale (opzionale)
  title TEXT NOT NULL,
  difficulty TEXT CHECK (difficulty IN ('beginner','intermediate','advanced')),
  category TEXT,                                -- 'geometric', 'animal', 'character', ...
  yarn_weight TEXT,                             -- 'fingering','dk','worsted','bulky'
  hook_size TEXT,
  finished_size_cm TEXT,
  parts JSONB NOT NULL,                        -- array di parti con istruzioni giro-per-giro
  images JSONB DEFAULT '[]',                   -- URL foto risultato finale + WIP
  status TEXT DEFAULT 'pending'                -- 'pending', 'validated', 'rejected', 'ground_truth'
    CHECK (status IN ('pending','validated','rejected','ground_truth')),
  admin_notes TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  validated_at TIMESTAMPTZ,
  validated_by UUID REFERENCES profiles(id)
);

-- Struttura di parts (JSONB):
-- [
--   {
--     "name": "Testa",
--     "color": "beige",
--     "rounds": [
--       {"round": 1, "instruction": "MR, 6sc", "stitch_count": 6},
--       {"round": 2, "instruction": "inc x6", "stitch_count": 12},
--       {"round": 3, "instruction": "*sc, inc* x6", "stitch_count": 18}
--     ],
--     "image_url": "..."
--   }
-- ]
```

### Step 2 — Tool "Schema Creator" (Editor nell'app)

**Dove metterlo:** nuova tab nel progetto, oppure sezione `/pattern-creator` accessibile dal menu

**UI:**
```
[Titolo schema] [Difficoltà ▼] [Categoria ▼]
[Peso filato ▼] [Ferri] [Dimensione finita]

PARTI:
+ Aggiungi parte

┌─ Testa ─────────────────────────── [foto] ─┐
│ Giro 1: [MR, 6sc              ] → 6 punti  │
│ Giro 2: [inc x6               ] → 12 punti │
│ + Aggiungi giro                             │
└─────────────────────────────────────────────┘

┌─ Corpo ─────────────────────────── [foto] ─┐
│ ...                                         │
└─────────────────────────────────────────────┘

[Aggiungi parte] [Anteprima] [Contribuisci al training AI ✓]
```

**Logica di validazione automatica (da fare):**
- Controlla che stitch_count sia coerente (inc aumenta di 1, dec diminuisce)
- Avvisa se un giro di chiusura non torna a 6
- Suggerisce il conteggio corretto se sbagliato

### Step 3 — Contribuzione da Progetto Esistente

Nel progetto esistente, se l'utente ha compilato `secs` con nomi parti + immagini, mostrare:

```
💡 Hai tracciato 4 parti con foto — vuoi contribuire questo schema
   al training AI? L'admin lo verificherà prima di usarlo.
   [Sì, contribuisci] [No grazie]
```

Questo crea un pre-schema automatico dai dati `secs` già presenti, che l'admin poi completa con i dettagli giro-per-giro.

### Step 4 — Coda Validazione Admin

Nel pannello `/admin`, nuova sezione "Training Dataset":
```
CODA VALIDAZIONE (12 in attesa)
┌──────────────────────────────────────────┐
│ "Orsetto beige" — @utente123 — 3 parti   │
│ [Visualizza] [Approva] [Correggi] [Rifiuta] │
├──────────────────────────────────────────┤
│ "Gatto grigio" — @utente456 — 5 parti    │
│ [Visualizza] [Approva] [Correggi] [Rifiuta] │
└──────────────────────────────────────────┘

DATASET VALIDATO (47 schemi)
Ground truth (Erika): 23
Validati da utenti: 24
Pronti per training: 47
```

**Funzione "Correggi":** apre lo schema contributor con i dati precompilati e permette all'admin di modificare giro per giro prima di approvare.

---

## Strategia Progressiva (Geometrico → Complesso)

### Livello 1 — Forme Geometriche Pure (partenza)
Matematicamente verificabili, nessuna ambiguità:

| Forma | Formula standard | Variabili |
|-------|-----------------|-----------|
| Sfera | MR6 → +6/giro → plateau → -6/giro | diametro (cm) |
| Cilindro | MR6 → +6/giro → plateau → nessuna riduzione | diametro × altezza |
| Ovale | catena N → giro intorno → +N/estremità | asse lungo × corto |
| Cono | MR6 → +6 ogni X giri | altezza, angolo |
| Teardrop | sfera modificata con riduzione asimmetrica | proporzioni |

Questi sono i mattoni di tutti gli amigurumi. Con 20-30 varianti di ogni forma = ~150 schemi base matematicamente corretti al 100%.

### Livello 2 — Animali Semplici (2-3 parti, forme note)
- Pallina con occhi (sfera + occhi)
- Pesce (ovale + pinne piatte)
- Orsetto semplice (sfera testa + ovale corpo + 4 sfere piccole)

### Livello 3 — Animali Medi (4-6 parti, proporzioni)
- Gatto seduto, coniglio, pulcino

### Livello 4 — Personaggi Complessi (7+ parti, dettagli)
- Umanoidi, accessori, abbigliamento

---

## Allineamento Schema → Immagine

### Perché è il problema più difficile

Un'immagine di un amigurumi "sfera 35 punti" dovrebbe mostrare esattamente quella forma, non una sfera generica. Il modello deve capire che:
- 35 punti plateau = diametro ~6cm con lana worsted DK
- Le proporzioni relative delle parti determinano la forma del risultato

### Soluzione: Feature Vector da Schema

```
Schema (testo strutturato)
    │
    ▼
Parser deterministico
    │
    ▼
Feature Vector:
{
  "parts": [
    {"name": "head", "shape": "sphere", "diameter_cm": 6.5, "color": "beige"},
    {"name": "body", "shape": "oval", "width_cm": 5, "height_cm": 7, "color": "beige"},
    {"name": "ear", "shape": "flat_circle", "diameter_cm": 2, "color": "beige", "count": 2}
  ],
  "proportions": {"head_to_body": 0.9},   // testa quasi grande quanto il corpo
  "style": "classic_amigurumi"
}
    │
    ▼
Prompt generazione immagine ultra-specifico:
"Amigurumi cat. Head: beige sphere 6.5cm diameter.
 Body: beige oval 5x7cm. Two flat circle ears 2cm.
 Head-to-body ratio 0.9 (head slightly smaller than body).
 Classic kawaii style, yarn texture, studio lighting."
    │
    ▼
Flux fine-tuned → immagine coerente
```

Il parser (deterministico, non AI) calcola le dimensioni fisiche reali a partire dal numero di punti usando formule standard del crochet (gauge).

---

## Consenso Utenti e Privacy

### Clausola ToS da aggiungere (testo suggerito)

> "Contribuzione volontaria al training AI: se scegli di condividere i tuoi schemi tramite la funzione apposita, il contenuto tecnico (istruzioni, conteggi, foto dell'opera) sarà utilizzato in forma anonimizzata esclusivamente per addestrare modelli AI sviluppati da Lurumi. Non condivideremo mai questi dati con terze parti. Puoi richiederne la rimozione in qualsiasi momento."

### Cosa NON raccogliere mai automaticamente
- Dati senza consenso esplicito (nessun harvesting silenzioso)
- Foto di volti degli utenti
- Dati personali associabili all'opera

---

## Conformità Legale Italia/EU

| Aspetto | Status | Note |
|---------|--------|------|
| GDPR | OK con consenso esplicito | Aggiungere clausola ToS + opt-in chiaro |
| Copyright dati training | OK | Solo dati propri + consenso utenti |
| EU AI Act | Rischio limitato | Trasparenza verso utenti che interagiscono con AI |
| Proprietà modello | Piena | Mistral Apache 2.0, training autonomo |

---

## Architettura Tecnica Finale

### Componente A — LLM Pattern Generator

- **Base:** Mistral 7B v0.3 (Apache 2.0)
- **Metodo:** QLoRA fine-tuning
- **Input:** `{category, difficulty, parts_description, yarn_weight, finished_size}`
- **Output:** schema completo giro-per-giro in formato JSON strutturato
- **Training:** RunPod A100, ~50h, ~€125 per prima run

### Componente B — Image Generator Allineato

- **Base:** Flux.1-dev LoRA fine-tuned su dataset amigurumi
- **Input:** feature vector estratto dallo schema (parser deterministico)
- **Output:** immagine coerente con forma/proporzioni/colori schema
- **Training:** dopo aver raccolto ≥200 coppie schema+immagine validate

### Componente C — Parser Schema → Feature Vector (deterministico, no AI)

- Calcola dimensioni fisiche da stitch count + gauge yarn
- Identifica forma geometrica dominante per ogni parte
- Genera proporzioni relative tra le parti
- Produce prompt immagine ultra-specifico

---

## Roadmap Aggiornata

### Fase 0 — Fondamenta (1-2 mesi, costo: €0)
- [ ] Aggiungere clausola ToS consenso dati
- [ ] Creare tabella `training_patterns` su Supabase
- [ ] Erika crea 20-30 schemi forme geometriche pure (ground truth)
- [ ] Erika crea 10-15 amigurumi semplici (livello 2)

### Fase 1 — Tool nell'App (2-3 mesi, costo: dev time)
- [ ] Schema Creator: editor giro-per-giro con foto per parte
- [ ] Bottone "Contribuisci" nei progetti esistenti (da secs compilate)
- [ ] Coda validazione admin nel pannello `/admin`
- [ ] Funzione "Correggi schema" per admin
- [ ] Target: 100 schemi validati (50 Erika + 50 utenti)

### Fase 2 — Training LLM (1 mese, costo: ~€150-300)
- [ ] Preparare dataset JSONL da schemi validati
- [ ] Fine-tune Mistral 7B con QLoRA
- [ ] Valutazione: stitch count accuracy, round closure check
- [ ] Beta nell'app: "Genera schema" (sostituisce prompt generico)

### Fase 3 — Training Immagini + Allineamento (2-3 mesi, costo: ~€300-500)
- [ ] Raccogliere ≥200 coppie schema+immagine validate
- [ ] Fine-tune Flux LoRA su dataset amigurumi
- [ ] Costruire parser schema → feature vector
- [ ] Pipeline end-to-end: richiesta → schema → feature → immagine

### Fase 4 — Produzione e Flywheel
- [ ] Hosting modello (Replicate custom o VPS GPU)
- [ ] Gli utenti usano il modello → validano output → reinserito nel training
- [ ] Ogni nuovo schema validato migliora il modello successivo

---

## Costi Stimati

| Voce | Costo |
|------|-------|
| Erika crea 50 schemi ground truth | Tempo Erika (no costo diretto) |
| Dev tool Schema Creator + Admin | Dev time |
| Training LLM Fase 2 (RunPod ~75h A100) | ~€190 |
| Training immagini Fase 3 (RunPod ~100h) | ~€250 |
| Storage + infrastruttura | ~€20/mese |
| **Totale monetario lancio** | **~€460-600** |

---

## Note Sessioni

### 2026-03-06 — Sessione 1
Decisioni prese:
- NO a dati sintetici AI come seed, SI a schemi reali verificati
- Partenza da Erika (ground truth) + forme geometriche pure
- Utenti contribuiscono → admin valida (coda) → dataset
- I `secs` esistenti nei progetti Lurumi sono già dati semi-strutturati preziosi
- Progressione geometrico → semplice → complesso → avanzato
- Allineamento schema-immagine via parser deterministico (stitch count → dimensioni fisiche → feature vector → prompt immagine condizionato)

Prossimi passi da implementare nel codice:
1. Tabella `training_patterns` in setup-db.mjs
2. Schema Creator UI nell'app
3. Bottone "Contribuisci" nei progetti con secs
4. Sezione coda validazione nell'admin dashboard
