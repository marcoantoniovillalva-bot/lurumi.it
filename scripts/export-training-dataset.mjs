/**
 * export-training-dataset.mjs
 * Esporta il dataset di training in formato JSONL per fine-tuning Mistral 7B (QLoRA).
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/export-training-dataset.mjs
 *   oppure con dotenv:
 *   node --env-file=.env.local scripts/export-training-dataset.mjs
 *
 * Output:
 *   dataset/training_YYYY-MM-DD.jsonl   — esempi positivi da schemi validati
 *   dataset/feedback_YYYY-MM-DD.jsonl   — esempi correttivi da model_feedback
 *   dataset/combined_YYYY-MM-DD.jsonl   — tutto insieme (usare questo per il fine-tuning)
 *   dataset/stats_YYYY-MM-DD.json       — statistiche del dataset
 */

import { createClient } from '@supabase/supabase-js'
import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

// ── Config ──────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌  Variabili d\'ambiente mancanti: NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)
const today = new Date().toISOString().split('T')[0]
const OUT_DIR = join(ROOT, 'dataset')

// ── Sistema di prompt per Mistral 7B ────────────────────────────────────────

const SYSTEM_PROMPT = `Sei LurumiAI, un esperto di schemi amigurumi creato da Lurumi.
Generi schemi amigurumi tecnici, giro per giro, matematicamente corretti.
Usi il vocabolario italiano: pb (punto basso), aum (aumento), dim (diminuzione), AM (anello magico), cat (catenella).
Regole matematiche assolute:
- AUMENTO: nuovo_conteggio = conteggio_precedente + numero_aumenti
- DIMINUZIONE: nuovo_conteggio = conteggio_precedente - numero_diminuzioni
- GIRO DRITTO: conteggio invariato
Rispondi sempre con un array JSON valido delle parti dello schema.`

// ── Generatore prompt varianti ────────────────────────────────────────────────
// Per ogni schema genera più prompt diversi → più varietà nel training

function generatePromptVariants(pattern) {
  const { title, difficulty, category, parts } = pattern
  const partNames = parts.map(p => p.name).join(', ')
  const totalRounds = parts.reduce((s, p) => s + (p.rounds?.length ?? 0), 0)

  const difficultyIT = difficulty === 'beginner' ? 'facile' : difficulty === 'intermediate' ? 'medio' : 'avanzato'

  return [
    // Prompt diretto
    `Genera lo schema amigurumi per: ${title}`,

    // Prompt con dettagli
    `Crea uno schema ${difficultyIT} per ${title.toLowerCase()}. Parti: ${partNames}.`,

    // Prompt descrittivo
    `Ho bisogno dello schema completo per ${title.toLowerCase()} (${totalRounds} giri totali, difficoltà ${difficultyIT}).`,

    // Prompt categoria se presente
    ...(category ? [`Schema amigurumi categoria "${category}": ${title}.`] : []),
  ]
}

// ── Formattatore risposta ─────────────────────────────────────────────────────

function formatAssistantResponse(parts) {
  return JSON.stringify(parts, null, 2)
}

// ── Costruttore record JSONL ──────────────────────────────────────────────────
// Formato chat (compatibile con Mistral Instruct, LLaMA-3, ecc.)

function buildChatRecord(userPrompt, assistantResponse) {
  return JSON.stringify({
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
      { role: 'assistant', content: assistantResponse },
    ],
  })
}

// Formato testo (compatibile con training base senza template chat)
function buildTextRecord(userPrompt, assistantResponse) {
  return JSON.stringify({
    text: `<s>[INST] ${userPrompt} [/INST]\n${assistantResponse}</s>`,
  })
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🧶 Export dataset training Lurumi AI')
  console.log(`📅 Data: ${today}\n`)

  mkdirSync(OUT_DIR, { recursive: true })

  // ── 1. Fetch training_patterns ────────────────────────────────────────────

  console.log('📥 Scarico training_patterns (validated + ground_truth)...')
  const { data: patterns, error: pErr } = await supabase
    .from('training_patterns')
    .select('id, title, difficulty, category, parts, admin_notes, status, validated_at')
    .in('status', ['validated', 'ground_truth'])
    .order('validated_at', { ascending: true })

  if (pErr) {
    console.error('❌ Errore fetch patterns:', pErr.message)
    process.exit(1)
  }

  console.log(`✅ ${patterns.length} schemi trovati\n`)

  // Filtra parti incomplete (rounds vuoti → contribuzioni senza giri dettagliati)
  const patternsWithRounds = patterns.filter(p =>
    Array.isArray(p.parts) && p.parts.some(part => Array.isArray(part.rounds) && part.rounds.length > 0)
  )
  const patternsStubOnly = patterns.filter(p =>
    !patternsWithRounds.find(pw => pw.id === p.id)
  )

  console.log(`  📋 Schemi con giri dettagliati: ${patternsWithRounds.length}`)
  console.log(`  📑 Stub (solo contatori, nessun giro): ${patternsStubOnly.length}`)
  console.log()

  // ── 2. Genera esempi da schemi ────────────────────────────────────────────

  const trainingLines = []
  let examplesFromPatterns = 0

  for (const pattern of patternsWithRounds) {
    const variants = generatePromptVariants(pattern)
    const response = formatAssistantResponse(pattern.parts)

    for (const prompt of variants) {
      trainingLines.push(buildChatRecord(prompt, response))
      examplesFromPatterns++
    }
  }

  writeFileSync(
    join(OUT_DIR, `training_${today}.jsonl`),
    trainingLines.join('\n'),
    'utf8'
  )
  console.log(`✅ training_${today}.jsonl — ${examplesFromPatterns} esempi da ${patternsWithRounds.length} schemi`)

  // ── 3. Fetch model_feedback ───────────────────────────────────────────────

  console.log('\n📥 Scarico model_feedback (correzioni admin)...')
  const { data: feedbacks, error: fErr } = await supabase
    .from('model_feedback')
    .select('id, prompt, model_response, is_correct, corrected_response, math_check_passed, math_errors, created_at')
    .order('created_at', { ascending: true })

  if (fErr) {
    console.error('❌ Errore fetch feedbacks:', fErr.message)
    process.exit(1)
  }

  console.log(`✅ ${feedbacks.length} feedback trovati`)

  const correctFeedbacks = feedbacks.filter(f => f.is_correct === true)
  const correctedFeedbacks = feedbacks.filter(f => f.is_correct === false && f.corrected_response)

  console.log(`  ✓ Feedback positivi (schema corretto): ${correctFeedbacks.length}`)
  console.log(`  ✗ Feedback correttivi (schema sbagliato → corretto): ${correctedFeedbacks.length}`)

  const feedbackLines = []
  let examplesFromFeedback = 0

  // Feedback positivi → esempio diretto
  for (const fb of correctFeedbacks) {
    const response = formatAssistantResponse(fb.model_response)
    feedbackLines.push(buildChatRecord(fb.prompt, response))
    examplesFromFeedback++
  }

  // Feedback correttivi → usa risposta corretta (non quella sbagliata)
  for (const fb of correctedFeedbacks) {
    const response = formatAssistantResponse(fb.corrected_response)
    feedbackLines.push(buildChatRecord(fb.prompt, response))
    examplesFromFeedback++
  }

  writeFileSync(
    join(OUT_DIR, `feedback_${today}.jsonl`),
    feedbackLines.join('\n'),
    'utf8'
  )
  console.log(`✅ feedback_${today}.jsonl — ${examplesFromFeedback} esempi`)

  // ── 4. Combined dataset ───────────────────────────────────────────────────

  const allLines = [...trainingLines, ...feedbackLines]
  writeFileSync(
    join(OUT_DIR, `combined_${today}.jsonl`),
    allLines.join('\n'),
    'utf8'
  )

  // ── 5. Stats ──────────────────────────────────────────────────────────────

  const stats = {
    exported_at: new Date().toISOString(),
    sources: {
      ground_truth: patterns.filter(p => p.status === 'ground_truth').length,
      validated: patterns.filter(p => p.status === 'validated').length,
      with_detailed_rounds: patternsWithRounds.length,
      stub_only: patternsStubOnly.length,
    },
    feedback: {
      total: feedbacks.length,
      correct: correctFeedbacks.length,
      corrected: correctedFeedbacks.length,
    },
    examples: {
      from_patterns: examplesFromPatterns,
      from_feedback: examplesFromFeedback,
      total: allLines.length,
    },
    readiness: {
      training_ready: allLines.length,
      minimum_for_finetune: 100,
      percentage: Math.round((allLines.length / 100) * 100),
    },
  }

  writeFileSync(
    join(OUT_DIR, `stats_${today}.json`),
    JSON.stringify(stats, null, 2),
    'utf8'
  )

  // ── 6. Summary ───────────────────────────────────────────────────────────

  console.log('\n' + '─'.repeat(50))
  console.log('📊 RIEPILOGO DATASET')
  console.log('─'.repeat(50))
  console.log(`  Schemi ground truth (Erika):  ${stats.sources.ground_truth}`)
  console.log(`  Schemi validati da utenti:    ${stats.sources.validated}`)
  console.log(`  Feedback correttivi (RLHF):   ${stats.feedback.corrected}`)
  console.log('─'.repeat(50))
  console.log(`  Esempi totali:                ${stats.examples.total}`)
  console.log(`  Pronti per fine-tuning:       ${stats.readiness.percentage}% (min. 100)`)
  console.log('─'.repeat(50))

  if (allLines.length < 100) {
    const needed = 100 - allLines.length
    console.log(`\n⚠️  Dataset non ancora sufficiente per il fine-tuning.`)
    console.log(`   Aggiungere almeno ${needed} esempi tramite Schema Creator o panel RLHF.`)
  } else {
    console.log(`\n🚀 Dataset pronto! Prossimo step: fine-tuning Mistral 7B con QLoRA su RunPod.`)
    console.log(`   File da usare: dataset/combined_${today}.jsonl`)
  }

  console.log('\n📁 File generati:')
  console.log(`   dataset/training_${today}.jsonl`)
  console.log(`   dataset/feedback_${today}.jsonl`)
  console.log(`   dataset/combined_${today}.jsonl`)
  console.log(`   dataset/stats_${today}.json`)
}

main().catch(err => {
  console.error('❌ Errore fatale:', err)
  process.exit(1)
})
