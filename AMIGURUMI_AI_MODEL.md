# Progetto: Modello AI Custom per Pattern Amigurumi
> File di continuità per sessioni multiple con Claude Code
> Ultimo aggiornamento: 2026-03-06

---

## Obiettivo

Creare un modello AI proprietario capace di:
1. **Generare schemi amigurumi affidabili e tecnicamente corretti** (testo strutturato con istruzioni riga per riga)
2. **Generare immagini che corrispondano ESATTAMENTE allo schema prodotto** (non generiche, ma coerenti con forma, proporzioni e colori dello schema)
3. Tutto questo in modo **economico, legale in Italia/EU, con piena proprietà del modello**

---

## Analisi del Problema

### Perché nessuna AI attuale lo fa bene

- I modelli generativi (GPT, Claude, Gemini) generano pattern plausibili ma con **errori strutturali**: conteggi di punti sbagliati, diminuzioni che non chiudono la forma, proporzioni impossibili
- Non esiste allineamento tra testo schema e immagine: un'AI genera l'immagine indipendentemente dallo schema
- Il linguaggio degli schemi amigurumi è **semi-formale e specialistico**: mix di abbreviazioni (sc, inc, dec, MR, sl st), numerazione circolare, assembly notes

### Soluzione in 2 componenti

```
Componente A: LLM fine-tuned → genera schema testuale corretto
Componente B: Diffusion model fine-tuned → genera immagine CONDIZIONATA allo schema
                                           (non generica, ma legata alle specifiche del pattern)
```

---

## Architettura Tecnica Consigliata

### Componente A — Generazione Schema (LLM)

**Modello base raccomandato: Mistral 7B v0.3**
- Licenza: Apache 2.0 → piena proprietà commerciale del fine-tune
- 7B parametri: ottimo rapporto qualità/costo per testo strutturato
- Alternative: LLaMA 3 8B (Meta custom license, commerciale OK), Phi-3 Mini (MIT)

**Metodo di training: QLoRA (Quantized Low-Rank Adaptation)**
- Riduce la VRAM necessaria da 40GB a ~8-12GB
- Costo: ~$50-150 per run iniziale su RunPod (GPU A100 ~$2/ora, ~25-75h)
- Tool: Hugging Face `transformers` + `peft` + `trl` (SFTTrainer)
- Nessuna condivisione pesi con terzi

**Formato dati training (JSONL):**
```json
{
  "instruction": "Genera uno schema amigurumi per un gatto seduto, altezza 15cm, lana worsted weight",
  "output": "MATERIALI:\n- Lana beige 50g\n- Lana nera 10g (dettagli)\n- Ferri n.3\n- Occhi di sicurezza 9mm\n\nTESTA:\nMagic Ring, 6sc (6)\nRound 1: inc x6 (12)\nRound 2: *sc, inc* x6 (18)\n..."
}
```

### Componente B — Generazione Immagine Allineata

**Approccio: Flux.1-dev fine-tuned con ControlNet custom**

Il segreto dell'allineamento schema-immagine è **condizionare la generazione su features estratte dallo schema**:

```
Schema testo → Parser → Feature vector (forma, colori, proporzioni, parti)
                              ↓
Feature vector + prompt → Flux fine-tuned → Immagine coerente
```

**Feature vector estratto dallo schema:**
- Forma globale (sferica, cilindrica, ovale)
- Numero di parti (testa, corpo, arti, accessori)
- Palette colori (estratta dalle istruzioni di cambio colore)
- Proporzioni (stitch count comparativo tra parti)
- Texture yarn (weight, tipo punto)

**Alternativa più semplice (fase 1):**
Usare GPT-4o per estrarre le feature dallo schema → passarle come prompt ultra-dettagliato a Flux o SDXL fine-tuned su dataset amigurumi

**Tool per fine-tuning immagini:**
- `diffusers` (Hugging Face) per SDXL/Flux LoRA
- DreamBooth / LoRA con ~500-2000 immagini amigurumi taggate
- Piattaforma: RunPod o Replicate custom model

---

## Piano di Raccolta Dati (LEGALE in Italia/EU)

### Fonti legali disponibili

| Fonte | Legale? | Note |
|-------|---------|------|
| Schemi creati da te/team | SI | Fonte primaria, nessun problema |
| Schemi utenti Lurumi (con consenso) | SI | Richiede clausola ToS esplicita |
| Ravelry scraping | NO | Termini di servizio vietano scraping |
| Etsy scraping | NO | ToS proibisce, copyright individuale |
| Creative Commons (CC0, CC-BY) | SI | Verificare singola licenza |
| Schemi pubblici pre-1926 | SI | Dominio pubblico (ma amigurumi è recente) |
| Sintetici generati da LLM + validati | SI | Approccio raccomandato per scalare |

### Strategia raccolta dati via Lurumi

**Azione richiesta nel codice Lurumi:**

1. **Consenso esplicito in ToS** — aggiungere clausola:
   > "I pattern e schemi da te creati o salvati nell'app potranno essere utilizzati in forma anonimizzata per migliorare i servizi AI di Lurumi"

2. **Annotation tool nell'app** — sezione admin per:
   - Visualizzare schemi utenti anonimi
   - Validarli/correggerli
   - Etichettarli con metadati (tipo animale, difficoltà, dimensioni)

3. **Generazione sintetica** — usare GPT-4o per generare ~5000 schemi sintetici diversi come seed dataset iniziale, poi validare quelli migliori

**Quantità dati necessaria (stima):**
- Fase 1 (prototipo): 500-1000 schemi di qualità
- Fase 2 (modello solido): 5000-10000 schemi
- Fase 3 (eccellenza): 20000+ con diversity massima

---

## Conformità Legale Italia/EU

### Copyright e Data Mining

- **Direttiva EU 2019/790 (DSM), Art. 4**: permette text/data mining anche per scopi commerciali SE il titolare del copyright non ha espressamente riservato tale diritto ("opt-out machine readable")
- **Legge italiana 633/1941** (aggiornata): recepisce la direttiva DSM
- **In pratica**: siti come Ravelry che hanno `disallow` nel robots.txt o ToS anti-scraping = opt-out → NON usabili
- **Soluzione sicura**: dati propri + sintetici + CC0

### EU AI Act (in vigore 2024-2025)

Il sistema rientra in **rischio limitato** (non alto rischio):
- Obblighi: trasparenza verso utenti che interagiscono con AI
- Documentare il training dataset (già fatto con questo file)
- Nessun obbligo di audit esterno per questo caso d'uso

### Proprietà Intellettuale del Modello

**Per garantire piena proprietà:**
- Usare modelli base con licenza Apache 2.0 o MIT (Mistral, Phi-3)
- NON usare OpenAI fine-tuning API (OpenAI si riserva diritti di uso)
- NON usare Google Vertex AI fine-tuning senza leggere i ToS
- Training in autonomia su cloud (RunPod, Lambda Labs, vast.ai) = pesi 100% tuoi
- Registrare i pesi del modello su Hugging Face in repo PRIVATO
- Documentare il processo di training (timestamp, dataset, iperparametri)

**I pesi fine-tuned sono di tua proprietà** perché:
1. Mistral Apache 2.0 lo permette esplicitamente
2. I dati di training sono tuoi
3. Il training è eseguito su infrastruttura che non rivendica diritti

---

## Roadmap di Sviluppo

### Fase 0 — Infrastruttura dati (1-2 mesi, costo: ~€0)
- [ ] Aggiungere clausola ToS consenso dati in Lurumi
- [ ] Creare formato schema standardizzato (JSON schema definition)
- [ ] Costruire annotation tool nell'admin di Lurumi
- [ ] Generare 1000 schemi sintetici con GPT-4o e validarli manualmente

### Fase 1 — Prototipo LLM (1 mese, costo: ~€100-300)
- [ ] Preparare dataset JSONL da schemi validati
- [ ] Fine-tune Mistral 7B con QLoRA su RunPod
- [ ] Valutazione: stitch count accuracy, round closure, assembly completeness
- [ ] Integrare endpoint nel backend Lurumi come funzionalità beta

### Fase 2 — Allineamento immagine (2-3 mesi, costo: ~€300-800)
- [ ] Raccogliere 500+ immagini amigurumi con schema associato
- [ ] Fine-tune SDXL LoRA su dataset amigurumi
- [ ] Costruire parser schema → feature vector
- [ ] Pipeline: schema → features → prompt condizionato → immagine
- [ ] Valutazione: coerenza forma/colori immagine con schema

### Fase 3 — Produzione (ongoing)
- [ ] A/B test modello custom vs API commerciali
- [ ] Flywheel: utenti Lurumi generano schemi → validati → reinseriti nel training
- [ ] Hosting modello: Replicate custom model o self-hosted su VPS GPU

---

## Stack Tecnologico

```
Training:
- Python 3.11
- transformers, peft, trl, bitsandbytes (QLoRA)
- datasets (Hugging Face)
- wandb (monitoring training)

Infrastruttura training:
- RunPod (A100 80GB: ~$2.50/h) oppure vast.ai (più economico)
- Storage: Hugging Face Hub (repo privato) + Supabase Storage backup

Serving (dopo training):
- Replicate custom model (se vuoi API semplice)
- vLLM self-hosted (massima efficienza, costo fisso)
- Integrazione in Lurumi: API route Next.js → chiamata al modello

Dati:
- Supabase: tabella `training_patterns` (id, content, metadata, validated, source)
- Supabase: tabella `training_images` (id, url, pattern_id, tags)
```

---

## Costi Stimati Totali

| Voce | Costo stimato |
|------|---------------|
| Generazione dati sintetici (GPT-4o, 5000 schemi) | ~€50-100 |
| Training LLM Fase 1 (RunPod, ~50h A100) | ~€125 |
| Training immagini Fase 2 (RunPod, ~100h) | ~€250 |
| Storage e infrastruttura | ~€20/mese |
| **Totale lancio** | **~€500-600** |
| Ongoing (inference self-hosted) | ~€30-80/mese |

---

## Domande Aperte / Da Decidere

1. **Vuoi che gli utenti Lurumi possano usare il modello custom direttamente nell'app?** (sostituisce le chiamate a Replicate/OpenAI)
2. **Vuoi monetizzare il modello anche esternamente** (API, licenza a terzi) o solo interno a Lurumi?
3. **Qual è il budget iniziale disponibile?** (orienta se partire con dataset sintetico piccolo o investire subito)
4. **Hai GPU locale?** (RTX 3090/4090 permetterebbe training senza cloud)

---

## File Correlati nel Progetto

- `src/app/api/generate-image/route.ts` — attuale generazione immagini (Replicate + OpenAI)
- `src/app/admin/AdminDashboard.tsx` — pannello admin (dove aggiungere annotation tool)
- `scripts/setup-db.mjs` — script migrazioni DB (aggiungere tabelle training)

---

## Note Sessioni

### 2026-03-06
- File creato. Analisi iniziale completata.
- Prossimi passi: decidere budget, aggiungere clausola ToS, creare formato schema standard
