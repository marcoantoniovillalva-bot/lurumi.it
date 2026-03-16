import imageCompression from 'browser-image-compression';

/**
 * Comprime un'immagine prima dell'upload su Supabase Storage.
 * - Max 1 MB, max 2000px su qualsiasi lato, qualità 0.82
 * - I PDF e i file non-immagine vengono restituiti invariati
 * - In caso di errore restituisce il file originale (mai blocca l'upload)
 */
export async function compressImage(file: File): Promise<File> {
    if (!file.type.startsWith('image/')) return file;

    try {
        const compressed = await imageCompression(file, {
            maxSizeMB: 1,
            maxWidthOrHeight: 2000,
            useWebWorker: true,
            initialQuality: 0.82,
        });
        // Mantieni il nome originale
        return new File([compressed], file.name, { type: compressed.type });
    } catch {
        return file;
    }
}
