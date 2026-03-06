import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'

export interface PdfProjectInput {
    title: string
    timer?: number
    type?: string
    url?: string          // link YouTube (tutorial) o altro link esterno
    coverImageId?: string
    images?: { id: string }[]
    secs: { id: string; name: string; value: number; imageId?: string }[]
    notesHtml?: string
}

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
        // Usa canvas per convertire qualsiasi formato (PNG, JPEG, WebP, HEIC…) in JPEG
        const img = new Image()
        img.crossOrigin = 'anonymous'
        await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve()
            img.onerror = () => reject(new Error('load failed'))
            img.src = url
        })
        const canvas = document.createElement('canvas')
        canvas.width = img.naturalWidth
        canvas.height = img.naturalHeight
        const ctx = canvas.getContext('2d')
        if (!ctx) return null
        ctx.drawImage(img, 0, 0)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.92)
        const base64 = dataUrl.split(',')[1]
        const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0))
        return { bytes, isPng: false }
    } catch {
        return null
    }
}

export async function generatePatternPdf(
    project: PdfProjectInput,
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
    const typeLabel = project.type === 'pdf' ? 'Pattern PDF' : project.type === 'tutorial' ? 'Tutorial' : 'Galleria Immagini'
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
        coverY -= 20
    }

    // Link YouTube / URL esterno (solo se presente)
    if (project.url) {
        const urlLabel = 'Tutorial: '
        const urlText = project.url.length > 60 ? project.url.slice(0, 57) + '...' : project.url
        const labelW = fontBold.widthOfTextAtSize(urlLabel, 9)
        const linkW  = fontNormal.widthOfTextAtSize(urlText, 9)
        coverPage.drawText(urlLabel, { x: MARGIN, y: coverY, size: 9, font: fontBold, color: MUTED })
        coverPage.drawText(urlText,  { x: MARGIN + labelW, y: coverY, size: 9, font: fontNormal, color: PURPLE })
        // Sottolineatura per indicare link cliccabile
        coverPage.drawLine({
            start: { x: MARGIN + labelW, y: coverY - 1 },
            end:   { x: MARGIN + labelW + linkW, y: coverY - 1 },
            thickness: 0.5, color: PURPLE,
        })
        coverY -= 20
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

    // IDs delle immagini usate dai contatori secondari
    const counterImageIds = new Set(
        (project.secs ?? []).filter(s => s.imageId).map(s => s.imageId as string)
    )

    // Indice e ID dell'immagine di copertina effettiva
    const coverImgRealIdx = project.coverImageId
        ? (project.images ?? []).findIndex(i => i.id === project.coverImageId)
        : 0
    const coverImgRealId = (project.images ?? [])[coverImgRealIdx >= 0 ? coverImgRealIdx : 0]?.id

    // ── Pagina 2: Immagini non associate ────────────────────────────────────
    // Tutte le immagini che non sono né la copertina né associate a un contatore
    const galleryImages = (project.images ?? [])
        .map((img, idx) => ({ img, idx }))
        .filter(({ img }) => img.id !== coverImgRealId && !counterImageIds.has(img.id))

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
                const maxH = 300
                const scale = Math.min(CONTENT_W / embedded.width, maxH / embedded.height, 1)
                const iW = embedded.width * scale
                const iH = embedded.height * scale
                if (y - iH < 80) {
                    galPage = addPage()
                    y = H - MARGIN
                }
                galPage.drawImage(embedded, { x: MARGIN + (CONTENT_W - iW) / 2, y: y - iH, width: iW, height: iH })
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
            const secImgIdx = sec.imageId
                ? (project.images ?? []).findIndex(i => i.id === sec.imageId)
                : -1
            const secImgUrl = secImgIdx >= 0 ? (imageUrls[secImgIdx] ?? null) : null

            // Se l'immagine associata è anche la copertina → mostrala piccola (100px),
            // altrimenti mostrarla normale (200px)
            const isCoverDuplicate = sec.imageId === coverImgRealId
            const maxImgH = isCoverDuplicate ? 100 : 200

            let secImgEmbedded: Awaited<ReturnType<typeof pdfDoc.embedPng>> | null = null
            let secImgH = 0
            let secImgW = 0

            if (secImgUrl) {
                const imgData = await fetchImageAsBytes(secImgUrl)
                if (imgData) {
                    try {
                        secImgEmbedded = imgData.isPng
                            ? await pdfDoc.embedPng(imgData.bytes)
                            : await pdfDoc.embedJpg(imgData.bytes)
                        const scale = Math.min(CONTENT_W / secImgEmbedded.width, maxImgH / secImgEmbedded.height, 1)
                        secImgW = secImgEmbedded.width * scale
                        secImgH = secImgEmbedded.height * scale
                    } catch {}
                }
            }

            const blockH = (secImgH > 0 ? secImgH + 12 : 0) + 18 + 18 + 10 + 24
            if (y < blockH + 60) {
                secsPage = addPage()
                y = H - MARGIN
            }

            // Immagine sopra i dati del contatore
            if (secImgEmbedded && secImgH > 0) {
                secsPage.drawImage(secImgEmbedded, {
                    x: MARGIN + (CONTENT_W - secImgW) / 2,
                    y: y - secImgH,
                    width: secImgW,
                    height: secImgH,
                })
                y -= secImgH + 12
            }

            secsPage.drawText(sec.name || 'Parte', {
                x: MARGIN, y, size: 13, font: fontBold, color: DARK,
            })
            y -= 18

            secsPage.drawText(`${sec.value} giri`, {
                x: MARGIN, y, size: 11, font: fontNormal, color: PURPLE,
            })
            y -= 10

            secsPage.drawLine({ start: { x: MARGIN, y }, end: { x: W - MARGIN, y }, thickness: 0.4, color: LIGHT })
            y -= 24
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
