import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { PDFDocument, StandardFonts, rgb, PDFPage, PDFFont } from 'pdf-lib'

// ── Tipi sezioni ricevute dal client ─────────────────────────────────────────
type Section =
    | { type: 'title';   title: string; timer: string; coverBase64?: string | null }
    | { type: 'counter'; name: string; value: number; imageBase64?: string | null }
    | { type: 'image';   label: string; imageBase64: string | null }
    | { type: 'notes';   text: string; title: string; timer: string }

// ── Dimensioni pagina 16:9 ────────────────────────────────────────────────────
const W = 1280, H = 720

// ── Palette colori ────────────────────────────────────────────────────────────
const C_PURPLE  = rgb(0.482, 0.361, 0.965)   // #7B5CF6
const C_DARK    = rgb(0.110, 0.110, 0.118)   // #1C1C1E
const C_MUTED   = rgb(0.604, 0.635, 0.694)   // #9AA2B1
const C_WHITE   = rgb(1, 1, 1)
const C_BG_LILAC = rgb(0.957, 0.933, 1.000)  // #F4EEFF

// ── Converti coordinata top-down → Y pdf (bottom-up) ─────────────────────────
const fromTop = (y: number) => H - y

// ── Wrapping testo manuale ────────────────────────────────────────────────────
function wrapText(text: string, font: PDFFont, size: number, maxW: number): string[] {
    const words = text.split(/\s+/).filter(Boolean)
    const lines: string[] = []
    let line = ''
    for (const w of words) {
        const test = line ? `${line} ${w}` : w
        if (font.widthOfTextAtSize(test, size) > maxW && line) {
            lines.push(line)
            line = w
        } else line = test
    }
    if (line) lines.push(line)
    return lines
}

// ── Parse dataUrl base64 ──────────────────────────────────────────────────────
function parseBase64(dataUrl: string | null | undefined): { bytes: Buffer; mime: string } | null {
    if (!dataUrl) return null
    const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
    if (!m) return null
    return { mime: m[1], bytes: Buffer.from(m[2], 'base64') }
}

// ── Embed immagine nel PDF (ritorna null se fallisce) ─────────────────────────
async function embedImg(pdfDoc: PDFDocument, dataUrl: string | null | undefined) {
    const parsed = parseBase64(dataUrl)
    if (!parsed) return null
    try {
        return parsed.mime === 'image/png'
            ? await pdfDoc.embedPng(parsed.bytes)
            : await pdfDoc.embedJpg(parsed.bytes)
    } catch { return null }
}

// ── Barra verticale viola a sinistra ─────────────────────────────────────────
function drawBar(page: PDFPage) {
    page.drawRectangle({ x: 0, y: 0, width: 10, height: H, color: C_PURPLE })
}

// ── Pagina TITOLO ─────────────────────────────────────────────────────────────
async function addTitlePage(
    pdfDoc: PDFDocument,
    sec: Extract<Section, { type: 'title' }>,
    fonts: { bold: PDFFont; regular: PDFFont }
) {
    const page = pdfDoc.addPage([W, H])
    page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: C_WHITE })
    drawBar(page)

    let textX = 30

    const img = await embedImg(pdfDoc, sec.coverBase64)
    if (img) {
        const maxW = 560, maxH = H - 80
        const scale = Math.min(maxW / img.width, maxH / img.height)
        const dW = img.width * scale, dH = img.height * scale
        page.drawImage(img, { x: 20 + (maxW - dW) / 2, y: (H - dH) / 2, width: dW, height: dH })
        textX = 620
    }

    const textW = W - textX - 40

    // Titolo (a capo automatico)
    const titleLines = wrapText(sec.title, fonts.bold, 56, textW)
    titleLines.slice(0, 3).forEach((line, i) => {
        page.drawText(line, { x: textX, y: fromTop(230 + i * 66), size: 56, font: fonts.bold, color: C_DARK })
    })

    // Timer
    page.drawText(`Tempo totale: ${sec.timer}`, {
        x: textX, y: fromTop(560), size: 22, font: fonts.regular, color: C_MUTED,
    })
}

// ── Pagina CONTATORE ──────────────────────────────────────────────────────────
async function addCounterPage(
    pdfDoc: PDFDocument,
    sec: Extract<Section, { type: 'counter' }>,
    fonts: { bold: PDFFont; regular: PDFFont }
) {
    const page = pdfDoc.addPage([W, H])
    page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: C_WHITE })
    drawBar(page)

    let textX = 30

    const img = await embedImg(pdfDoc, sec.imageBase64)
    if (img) {
        const maxW = 580, maxH = H - 80
        const scale = Math.min(maxW / img.width, maxH / img.height)
        const dW = img.width * scale, dH = img.height * scale
        page.drawImage(img, { x: 20 + (maxW - dW) / 2, y: (H - dH) / 2, width: dW, height: dH })
        textX = 630
    }

    const textW = W - textX - 40

    // Nome contatore
    const nameLines = wrapText(sec.name, fonts.bold, 44, textW)
    nameLines.slice(0, 3).forEach((line, i) => {
        page.drawText(line, { x: textX, y: fromTop(200 + i * 52), size: 44, font: fonts.bold, color: C_DARK })
    })

    // Valore
    page.drawText(String(sec.value), {
        x: textX, y: fromTop(420), size: 140, font: fonts.bold, color: C_PURPLE,
    })

    // "giri"
    page.drawText('giri', { x: textX, y: fromTop(575), size: 28, font: fonts.regular, color: C_MUTED })
}

// ── Pagina IMMAGINE ───────────────────────────────────────────────────────────
async function addImagePage(
    pdfDoc: PDFDocument,
    sec: Extract<Section, { type: 'image' }>,
    fonts: { bold: PDFFont; regular: PDFFont }
) {
    const page = pdfDoc.addPage([W, H])
    page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: C_WHITE })

    const img = await embedImg(pdfDoc, sec.imageBase64)
    if (img) {
        const maxW = W - 80, maxH = H - 80
        const scale = Math.min(maxW / img.width, maxH / img.height)
        const dW = img.width * scale, dH = img.height * scale
        page.drawImage(img, { x: 40 + (maxW - dW) / 2, y: 40 + (maxH - dH) / 2, width: dW, height: dH })
    }

    // Label in basso
    page.drawRectangle({ x: 0, y: 0, width: W, height: 36, color: rgb(0, 0, 0) })
    const labelW = fonts.bold.widthOfTextAtSize(sec.label, 18)
    page.drawText(sec.label, { x: (W - labelW) / 2, y: 10, size: 18, font: fonts.bold, color: C_WHITE })
}

// ── Pagina NOTE ───────────────────────────────────────────────────────────────
async function addNotesPage(
    pdfDoc: PDFDocument,
    sec: Extract<Section, { type: 'notes' }>,
    fonts: { bold: PDFFont; regular: PDFFont }
) {
    const page = pdfDoc.addPage([W, H])
    page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: C_BG_LILAC })
    drawBar(page)

    page.drawText('NOTE DI LAVORO', { x: 40, y: fromTop(60), size: 24, font: fonts.bold, color: C_PURPLE })
    page.drawText(`${sec.title}  •  Tempo totale: ${sec.timer}`, {
        x: 40, y: fromTop(110), size: 16, font: fonts.regular, color: C_MUTED,
    })

    const noteLines = wrapText(sec.text, fonts.regular, 22, W - 80)
    noteLines.slice(0, 18).forEach((line, i) => {
        page.drawText(line, { x: 40, y: fromTop(155 + i * 32), size: 22, font: fonts.regular, color: C_DARK })
    })
}

// ── Poll Canva import job ─────────────────────────────────────────────────────
async function pollImportJob(jobId: string, token: string, maxMs = 90000): Promise<string | null> {
    const deadline = Date.now() + maxMs
    while (Date.now() < deadline) {
        await new Promise(r => setTimeout(r, 2500))
        const res = await fetch(`https://api.canva.com/rest/v1/imports/${jobId}`, {
            headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) return null
        const data = await res.json()
        if (data.job?.status === 'success') return data.job?.result?.designs?.[0]?.urls?.edit_url ?? null
        if (data.job?.status === 'failed') {
            console.error('[Canva Export] Import job failed:', data.job?.error)
            return null
        }
    }
    return null
}

// ── Handler principale ────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

    const { title, sections } = await request.json() as { title: string; sections: Section[] }
    if (!sections?.length) {
        return NextResponse.json({ error: 'Nessuna sezione da esportare' }, { status: 400 })
    }

    const { data: profile } = await supabase.from('profiles').select('canva_token').eq('id', user.id).single()
    const token = (profile as any)?.canva_token
    if (!token) {
        return NextResponse.json({ error: 'Canva non connesso. Collegati dal tuo profilo.' }, { status: 400 })
    }

    try {
        // 1. Crea PDF con elementi reali (testo + immagini come oggetti separati)
        const pdfDoc = await PDFDocument.create()
        const boldFont    = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
        const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica)
        const fonts = { bold: boldFont, regular: regularFont }

        for (const section of sections) {
            if (section.type === 'title')   await addTitlePage(pdfDoc, section, fonts)
            if (section.type === 'counter') await addCounterPage(pdfDoc, section, fonts)
            if (section.type === 'image')   await addImagePage(pdfDoc, section, fonts)
            if (section.type === 'notes')   await addNotesPage(pdfDoc, section, fonts)
        }

        // "made with lurumi.it" solo sull'ultima pagina in basso a destra
        const pages = pdfDoc.getPages()
        if (pages.length > 0) {
            const lastPage = pages[pages.length - 1]
            const footerText = 'made with lurumi.it'
            const footerW = regularFont.widthOfTextAtSize(footerText, 13)
            lastPage.drawText(footerText, {
                x: W - footerW - 20, y: 18, size: 13, font: regularFont, color: C_MUTED,
            })
        }

        const pdfBytes = await pdfDoc.save()

        // 2. Importa il PDF su Canva
        const titleBase64 = Buffer.from(title.slice(0, 50)).toString('base64')
        const importRes = await fetch('https://api.canva.com/rest/v1/imports', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/octet-stream',
                'Import-Metadata': JSON.stringify({ title_base64: titleBase64, mime_type: 'application/pdf' }),
            },
            body: Buffer.from(pdfBytes),
        })

        if (!importRes.ok) {
            const err = await importRes.text()
            console.error('[Canva Export] Import failed:', importRes.status, err)
            if (importRes.status === 401) {
                return NextResponse.json({
                    error: 'Token Canva scaduto. Ricollega il tuo account Canva dal profilo.',
                }, { status: 401 })
            }
            return NextResponse.json({ error: "Errore durante l'importazione su Canva" }, { status: 500 })
        }

        const importData = await importRes.json()
        const jobId = importData.job?.id
        if (!jobId) return NextResponse.json({ error: 'Risposta Canva non valida' }, { status: 500 })

        // 3. Attendi completamento (max 90s)
        const designUrl = await pollImportJob(jobId, token, 90000)
        if (!designUrl) return NextResponse.json({ error: 'Import Canva non completato in tempo' }, { status: 500 })

        return NextResponse.json({ success: true, designUrl, sectionsUploaded: sections.length })

    } catch (e: any) {
        console.error('[Canva Export] Unexpected error:', e)
        return NextResponse.json({ error: "Errore durante l'esportazione" }, { status: 500 })
    }
}
