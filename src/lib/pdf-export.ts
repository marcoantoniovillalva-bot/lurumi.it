import { PDFDocument, rgb } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'

export interface PdfProjectInput {
    title: string
    timer?: number
    type?: string
    url?: string          // link YouTube (tutorial) o altro link esterno
    coverImageId?: string
    images?: { id: string }[]
    secs: { id: string; name: string; value: number; imageId?: string; sectionId?: string }[]
    sections?: { id: string; title: string; description?: string; order: number }[]
    notesHtml?: string
}

const PURPLE       = rgb(0.482, 0.361, 0.965)  // #7B5CF6
const PURPLE_LIGHT = rgb(0.961, 0.941, 1.0)    // #F5EEFF lavanda chiara
const PURPLE_MID   = rgb(0.82,  0.76,  1.0)    // bordi sezione
const DARK         = rgb(0.11,  0.11,  0.118)  // #1C1C1E
const MUTED        = rgb(0.604, 0.635, 0.694)  // #9AA2B1
const LIGHT        = rgb(0.933, 0.941, 0.957)  // #EEF0F4

function stripHtml(html: string): string {
    return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

/** Word-wrap che rispetta i newline dell'utente */
function wrapText(text: string, font: any, fontSize: number, maxWidth: number): string[] {
    const lines: string[] = []
    for (const para of text.split('\n')) {
        if (!para.trim()) { lines.push(''); continue }
        const words = para.split(' ')
        let cur = ''
        for (const word of words) {
            const test = cur ? cur + ' ' + word : word
            if (font.widthOfTextAtSize(test, fontSize) <= maxWidth) {
                cur = test
            } else {
                if (cur) lines.push(cur)
                cur = word
            }
        }
        if (cur) lines.push(cur)
    }
    return lines
}

/** Fetch raw PNG bytes (preserva trasparenza — non usa canvas) */
async function fetchPngRaw(url: string): Promise<Uint8Array | null> {
    try {
        const res = await fetch(url)
        if (!res.ok) return null
        return new Uint8Array(await res.arrayBuffer())
    } catch { return null }
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

async function loadFontBytes(path: string): Promise<ArrayBuffer> {
    const res = await fetch(path)
    return res.arrayBuffer()
}

export async function generatePatternPdf(
    project: PdfProjectInput,
    imageUrls: (string | null)[]
): Promise<Uint8Array> {
    const pdfDoc = await PDFDocument.create()
    pdfDoc.registerFontkit(fontkit)
    // Noto Sans supporta Latin, Cyrillic, Greek e molti altri script
    const [boldBytes, normalBytes] = await Promise.all([
        loadFontBytes('/fonts/NotoSans-Bold.ttf'),
        loadFontBytes('/fonts/NotoSans-Regular.ttf'),
    ])
    const fontBold   = await pdfDoc.embedFont(boldBytes)
    const fontNormal = await pdfDoc.embedFont(normalBytes)

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

    // Header bar viola con titolo progetto (auto-size per titoli lunghi)
    coverPage.drawRectangle({ x: 0, y: H - 80, width: W, height: 80, color: PURPLE })
    const maxHeaderW = W - MARGIN * 2 - 8
    let headerTitleSize = 22
    while (headerTitleSize > 11 && fontBold.widthOfTextAtSize(project.title, headerTitleSize) > maxHeaderW) {
        headerTitleSize -= 1
    }
    const headerTitleLines = wrapText(project.title, fontBold, headerTitleSize, maxHeaderW)
    const headerLineH = headerTitleSize + 3
    const headerBlockH = headerTitleLines.length * headerLineH
    const headerStartY = H - 40 - (headerBlockH - headerTitleSize) / 2
    headerTitleLines.forEach((line, i) => {
        coverPage.drawText(line, { x: MARGIN, y: headerStartY - i * headerLineH, size: headerTitleSize, font: fontBold, color: rgb(1, 1, 1) })
    })

    coverY = H - 80 - 24

    // Tipo — sempre "SCHEMA PDF"
    coverPage.drawText('SCHEMA PDF', {
        x: MARGIN, y: coverY, size: 10, font: fontBold, color: MUTED,
    })
    coverY -= 8

    // Linea separatore
    coverPage.drawLine({ start: { x: MARGIN, y: coverY }, end: { x: W - MARGIN, y: coverY }, thickness: 1, color: LIGHT })
    coverY -= 24

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
                // Occupa quasi tutto lo spazio rimasto sul foglio
                // coverY = posizione Y dopo le scritte; 72 = footer(52) + buffer(20)
                const maxW = CONTENT_W
                const maxH = coverY - 72
                // Scala per riempire lo spazio (no limite a 1: permette upscaling per immagini piccole)
                const scale = Math.min(maxW / embedded.width, maxH / embedded.height)
                const iW = embedded.width * scale
                const iH = embedded.height * scale
                const iX = MARGIN + (CONTENT_W - iW) / 2
                // Centra l'immagine verticalmente tra le scritte (coverY) e il footer (72pt)
                const availableCenter = (coverY + 72) / 2
                const iY = availableCenter - iH / 2
                coverPage.drawImage(embedded, { x: iX, y: iY, width: iW, height: iH })
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

    // Traccia la pagina e la posizione Y corrente per ottimizzare il riempimento pagine
    let activePage: ReturnType<typeof addPage> = coverPage
    let activeY: number = coverY

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
        activePage = galPage; activeY = y
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

        // Helper: disegna un singolo contatore nella pagina corrente
        const drawCounter = async (
            sec: { id: string; name: string; value: number; imageId?: string; sectionId?: string },
            page: ReturnType<typeof addPage>,
            yPos: number
        ): Promise<{ page: ReturnType<typeof addPage>; y: number }> => {
            const secImgIdx = sec.imageId
                ? (project.images ?? []).findIndex(i => i.id === sec.imageId)
                : -1
            const secImgUrl = secImgIdx >= 0 ? (imageUrls[secImgIdx] ?? null) : null
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

            // Calcola altezza blocco: immagine + riga "nome [valore]" + divider
            const blockH = (secImgH > 0 ? secImgH + 12 : 0) + 20 + 10 + 20
            let curPage = page
            let curY = yPos
            if (curY < blockH + 60) {
                curPage = addPage()
                curY = H - MARGIN
            }

            if (secImgEmbedded && secImgH > 0) {
                curPage.drawImage(secImgEmbedded, {
                    x: MARGIN + (CONTENT_W - secImgW) / 2,
                    y: curY - secImgH,
                    width: secImgW,
                    height: secImgH,
                })
                curY -= secImgH + 12
            }

            // Nome e [valore] sulla stessa riga
            const nameText = sec.name || 'Parte'
            const valueText = ` [${sec.value}]`
            curPage.drawText(nameText, {
                x: MARGIN, y: curY, size: 13, font: fontBold, color: DARK,
            })
            const nameWidth = fontBold.widthOfTextAtSize(nameText, 13)
            curPage.drawText(valueText, {
                x: MARGIN + nameWidth, y: curY, size: 13, font: fontBold, color: PURPLE,
            })
            curY -= 10

            curPage.drawLine({ start: { x: MARGIN, y: curY }, end: { x: W - MARGIN, y: curY }, thickness: 0.4, color: LIGHT })
            curY -= 20

            return { page: curPage, y: curY }
        }

        const sectionsList = (project.sections ?? []).sort((a, b) => a.order - b.order)

        /** Disegna l'intestazione di una sezione con sfondo lavanda + barra sinistra viola */
        const drawSectionHeader = async (
            page: ReturnType<typeof addPage>,
            yPos: number,
            section: { title: string; description?: string }
        ): Promise<{ page: ReturnType<typeof addPage>; y: number }> => {
            const SECT_FS = 13
            const DESC_FS = 9
            const descLines = section.description ? wrapText(section.description, fontNormal, DESC_FS, CONTENT_W - 16) : []
            const headerH = 38 + (descLines.length > 0 ? descLines.length * (DESC_FS + 3) + 10 : 0)

            let curPage = page
            let curY = yPos
            // Assicura spazio sufficiente
            if (curY < headerH + 80) { curPage = addPage(); curY = H - MARGIN }

            // Background lavanda
            curPage.drawRectangle({ x: MARGIN, y: curY - headerH + 6, width: CONTENT_W, height: headerH, color: PURPLE_LIGHT })
            // Barra sinistra viola
            curPage.drawRectangle({ x: MARGIN, y: curY - headerH + 6, width: 4, height: headerH, color: PURPLE })
            // Titolo sezione
            curPage.drawText(section.title, { x: MARGIN + 12, y: curY - 14, size: SECT_FS, font: fontBold, color: PURPLE, maxWidth: CONTENT_W - 16 })
            curY -= 32  // più spazio tra titolo e descrizione (era 22)

            // Descrizione (wrapped, rispetta i newline)
            for (const line of descLines) {
                curPage.drawText(line, { x: MARGIN + 12, y: curY, size: DESC_FS, font: fontNormal, color: MUTED })
                curY -= DESC_FS + 4
            }
            if (descLines.length > 0) curY -= 6

            curY -= 18  // più spazio tra intestazione e primo contatore (era 10)
            return { page: curPage, y: curY }
        }

        if (sectionsList.length > 0) {
            // Render grouped by section
            for (const section of sectionsList) {
                const sectionCounters = project.secs.filter(s => s.sectionId === section.id)
                if (sectionCounters.length === 0) continue

                const hdrResult = await drawSectionHeader(secsPage, y, section)
                secsPage = hdrResult.page
                y = hdrResult.y

                for (const sec of sectionCounters) {
                    const result = await drawCounter(sec, secsPage, y)
                    secsPage = result.page
                    y = result.y
                }

                // Fine sezione: bordo viola chiaro + spazio
                secsPage.drawLine({ start: { x: MARGIN, y }, end: { x: W - MARGIN, y }, thickness: 1.2, color: PURPLE_MID })
                y -= 24
            }

            // Ungrouped counters
            const ungrouped = project.secs.filter(s => !s.sectionId)
            if (ungrouped.length > 0) {
                const hdrResult = await drawSectionHeader(secsPage, y, { title: 'Senza sezione' })
                secsPage = hdrResult.page
                y = hdrResult.y
                for (const sec of ungrouped) {
                    const result = await drawCounter(sec, secsPage, y)
                    secsPage = result.page
                    y = result.y
                }
            }
        } else {
            // No sections — render flat list
            for (const sec of project.secs) {
                const result = await drawCounter(sec, secsPage, y)
                secsPage = result.page
                y = result.y
            }
        }
        activePage = secsPage; activeY = y
    }

    // ── Note: sulla stessa pagina se c'è spazio, altrimenti nuova pagina ────
    if (project.notesHtml && stripHtml(project.notesHtml).length > 0) {
        const FOOTER_CLEARANCE = 52 + 20  // FOOTER_H + buffer
        const NOTES_HEADER_H = 62         // titolo 20pt + linea + spacing
        const MIN_LINES = 3               // minimo righe di testo da mostrare
        const LINE_H = 16
        const MIN_NOTES_SPACE = NOTES_HEADER_H + MIN_LINES * LINE_H + FOOTER_CLEARANCE  // ~154pt

        // Riusa la pagina corrente se c'è abbastanza spazio, altrimenti nuova pagina
        let notesPage: ReturnType<typeof addPage>
        let y: number
        if (activeY > MIN_NOTES_SPACE + 32) {
            // Spazio sufficiente: aggiungi sezione nella stessa pagina con gap
            notesPage = activePage
            y = activeY - 32
        } else {
            notesPage = addPage()
            y = H - MARGIN
        }

        notesPage.drawText('Note', {
            x: MARGIN, y, size: 20, font: fontBold, color: DARK,
        })
        y -= 14
        notesPage.drawLine({ start: { x: MARGIN, y }, end: { x: W - MARGIN, y }, thickness: 1, color: LIGHT })
        y -= 28

        const noteText = stripHtml(project.notesHtml)
        const noteLines = wrapText(noteText, fontNormal, 11, CONTENT_W)
        const bottomLimit = FOOTER_CLEARANCE + 8

        for (const line of noteLines) {
            if (y < bottomLimit) break
            notesPage.drawText(line, { x: MARGIN, y, size: 11, font: fontNormal, color: DARK })
            y -= LINE_H
        }
    }

    // ── Footer viola sull'ultima pagina ─────────────────────────────────────
    const FOOTER_H = 52
    const lastPage = pdfDoc.getPage(pdfDoc.getPageCount() - 1)
    // Copre il footer-line esistente con il rettangolo viola
    lastPage.drawRectangle({ x: 0, y: 0, width: W, height: FOOTER_H, color: PURPLE })

    // Logo (PNG raw, trasparenza preservata)
    let logoEndX = MARGIN
    try {
        const logoPngBytes = await fetchPngRaw('/images/logo/isotipo.png')
        if (logoPngBytes) {
            const logoImg = await pdfDoc.embedPng(logoPngBytes)
            const logoH = 32
            const logoScale = logoH / logoImg.height
            const logoW = logoImg.width * logoScale
            lastPage.drawImage(logoImg, {
                x: MARGIN,
                y: (FOOTER_H - logoH) / 2,
                width: logoW,
                height: logoH,
            })
            logoEndX = MARGIN + logoW + 10
        }
    } catch {}

    // "fatto con www.lurumi.it" — usa il carattere obliquo tramite shear sulla matrice di trasformazione
    // non disponendo di un font italic, utilizziamo il font normal con testo semplice
    const footerText = 'fatto con www.lurumi.it'
    const footerFontSize = 11
    lastPage.drawText(footerText, {
        x: logoEndX,
        y: (FOOTER_H - footerFontSize) / 2,
        size: footerFontSize,
        font: fontNormal,
        color: rgb(1, 1, 1),
    })

    return pdfDoc.save()
}
