/**
 * pattern-math.ts
 * Validator deterministico e normalizzatore per schemi amigurumi Lurumi.
 * Zero dipendenze esterne — logica pura, zero costi API.
 *
 * Funzioni esportate:
 *   normalizeStitch(alias)       — normalizza abbreviazioni IT/EN/ES → forma canonica EN
 *   validateRound(prev, instr)   — verifica il conteggio maglie di un giro
 *   validatePart(rounds)         — verifica un'intera parte (tutti i giri)
 *   estimateSizeCm(count, gauge) — stima dimensione fisica in cm dal conteggio
 *   distributiveFormula(from,to) — genera la formula distributiva aumenti/diminuzioni
 */

// ---------------------------------------------------------------------------
// Tipi
// ---------------------------------------------------------------------------

export interface Round {
  round: number | string
  instruction: string
  stitch_count: number
  modifier?: string
  note?: string
  color_change?: boolean | string
}

export interface RoundValidationResult {
  round: number | string
  ok: boolean
  expected: number
  got: number
  errors: string[]
  syntaxErrors: string[]
  suggestion: string | null  // istruzione auto-corretta se ci sono errori di sintassi
}

export interface PartValidationResult {
  valid: boolean
  rounds: RoundValidationResult[]
  totalErrors: number       // errori matematici
  totalSyntaxErrors: number // errori di sintassi
}

// ---------------------------------------------------------------------------
// Validazione sintattica — regole di formato indipendenti dalla matematica
// ---------------------------------------------------------------------------

export interface SyntaxValidationResult {
  ok: boolean
  errors: string[]
  suggestion: string | null // versione corretta auto-generata, null se nessun errore
}

export interface SyntaxRule {
  wrong: string    // pattern sbagliato (normalizzato lowercase per confronto)
  correct: string  // versione corretta canonica
  source?: string  // 'book' | 'feedback' — provenienza della regola
}

/**
 * Regole sintattiche statiche estratte dal libro "Il Metodo Lurumi".
 * Fonte: LIBRO_LURUMI_TRAINING_EXTRACTION.md §10 — Pattern Linguistici
 */
export const BOOK_SYNTAX_RULES: SyntaxRule[] = [
  // Simbolo moltiplicazione: x → ×
  // (gestito anche da R1 dinamica, ma utile come esempio)
  { wrong: 'aum x6',  correct: 'aum ×6',        source: 'book' },
  { wrong: 'dim x6',  correct: 'dim ×6',         source: 'book' },
  { wrong: 'aum x 6', correct: 'aum ×6',         source: 'book' },
  { wrong: 'dim x 6', correct: 'dim ×6',         source: 'book' },
  // Parentesi mancanti nei gruppi (esempi canonici dal libro)
  { wrong: '1pb, aum x6',  correct: '(1pb, aum) ×6',  source: 'book' },
  { wrong: '2pb, aum x6',  correct: '(2pb, aum) ×6',  source: 'book' },
  { wrong: '1pb, dim x6',  correct: '(1pb, dim) ×6',  source: 'book' },
  { wrong: '2pb, dim x6',  correct: '(2pb, dim) ×6',  source: 'book' },
]

/**
 * Verifica la sintassi di un'istruzione secondo le regole di formato Lurumi.
 * Non dipende dal conteggio maglie — è puramente testuale.
 *
 * Regole statiche:
 *   R1 — La lettera 'x' usata come moltiplicazione → deve essere '×' (U+00D7)
 *   R2 — Gruppo multi-istruzione prima di ×N senza parentesi → aggiungere ( )
 *
 * Regole dinamiche (opzionali):
 *   dynamicRules — estratte dai feedback admin salvati nel DB
 *   Quando l'admin corregge GPT, il pattern sbagliato→corretto viene
 *   salvato e caricato qui per riconoscerlo automaticamente in futuro.
 */
export function validateSyntax(
  instruction: string,
  dynamicRules: SyntaxRule[] = []
): SyntaxValidationResult {
  const errors: string[] = []
  let fixed = instruction

  // Controlla prima le regole dinamiche (dal DB) — hanno priorità perché sono
  // correzioni specifiche fatte dall'admin su errori reali di GPT
  const instrLower = instruction.toLowerCase().trim()
  for (const rule of dynamicRules) {
    if (instrLower === rule.wrong.toLowerCase().trim()) {
      errors.push(`Sintassi non canonica (corretta in precedenza dall'admin)`)
      fixed = rule.correct
      // Una sola regola dinamica per istruzione — evita conflitti
      break
    }
  }

  // R1: 'x' (lettera ASCII) usata come simbolo moltiplicazione
  // Riconosce: ") x6", "aum x 6", "pb x6"
  if (errors.length === 0) {
    const asciiX = /([)a-zA-Z\d])\s*\bx\b\s*(\d+)/g
    if (asciiX.test(fixed)) {
      errors.push('Usa × (U+00D7) invece della lettera x come simbolo di ripetizione')
      fixed = fixed.replace(/([)a-zA-Z\d])\s*\bx\b\s*(\d+)/g, (_, before, n) =>
        `${before} ×${n}`
      )
    }
  }

  // R2: gruppo multi-istruzione (contiene virgola) davanti a ×N senza parentesi
  // Es. "pb, aum ×6" → "(pb, aum) ×6"
  if (errors.length === 0) {
    const missingParens = /^([^()\n,]+,[^()\n]+)\s*[×]\s*(\d+)\s*$/
    const mpMatch = fixed.match(missingParens)
    if (mpMatch) {
      const inner = mpMatch[1].trim()
      const n = mpMatch[2]
      errors.push(`Gruppo multi-istruzione deve essere tra parentesi: (${inner}) ×${n}`)
      fixed = `(${inner}) ×${n}`
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    suggestion: errors.length > 0 ? fixed : null,
  }
}

// ---------------------------------------------------------------------------
// Vocabolario canonico — tutte le abbreviazioni IT / EN / ES → forma EN
// Fonte: "Il Metodo Lurumi", tavola abbreviazioni pp. 17-19
// ---------------------------------------------------------------------------

const STITCH_MAP: Record<string, string> = {
  // Punto basso / Single crochet
  mb: 'sc', pb: 'sc', 'mb/pb': 'sc', dc: 'sc',
  sc: 'sc',

  // Aumento / Increase
  aum: 'inc', inc: 'inc',

  // Diminuzione / Decrease
  dim: 'dec', dec: 'dec',

  // Anello magico / Magic ring
  am: 'mr', AM: 'mr', mr: 'mr', MR: 'mr', Mr: 'mr',

  // Catenella / Chain
  cat: 'ch', cad: 'ch', ch: 'ch',

  // Punto bassissimo / Slip stitch
  pbss: 'sl st', 'sl st': 'sl st', slst: 'sl st',

  // Mezzo punto alto / Half treble crochet
  mpa: 'htc', ma: 'htc', htc: 'htc',

  // Punto alto / Double crochet (UK) / Treble crochet (US)
  pa: 'tc', tc: 'tc', 'dc(uk)': 'tc',

  // Doppio punto alto / Treble crochet
  dpa: 'dtc', pad: 'dtc', dtc: 'dtc',

  // Triplo punto alto / Double treble
  tpa: 'ttc', pat: 'ttc', ttc: 'ttc',

  // Modificatori
  blo: 'BLO', BLO: 'BLO',
  flo: 'FLO', FLO: 'FLO',
}

/**
 * Normalizza un'abbreviazione nelle tre lingue (IT/EN/ES) alla forma canonica EN.
 * Esempio: "mb" → "sc", "aum" → "inc", "dim" → "dec"
 * Restituisce l'alias originale in lowercase se non trovato nel vocabolario.
 */
export function normalizeStitch(alias: string): string {
  const trimmed = alias.trim()
  return STITCH_MAP[trimmed] ?? STITCH_MAP[trimmed.toLowerCase()] ?? trimmed.toLowerCase()
}

// ---------------------------------------------------------------------------
// Parser istruzione — conta aumenti, diminuzioni e maglie diritte
// ---------------------------------------------------------------------------

interface ParsedInstruction {
  increases: number
  decreases: number
  straight: number
  hasChain: boolean
  hasJoin: boolean
  hasBLO: boolean
  netChange: number
}

/**
 * Analizza un'istruzione di schema e restituisce il conteggio netto delle maglie.
 * Gestisce i pattern più comuni: "Npb", "inc ×N", "(Xpb, inc) ×N", "dim ×N", ecc.
 */
function parseInstruction(instruction: string): ParsedInstruction {
  const instr = instruction.toLowerCase()

  let increases = 0
  let decreases = 0
  let straight = 0

  const hasBLO = instr.includes('blo') || instr.includes('asole dietro') || instr.includes('asole posteriori')
  const hasChain = instr.includes('cat') || instr.includes(' ch') || instr.includes('cad')
  const hasJoin = instr.includes('unire') || instr.includes('join')

  // Caso speciale: anello magico — "AM 6pb" / "MR 6sc" / "6 mb nell'AM"
  // Le N maglie vengono CREATE dall'anello, non sono aumenti rispetto a maglie precedenti.
  // Le trattiamo come "increases da 0" così il conteggio atteso risulta esattamente N.
  const magicRingMatch = instr.match(/\b(?:am|mr)\b\s+(\d+)\s*(?:pb|mb|sc|dc)/) ||
                          instr.match(/(\d+)\s*(?:pb|mb|sc|dc)\s+(?:nel|nell[a']|in)\s+(?:am|mr|anello)/)
  if (magicRingMatch) {
    const n = parseInt(magicRingMatch[1])
    return { increases: n, decreases: 0, straight: 0, hasChain, hasJoin, hasBLO, netChange: n }
  }

  // Pattern: "(Xpb, inc) ×N" o "(Xpb, aum) ×N"
  const groupRepeatMatch = instr.match(/\(([^)]+)\)\s*[×x*]\s*(\d+)/)
  if (groupRepeatMatch) {
    const innerExpr = groupRepeatMatch[1]
    const repeatCount = parseInt(groupRepeatMatch[2])

    const innerInc = countOccurrences(innerExpr, ['inc', 'aum'])
    const innerDec = countOccurrences(innerExpr, ['dec', 'dim', 'dim inv'])
    const innerStraight = countOccurrences(innerExpr, ['pb', 'mb', 'sc'])

    increases += innerInc * repeatCount
    decreases += innerDec * repeatCount
    straight += innerStraight * repeatCount

    // maglie al di fuori della ripetizione
    const before = instr.slice(0, instr.indexOf('('))
    const after = instr.slice(instr.lastIndexOf(')') + 1)
    straight += countOccurrences(before, ['pb', 'mb', 'sc'])
    straight += countOccurrences(after, ['pb', 'mb', 'sc'])
    increases += countOccurrences(before, ['inc', 'aum'])
    increases += countOccurrences(after, ['inc', 'aum'])
    decreases += countOccurrences(before, ['dec', 'dim'])
    decreases += countOccurrences(after, ['dec', 'dim'])
  } else {
    // Pattern senza gruppo con ripetizione

    // "inc ×N" o "aum ×N"
    const incRepeat = instr.match(/(?:inc|aum)\s*[×x*]\s*(\d+)/)
    if (incRepeat) increases += parseInt(incRepeat[1])
    else increases += countOccurrences(instr, ['inc', 'aum'])

    // "dec ×N" o "dim ×N"
    const decRepeat = instr.match(/(?:dec|dim)\s*[×x*]\s*(\d+)/)
    if (decRepeat) decreases += parseInt(decRepeat[1])
    else decreases += countOccurrences(instr, ['dec', 'dim'])

    // "Npb" o "Nmb"
    const straightMatch = instr.match(/(\d+)\s*(?:pb|mb|sc)/)
    if (straightMatch) straight += parseInt(straightMatch[1])
  }

  const netChange = increases - decreases

  return { increases, decreases, straight, hasChain, hasJoin, hasBLO, netChange }
}

function countOccurrences(text: string, keywords: string[]): number {
  let count = 0
  for (const kw of keywords) {
    const regex = new RegExp(`\\b${kw}\\b`, 'gi')
    const matches = text.match(regex)
    if (matches) count += matches.length
  }
  return count
}

// ---------------------------------------------------------------------------
// Invarianti matematici — Regole Assolute
// Fonte: AMIGURUMI_AI_MODEL.md § "Invarianti Matematici"
// ---------------------------------------------------------------------------

/**
 * Verifica il conteggio maglie di un singolo giro.
 *
 * @param prevCount   - maglie totali alla fine del giro precedente
 * @param instruction - testo dell'istruzione (es. "(2pb, inc) ×6")
 * @param declaredCount - conteggio dichiarato nello schema (il numero tra [ ])
 * @returns RoundValidationResult
 */
export function validateRound(
  prevCount: number,
  instruction: string,
  declaredCount: number,
  dynamicRules: SyntaxRule[] = []
): RoundValidationResult {
  const errors: string[] = []
  const parsed = parseInstruction(instruction)

  // Calcolo atteso secondo gli invarianti:
  // AUMENTO:     new = prev + num_increases
  // DIMINUZIONE: new = prev - num_decreases
  // GIRO DRITTO: new = prev
  // BLO/FLO:     non cambia il conteggio
  const expected = prevCount + parsed.increases - parsed.decreases

  const ok = expected === declaredCount

  if (!ok) {
    errors.push(
      `Conteggio errato: atteso ${expected} (${prevCount} + ${parsed.increases} aum - ${parsed.decreases} dim), dichiarato ${declaredCount}`
    )
  }

  if (parsed.increases > 0 && parsed.decreases > 0) {
    errors.push('Attenzione: lo stesso giro contiene sia aumenti che diminuzioni — verifica che sia intenzionale')
  }

  const syntax = validateSyntax(instruction, dynamicRules)

  return {
    round: 0,
    ok,
    expected,
    got: declaredCount,
    errors,
    syntaxErrors: syntax.errors,
    suggestion: syntax.suggestion,
  }
}

/**
 * Verifica tutti i giri di una parte dello schema.
 * Propaga il conteggio giro per giro partendo da 0.
 *
 * @param rounds - array di giri con instruction e stitch_count
 * @returns PartValidationResult con dettaglio per ogni giro
 */
export function validatePart(rounds: Round[], dynamicRules: SyntaxRule[] = []): PartValidationResult {
  const results: RoundValidationResult[] = []
  let currentCount = 0

  for (const r of rounds) {
    // Gestione giri con range ("8-11") — li espande e li valida tutti
    const roundNumbers = expandRoundRange(r.round)

    for (const rNum of roundNumbers) {
      const result = validateRound(currentCount, r.instruction, r.stitch_count, dynamicRules)
      result.round = rNum
      results.push(result)

      if (result.ok) {
        currentCount = r.stitch_count
      } else {
        // Usa il valore dichiarato per continuare la validazione degli altri giri
        currentCount = r.stitch_count
      }
    }
  }

  const totalErrors = results.filter(r => !r.ok).length
  const totalSyntaxErrors = results.filter(r => r.syntaxErrors.length > 0).length

  return {
    valid: totalErrors === 0,
    rounds: results,
    totalErrors,
    totalSyntaxErrors,
  }
}

/**
 * Espande un identificatore di giro (numero o range) in array di numeri.
 * "8-11" → [8, 9, 10, 11]
 * 5 → [5]
 * "5" → [5]
 */
function expandRoundRange(round: number | string): number[] {
  if (typeof round === 'number') return [round]
  const rangeMatch = round.match(/^(\d+)\s*[-–]\s*(\d+)$/)
  if (rangeMatch) {
    const start = parseInt(rangeMatch[1])
    const end = parseInt(rangeMatch[2])
    return Array.from({ length: end - start + 1 }, (_, i) => start + i)
  }
  return [parseInt(round)]
}

// ---------------------------------------------------------------------------
// Stima dimensioni fisiche
// ---------------------------------------------------------------------------

// Gauge standard Lurumi: cotone gasato 2.5mm → ~5 maglie per cm
const DEFAULT_GAUGE = 5 // maglie per cm

/**
 * Stima il diametro di una sfera in cm a partire dal conteggio al plateau.
 * Formula: diametro_cm ≈ stitch_count_plateau / (gauge × π)
 * Approssimazione pratica Lurumi: stitch_count / 30 per cotone 2.5mm
 *
 * @param stitchCount - numero maglie al plateau (punto più largo)
 * @param gauge       - maglie per cm (default 5 per cotone gasato 2.5mm)
 * @returns diametro stimato in cm
 */
export function estimateSizeCm(stitchCount: number, gauge: number = DEFAULT_GAUGE): number {
  // Circonferenza = stitchCount / gauge
  // Diametro = circonferenza / π
  const circumferenceCm = stitchCount / gauge
  const diameterCm = circumferenceCm / Math.PI
  return Math.round(diameterCm * 10) / 10
}

// ---------------------------------------------------------------------------
// Formula distributiva aumenti/diminuzioni
// ---------------------------------------------------------------------------

/**
 * Genera la formula distributiva per passare da M a M±6 maglie.
 * Regola: (M/6 - 1) sc, poi 1 inc/dec, ripetuto 6 volte.
 *
 * Esempio: distributiveFormula(12, 18) → "(1sc, inc) ×6"
 * Esempio: distributiveFormula(18, 12) → "(1sc, dec) ×6"
 *
 * @param from - conteggio maglie iniziale (deve essere multiplo di 6)
 * @param to   - conteggio maglie finale (deve essere from ± 6)
 */
export function distributiveFormula(from: number, to: number): string {
  const diff = to - from

  if (diff === 0) return `${from}sc`

  if (Math.abs(diff) !== 6) {
    return `Formula non standard: differenza di ${diff} (attesa ±6)`
  }

  if (from % 6 !== 0) {
    return `Formula non standard: ${from} non è multiplo di 6`
  }

  const straightCount = from / 6 - 1
  const operation = diff > 0 ? 'inc' : 'dec'

  if (straightCount === 0) {
    return `${operation} ×6`
  }

  return `(${straightCount}sc, ${operation}) ×6`
}

// ---------------------------------------------------------------------------
// Utilità: genera la struttura sferica standard
// ---------------------------------------------------------------------------

/**
 * Genera i giri di una sfera standard amigurumi dato il numero di giri di crescita.
 * Struttura: MR6 → +6/giro × N → plateau × M → -6/giro × N
 *
 * @param growthRounds   - numero di giri di crescita (es. 4 → plateau a 30 maglie)
 * @param plateauRounds  - numero di giri al plateau (default 2)
 * @returns array di Round pronti per validatePart()
 */
export function generateStandardSphere(growthRounds: number, plateauRounds: number = 2): Round[] {
  const rounds: Round[] = []
  let roundNum = 1

  // G1: Anello magico
  rounds.push({ round: roundNum++, instruction: 'MR 6sc', stitch_count: 6 })

  // Fase crescita
  let current = 6
  for (let i = 1; i <= growthRounds; i++) {
    const next = current + 6
    const instruction = distributiveFormula(current, next)
    rounds.push({ round: roundNum++, instruction, stitch_count: next })
    current = next
  }

  // Plateau
  if (plateauRounds > 1) {
    const start = roundNum
    const end = roundNum + plateauRounds - 1
    rounds.push({
      round: `${start}-${end}`,
      instruction: `${current}sc`,
      stitch_count: current,
      note: 'plateau',
    })
    roundNum = end + 1
  } else if (plateauRounds === 1) {
    rounds.push({ round: roundNum++, instruction: `${current}sc`, stitch_count: current, note: 'plateau' })
  }

  // Fase chiusura
  for (let i = growthRounds; i >= 1; i--) {
    const next = current - 6
    const instruction = distributiveFormula(current, next)
    rounds.push({ round: roundNum++, instruction, stitch_count: next })
    current = next
  }

  return rounds
}

// ---------------------------------------------------------------------------
// Validazione strutturale — confronto schema vs tipo richiesto dal prompt
// Fonte: LIBRO_LURUMI_TRAINING_EXTRACTION.md §3, §4, §5
// ---------------------------------------------------------------------------

export type SchemaType =
  | 'sphere'      // sfera standard: AM 6pb → +6/giro → plateau → -6/giro
  | 'oval'        // base ovale: avviamento a catene, espansione simmetrica, BLO
  | 'hexagonal'   // base esagonale piatta: AM → +6/giro, nessuna chiusura
  | 'cylinder'    // cilindro: AM o catene → fase dritta lunga, nessun plateau
  | 'flat'        // pezzo piatto: avviamento a catene, andata e ritorno
  | 'unknown'

export interface StructureIssue {
  severity: 'error' | 'warning'
  message: string
}

export interface StructureValidationResult {
  schemaType: SchemaType
  issues: StructureIssue[]
  ok: boolean
}

/**
 * Rileva il tipo di schema richiesto dal prompt (keyword matching trilingue).
 * Usato per scegliere le regole strutturali da applicare.
 */
export function detectPromptType(prompt: string): SchemaType {
  const p = prompt.toLowerCase()

  // Sfera / palla
  if (/\b(sfera|sphere|ball|palla|testa|head|corpo|body)\b/.test(p)) return 'sphere'

  // Base esagonale
  if (/\b(esagon|hexagon|esagono|base\s+esag)\b/.test(p)) return 'hexagonal'

  // Base ovale (piedi, suole, stivaletti, scarpe)
  if (/\b(ovale|oval|piede|foot|feet|suola|sole|stivalett|scarpa|shoe|boot)\b/.test(p)) return 'oval'

  // Cilindro (gambe, braccia, code, colli)
  if (/\b(cilindro|cylinder|gamba|leg|braccio|arm|coda|tail|collo|neck)\b/.test(p)) return 'cylinder'

  // Pezzo piatto (vestiti, ali, orecchie piatte)
  if (/\b(piatt|flat|vestit|cloth|dress|ala|wing|orecchi\w+\s+piat)\b/.test(p)) return 'flat'

  return 'unknown'
}

/**
 * Valida la struttura di uno schema (array di parti) rispetto al tipo atteso.
 * Ogni tipo ha invarianti strutturali diversi:
 *   - Sfera: AM, crescita +6, plateau, chiusura -6
 *   - Ovale: start chain, BLO round, espansione simmetrica
 *   - Esagonale: AM, solo crescita, nessuna chiusura
 *   - Cilindro: AM, fase dritta lunga, nessuna chiusura -6
 *   - Piatto: start chain, nessun AM
 *
 * @param parts      - array di parti dello schema (ciascuna con rounds[])
 * @param schemaType - tipo rilevato dal prompt
 */
export function validateSchemaStructure(
  parts: { start_type?: string; rounds: Round[] }[],
  schemaType: SchemaType
): StructureValidationResult {
  const issues: StructureIssue[] = []

  if (schemaType === 'unknown' || parts.length === 0) {
    return { schemaType, issues, ok: true }
  }

  for (let pi = 0; pi < parts.length; pi++) {
    const part = parts[pi]
    const counts = part.rounds.map(r => r.stitch_count)
    const partLabel = parts.length > 1 ? ` (parte ${pi + 1})` : ''
    const startType = part.start_type ?? ''

    // Analisi sequenza conteggi
    const peak = Math.max(...counts)
    const hasBLO = part.rounds.some(r =>
      (r.modifier ?? '').toUpperCase() === 'BLO' ||
      r.instruction.toLowerCase().includes('blo') ||
      r.instruction.toLowerCase().includes('asole')
    )
    const growthRounds = counts.filter((c, i) => i > 0 && c > counts[i - 1]).length
    const decreaseRounds = counts.filter((c, i) => i > 0 && c < counts[i - 1]).length
    const straightRounds = counts.filter((c, i) => i > 0 && c === counts[i - 1]).length
    const firstCount = counts[0] ?? 0

    // ── Sfera ──────────────────────────────────────────────────────────────
    if (schemaType === 'sphere') {
      if (startType && startType !== 'magic_ring') {
        issues.push({ severity: 'error', message: `La sfera deve iniziare con anello magico${partLabel}, non con catene` })
      }
      if (firstCount !== 6) {
        issues.push({ severity: 'warning', message: `La sfera standard inizia con 6pb${partLabel} — trovato ${firstCount}pb` })
      }
      if (growthRounds === 0) {
        issues.push({ severity: 'error', message: `La sfera deve avere una fase di crescita (+6/giro)${partLabel}` })
      }
      if (decreaseRounds === 0) {
        issues.push({ severity: 'error', message: `La sfera deve avere una fase di chiusura (-6/giro)${partLabel}` })
      }
      if (growthRounds > 0 && decreaseRounds > 0 && Math.abs(growthRounds - decreaseRounds) > 1) {
        issues.push({ severity: 'warning', message: `Sfera asimmetrica${partLabel}: ${growthRounds} giri crescita vs ${decreaseRounds} giri chiusura` })
      }
    }

    // ── Base esagonale (piatta) ────────────────────────────────────────────
    if (schemaType === 'hexagonal') {
      if (startType && startType !== 'magic_ring') {
        issues.push({ severity: 'error', message: `La base esagonale deve iniziare con anello magico${partLabel}` })
      }
      if (firstCount !== 6) {
        issues.push({ severity: 'warning', message: `La base esagonale standard inizia con 6pb${partLabel} — trovato ${firstCount}pb` })
      }
      if (decreaseRounds > 0) {
        issues.push({ severity: 'warning', message: `Base esagonale piatta non dovrebbe avere giri di chiusura${partLabel} — è un pezzo aperto` })
      }
      if (growthRounds === 0) {
        issues.push({ severity: 'error', message: `La base esagonale deve crescere di +6 maglie ogni giro${partLabel}` })
      }
    }

    // ── Base ovale ─────────────────────────────────────────────────────────
    if (schemaType === 'oval') {
      if (startType && startType !== 'chain') {
        issues.push({ severity: 'error', message: `La base ovale deve iniziare con catene${partLabel}, non con anello magico` })
      }
      if (!hasBLO) {
        issues.push({ severity: 'warning', message: `La base ovale di solito ha un giro BLO (asole posteriori) per definire la suola${partLabel}` })
      }
    }

    // ── Cilindro ───────────────────────────────────────────────────────────
    if (schemaType === 'cylinder') {
      if (decreaseRounds > 2) {
        issues.push({ severity: 'warning', message: `Il cilindro non dovrebbe avere una fase di chiusura${partLabel} — trovati ${decreaseRounds} giri decrescenti` })
      }
      if (straightRounds < 3) {
        issues.push({ severity: 'warning', message: `Il cilindro dovrebbe avere almeno 3 giri dritti consecutivi${partLabel} — trovati ${straightRounds}` })
      }
      if (peak > 30 && straightRounds < 5) {
        issues.push({ severity: 'warning', message: `Cilindro largo (${peak} maglie) ma con soli ${straightRounds} giri dritti${partLabel} — potrebbe essere troppo corto` })
      }
    }

    // ── Pezzo piatto ───────────────────────────────────────────────────────
    if (schemaType === 'flat') {
      if (startType && startType !== 'chain') {
        issues.push({ severity: 'warning', message: `I pezzi piatti di solito iniziano con catene${partLabel}` })
      }
    }
  }

  return {
    schemaType,
    issues,
    ok: issues.filter(i => i.severity === 'error').length === 0,
  }
}
