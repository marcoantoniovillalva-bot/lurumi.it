/**
 * generate-character-themes.mjs
 *
 * Genera le immagini tematiche dei personaggi usando:
 *   1. google/nano-banana-2 (Gemini 3.1 Flash Image) per generare
 *      il personaggio nel contesto richiesto, mantenendo stile e look
 *      identici tramite reference image
 *   2. 851-labs/background-remover per rendere lo sfondo trasparente
 *
 * Le immagini vengono poi caricate su Supabase Storage nel bucket
 * "character-themes" con path {character}/{slot}.png
 *
 * Uso:
 *   node scripts/generate-character-themes.mjs [--character luly] [--slot welcome]
 *   node scripts/generate-character-themes.mjs --character luly   (tutti gli slot)
 *   node scripts/generate-character-themes.mjs                    (tutti)
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

// ── Credenziali ────────────────────────────────────────────
const REPLICATE_TOKEN   = process.env.REPLICATE_API_TOKEN   || 'REPLICATE_TOKEN_REMOVED'
const SUPABASE_URL      = process.env.NEXT_PUBLIC_SUPABASE_URL      || 'https://djatdyhqliotgnsljdja.supabase.co'
const SUPABASE_SERVICE  = process.env.SUPABASE_SERVICE_ROLE_KEY || 'SUPABASE_SERVICE_ROLE_REMOVED'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE)
const BUCKET   = 'character-themes'

// ── Descrizioni visive dei personaggi ──────────────────────
// Usate nel prompt per mantenere la coerenza visiva con il personaggio originale
const CHARACTER_DESC = {
    luly:  'a cute chibi girl with curly red hair in two pigtails, wearing a white polka-dot short-sleeve shirt and a red skirt, with red shoes decorated with hearts',
    babol: 'a cute chibi girl with pink curly hair styled in two low pigtails and wearing a pink knitted beret hat, wearing a blue checkered sleeveless top over a white pleated skirt, carrying a small round red crochet purse on her shoulder',
    clara: 'a cute chibi girl with long dark navy-blue hair worn in a braid over her shoulder, white flower clip in her hair, wearing a short-sleeve yellow dress covered in red heart prints with a white scalloped collar and hem',
    tommy: 'a cute chibi boy with short reddish-brown hair and rosy cheeks, wearing a white short-sleeve collared shirt and red shorts with white socks and brown shoes',
    derek: 'a cute chibi boy with spiky dark black-and-white hair, serious/stern expression with furrowed brows and blue eyes, wearing a dark navy sailor-style school uniform with white trim and a white neckerchief',
    sara:  'a cute chibi girl with shoulder-length orange-auburn hair, wearing a yellow knitted beret with a black bow, yellow dungaree overalls over a white shirt, carrying a dark messenger bag with kanji text, white boots',
    susy:  'a cute chibi girl with short wavy golden-blonde hair and bright blue eyes, wearing a white short-sleeve blouse and a green dress with a green bow tie at the collar and green Mary Jane shoes with white bows',
}

// ── Prompt per ogni slot ────────────────────────────────────
const SLOT_PROMPTS = {
    welcome: (desc) =>
        `${desc}, waving cheerfully with one hand raised in a greeting gesture, holding a small handmade amigurumi crochet bear toy in the other hand. Expression: big happy smile, welcoming and friendly.`,

    projects_empty: (desc) =>
        `${desc}, sitting at a small crafting table, holding a crochet hook in one hand and a colorful ball of yarn in the other, looking excited and ready to start creating. A half-finished crochet project sits on the table. Expression: enthusiastic and eager.`,

    tutorials_empty: (desc) =>
        `${desc}, holding a small tablet device showing a video player with a play button, looking curious and interested at the screen. Expression: studious, curious, and attentive.`,

    tool_designer: (desc) =>
        `${desc}, holding an artist's paint palette in one hand and a large paintbrush in the other, surrounded by floating colorful sparkles and small stars. Expression: creative and focused, slightly tilting head.`,

    tool_chat: (desc) =>
        `${desc}, cheerfully talking to a small cute round robot companion standing next to them, with a speech bubble containing three dots (typing indicator). Expression: lively, friendly, mid-conversation.`,

    tool_books: (desc) =>
        `${desc}, holding a large colorful open book and smiling happily at the camera, surrounded by small floating books and yarn balls. Expression: joyful and excited about reading.`,

    tool_timer: (desc) =>
        `${desc}, holding a round stopwatch in one raised hand while counting stitches on the fingers of the other hand, a small colorful ball of yarn at their feet. Expression: focused and concentrated, tongue slightly out.`,

    tool_notes: (desc) =>
        `${desc}, writing in an open colorful spiral notebook with a pencil, surrounded by small pastel-colored sticky notes with doodles of yarn and hooks on them. Expression: thoughtful and creative.`,

    tool_courses: (desc) =>
        `${desc}, wearing a black graduation mortarboard cap on their head, proudly holding a rolled diploma tied with a ribbon. Expression: proud and accomplished, big smile.`,

    profile: (desc) =>
        `${desc}, standing in a proud superhero-like pose with hands on hips, wearing a small shiny star-shaped badge/medal pinned to their chest. Expression: confident, proud, and happy.`,
}

const ALL_CHARACTERS = ['luly', 'babol', 'clara', 'tommy', 'derek', 'sara', 'susy']
const ALL_SLOTS      = Object.keys(SLOT_PROMPTS)

// ── Parsing argomenti CLI ───────────────────────────────────
const args = process.argv.slice(2)
const argCharacter = args.includes('--character') ? args[args.indexOf('--character') + 1] : null
const argSlot      = args.includes('--slot')      ? args[args.indexOf('--slot')      + 1] : null

const characters = argCharacter ? [argCharacter] : ALL_CHARACTERS
const slots      = argSlot      ? [argSlot]      : ALL_SLOTS

// ── Helper: POST a Replicate con retry su 429 ──────────────
async function replicatePost(url, body) {
    let attempts = 0
    while (true) {
        attempts++
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${REPLICATE_TOKEN}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        })

        if (res.status === 429) {
            const data = await res.json().catch(() => ({}))
            const wait = ((data.retry_after ?? 10) + 2) * 1000
            console.log(`  ⏳ Rate limit — attendo ${Math.round(wait/1000)}s...`)
            await new Promise(r => setTimeout(r, wait))
            continue
        }

        if (!res.ok) throw new Error(await res.text())
        return await res.json()
    }
}

// ── Helper: polling risultato ───────────────────────────────
async function pollPrediction(id) {
    while (true) {
        await new Promise(r => setTimeout(r, 2500))
        const res = await fetch(`https://api.replicate.com/v1/predictions/${id}`, {
            headers: { 'Authorization': `Bearer ${REPLICATE_TOKEN}` },
        })
        const pred = await res.json()
        if (pred.status === 'succeeded') return pred
        if (pred.status === 'failed') throw new Error(pred.error ?? 'Prediction failed')
        process.stdout.write('.')
    }
}

// ── Helper: scarica immagine come Buffer ────────────────────
async function downloadImage(url) {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Download failed: ${url}`)
    return Buffer.from(await res.arrayBuffer())
}

// ── Helper: converti file in data URI base64 ────────────────
function fileToDataUri(filePath) {
    const ext = path.extname(filePath).slice(1).toLowerCase()
    const mime = ext === 'png' ? 'image/png' : 'image/jpeg'
    const data = fs.readFileSync(filePath).toString('base64')
    return `data:${mime};base64,${data}`
}

// ── Crea bucket Supabase se non esiste ──────────────────────
async function ensureBucket() {
    const { data: buckets } = await supabase.storage.listBuckets()
    const exists = buckets?.some(b => b.name === BUCKET)
    if (!exists) {
        const { error } = await supabase.storage.createBucket(BUCKET, { public: true })
        if (error) throw new Error(`Cannot create bucket: ${error.message}`)
        console.log(`✓ Bucket "${BUCKET}" creato`)
    } else {
        console.log(`✓ Bucket "${BUCKET}" già esistente`)
    }
}

// ── Genera e carica una singola immagine ────────────────────
async function generateAndUpload(character, slot) {
    const refImagePath = path.join(ROOT, 'personaggi', `${character.charAt(0).toUpperCase() + character.slice(1)}.png`)
    if (!fs.existsSync(refImagePath)) {
        console.warn(`  ⚠ Immagine riferimento non trovata: ${refImagePath}`)
        return
    }

    // Skip se già caricato su Supabase (evita rigenerazione)
    if (!args.includes('--force')) {
        const { data: existing } = await supabase.storage
            .from(BUCKET)
            .list(character, { search: `${slot}.png` })
        if (existing?.some(f => f.name === `${slot}.png`)) {
            console.log(`  ⏭ ${character}/${slot} già esistente — skip (usa --force per rigenerare)`)
            return
        }
    }

    const desc      = CHARACTER_DESC[character]
    const promptFn  = SLOT_PROMPTS[slot]
    const basePrompt = promptFn(desc)

    const fullPrompt = `${basePrompt} The character must look EXACTLY like the reference image: same face, same hair style and color, same outfit and accessories, same chibi proportions. Art style: cute chibi cartoon illustration, thick dark outlines, flat pastel colors with soft shading, anime-style rosy cheeks on both cheeks, large expressive round eyes. White background. Full body visible, centered in frame, no cropping.`

    console.log(`  📸 Generando ${character}/${slot}...`)

    // Step 1: Genera con Nano Banana 2
    const refDataUri = fileToDataUri(refImagePath)

    let generatedUrl
    try {
        // Step 1: Genera con Nano Banana 2
        const pred = await replicatePost(
            'https://api.replicate.com/v1/models/google/nano-banana-2/predictions',
            {
                input: {
                    prompt: fullPrompt,
                    image: refDataUri,
                    aspect_ratio: '3:4',
                    output_format: 'png',
                },
            }
        )

        const completed = pred.status === 'succeeded' ? pred : await pollPrediction(pred.id)
        process.stdout.write('\n')

        generatedUrl = Array.isArray(completed.output) ? completed.output[0] : completed.output
        if (!generatedUrl) throw new Error('Nessun output da nano-banana-2')

    } catch (err) {
        console.error(`  ✗ Generazione fallita per ${character}/${slot}: ${err.message}`)
        return
    }

    // Step 2: Rimuovi sfondo (cjwbw/rembg)
    console.log(`  🪄 Rimozione sfondo ${character}/${slot}...`)
    let finalBuffer
    try {
        // cjwbw/rembg — rimozione sfondo con versione specifica
        const bgPred = await replicatePost(
            'https://api.replicate.com/v1/predictions',
            {
                version: 'fb8af171cfa1616ddcf1242c093f9c46bcada5ad4cf6f2fbe8b81b330ec5c003',
                input: { image: generatedUrl },
            }
        )

        const bgCompleted = bgPred.status === 'succeeded' ? bgPred : await pollPrediction(bgPred.id)
        process.stdout.write('\n')

        const transparentUrl = Array.isArray(bgCompleted.output) ? bgCompleted.output[0] : bgCompleted.output
        finalBuffer = await downloadImage(transparentUrl)

    } catch (err) {
        console.warn(`  ⚠ Background removal fallita, uso immagine con sfondo: ${err.message}`)
        finalBuffer = await downloadImage(generatedUrl)
    }

    // Step 3: Salva localmente per reference
    const outDir = path.join(ROOT, 'personaggi', 'generated', character)
    fs.mkdirSync(outDir, { recursive: true })
    const localPath = path.join(outDir, `${slot}.png`)
    fs.writeFileSync(localPath, finalBuffer)

    // Step 4: Carica su Supabase Storage
    const storagePath = `${character}/${slot}.png`
    const { error: uploadErr } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, finalBuffer, {
            contentType: 'image/png',
            upsert: true,
        })

    if (uploadErr) {
        console.error(`  ✗ Upload fallito per ${storagePath}: ${uploadErr.message}`)
        return
    }

    console.log(`  ✓ ${character}/${slot}.png → Supabase Storage`)
}

// ── Main ────────────────────────────────────────────────────
async function main() {
    console.log('\n🎨 Generazione immagini tema personaggi Lurumi')
    console.log(`   Personaggi: ${characters.join(', ')}`)
    console.log(`   Slot: ${slots.join(', ')}`)
    console.log(`   Totale: ${characters.length * slots.length} immagini\n`)

    await ensureBucket()

    for (const character of characters) {
        console.log(`\n👤 Personaggio: ${character.toUpperCase()}`)
        for (const slot of slots) {
            await generateAndUpload(character, slot)
            // Piccola pausa tra le richieste
            await new Promise(r => setTimeout(r, 1000))
        }
    }

    console.log('\n✅ Generazione completata!')
    console.log(`   Le immagini sono su: ${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/`)
}

main().catch(err => {
    console.error('Errore fatale:', err)
    process.exit(1)
})
