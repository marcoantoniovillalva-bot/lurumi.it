import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import type { Project } from '@/features/projects/store/useProjectStore'

const PURPLE = rgb(0.482, 0.361, 0.965)  // #7B5CF6
const DARK   = rgb(0.11, 0.11, 0.118)    // #1C1C1E
const MUTED  = rgb(0.604, 0.635, 0.694)  // #9AA2B1
const LIGHT  = rgb(0.933, 0.941, 0.957)  // #EEF0F4

function stripHtml(html: string): string {
    return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function formatTime(seconds: number): string {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    if (h > 0) return `${h}h ${m}m`
    if (m > 0) return `${m}m ${s}s`
    return `${s}s`
}

async function fetchImageAsBytes(url: string): Promise<{ bytes: Uint8Array; isPng: boolean } | null> {
    try {
        const res = await fetch(url)
        if (!res.ok) return null
        const blob = await res.blob()
        const isPng = blob.type === 'image/png' || url.toLowerCase().includes('.png')
        const buf = await blob.arrayBuffer()
        return { bytes: new Uint8Array(buf), isPng }
    } catch {
        return null
    }
}

export async function generatePatternPdf(
    project: Project,
    imageUrls: (string | null)[]
): Promise<Uint8Array> {
    const pdfDoc = await PDFDocument.create()
    const fontBold   = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
    const fontNormal = await pdfDoc.embedFont(StandardFonts.Helvetica)

    const W = 595  // A4 width pt
    const H = 842  // A4 height pt
    const MARGIN = 48
    const CONTENT_W = W - MARGIN * 2

    // ── Helper: nuova pagina con footer ─────────────────────────────────────
    const addPage = () => {
        const page = pdfDoc.addPage([W, H])

        // Footer line
        page.drawLine({ start: { x: MARGIN, y: 36 }, end: { x: W - MARGIN, y: 36 }, thickness: 0.5, color: LIGHT })
        page.drawText('Creato con lurumi.it', {
            x: MARGIN, y: 20, size: 8, font: fontNormal, color: MUTED,
        })
        page.drawText(project.title, {
            x: W - MARGIN - fontBold.widthOfTextAtSize(project.title, 8),
            y: 20, size: 8, font: fontBold, color: MUTED,
        })
        return page
    }

    // ── Pagina 1: Copertina ─────────────────────────────────────────────────
    const coverPage = addPage()
    let coverY = H - MARGIN

    // Header bar viola
    coverPage.drawRectangle({ x: 0, y: H - 80, width: W, height: 80, color: PURPLE })
    coverPage.drawText('lurumi.it', { x: MARGIN, y: H - 52, size: 18, font: fontBold, color: rgb(1, 1, 1) })

    coverY = H - 80 - 40

    // Titolo
    const titleSize = project.title.length > 30 ? 24 : 30
    coverPage.drawText(project.title, {
        x: MARGIN, y: coverY, size: titleSize, font: fontBold, color: DARK,
        maxWidth: CONTENT_W,
    })
    coverY -= 30

    // Tipo
    const typeLabel = project.type === 'pdf' ? 'Pattern PDF' : 'Galleria Immagini'
    coverPage.drawText(typeLabel.toUpperCase(), {
        x: MARGIN, y: coverY, size: 10, font: fontBold, color: MUTED,
    })
    coverY -= 8

    // Linea separatore
    coverPage.drawLine({ start: { x: MARGIN, y: coverY }, end: { x: W - MARGIN, y: coverY }, thickness: 1, color: LIGHT })
    coverY -= 30

    // Timer
    if (project.timer && project.timer > 0) {
        coverPage.drawText(`Tempo: ${formatTime(project.timer)}`, {
            x: MARGIN, y: coverY, size: 11, font: fontNormal, color: MUTED,
        })
        coverY -= 24
    }

    // Immagine di copertina
    const coverImgIdx = project.coverImageId
        ? (project.images ?? []).findIndex(i => i.id === project.coverImageId)
        : 0
    const coverUrl = imageUrls[coverImgIdx >= 0 ? coverImgIdx : 0]
    if (coverUrl) {
        const imgData = await fetchImageAsBytes(coverUrl)
        if (imgData) {
            try {
                const embedded = imgData.isPng
                    ? await pdfDoc.embedPng(imgData.bytes)
                    : await pdfDoc.embedJpg(imgData.bytes)
                const maxW = CONTENT_W
                const maxH = Math.min(coverY - 80, 320)
                const scale = Math.min(maxW / embedded.width, maxH / embedded.height, 1)
                const iW = embedded.width * scale
                const iH = embedded.height * scale
                const iX = MARGIN + (CONTENT_W - iW) / 2
                coverPage.drawImage(embedded, { x: iX, y: coverY - iH, width: iW, height: iH })
            } catch {}
        }
    }

    // ── Pagina 2: Immagini non associate ────────────────────────────────────
    // Immagini che non sono la copertina e non sono associate a nessun contatore secondario
    const associatedImageIds = new Set([
        ...(project.coverImageId ? [project.coverImageId] : []),
        ...(project.secs ?? []).filter(s => s.imageId).map(s => s.imageId as string),
    ])
    const galleryImages = (project.images ?? [])
        .map((img, idx) => ({ img, idx }))
        .filter(({ img }) => !associatedImageIds.has(img.id))

    if (galleryImages.length > 0) {
        let galPage = addPage()
        let y = H - MARGIN

        galPage.drawText('Immagini del progetto', {
            x: MARGIN, y, size: 20, font: fontBold, color: DARK,
        })
        y -= 14
        galPage.drawLine({ start: { x: MARGIN, y }, end: { x: W - MARGIN, y }, thickness: 1, color: LIGHT })
        y -= 28

        for (const { idx } of galleryImages) {
            const url = imageUrls[idx]
            if (!url) continue
            const imgData = await fetchImageAsBytes(url)
            if (!imgData) continue
            try {
                const embedded = imgData.isPng
                    ? await pdfDoc.embedPng(imgData.bytes)
                    : await pdfDoc.embedJpg(imgData.bytes)
                const maxH = Math.min(y - 80, 300)
                const maxW = CONTENT_W
                const scale = Math.min(maxW / embedded.width, maxH / embedded.height, 1)
                const iW = embedded.width * scale
                const iH = embedded.height * scale
                if (y - iH < 60) {
                    galPage = addPage()
                    y = H - MARGIN
                }
                const iX = MARGIN + (CONTENT_W - iW) / 2
                galPage.drawImage(embedded, { x: iX, y: y - iH, width: iW, height: iH })
                y -= iH + 20
            } catch {}
        }
    }

    // ── Pagina 3: Contatori secondari (secs) ────────────────────────────────
    if (project.secs && project.secs.length > 0) {
        let secsPage = addPage()
        let y = H - MARGIN

        secsPage.drawText('Parti del progetto', {
            x: MARGIN, y, size: 20, font: fontBold, color: DARK,
        })
        y -= 14

        secsPage.drawLine({ start: { x: MARGIN, y }, end: { x: W - MARGIN, y }, thickness: 1, color: LIGHT })
        y -= 28

        for (const sec of project.secs) {
            // Trova immagine associata
            const secImgIdx = sec.imageId ? (project.images ?? []).findIndex(i => i.id === sec.imageId) : -1
            const secImgUrl = secImgIdx >= 0 ? imageUrls[secImgIdx] : null

            // Calcola altezza immagine associata (se presente)
            let secImgEmbedded = null
            let secImgH = 0
            let secImgW = 0
            if (secImgUrl) {
                const imgData = await fetchImageAsBytes(secImgUrl)
                if (imgData) {
                    try {
                        secImgEmbedded = imgData.isPng
                            ? await pdfDoc.embedPng(imgData.bytes)
                            : await pdfDoc.embedJpg(imgData.bytes)
                        const maxH = 200
                        const maxW = CONTENT_W
                        const scale = Math.min(maxW / secImgEmbedded.width, maxH / secImgEmbedded.height, 1)
                        secImgW = secImgEmbedded.width * scale
                        secImgH = secImgEmbedded.height * scale
                    } catch {}
                }
            }

            const blockH = (secImgH > 0 ? secImgH + 12 : 0) + 18 + 10 + 22 + 30
            if (y < blockH + 60) {
                secsPage = addPage()
                y = H - MARGIN
            }

            // Immagine sopra il contatore
            if (secImgEmbedded && secImgH > 0) {
                const iX = MARGIN + (CONTENT_W - secImgW) / 2
                secsPage.drawImage(secImgEmbedded, { x: iX, y: y - secImgH, width: secImgW, height: secImgH })
                y -= secImgH + 12
            }

            // Nome parte
            secsPage.drawText(sec.name || 'Parte', {
                x: MARGIN, y, size: 13, font: fontBold, color: DARK,
            })
            y -= 18

            // Valore giri
            secsPage.drawText(`${sec.value} giri`, {
                x: MARGIN, y, size: 11, font: fontNormal, color: PURPLE,
            })
            y -= 10

            secsPage.drawLine({ start: { x: MARGIN, y }, end: { x: W - MARGIN, y }, thickness: 0.4, color: LIGHT })
            y -= 22
        }
    }

    // ── Pagina 3: Note ───────────────────────────────────────────────────────
    if (project.notesHtml && stripHtml(project.notesHtml).length > 0) {
        const notesPage = addPage()
        let y = H - MARGIN

        notesPage.drawText('Note', {
            x: MARGIN, y, size: 20, font: fontBold, color: DARK,
        })
        y -= 14
        notesPage.drawLine({ start: { x: MARGIN, y }, end: { x: W - MARGIN, y }, thickness: 1, color: LIGHT })
        y -= 28

        const noteText = stripHtml(project.notesHtml)
        const words = noteText.split(' ')
        const lineH = 16
        const fontSize = 11
        let line = ''

        for (const word of words) {
            const candidate = line ? `${line} ${word}` : word
            if (fontNormal.widthOfTextAtSize(candidate, fontSize) > CONTENT_W) {
                notesPage.drawText(line, { x: MARGIN, y, size: fontSize, font: fontNormal, color: DARK })
                y -= lineH
                line = word
                if (y < 60) break
            } else {
                line = candidate
            }
        }
        if (line && y >= 60) {
            notesPage.drawText(line, { x: MARGIN, y, size: fontSize, font: fontNormal, color: DARK })
        }
    }

    return pdfDoc.save()
}
