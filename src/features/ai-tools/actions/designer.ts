'use server'

import { createClient, createServiceClient } from '@/lib/supabase/server'

// Estrae il path storage da un URL Supabase (pubblico o signed)
function extractStoragePath(url: string): string | null {
    const match = url.match(/designer-images\/(.+?)(\?|$)/)
    return match?.[1] ? decodeURIComponent(match[1]) : null
}

export interface DesignerGeneration {
    id: string
    imageUrl: string
    prompt: string
    aspectRatio: string
    hd: boolean
    createdAt: string
}

export async function getDesignerHistory(): Promise<DesignerGeneration[]> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    const { data } = await supabase
        .from('ai_generations')
        .select('id, output_data, created_at')
        .eq('user_id', user.id)
        .eq('tool_type', 'designer')
        .order('created_at', { ascending: false })
        .limit(100)

    const filtered = (data ?? []).filter(r => {
        const url = r.output_data?.imageUrl as string | undefined
        // Solo URL Supabase Storage — esclude base64 e URL Replicate (scadono in 24-48h)
        return url && url.includes('supabase.co') && url.includes('designer-images')
    })

    if (filtered.length === 0) return []

    const serviceClient = createServiceClient()

    // Genera signed URL individuale per ogni immagine (7 giorni) — in parallelo
    return await Promise.all(
        filtered.map(async (r) => {
            const storedUrl = r.output_data.imageUrl as string
            const path = extractStoragePath(storedUrl)
            let finalUrl = storedUrl

            if (path) {
                try {
                    const { data, error } = await serviceClient.storage
                        .from('designer-images')
                        .createSignedUrl(path, 7 * 24 * 3600)
                    if (data?.signedUrl && !error) finalUrl = data.signedUrl
                    else console.error('[designer history] signed URL error:', error, 'path:', path)
                } catch (e) {
                    console.error('[designer history] signed URL exception:', e)
                }
            }

            return {
                id: r.id,
                imageUrl: finalUrl,
                prompt: (r.output_data.prompt as string) ?? '',
                aspectRatio: (r.output_data.aspectRatio as string) ?? '1:1',
                hd: (r.output_data.hd as boolean) ?? false,
                createdAt: r.created_at as string,
            }
        })
    )
}

export async function deleteDesignerGeneration(id: string): Promise<void> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Non autenticato')

    const { data: row } = await supabase
        .from('ai_generations')
        .select('output_data')
        .eq('id', id)
        .eq('user_id', user.id)
        .single()

    if (!row) throw new Error('Immagine non trovata')

    const imageUrl: string = (row.output_data as any)?.imageUrl ?? ''
    if (imageUrl) {
        try {
            const path = extractStoragePath(imageUrl)
            if (path) {
                const serviceClient = createServiceClient()
                await serviceClient.storage.from('designer-images').remove([path])
            }
        } catch { /* continua anche se delete Storage fallisce */ }
    }

    await supabase.from('ai_generations').delete().eq('id', id)
}
