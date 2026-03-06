# Estrazione Dati di Training — "Il Metodo Lurumi per leggere gli schemi Amigurumi"
> Autrice: Erika Geraldine Herrera | © 2026 Lurumi
> Analisi completa delle 72 pagine | Ultimo aggiornamento: 2026-03-06

---

## Indice Rapido per Utilità AI

| Sezione | Pagine | Utilità Training | Tipo Dato |
|---------|--------|-----------------|-----------|
| Schema Luly completo | 63-70 | ★★★★★ | Ground truth: schema + parti + misure |
| Tavola abbreviazioni trilinguee | 17-19 | ★★★★★ | Vocabolario canonico IT/EN/ES |
| Punti base step-by-step | 44-57 | ★★★★★ | Stitch definitions + foto |
| Esercizi con schemi reali | 37-43 | ★★★★☆ | Schemi parziali verificati |
| Tavola reale vs IA | 28-36 | ★★★★☆ | Classificatore qualità schema |
| Progressione forma sferica | 20-23 | ★★★☆☆ | Logica aumenti/diminuzioni |
| Materiali e strumenti | 7-14 | ★★☆☆☆ | Vocabolario materiali |
| Pagina personaggi futuri | 71 | ★☆☆☆☆ | Solo riferimento visivo |

---

## 1. VOCABOLARIO CANONICO — Tavola Abbreviazioni (pp. 17-19)

**Priorita massima**: questa tavola definisce il vocabolario ground truth dell'autrice. Qualsiasi modello deve conoscere queste equivalenze prima di tutto.

### Tavola Trilinguea Completa (IT / EN / ES)

| Italiano | English | Español | Significato |
|----------|---------|---------|-------------|
| Cat / Cad | Ch | Cad | Catenella (chain) |
| AM | MR / Mr | Am | Anello Magico (magic ring) |
| Aum | Inc | Aum | Aumento (increase — 2 pb nella stessa maglia) |
| Dim | Dec | Dim | Diminuzione (decrease — unire 2 maglie) |
| m.b / mb | dc / sc | pb | Maglia bassa / punto basso (single crochet) |
| mpa | htc | ma | Mezzo punto alto (half treble) |
| pa | tc | dc | Punto alto (double crochet) |
| dpa | dtc | pad | Doppio punto alto (treble crochet) |
| tpa | ttc | pat | Triplo punto alto (double treble) |
| BLO | BLO | BLO | Solo asole posteriori (back loop only) |
| FLO | FLO | FLO | Solo asole anteriori (front loop only) |
| pbss | sl st | pbss | Punto bassissimo (slip stitch) |
| PA uniti | joined DC | PA uni | Punti alti uniti insieme |

**Nota per il modello:** il libro usa indifferentemente `mb` e `pb` per "punto basso" / "maglia bassa" = stessa cosa. Il modello deve normalizzare entrambe le forme.

---

## 2. DEFINIZIONE PUNTI BASE (pp. 44-57)

### 2.1 Anello Magico (AM / MR)

Quattro metodi accettati dall'autrice:
1. **Classico intorno alle dita** — avvolgere il filo intorno all'indice, passare l'uncinetto
2. **4 catenelle chiuse con punto bassissimo** — per chi non riesce con il classico
3. **Falso anello magico** — alternativa semplificata
4. **Cerchio avvolto** — per filati scivolosi

**Output atteso per training:** quando uno schema dice "AM 6pb" significa:
- Forma un anello magico
- Esegui 6 punti bassi nell'anello
- Chiudi l'anello tirando il capo
- Risultato: cerchio con 6 maglie, base di qualsiasi forma sferica o circolare

### 2.2 Aumento (Aum / Inc)
- Definizione: eseguire 2 punti bassi nella STESSA maglia
- Effetto: +1 maglia per ogni aumento
- Formula matematica: `stitch_count_new = stitch_count_old + num_increases`
- **Regola invariante:** se un giro ha X aumenti, il totale aumenta di esattamente X

### 2.3 Diminuzione Invisibile (Dim / Dec)
- Definizione: inserire l'uncinetto SOLO nei fili anteriori di 2 maglie consecutive, tirare il filo attraverso entrambe, poi completare il punto
- Effetto: -1 maglia per ogni diminuzione (due maglie diventano una)
- Formula matematica: `stitch_count_new = stitch_count_old - num_decreases`
- **Nota "invisibile":** il metodo con solo fili anteriori rende la diminuzione meno visibile sulla superficie
- **Regola invariante:** se un giro ha X diminuzioni, il totale diminuisce di esattamente X

### 2.4 Catenella (Cat / Ch)
- Usata per: avviamenti di pezzi ovali/piatti, maglie aeree, decorazioni
- In schemi ovali: il numero di catenelle = lunghezza dell'asse maggiore - approssimazione

### 2.5 Punto Bassissimo (pbss / sl st)
- Usato per: chiusura giri, unioni, spostamento senza aggiungere altezza
- **Non aumenta il conteggio** — non conta come maglia

### 2.6 Punto Basso (pb / mb / sc / dc)
- Il punto fondamentale dell'amigurumi
- Altezza: la più bassa tra i punti che creano struttura
- Tensione: determina la densità del pezzo (importante per stuffing)

### 2.7 Mezzo Punto Alto (mpa / htc / ma)
- Altezza intermedia tra pb e pa
- Raro nell'amigurumi puro, usato nei vestiti/accessori

### 2.8 Punto Alto (pa / tc / dc)
- Altezza doppia rispetto al pb
- Usato in vestiti, fiori, elementi decorativi
- Nel libro: usato nei "Fiori" (p. 70): "3 PA uniti"

### 2.9 Doppio Punto Alto (dpa / dtc / pad)
- Altezza tripla rispetto al pb
- Usato per petali grandi, elementi molto aperti

### 2.10 Triplo Punto Alto (tpa / ttc / pat)
- Il punto più alto della tavola
- Usato per elementi molto aperti e decorativi

### 2.11 BLO / FLO (Back/Front Loop Only)
- **BLO:** inserire solo nel filo posteriore → crea una linea/crease visibile
- **FLO:** inserire solo nel filo anteriore
- Usato per: separazioni anatomiche (dove un pezzo si attacca), suole di scarpe, bande

---

## 3. LOGICA PROGRESSIONE SFERICA (pp. 20-23)

### Regola Fondamentale della Sfera Amigurumi

Una sfera standard segue sempre questa struttura:
```
Fase 1 — Crescita: +6 maglie per giro (un aumento ogni maglia esistente)
Fase 2 — Plateau: giri diritti (nessuna variazione)
Fase 3 — Chiusura: -6 maglie per giro (una diminuzione ogni maglia rimanente)
```

### Formula per una Sfera di Diametro D

Il numero di maglie al plateau dipende dal diametro target:
- `maglie_plateau = 6 × N` dove N = numero di giri di crescita
- Giri crescita: `N = (maglie_plateau / 6)`
- Giri plateau: dipende dalla lunghezza equatoriale desiderata
- Giri chiusura: stesso numero dei giri di crescita

**Esempio canonico dal libro (sfera piccola):**
```
G1: AM 6pb [6]
G2: aum ×6 [12]
G3: (1pb, aum) ×6 [18]
G4: (2pb, aum) ×6 [24]
G5-G6: 24pb [24]    ← plateau (2 giri)
G7: (2pb, dim) ×6 [18]
G8: (1pb, dim) ×6 [12]
G9: dim ×6 [6]      ← chiusura
```

**Regola distributiva degli aumenti:**
- Passando da M a M+6 maglie: `(M/6 - 1) pb, poi 1 aum` ripetuto 6 volte
- Esempio: 12→18: `(1pb, aum) ×6` — 1 = (12/6 - 1)

---

## 4. SCHEMI ESERCIZIO — Reali Verificati (pp. 37-43)

### 4.1 Schema Procione (parziale, p. 37-40)
*(Schema reale usato come esercizio di lettura)*

```
Testa:
G1: 6 mb nel AM [6]
G2: (aum) ×6 [12]
G3: (1mb, aum) ×6 [18]
G4: (2mb, aum) ×6 [24]
G5: (3mb, aum) ×6 [30]
G6: (4mb, aum) ×6 [36]
G7-G10: 36mb [36]   ← plateau 4 giri
G11: (4mb, dim) ×6 [30]
G12: (3mb, dim) ×6 [24]
G13: (2mb, dim) ×6 [18]
G14: (1mb, dim) ×6 [12]
G15: dim ×6 [6]
```
**Materiali indicati:** 2 colori (grigio + maschera scura), ferri 2.5mm

### 4.2 Schema Pulcino (parziale, p. 41-43)
```
G1: 6 mb nel am [6]
G2: (aum) ×6 [12]
G3: (1mb, aum) ×6 [18]
G4: (2mb, aum) ×6 [24]
Dal G5 al G6: 24 mb [24]   ← plateau
```

---

## 5. SCHEMA LULY — GROUND TRUTH COMPLETO (pp. 63-70)

**Questo è il dato di training più prezioso del libro.** Schema reale, completo, multi-parte, con colori, materiali e foto WIP.

### Materiali
- Cotone gasato colori: bianco, bordeaux, rosso, beige, giallo
- Uncinetto: 2.5mm
- Imbottitura: cotone bianco

### Abbreviazioni usate nello schema
`am, pb, mpa, pa, dpa, aum, dim, cat, blo, pbss, popcorn`

---

### PARTE 1: Testa (36 giri)

```
G1:  AM 6pb                              [6pb]
G2:  (aum) ×6                            [12pb]
G3:  (1pb, aum) ×6                       [18pb]
G4:  (2pb, aum) ×6                       [24pb]
G5:  (3pb, aum) ×6                       [30pb]
G6:  (4pb, aum) ×6                       [36pb]
G7:  (5pb, aum) ×6                       [42pb]
G8:  (6pb, aum) ×6                       [48pb]
G9:  (7pb, aum) ×6                       [54pb]
G10-G11: 54pb                            [54pb]
G12: (7pb, dim) ×6                       [48pb]
G13: (6pb, dim) ×6                       [42pb]
G14: (5pb, dim) ×6                       [36pb]
G15: (4pb, dim) ×6                       [30pb]
G16: (3pb, dim) ×6                       [24pb]
G17-G20: 24pb                            [24pb]  ← plateau basso
G21: (2pb, dim) ×6                       [18pb]
G22: (1pb, dim) ×6                       [12pb]
G23-G30: 12pb                            [12pb]  ← collo (plateau stretto)
G31: (1pb, aum) ×6                       [18pb]
G32: (2pb, aum) ×6                       [24pb]
G33-G34: 24pb                            [24pb]
G35: (2pb, dim) ×6                       [18pb]
G36: (1pb, dim) ×6                       [12pb]
```

**Nota tecnica:** la testa di Luly non è una sfera semplice — ha un collo stretto (G23-G30 a 12pb) e poi si allarga per formare il busto superiore. Questo è un pattern non-standard che il modello deve riconoscere come "testa + collo integrati".

---

### PARTE 2: Capelli (16 giri)

```
G1:  AM 6pb                              [6pb]
G2:  (aum) ×6                            [12pb]
G3:  (1pb, aum) ×6                       [18pb]
G4:  (2pb, aum) ×6                       [24pb]
G5:  (3pb, aum) ×6                       [30pb]
G6:  (4pb, aum) ×6                       [36pb]
G7:  (5pb, aum) ×6                       [42pb]
G8:  (6pb, aum) ×6                       [48pb]
G9-G12: 48pb                             [48pb]
G13: (6pb, dim) ×6                       [42pb]
G14: (5pb, dim) ×6                       [36pb]
G15: (4pb, dim) ×6                       [30pb]
G16: (3pb, dim) ×6                       [24pb]
```

**Codini (treccine):** serie di catenelle di lunghezze variabili che vengono attaccate ai capelli — dettaglio estetico, non strutturale per il training di base.

---

### PARTE 3: Piedi (22 giri) — con unione gambe

**Avviamento ovale:**
```
Fare 10 cat
G1:  saltare 1 cat, 8pb, 3pb nell'ultima cat, 7pb (lato opposto), aum nel primo    [20pb]
G2:  aum, 7pb, aum ×3, 7pb, aum ×2                                                 [26pb]
G3:  (1pb, aum), 7pb, (1pb, aum) ×3, 7pb, (1pb, aum) ×2                           [32pb]
G4:  fare 31pb in blo (asole dietro)                                               [32pb]
G5:  32pb                                                                            [32pb]
G6:  8pb, (dim) ×4, 8pb, (dim) ×4                                                  [24pb]
G7:  (dim) ×4, 8pb, (dim) ×4                                                       [16pb]
G8-G13: 16pb                                                                         [16pb]  ← gamba
G14: cambio colore beige → bianco
G14-G21: 16pb in bianco                                                              [16pb]
G22: unire le due gambe: 46pb totali                                               [46pb]
```

**Nota tecnica:** i piedi/gambe sono la parte più complessa — avviamento ovale (non anello magico), BLO per creare la suola, cambio colore, e infine unione delle due gambe che diventa il punto di partenza del corpo. Questa tecnica è fondamentale per qualsiasi personaggio con gambe.

---

### PARTE 4: Corpo (continuazione da G23)

Il corpo continua direttamente dalla gamba unita a G22:
```
G23-G30: 46pb                            [46pb]
G31: (5pb, dim) ×6, 4pb                  [40pb]
G32-G35: 40pb                            [40pb]
G36: (4pb, dim) ×6, 4pb                  [34pb]
G37-G40: 34pb                            [34pb]
G41: (3pb, dim) ×6, 4pb                  [28pb]
G42-G43: 28pb                            [28pb]
G44: attacca braccio sinistro (4pb corpo + giro braccio)
G45: attacca braccio destro
G46-G58: gestione attacchi e chiusura corpo
```

**Nota tecnica:** l'attacco delle braccia al corpo (G44-G45) avviene lavorando attraverso sia le maglie del corpo che dell'estremità del braccio — tecnica di "join" che il modello deve capire come diversa dalla semplice cucitura.

---

### PARTE 5: Bracci (18 giri)

```
G1:  AM 6pb                              [6pb]
G2:  (aum) ×6                            [12pb]
G3:  (1pb, aum) ×6                       [18pb]  ← NB: questo è insolito, molto largo per un braccio
```

**Correzione nota:** probabilmente `G3: (aum) ×3` o simile — verificare con Erika. Il conteggio [18pb] per un braccio è molto largo; potrebbe essere un errore di trascrizione nel libro o il braccio è particolarmente voluminoso per Luly.

```
G4:  popcorn stitch (punto popcorn)      ← decorativo
G5-G18: pb in numero variabile           [dipende dalla correzione G3]
```

---

### PARTE 6: Camicia (a pezzi piatti)

```
Base: 35 cat
G1:  35pb                                [35pb]
G2:  (aum) ×X                            [~52pb]
G3-G5: X pb                              [52pb]
G6:  aperture per maniche (catene di esclusione)
...fino a completamento
```

---

### PARTE 7: Colletto
Serie di punti alti e mezzi punti alti applicati al bordo della camicia.

---

### PARTE 8: Gonna
Lavorata separatamente, attaccata al corpo finito.

---

### PARTE 9: Stivaletti (11 giri) — p. 70

```
Fare 12 cat
G1:  saltare 1 cat, 1 aum, 9pb, 2 aum, 9pb, 1 aum     [26pb]
G2:  1 aum, 10pb, 4 aum, 10pb, 1 aum                   [32pb]
G3:  10pb, (1 aum, 1 pb) ×6, 10pb                      [38pb]
G4:  fare 37pb in blo (asole dietro)                   [38pb]
G5:  38pb                                               [38pb]
G6:  10pb, (1 dim, 1 pb) ×6, 10pb                      [32pb]
G7:  1 dim, 10pb, 4 dim, 10pb, 1 dim                   [26pb]
G8-G11: 26pb                                            [26pb]
```
*I cuori degli stivaletti sono imbastiti con il filo di cotone bianco.*

**Nota tecnica:** gli stivaletti seguono la stessa logica ovale dei piedi (avviamento a catene, espansione simmetrica per la punta, BLO per la suola, poi riduzione per il tacco). Schema geometricamente speculare a quello dei piedi ma più piccolo.

---

### PARTE 10: Fiori — p. 70

```
G1:  5pb nell'AM                         [5pb]
G2:  (1 pbss, 3 cat, 3 PA uniti, 3 cat, 1 pbss) ×5   [5 petali]
```

**Nota tecnica:** il fiore è un elemento bidimensionale. La formula "3 PA uniti" significa 3 punti alti che condividono lo stesso punto di chiusura (cluster stitch). Questo crea un petalo arrotondato. Pattern applicabile a qualsiasi fiore a 5 petali.

---

## 6. TAVOLA DIAGNOSTICA: REALE vs IA (pp. 28-36)

**Alta utilità per il training** — questa sezione è la più preziosa per costruire un classificatore di qualità degli schemi.

### Tabella "Come riconoscere un amigurumi reale vs IA"

| Caratteristica | Amigurumi Reale | Generato da IA |
|---------------|-----------------|----------------|
| Forma delle maglie | Regolari, distinguibili, in fila ordinate | Irregolari, confuse, sfocate |
| Ombre | Coerenti con la forma 3D, soft shadows | Ombre piatte o contraddittorie |
| Texture del filo | Fibre distinguibili, torsione visibile | Superficie liscia o texture generica |
| Effetto aumento | Aumenti visibili ai bordi come piccole V | Non rilevabili o mancanti |
| Imprecisioni naturali | Piccole variazioni tra una maglia e l'altra | Troppo perfetto o troppo caotico |
| Doppia maglia | Le maglie doppie (BLO/FLO) creano un bordo netto | Assente o simulato |
| Imbottitura | Rigonfiamento coerente con la forma geometrica | Gonfiore anomalo o mancante |
| Occhi di sicurezza | Riflesso specifico del plastico nero | Simulati, proporzioni errate |
| Giunture tra parti | Cucitura visibile ma ordinata | Mancante o irreal |
| Colori | Colori del filato (opachi, leggermente variabili) | Saturazione digitale |

**Applicazione al training:**
- Le foto delle immagini generate da AI non sono adatte al training
- Solo foto di amigurumi reali handmade possono essere usate
- Questo classificatore può essere implementato come step di validazione automatica prima che una foto entri nel dataset

---

## 7. MATERIALI E GAUGE (pp. 7-14)

### Tipi di Filato per Amigurumi
| Tipo | Peso | Uncinetto consigliato | Utilizzo |
|------|------|----------------------|---------|
| Cotone gasato | Fingering/DK | 2.0-2.5mm | Standard amigurumi (usato da Luly) |
| Cotone soft | DK | 2.5-3.0mm | Amigurumi più morbidi |
| Acrilico | DK/Worsted | 3.0-4.0mm | Economico, buona definizione |
| Lana | DK/Worsted | 3.5-4.5mm | Risultato più rustico |
| Peluche | Super bulky | 5.0-6.0mm | Amigurumi morbidissimi |

### Gauge Standard (calibrazione)
Per cotone gasato 2.5mm (standard Lurumi):
- ~5 maglie = 1 cm
- **Quindi:** `diametro_cm ≈ stitch_count_plateau / (6 × 5)` per una sfera

**Questa formula è il core del parser deterministico schema→dimensioni:**
- Sfera con plateau 30 maglie → diametro ≈ 30 / 30 = ~1 cm per "cerchio" → ~4-5cm diametro sfera 3D

*Nota: il gauge reale varia molto con tensione utente. Erika deve fornire il gauge esatto per ogni schema ground truth.*

---

## 8. PERSONAGGI FUTURI (p. 71) — Riferimento Visivo

La serie "Luly e i suoi amici" prevede i seguenti personaggi con schema futuro:

| Personaggio | Descrizione visiva | Schema disponibile |
|-------------|-------------------|-------------------|
| Sara | Bambina capelli rossi lunghi, cappello giallo, borsa | Futuro |
| Tommy | Bambino capelli castani corti, pantaloni rossi | Futuro |
| Clara | Bambina capelli neri lunghi, vestito giallo con cuori | Futuro |
| Babol | Bambina capelli castani/rossi ricci, borsa a tracolla | Futuro |
| Susy | Bambina capelli biondi, vestito verde | Futuro |
| Lurumi | Pecorella bianca con orecchie blu, tiene un gomitolo | Mascotte Lurumi |

**Utilità per training:** questi personaggi sono i target ideali per i dataset futuri. Quando Erika creerà i loro schemi, saranno ground truth di livello massimo (personaggi umanoidi multi-parte con abbigliamento).

---

## 9. ESTRAZIONI JSON PRONTE PER IL DATABASE

### 9.1 Schema Fiore (completo, training-ready)

```json
{
  "title": "Fiore a 5 petali",
  "category": "decorative",
  "difficulty": "beginner",
  "yarn_weight": "fingering",
  "hook_size": "2.5mm",
  "finished_size_cm": "3-4cm diametro",
  "author": "Erika Geraldine Herrera",
  "source": "Il Metodo Lurumi - p.70",
  "status": "ground_truth",
  "parts": [
    {
      "name": "Fiore",
      "color": "colore a scelta",
      "is_flat": true,
      "rounds": [
        {"round": 1, "instruction": "5pb nell'AM", "stitch_count": 5},
        {"round": 2, "instruction": "(1 pbss, 3 cat, 3 PA uniti, 3 cat, 1 pbss) ×5", "stitch_count": 5, "note": "5 petali — il pbss non conta come maglia"}
      ]
    }
  ]
}
```

### 9.2 Schema Stivaletto Luly (completo, training-ready)

```json
{
  "title": "Stivaletto Luly",
  "category": "accessory",
  "difficulty": "intermediate",
  "yarn_weight": "fingering",
  "hook_size": "2.5mm",
  "author": "Erika Geraldine Herrera",
  "source": "Il Metodo Lurumi - p.70",
  "status": "ground_truth",
  "parts": [
    {
      "name": "Stivaletto",
      "color": "bordeaux",
      "start_type": "chain",
      "chain_count": 12,
      "rounds": [
        {"round": 1, "instruction": "saltare 1 cat, 1 aum, 9pb, 2 aum, 9pb, 1 aum", "stitch_count": 26},
        {"round": 2, "instruction": "1 aum, 10pb, 4 aum, 10pb, 1 aum", "stitch_count": 32},
        {"round": 3, "instruction": "10pb, (1 aum, 1 pb) ×6, 10pb", "stitch_count": 38},
        {"round": 4, "instruction": "fare 37pb in blo", "stitch_count": 38, "modifier": "BLO"},
        {"round": 5, "instruction": "38pb", "stitch_count": 38},
        {"round": 6, "instruction": "10pb, (1 dim, 1 pb) ×6, 10pb", "stitch_count": 32},
        {"round": 7, "instruction": "1 dim, 10pb, 4 dim, 10pb, 1 dim", "stitch_count": 26},
        {"round": "8-11", "instruction": "26pb", "stitch_count": 26}
      ],
      "note": "I cuori degli stivaletti sono imbastiti con il filo di cotone bianco"
    }
  ]
}
```

### 9.3 Schema Testa Luly (completo, training-ready)

```json
{
  "title": "Testa Luly",
  "category": "character_part",
  "difficulty": "intermediate",
  "yarn_weight": "fingering",
  "hook_size": "2.5mm",
  "author": "Erika Geraldine Herrera",
  "source": "Il Metodo Lurumi - pp.63-65",
  "status": "ground_truth",
  "parts": [
    {
      "name": "Testa",
      "color": "beige",
      "start_type": "magic_ring",
      "rounds": [
        {"round": 1, "instruction": "AM 6pb", "stitch_count": 6},
        {"round": 2, "instruction": "aum ×6", "stitch_count": 12},
        {"round": 3, "instruction": "(1pb, aum) ×6", "stitch_count": 18},
        {"round": 4, "instruction": "(2pb, aum) ×6", "stitch_count": 24},
        {"round": 5, "instruction": "(3pb, aum) ×6", "stitch_count": 30},
        {"round": 6, "instruction": "(4pb, aum) ×6", "stitch_count": 36},
        {"round": 7, "instruction": "(5pb, aum) ×6", "stitch_count": 42},
        {"round": 8, "instruction": "(6pb, aum) ×6", "stitch_count": 48},
        {"round": 9, "instruction": "(7pb, aum) ×6", "stitch_count": 54},
        {"round": "10-11", "instruction": "54pb", "stitch_count": 54},
        {"round": 12, "instruction": "(7pb, dim) ×6", "stitch_count": 48},
        {"round": 13, "instruction": "(6pb, dim) ×6", "stitch_count": 42},
        {"round": 14, "instruction": "(5pb, dim) ×6", "stitch_count": 36},
        {"round": 15, "instruction": "(4pb, dim) ×6", "stitch_count": 30},
        {"round": 16, "instruction": "(3pb, dim) ×6", "stitch_count": 24},
        {"round": "17-20", "instruction": "24pb", "stitch_count": 24, "note": "plateau basso"},
        {"round": 21, "instruction": "(2pb, dim) ×6", "stitch_count": 18},
        {"round": 22, "instruction": "(1pb, dim) ×6", "stitch_count": 12},
        {"round": "23-30", "instruction": "12pb", "stitch_count": 12, "note": "collo stretto"},
        {"round": 31, "instruction": "(1pb, aum) ×6", "stitch_count": 18},
        {"round": 32, "instruction": "(2pb, aum) ×6", "stitch_count": 24},
        {"round": "33-34", "instruction": "24pb", "stitch_count": 24},
        {"round": 35, "instruction": "(2pb, dim) ×6", "stitch_count": 18},
        {"round": 36, "instruction": "(1pb, dim) ×6", "stitch_count": 12}
      ]
    }
  ]
}
```

### 9.4 Schema Piede/Gamba Luly (training-ready)

```json
{
  "title": "Piede e Gamba Luly",
  "category": "character_part",
  "difficulty": "advanced",
  "yarn_weight": "fingering",
  "hook_size": "2.5mm",
  "author": "Erika Geraldine Herrera",
  "source": "Il Metodo Lurumi - pp.66-67",
  "status": "ground_truth",
  "parts": [
    {
      "name": "Piede+Gamba",
      "colors": ["beige", "bianco"],
      "start_type": "chain",
      "chain_count": 10,
      "rounds": [
        {"round": 1, "instruction": "saltare 1 cat, 8pb, 3pb nell'ultima cat, 7pb, aum nel primo", "stitch_count": 20},
        {"round": 2, "instruction": "aum, 7pb, aum ×3, 7pb, aum ×2", "stitch_count": 26},
        {"round": 3, "instruction": "(1pb, aum), 7pb, (1pb, aum) ×3, 7pb, (1pb, aum) ×2", "stitch_count": 32},
        {"round": 4, "instruction": "fare 31pb in blo", "stitch_count": 32, "modifier": "BLO"},
        {"round": 5, "instruction": "32pb", "stitch_count": 32},
        {"round": 6, "instruction": "8pb, dim ×4, 8pb, dim ×4", "stitch_count": 24},
        {"round": 7, "instruction": "dim ×4, 8pb, dim ×4", "stitch_count": 16},
        {"round": "8-13", "instruction": "16pb", "stitch_count": 16, "note": "gamba"},
        {"round": 14, "instruction": "cambio colore a bianco, 16pb", "stitch_count": 16, "color_change": "beige→bianco"},
        {"round": "15-21", "instruction": "16pb", "stitch_count": 16},
        {"round": 22, "instruction": "unire le due gambe: 46pb", "stitch_count": 46, "note": "punto di unione con la seconda gamba"}
      ]
    }
  ]
}
```

---

## 10. VOCABOLARIO TRAINING: PATTERNS LINGUISTICI

Il modello deve riconoscere queste strutture sintattiche come istruzioni di schema:

### Pattern Ripetizione
- `(X, Y) ×N` = eseguire X e Y per N volte
- `Dal G_start al G_end: Npb` = giri da N a M tutti uguali, N pb ciascuno
- `×6 volte` = ripetere 6 volte (= 1 volta per ogni 1/6 del cerchio, per sfere)

### Pattern Inizio Pezzo
- `Fare N cat` = avviamento a catene per pezzi ovali
- `AM Npb` = anello magico con N punti bassi iniziali
- `Fare N cat, chiudere con pbss` = avviamento per pezzi piatti circolari

### Pattern Stitch Count
- `[Npb]` o `(Npb)` alla fine di una riga = numero maglie totali dopo quel giro
- Deve essere verificabile matematicamente

### Pattern Modificatori
- `in blo` o `in asole dietro` = BLO modifier
- `cambio colore` = color change, nuovo colore per i giri successivi
- `lasciare un'apertura` = stuffing hole, giro non completamente chiuso

---

## 11. PRIORITA DI INSERIMENTO NEL DATABASE

**Ordine suggerito per popolare `training_patterns`:**

1. **Subito (p. 70):** Fiore (2 giri, beginner) → schema più semplice, perfetto per test del sistema
2. **Subito (pp. 63-65):** Testa Luly (36 giri) → schema più completo disponibile
3. **Subito (p. 70):** Stivaletto (11 giri) → schema ovale, intermedio
4. **Poi (pp. 66-68):** Piede+Gamba+Corpo Luly → schema avanzato con unione parti
5. **Poi (pp. 37-43):** Procione + Pulcino → schemi esercizio parziali (integrare con parti mancanti)
6. **Futuro:** Sara, Tommy, Clara, Babol, Susy, Lurumi (quando Erika creerà gli schemi)

---

## 12. NOTE FINALI PER L'ADMIN

- Tutte le trascrizioni JSON in sezione 9 sono pronte per essere inserite nella tabella `training_patterns` con `status = 'ground_truth'` e `validated_by = [Erika user_id]`
- I giri con range (`"8-11"`) devono essere espansi in giri individuali nel DB finale per permettere associazione di immagini per giro specifico
- Verificare con Erika il conteggio G3 del braccio Luly ([18pb] sembra inusualmente largo per un braccio)
- Le foto WIP alle pagine 66, 67, 68, 69 mostrano i vari stadi di assemblaggio — preziose come riferimento visivo del progresso per giro
- I personaggi futuri (Sara, Tommy, ecc.) devono essere inseriti appena Erika crea i loro schemi — sono il target naturale del dataset di livello 4 (personaggi complessi)
