/**
 * backfill-embeddings.mjs — Vettorizza i progetti esistenti + il libro Lurumi.
 * Eseguire UNA SOLA VOLTA dopo aver eseguito setup-db.mjs.
 *
 * Usage: node scripts/backfill-embeddings.mjs
 * Richiede: OPENAI_API_KEY e DATABASE_URL in .env.local o come variabili d'ambiente.
 */

import pg from 'pg'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

// Legge .env.local manualmente (dotenv non installato nel progetto)
const __dirname2 = dirname(fileURLToPath(import.meta.url))
const envPath = join(__dirname2, '..', '.env.local')
try {
    const envContent = readFileSync(envPath, 'utf-8')
    for (const line of envContent.split('\n')) {
        const match = line.match(/^([^#=]+)=(.*)$/)
        if (match) {
            const key = match[1].trim()
            const val = match[2].trim().replace(/^['"]|['"]$/g, '')
            if (!process.env[key]) process.env[key] = val
        }
    }
} catch { /* .env.local non trovato, usa variabili già presenti */ }

const __dirname = dirname(fileURLToPath(import.meta.url))
const { Client } = pg

const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const CONNECTION_STRING = process.env.DATABASE_URL ||
    'postgresql://postgres:Quieroplata1!@db.djatdyhqliotgnsljdja.supabase.co:5432/postgres'

if (!OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY non trovata in .env.local')
    process.exit(1)
}

// ── Helper embedding ─────────────────────────────────────────────────────────

async function createEmbedding(text) {
    const res = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'text-embedding-3-small', input: text.slice(0, 8000) }),
    })
    if (!res.ok) throw new Error(`OpenAI error ${res.status}: ${await res.text()}`)
    const data = await res.json()
    return data.data[0].embedding
}

function stripHtml(html) {
    return (html ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

function buildProjectText(p) {
    const parts = [`Progetto: ${p.title}`]
    if (p.type) parts.push(`Tipo: ${p.type}`)
    if (p.sections?.length) parts.push(`Sezioni: ${p.sections.map(s => s.title).join(', ')}`)
    if (p.secs?.length) parts.push(`Contatori: ${p.secs.map(s => s.name).join(', ')}`)
    const notes = stripHtml(p.notes_html)
    if (notes) parts.push(`Note: ${notes.slice(0, 1000)}`)
    return parts.join('\n')
}

// ── Chunks del libro Lurumi ───────────────────────────────────────────────────

function buildBookChunks() {
    const bookPath = join(__dirname, '..', 'impariamo a leggere gli schemi', 'libro_lurumi_training_extraction.md')
    let bookContent = ''
    try {
        bookContent = readFileSync(bookPath, 'utf-8')
    } catch {
        console.warn('⚠️  Libro Lurumi non trovato, skip.')
        return []
    }

    // Dividi per sezioni (## heading)
    const sections = bookContent.split(/\n## /).filter(Boolean)
    return sections.map((section, i) => {
        const firstLine = section.split('\n')[0].trim().replace(/^#+\s*/, '')
        return {
            sourceId: `libro_lurumi/${i}_${firstLine.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 40)}`,
            content: section.length > 50 ? section.slice(0, 3000) : null,
            metadata: { title: `Libro Lurumi — ${firstLine}`, section: firstLine },
        }
    }).filter(c => c.content)
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function run() {
    const client = new Client({ connectionString: CONNECTION_STRING, ssl: { rejectUnauthorized: false } })
    await client.connect()
    console.log('✅ DB connesso')

    let processed = 0
    let skipped = 0
    let errors = 0

    // ── 1. Vettorizza progetti esistenti ──────────────────────────────────────
    console.log('\n📦 Vettorizzo progetti utenti...')

    const { rows: projects } = await client.query(`
        SELECT id, user_id, title, type, notes_html, secs, sections
        FROM projects
        WHERE id NOT IN (
            SELECT source_id FROM knowledge_chunks WHERE source_type = 'project' AND source_id IS NOT NULL
        )
        ORDER BY created_at DESC
    `)

    console.log(`   Trovati ${projects.length} progetti da vettorizzare`)

    for (const p of projects) {
        try {
            const text = buildProjectText({
                ...p,
                secs: p.secs ?? [],
                sections: p.sections ?? [],
            })
            const embedding = await createEmbedding(text)

            await client.query(
                `DELETE FROM knowledge_chunks WHERE user_id=$1 AND source_type='project' AND source_id=$2`,
                [p.user_id, p.id]
            )
            await client.query(`
                INSERT INTO knowledge_chunks (user_id, source_type, source_id, content, embedding, metadata)
                VALUES ($1, 'project', $2, $3, $4, $5)
            `, [p.user_id, p.id, text, JSON.stringify(embedding), JSON.stringify({ title: p.title, type: p.type })])

            processed++
            process.stdout.write(`\r   ✓ ${processed}/${projects.length} (${p.title.slice(0, 30)})      `)

            // Rate limit: max 500 req/min su OpenAI free tier
            await new Promise(r => setTimeout(r, 150))
        } catch (err) {
            errors++
            console.error(`\n   ❌ Errore su progetto ${p.id}: ${err.message}`)
        }
    }

    console.log(`\n   Completato: ${processed} ok, ${skipped} saltati, ${errors} errori`)

    // ── 2. Vettorizza libro Lurumi ────────────────────────────────────────────
    console.log('\n📚 Vettorizzo libro Lurumi...')

    const bookChunks = buildBookChunks()
    console.log(`   Trovati ${bookChunks.length} chunk del libro`)

    let bookProcessed = 0
    for (const chunk of bookChunks) {
        try {
            const embedding = await createEmbedding(chunk.content)

            await client.query(
                `DELETE FROM knowledge_chunks WHERE user_id IS NULL AND source_type='libro' AND source_id=$1`,
                [chunk.sourceId]
            )
            await client.query(`
                INSERT INTO knowledge_chunks (user_id, source_type, source_id, content, embedding, metadata)
                VALUES (NULL, 'libro', $1, $2, $3, $4)
            `, [chunk.sourceId, chunk.content, JSON.stringify(embedding), JSON.stringify(chunk.metadata)])

            bookProcessed++
            process.stdout.write(`\r   ✓ ${bookProcessed}/${bookChunks.length}      `)
            await new Promise(r => setTimeout(r, 150))
        } catch (err) {
            console.error(`\n   ❌ Errore chunk libro ${chunk.sourceId}: ${err.message}`)
        }
    }

    console.log(`\n   Libro vettorizzato: ${bookProcessed} chunk`)

    // ── Summary ───────────────────────────────────────────────────────────────
    const { rows: [{ count }] } = await client.query(`SELECT COUNT(*) FROM knowledge_chunks`)
    console.log(`\n🎉 Backfill completato! Totale chunk in DB: ${count}`)

    await client.end()
}

run().catch(err => {
    console.error('❌ Errore fatale:', err)
    process.exit(1)
})
