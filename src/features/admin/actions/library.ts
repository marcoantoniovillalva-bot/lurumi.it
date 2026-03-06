'use server'

import { createClient } from '@/lib/supabase/server'
import { pushToAllUsers } from '@/lib/webpush'
import { revalidatePath } from 'next/cache'
import { enrollAllActiveUsersInSequence } from '@/lib/email-triggers'

/* ─── Tipi ─────────────────────────────────────────────────── */

export interface LibrarySection {
    id: string
    title: string
    body: string
    image_urls: string[]
    image_captions?: string[]   // opzionale: nome/didascalia per ogni immagine (stesso indice)
    order: number
}

export interface LibraryItem {
    id: string
    title: string
    description: string
    item_type: 'schema' | 'book'
    tier: 'free' | 'premium'
    language: string | null
    cover_urls: string[]
    content_type: 'pdf' | 'sections'
    pdf_url: string | null
    video_url: string | null
    sections: LibrarySection[]
    is_published: boolean
    created_at: string
    updated_at: string
}

export interface LibraryFormData {
    title: string
    description: string
    item_type: 'schema' | 'book'
    tier: 'free' | 'premium'
    language?: string
    cover_urls: string[]
    content_type: 'pdf' | 'sections'
    pdf_url?: string
    video_url?: string
    sections: LibrarySection[]
    is_published?: boolean
}

/* ─── Guard admin ─────────────────────────────────────────── */

async function assertAdmin() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Non autenticato')
    const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single()
    if (!profile?.is_admin) throw new Error('Non autorizzato')
    return supabase
}

/* ─── Azioni admin ─────────────────────────────────────────── */

export async function getAdminLibraryItems(): Promise<LibraryItem[]> {
    const supabase = await assertAdmin()
    const { data, error } = await supabase
        .from('library_items')
        .select('*')
        .order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []) as LibraryItem[]
}

export async function createLibraryItem(
    itemId: string,
    form: LibraryFormData
): Promise<void> {
    const supabase = await assertAdmin()
    const { error } = await supabase
        .from('library_items')
        .insert({
            id: itemId,
            title: form.title,
            description: form.description,
            item_type: form.item_type,
            tier: form.tier,
            language: form.language?.trim() || null,
            cover_urls: form.cover_urls,
            content_type: form.content_type,
            pdf_url: form.pdf_url || null,
            video_url: form.video_url || null,
            sections: form.sections,
            is_published: form.is_published ?? true,
        })
    if (error) throw error

    // Notifica push a tutti gli utenti quando si pubblica
    if (form.is_published !== false) {
        const typeLabel = form.item_type === 'book' ? 'Libro' : 'Schema'
        pushToAllUsers({
            title: `Lurumi — Nuovo ${typeLabel} disponibile`,
            body: form.title,
            url: '/tools/books',
            tag: `library-new-${itemId}`,
        }).catch(() => {})
        // Enrollment sequenza email new_library_item
        enrollAllActiveUsersInSequence('new_library_item', { title: form.title, type: form.item_type }).catch(() => {})
    }

    revalidatePath('/tools/books')
}

export async function updateLibraryItem(
    id: string,
    form: Partial<LibraryFormData>
): Promise<void> {
    const supabase = await assertAdmin()
    const payload: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
    }
    if (form.title !== undefined) payload.title = form.title
    if (form.description !== undefined) payload.description = form.description
    if (form.item_type !== undefined) payload.item_type = form.item_type
    if (form.tier !== undefined) payload.tier = form.tier
    if (form.language !== undefined) payload.language = form.language?.trim() || null
    if (form.cover_urls !== undefined) payload.cover_urls = form.cover_urls
    if (form.content_type !== undefined) payload.content_type = form.content_type
    if (form.pdf_url !== undefined) payload.pdf_url = form.pdf_url || null
    if (form.video_url !== undefined) payload.video_url = form.video_url || null
    if (form.sections !== undefined) payload.sections = form.sections
    if (form.is_published !== undefined) payload.is_published = form.is_published

    const { error } = await supabase
        .from('library_items')
        .update(payload)
        .eq('id', id)
    if (error) throw error

    revalidatePath('/tools/books')
}

export async function deleteLibraryItem(id: string): Promise<void> {
    const supabase = await assertAdmin()
    const { error } = await supabase
        .from('library_items')
        .delete()
        .eq('id', id)
    if (error) throw error
    revalidatePath('/tools/books')
}

/* ─── Azione pubblica (utenti) ────────────────────────────── */

export async function getPublishedLibraryItems(): Promise<LibraryItem[]> {
    const supabase = await createClient()
    const { data, error } = await supabase
        .from('library_items')
        .select('*')
        .eq('is_published', true)
        .order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []) as LibraryItem[]
}

export async function getLibraryItemById(id: string): Promise<LibraryItem | null> {
    const supabase = await createClient()
    const { data, error } = await supabase
        .from('library_items')
        .select('*')
        .eq('id', id)
        .eq('is_published', true)
        .single()
    if (error) return null
    return data as LibraryItem
}
