import JSZip from 'jszip'

export interface CanvaExportData {
    projectName: string
    images: { name: string; url: string }[]
    metadata: { [key: string]: any }[]
}

/**
 * Generates a ZIP file containing:
 * 1. An 'images' folder with all project images.
 * 2. A 'data.csv' file compatible with Canva's "Bulk Create".
 */
export async function exportToCanva(data: CanvaExportData) {
    const zip = new JSZip()
    const imgFolder = zip.folder('images')

    // CSV Header: Image, [Metadata Keys...]
    const metaKeys = data.metadata.length > 0 ? Object.keys(data.metadata[0]) : []
    let csvContent = `Image,${metaKeys.join(',')}\n`

    // Process Images and Metadata
    for (let i = 0; i < data.images.length; i++) {
        const img = data.images[i]
        const meta = data.metadata[i] || {}

        // Download image
        try {
            const response = await fetch(img.url)
            const blob = await response.blob()
            imgFolder?.file(img.name, blob)

            // Update CSV row
            const metaValues = metaKeys.map(key => `"${String(meta[key] || '').replace(/"/g, '""')}"`)
            csvContent += `${img.name},${metaValues.join(',')}\n`
        } catch (error) {
            console.error(`Failed to include image ${img.name} in export:`, error)
        }
    }

    zip.file('canva_bulk_create.csv', csvContent)

    const content = await zip.generateAsync({ type: 'blob' })
    const url = window.URL.createObjectURL(content)
    const link = document.createElement('a')
    link.href = url
    link.download = `${data.projectName.replace(/\s+/g, '_')}_canva_export.zip`
    link.click()
}
