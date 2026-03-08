import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { BOOK_SYNTAX_RULES, type SyntaxRule, type MathOverride } from '@/lib/pattern-math'

/**
 * Rileva se la differenza tra due istruzioni è una sostituzione di una singola parola.
 * Es. "(sc, aum) ×6" → "(pb, aum) ×6" → { from: 'sc', to: 'pb' }
 * Restituisce null se la struttura non-alfabetica è diversa o cambiano più parole.
 */
function detectWordReplacement(wrong: string, correct: string): { from: string; to: string } | null {
    const wrongWords = wrong.toLowerCase().match(/[a-z]+/g) ?? []
    const correctWords = correct.toLowerCase().match(/[a-z]+/g) ?? []
    if (wrongWords.length !== correctWords.length) return null

    // La struttura non-alfabetica (numeri, simboli, punteggiatura) deve essere identica
    const wrongStructure = wrong.toLowerCase().replace(/[a-z]+/g, 'W')
    const correctStructure = correct.toLowerCase().replace(/[a-z]+/g, 'W')
    if (wrongStructure !== correctStructure) return null

    const diffs: { from: string; to: string }[] = []
    for (let i = 0; i < wrongWords.length; i++) {
        if (wrongWords[i] !== correctWords[i]) {
            diffs.push({ from: wrongWords[i], to: correctWords[i] })
        }
    }
    return diffs.length === 1 ? diffs[0] : null
}

/**
 * GET /api/training/syntax-rules
 *
 * Restituisce le regole sintattiche da usare nel validatore client-side:
 * 1. Regole statiche estratte dal libro "Il Metodo Lurumi" (BOOK_SYNTAX_RULES)
 * 2. Regole dinamiche estratte automaticamente dai feedback admin salvati nel DB:
 *    quando l'admin ha corretto GPT cambiando solo il testo dell'istruzione
 *    (stesso stitch_count, istruzione diversa) → il vecchio testo = sbagliato,
 *    il nuovo testo = corretto → salvato come regola permanente.
 *
 * In questo modo il validatore "ricorda" ogni correzione sintattica fatta
 * sull'output di GPT e la segnala automaticamente la prossima volta.
 */
export async function GET() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ rules: BOOK_SYNTAX_RULES })

    const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
    if (!profile?.is_admin) return NextResponse.json({ rules: BOOK_SYNTAX_RULES })

    // Legge i feedback dove l'admin ha fornito una correzione
    const { data: feedbacks } = await supabase
        .from('model_feedback')
        .select('model_response, corrected_response')
        .eq('is_correct', false)
        .not('corrected_response', 'is', null)
        .order('created_at', { ascending: false })
        .limit(100)

    const dynamicRules: SyntaxRule[] = []

    if (feedbacks) {
        for (const fb of feedbacks) {
            const original: { rounds: { instruction: string; stitch_count: number }[] }[] = fb.model_response ?? []
            const corrected: { rounds: { instruction: string; stitch_count: number }[] }[] = fb.corrected_response ?? []

            // Confronta parte per parte e giro per giro
            for (let pi = 0; pi < Math.min(original.length, corrected.length); pi++) {
                const origRounds = original[pi]?.rounds ?? []
                const corrRounds = corrected[pi]?.rounds ?? []
                for (let ri = 0; ri < Math.min(origRounds.length, corrRounds.length); ri++) {
                    const orig = origRounds[ri]
                    const corr = corrRounds[ri]
                    if (!orig || !corr) continue
                    // Stesso stitch_count ma istruzione diversa → correzione sintattica
                    if (
                        orig.stitch_count === corr.stitch_count &&
                        orig.instruction.trim().toLowerCase() !== corr.instruction.trim().toLowerCase()
                    ) {
                        const wrong = orig.instruction.trim()
                        const correct = corr.instruction.trim()
                        // Evita duplicati
                        const alreadyExists = dynamicRules.some(r =>
                            r.wrong.toLowerCase() === wrong.toLowerCase()
                        )
                        if (!alreadyExists) {
                            const rule: SyntaxRule = { wrong, correct, source: 'feedback' }
                            // Se la correzione è una sostituzione di singola parola (es. sc→pb),
                            // aggiungi wordReplace così il validatore cattura anche varianti
                            // con moltiplicatori diversi (×4, ×8…) non solo quella esatta
                            const wr = detectWordReplacement(wrong, correct)
                            if (wr) {
                                // Evita di aggiungere wordReplace duplicati
                                const wrAlreadyExists = dynamicRules.some(r =>
                                    r.wordReplace?.from === wr.from && r.wordReplace?.to === wr.to
                                )
                                if (!wrAlreadyExists) rule.wordReplace = wr
                            }
                            dynamicRules.push(rule)
                        }
                    }
                }
            }
        }
    }

    // Combina: regole libro + regole dal feedback
    const bookWrong = new Set(BOOK_SYNTAX_RULES.map(r => r.wrong.toLowerCase()))
    const allRules: SyntaxRule[] = [
        ...BOOK_SYNTAX_RULES,
        ...dynamicRules.filter(r => !bookWrong.has(r.wrong.toLowerCase())),
    ]

    // ── Math overrides: feedback positivi su schemi con errori matematici ──
    // Quando l'admin clicca "✓ Corretto" su uno schema che il validatore aveva
    // flaggato come errato, quelle coppie (instruction, stitch_count) diventano
    // verità assoluta → il validatore non le flaggherà mai più.
    const mathOverrides: MathOverride[] = []

    const { data: positiveFeedbacks } = await supabase
        .from('model_feedback')
        .select('model_response, math_errors')
        .eq('is_correct', true)
        .eq('math_check_passed', false)
        .not('math_errors', 'is', null)
        .limit(200)

    if (positiveFeedbacks) {
        for (const fb of positiveFeedbacks) {
            const parts: { name?: string; rounds?: { round: number | string; instruction: string; stitch_count: number }[] }[] = fb.model_response ?? []
            const errors: { part?: string; round?: number | string }[] = fb.math_errors ?? []

            for (const err of errors) {
                const part = parts.find(p => p.name === err.part) ?? parts[0]
                if (!part?.rounds) continue
                const round = part.rounds.find(r => String(r.round) === String(err.round))
                if (!round) continue

                const key = round.instruction.trim().toLowerCase()
                const alreadyExists = mathOverrides.some(o =>
                    o.instruction.toLowerCase() === key && o.stitch_count === round.stitch_count
                )
                if (!alreadyExists) {
                    mathOverrides.push({ instruction: round.instruction.trim(), stitch_count: round.stitch_count })
                }
            }
        }
    }

    return NextResponse.json({ rules: allRules, mathOverrides })
}
