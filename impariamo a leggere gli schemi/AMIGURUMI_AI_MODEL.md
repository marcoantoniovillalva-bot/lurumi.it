# Progetto: Modello AI Custom per Pattern Amigurumi
> File di continuità per sessioni multiple con Claude Code
> Ultimo aggiornamento: 2026-03-06 (v3 — post revisione critica)

---

## Obiettivo

Creare un modello AI proprietario capace di:
1. **Generare schemi amigurumi affidabili e tecnicamente corretti** (istruzioni giro per giro, stitch count verificati)
2. **Generare immagini che corrispondano ESATTAMENTE allo schema** (forma, proporzioni, colori coerenti)
3. Piena proprietà del modello, legale in Italia/EU, economico

---

## Blocchi Aperti — Da Risolvere Prima di Procedere

> Questi sono i problemi critici identificati durante la revisione. Vanno risolti nell'ordine indicato — tutto il resto dipende da questi.

| # | Blocco | Impatto | Stato |
|---|--------|---------|-------|
| 1 | **`pattern-math.ts` non esiste** | È il cuore del sistema: Schema Creator, RLHF loop e inserimento dati dipendono tutti da esso | ❌ Da fare |
| 2 | **Tabelle DB non create** | `training_patterns` e `model_feedback` non esistono ancora su Supabase | ❌ Da fare |
| 3 | **Errore nel ground truth (braccio Luly G3)** | Il giro 3 del braccio riporta [18pb] — valore inusualmente largo. Inserire dati sbagliati nel ground truth avvelena il training | ⚠️ Verificare con Erika |
| 4 | **JSON con range di giri** | I giri con range (`"round": "8-11"`) vanno espansi in giri individuali nel DB per permettere associazione immagine per giro | ❌ Da fare al momento dell'inserimento |

---

## Ordine di Priorità Immediato

```
1. Scrivere pattern-math.ts  (validator + normalizzatore)
2. Creare tabelle DB su Supabase  (training_patterns + model_feedback)
3. Verificare G3 braccio Luly con Erika  (blocca inserimento ground truth)
4. Inserire i 4 schemi JSON nel DB con status='ground_truth'  (dopo punti 2 e 3)
5. Schema Creator con validator live nell'app
```

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

## Vocabolario Canonico (da libro Erika)

Il modello usa come riferimento assoluto la tavola abbreviazioni trilinguea del libro "Il Metodo Lurumi":

| Canonical (EN) | Italiano | Español | Significato |
|---------------|----------|---------|-------------|
| sc / dc       | mb / pb  | pb      | Punto basso (single crochet) |
| inc           | aum      | aum     | Aumento (2sc nella stessa maglia) |
| dec           | dim      | dim     | Diminuzione invisibile |
| MR / Mr       | am / AM  | Am      | Anello magico |
| ch            | cat / cad | cad   | Catenella |
| sl st         | pbss     | pbss    | Punto bassissimo |
| htc           | mpa      | ma      | Mezzo punto alto |
| tc            | pa       | dc      | Punto alto |
| dtc           | dpa      | pad     | Doppio punto alto |
| ttc           | tpa      | pat     | Triplo punto alto |
| BLO           | blo      | blo     | Solo asole posteriori |
| FLO           | flo      | flo     | Solo asole anteriori |

**Il modello è trilingue fin dall'inizio** — tutti gli alias vengono normalizzati alla forma canonica EN prima della validazione e del training.

---

## Invarianti Matematici (Regole Assolute)

Queste regole sono deterministiche — qualsiasi schema che le viola è sbagliato:

```
1. AUMENTO:    stitch_count_new = stitch_count_old + num_increases
2. DIMINUZIONE: stitch_count_new = stitch_count_old - num_decreases
3. GIRO DIRITTO: stitch_count_new = stitch_count_old
4. FORMULA DISTRIBUTIVA: da M a M+6 → "(M/6 - 1) sc, inc" × 6
5. GAUGE (cotone 2.5mm): diametro_cm ≈ stitch_count_plateau / 30
6. SFERA STANDARD: MR6 → +6/giro × N → plateau × M → -6/giro × N
```

Questi invarianti alimentano il **validator deterministico** (`pattern-math.ts`) che verifica ogni giro prima dell'inserimento nel dataset.

---

## Livelli di Complessità del Dataset

| Livello | Tipo | Esempi | Start type |
|---------|------|--------|------------|
| 0 | Vocabolario + regole math | Tavola abbreviazioni | — |
| 1 | Forme geometriche pure | Sfera, cilindro, ovale, cono, flat circle | MR o catena |
| 2 | Accessori semplici | Fiore (2G) ✅, Stivaletto (11G) ✅ | MR o catena |
| 3 | Parti corpo semplici | Testa Luly (36G) ✅, Braccio (18G) ✅ | MR |
| 4 | Parti complesse + unione | Piede+Gamba (22G) ✅, Corpo | Catena |
| 5 | Personaggio completo | Luly intera (10 parti) | Multi-start |
| 6 | Personaggi futuri | Sara, Tommy, Clara, Babol, Susy, Lurumi | Multi-start |

✅ = schemi JSON già pronti in `LIBRO_LURUMI_TRAINING_EXTRACTION.md`

**Azione immediata:** i 4 schemi ✅ vanno inseriti nel DB `training_patterns` con `status='ground_truth'`.

---

## Tecniche Speciali — Tag Obbligatori nel DB

Il modello deve capire queste categorie come comportamento distinto:

| Tecnica | Comportamento | Tag DB |
|---------|--------------|--------|
| BLO/FLO | Non cambia stitch_count, crea linea visibile | `modifier: "BLO"` |
| Avviamento ovale | Start asimmetrico da catena | `start_type: "chain"` |
| Unione parti | Due pezzi separati → uno | `technique: "join"` |
| Cambio colore | Stessa stitch_count, colore cambia | `color_change: true` |
| Popcorn stitch | Punto volumetrico decorativo | `stitch_type: "popcorn"` |
| Cluster (PA uniti) | N punti chiusi nello stesso punto | `stitch_type: "cluster"` |

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
L'utente invia il progetto esistente con secs compilate + foto.

**Modalità B — Schema Strutturato (Schema Creator)**
Editor dedicato giro-per-giro con validator matematico integrato in tempo reale.

**Modalità C — Erika (Admin) crea direttamente**
Bypass della coda → status='ground_truth' automatico.

---

## Classificatore Foto: Reale vs IA

Dal libro (pp. 28-36), criteri per filtrare automaticamente le foto degli utenti prima della coda validazione.
Implementato come prompt GPT-4o Vision:

```
Criteri per foto REALE (accettata):
- Maglie regolari e distinguibili in fila ordinate
- Ombre coerenti con la forma 3D
- Texture filo visibile (fibre, torsione)
- Effetto aumento visibile ai bordi
- Piccole imprecisioni naturali tra una maglia e l'altra
- Imbottitura coerente con la geometria

Criteri per foto IA (rifiutata automaticamente):
- Superficie liscia o texture generica
- Ombre piatte o contraddittorie
- Maglie confuse o sfocate
- Troppo perfetto o troppo caotico
- Saturazione digitale dei colori
```

Questo riduce il carico admin e garantisce la qualità del dataset immagini.

---

## Ciclo di Validazione Admin con Feedback al Modello

### Idea chiave: Test → Errore → Correzione = Dato di training

L'admin non si limita a validare schemi statici — può **testare il modello in tempo reale** e usare gli errori come nuovi dati di training.

### Come funziona (RLHF semplificato)

```
1. Admin invia un prompt al modello: "dammi lo schema di una sfera da 6cm con cotone 2.5mm"
2. Modello risponde con uno schema (giro per giro)
3. Validator deterministico esegue il check matematico automatico
4. Admin legge la risposta e valuta:
   a. CORRETTO → marcato come esempio positivo nel dataset
   b. SBAGLIATO → admin inserisce la risposta corretta (o la modifica)
      → La coppia (prompt, risposta_sbagliata, risposta_corretta) diventa training data
      → Il modello impara sia "cosa è giusto" che "perché era sbagliato"
```

### Perché è potente

- Ogni errore del modello diventa automaticamente un esempio di training (dato correttivo)
- L'admin non ha bisogno di creare schemi dal niente — li "strappa" dagli errori del modello
- Il validator matematico filtra automaticamente gli errori ovvi senza bisogno dell'admin
- Con abbastanza cicli Test → Errore → Correzione il modello migliora in modo misurabile

### Struttura DB per i feedback

```sql
CREATE TABLE model_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt TEXT NOT NULL,                    -- cosa ha chiesto l'admin
  model_response JSONB NOT NULL,           -- cosa ha risposto il modello
  is_correct BOOLEAN,                      -- l'admin dice: giusto o sbagliato
  corrected_response JSONB,               -- risposta corretta (se is_correct=false)
  math_check_passed BOOLEAN,              -- validator automatico ha passato?
  math_errors JSONB,                       -- lista errori matematici trovati
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  admin_id UUID REFERENCES profiles(id)
);
```

---

## Piano di Sviluppo nell'App (Cosa Costruire)

> **Ordine obbligatorio:** Step 0 → Step 1 → Step 2 → Step 3+. Non saltare step.

### Step 0 — `pattern-math.ts` (prerequisito di tutto)

Da costruire **prima di ogni altra cosa** — è il cuore del sistema:
```typescript
normalizeStitch(alias: string): string     // "mb" → "sc", "aum" → "inc"
validateRound(prev: number, instruction: string): { ok: boolean, expected: number, got: number }
validatePart(rounds: Round[]): ValidationResult[]
estimateSizeCm(stitchCount: number, gauge: number): number
distributiveFormula(from: number, to: number): string  // "da 12 a 18 → (1sc, inc) ×6"
```

Senza questo file: lo Schema Creator non può validare in tempo reale, il pannello RLHF non può fare il check automatico, e i dati non possono essere verificati prima dell'inserimento nel DB.

### Step 1 — Tabelle DB per Training Data

```sql
CREATE TABLE training_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),
  project_id UUID REFERENCES projects(id),
  title TEXT NOT NULL,
  difficulty TEXT CHECK (difficulty IN ('beginner','intermediate','advanced')),
  category TEXT,
  yarn_weight TEXT,
  hook_size TEXT,
  finished_size_cm TEXT,
  parts JSONB NOT NULL,
  images JSONB DEFAULT '[]',
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending','validated','rejected','ground_truth')),
  admin_notes TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  validated_at TIMESTAMPTZ,
  validated_by UUID REFERENCES profiles(id)
);

CREATE TABLE model_feedback (
  -- vedi sezione "Ciclo di Validazione Admin" sopra
);
```

**Struttura `parts` (JSONB):**
```json
[{
  "name": "Testa",
  "color": "beige",
  "start_type": "magic_ring",
  "rounds": [
    {"round": 1, "instruction": "MR, 6sc", "stitch_count": 6},
    {"round": 2, "instruction": "inc ×6", "stitch_count": 12}
  ],
  "image_url": "..."
}]
```

### Step 2 — Inserimento Ground Truth nel DB

Prima di inserire i 4 schemi JSON:
1. **Verificare con Erika il G3 del braccio Luly** — [18pb] sembra errato (valore inusuale per un braccio)
2. **Espandere i giri con range** — es. `"round": "8-11"` va suddiviso in 4 giri individuali (`round: 8`, `round: 9`, ecc.) per permettere associazione immagine per giro specifico
3. Inserire tutti e 4 gli schemi con `status='ground_truth'` e `validated_by = [Erika user_id]`

### Step 3 — Schema Creator (editor nell'app)

Editor giro-per-giro con:
- Validator live (verde/rosso su ogni giro mentre l'admin digita)
- Auto-suggest del conteggio corretto se sbagliato
- Tag per tecniche speciali (BLO, join, color change, ecc.)
- Upload foto per ogni parte
- Normalizzazione automatica delle abbreviazioni

### Step 4 — Contribuzione da Progetto Esistente

Bottone "Contribuisci schema" nei progetti con secs compilate → pre-schema automatico → coda validazione.

### Step 5 — Pannello Admin: Training Dataset

**Sezione 1: Coda Validazione**
- Lista schemi in attesa con preview
- Azioni: Approva / Correggi (apre Schema Creator precompilato) / Rifiuta
- Auto-classificatore foto Reale vs IA integrato

**Sezione 2: Test Modello + Feedback**
- Input prompt libero (es. "schema sfera 5cm worsted")
- Output modello in tempo reale
- Check matematico automatico visibile (verde = passa, rosso = errori specifici)
- Pulsanti: [Corretto ✓] [Sbagliato — inserisci risposta giusta]
- Se sbagliato: editor Schema Creator precompilato con risposta modello → admin corregge → salva come dato correttivo

**Sezione 3: Dataset Stats**
```
Ground truth (Erika): 23
Validati da utenti: 24
Dati correttivi (feedback): 12
Pronti per training: 59
```

---

## Analisi Sezioni Esistenti nell'App

| Sezione | Dato disponibile | Valore | Azione richiesta |
|---------|-----------------|--------|-----------------|
| Tutorial trascrizioni | Istruzioni verbali pattern | ★★★★★ | Tag + parser NLP |
| Calcolatore | Logica validazione math | ★★★★★ | Refactor in `pattern-math.ts` |
| Progetti secs + foto | Struttura parti + immagini | ★★★★☆ | Bottone contribuisci |
| Designer ai_generations | Coppie prompt→immagine | ★★★★☆ | Rating + approval |
| Chat (vision+troubleshooter) | Q&A + foto amigurumi | ★★★☆☆ | Flag sessioni qualità |
| Editor immagini (remove-bg) | Foto amigurumi isolati | ★★★☆☆ | Opt-in contribuzione |
| Libreria | Schemi curati con immagini | ★★★☆☆ | Metadati strutturati |
| Note utenti | Schemi informali | ★★☆☆☆ | Flag opzionale |

---

## Architettura Tecnica

### Componente A — LLM Pattern Generator
- **Base:** Mistral 7B v0.3 (Apache 2.0)
- **Metodo:** QLoRA fine-tuning
- **Trilingue:** IT/EN/ES con vocabolario normalizzato
- **Input:** `{category, difficulty, parts_description, yarn_weight, finished_size}`
- **Output:** schema JSON strutturato con stitch count per ogni giro

### Componente B — Validator Deterministico (NO AI)
- `pattern-math.ts` — logica pura, zero costi API
- Controlla ogni giro prima che entri nel dataset
- Usato anche nel Test Modello per feedback automatico

### Componente C — Image Generator Allineato
- **Base:** Flux.1-dev LoRA fine-tuned su amigurumi reali
- **Input:** feature vector da schema (dimensioni fisiche calcolate dal validator)
- **Filtro ingresso:** classificatore Reale vs IA prima di ogni foto nel training set

### Componente D — RLHF Loop (novità v2)
- Test → Errore → Correzione admin → Dataset correttivo
- Alimenta il re-training incrementale del modello

---

## Roadmap Aggiornata

### Fase 0 — Fondamenta Tecniche (BLOCCO ATTUALE — fare subito)

> Nulla di ciò che segue funziona senza questi step. Non passare alla Fase 1 prima di completarli tutti.

- [x] Vocabolario canonico definito (libro Erika)
- [x] 4 schemi ground truth in formato JSON (libro Erika)
- [x] Invarianti matematici documentati
- [ ] **Scrivere `pattern-math.ts`** — validator + normalizzatore (priorità assoluta)
- [ ] **Creare tabelle DB** `training_patterns` + `model_feedback` su Supabase
- [ ] **Verificare con Erika G3 braccio Luly** — [18pb] sembra errato, blocca inserimento ground truth
- [ ] **Inserire 4 schemi JSON nel DB** con `status='ground_truth'` (solo dopo verifica braccio)
- [ ] Erika aggiunge schemi Livello 1 (sfere pure, cilindri, ovali) — ~10 schemi

### Fase 1 — Tool nell'App (2-3 mesi)

> Inizia solo dopo che `pattern-math.ts` e le tabelle DB esistono.

- [ ] Schema Creator con validator live (usa `pattern-math.ts`)
- [ ] Classificatore auto foto Reale vs IA
- [ ] Bottone "Contribuisci" nei progetti
- [ ] Coda validazione admin
- [ ] **Pannello Test Modello + Feedback** (RLHF loop)
- Target: 100 schemi validati + 50 dati correttivi

### Fase 2 — Training LLM (1 mese, ~€150-300)
- [ ] Dataset JSONL trilingue da schemi validati + dati correttivi
- [ ] Fine-tune Mistral 7B con QLoRA
- [ ] Valutazione: stitch count accuracy per giro
- [ ] Beta nell'app: "Genera schema"

### Fase 3 — Training Immagini (2-3 mesi, ~€300-500)
- [ ] Dataset foto reali filtrate dal classificatore
- [ ] Fine-tune Flux LoRA
- [ ] Pipeline end-to-end: richiesta → schema → feature vector → immagine

### Fase 4 — RLHF Continuo
- [ ] Il modello gira in produzione
- [ ] Gli utenti usano il modello → feedback admin → re-training incrementale
- [ ] Personaggi Sara, Tommy, Clara, Babol, Susy, Lurumi (Livello 6)

---

## Costi Stimati

| Voce | Costo |
|------|-------|
| Dev tool Schema Creator + Admin + RLHF panel | Dev time |
| Training LLM Fase 2 (RunPod ~75h A100) | ~€190 |
| Training immagini Fase 3 (RunPod ~100h) | ~€250 |
| Storage + infrastruttura | ~€20/mese |
| **Totale monetario lancio** | **~€460-600** |

---

## Consenso Utenti e Privacy

**Clausola ToS:**
> "Se scegli di condividere i tuoi schemi tramite la funzione apposita, il contenuto tecnico (istruzioni, conteggi, foto dell'opera) sarà utilizzato in forma anonimizzata esclusivamente per addestrare modelli AI sviluppati da Lurumi. Non condivideremo mai questi dati con terze parti. Puoi richiederne la rimozione in qualsiasi momento."

**Mai raccogliere:** dati senza consenso esplicito, foto di volti, dati personali associabili all'opera.

---

## Conformità Legale Italia/EU

| Aspetto | Status | Note |
|---------|--------|------|
| GDPR | OK con consenso esplicito | Clausola ToS + opt-in chiaro |
| Copyright dati training | OK | Solo dati propri + consenso utenti |
| EU AI Act | Rischio limitato | Trasparenza verso utenti AI |
| Proprietà modello | Piena | Mistral Apache 2.0, training autonomo |

---

## Decisioni Frontend/Backend

### Canva OAuth — da rimuovere

Il flusso OAuth Canva (`/api/canva/auth`, `/api/canva/callback`, `/api/canva/debug`) è stato tentato più volte senza successo. La funzione viene rimossa dall'interfaccia ma **la capacità di esportare verso Canva rimane**, tramite un approccio diverso (vedi sotto).

### Export PDF Editabile

Invece di dipendere dall'API Canva, l'app esporta un **PDF strutturato a oggetti** dove ogni elemento è separato e selezionabile:
- Testo come oggetti di testo reali (non immagine rasterizzata)
- Immagini come oggetti immagine incorporati
- Layout a colonne per schema giro-per-giro

**Libreria:** `pdf-lib` (già disponibile nell'ecosistema npm, zero dipendenze runtime)

```
Esempio output PDF editabile:
┌─────────────────────────────┐
│ [Testo] Schema Luly         │  ← oggetto testo selezionabile
│ [Immagine] foto-testa.jpg   │  ← oggetto immagine spostabile
│ [Testo] G1: AM 6pb [6]      │  ← testo editabile in Acrobat/Canva
│ [Testo] G2: aum ×6 [12]     │
│ ...                          │
└─────────────────────────────┘
```

Aperto in Adobe Acrobat, Preview, o **importato in Canva** → tutti gli elementi sono editabili separatamente.

### "Condividi su Canva" senza OAuth

Canva permette di **importare PDF** direttamente dalla sua UI (File → Import). Ogni pagina del PDF diventa un frame Canva con gli elementi separati. Il flusso diventa:

```
[Esporta PDF] → [Bottone "Apri in Canva"] → apre canva.com/create
                                              + tooltip: "Clicca File → Importa
                                                per caricare il tuo PDF"
```

Nessun OAuth necessario. L'utente importa manualmente in 2 clic.
Se in futuro Canva risolve il problema OAuth, si può riaggiungere l'upload automatico senza cambiare il PDF export.

### Pannello Admin — Nuove Sezioni da Aggiungere

1. **Coda Validazione Schemi** — lista schemi utenti in attesa con azioni Approva/Correggi/Rifiuta
2. **Test Modello + Feedback (RLHF)** — prompt libero → risposta modello → check matematico automatico → admin corregge se sbagliato → dato correttivo salvato
3. **Dataset Stats** — contatori ground truth / validati / correttivi / totale training-ready

---

## Note Sessioni

### 2026-03-06 — Sessione 4 (revisione critica)
- Identificati 4 blocchi aperti: `pattern-math.ts` mancante, tabelle DB non create, errore G3 braccio Luly, range giri da espandere
- Riorganizzata la roadmap: aggiunta Fase 0 esplicita con dipendenze chiare
- `pattern-math.ts` spostato a Step 0 (era Step 2) — è il prerequisito di tutto il sistema
- Inserimento ground truth condizionato alla verifica con Erika del braccio
- Aggiunta nota tecnica sull'espansione dei giri con range al momento dell'inserimento DB

### 2026-03-06 — Sessione 1
- NO dati sintetici AI come seed, SI schemi reali verificati
- Partenza da Erika (ground truth) + forme geometriche pure
- Utenti contribuiscono → admin valida → dataset
- I `secs` esistenti nei progetti Lurumi sono dati semi-strutturati preziosi
- Progressione geometrico → semplice → complesso → avanzato
- Allineamento schema-immagine via parser deterministico

### 2026-03-06 — Sessione 3 (frontend/backend decisions)
- Canva OAuth rimosso — sostituito da export PDF editabile con `pdf-lib`
- PDF strutturato a oggetti (testo reale + immagini separate) → importabile in Canva manualmente
- "Condividi su Canva" via import PDF: nessun OAuth, 2 clic dall'utente
- Aggiunte 3 nuove sezioni admin: coda validazione, test modello RLHF, dataset stats

### 2026-03-06 — Sessione 2 (post analisi libro)
- Vocabolario canonico trilingue IT/EN/ES definito dal libro
- 4 schemi ground truth JSON pronti per il DB
- Invarianti matematici documentati → base per `pattern-math.ts`
- Classificatore Reale vs IA basato su criteri libro (pp. 28-36)
- Livelli di complessità 0-6 con esempi concreti
- **Novità principale:** ciclo RLHF Test → Errore → Correzione admin
  - Il modello viene testato in tempo reale dall'admin
  - Gli errori diventano dati correttivi (tabella `model_feedback`)
  - Il validator deterministico automatizza il check matematico
  - L'admin corregge solo quando il validator non basta (errori semantici)
