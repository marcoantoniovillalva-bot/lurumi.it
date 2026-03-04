'use client'

import { useEffect, useState } from 'react'
import { useAuth } from './useAuth'
import { useUserProfile } from './useUserProfile'
import { useCharacterThemeContext } from '@/components/CharacterThemeProvider'

export type CharacterSlot =
    | 'welcome'
    | 'projects_empty'
    | 'tutorials_empty'
    | 'tool_designer'
    | 'tool_chat'
    | 'tool_books'
    | 'tool_timer'
    | 'tool_notes'
    | 'tool_courses'
    | 'profile'

export type CharacterName = 'luly' | 'babol' | 'clara' | 'tommy' | 'derek' | 'sara' | 'susy'

export const CHARACTERS: { name: CharacterName; label: string }[] = [
    { name: 'luly',  label: 'Luly'  },
    { name: 'babol', label: 'Babol' },
    { name: 'clara', label: 'Clara' },
    { name: 'tommy', label: 'Tommy' },
    { name: 'derek', label: 'Derek' },
    { name: 'sara',  label: 'Sara'  },
    { name: 'susy',  label: 'Susy'  },
]

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!

// Chiavi localStorage
const CHAR_KEY = 'lurumi_character_theme'   // carattere corrente (resettato a 'luly' su logout)
const UID_KEY  = 'lurumi_auth_uid'          // ultimo user.id loggato (rimosso su logout)
const userCharKey = (uid: string) => `lurumi_char_${uid}` // cache per-utente (persiste)

// Versione asset: incrementa questo numero ogni volta che carichi nuove immagini
// su Supabase Storage per forzare il reload nei browser degli utenti.
const CHAR_ASSET_VERSION = 'v4'

export function getCharacterUrl(character: CharacterName, slot: CharacterSlot): string {
    return `${SUPABASE_URL}/storage/v1/object/public/character-themes/${character}/${slot}.png?v=${CHAR_ASSET_VERSION}`
}

export function getCharacterPreviewUrl(character: CharacterName): string {
    return `${SUPABASE_URL}/storage/v1/object/public/character-themes/${character}/welcome.png?v=${CHAR_ASSET_VERSION}`
}

export function useCharacterTheme() {
    const { user, loading: authLoading } = useAuth()
    const { profile } = useUserProfile()
    // Il valore letto dal cookie server-side — corrisponde all'avatar reale dell'utente.
    // Usato come initial state per SSR: server e client renderizzano lo stesso personaggio,
    // eliminando il flash di Luly al refresh F5.
    const serverChar = useCharacterThemeContext() as CharacterName

    // ── Lazy initializer: gira nel render, NON dopo ───────────────────────────
    // Su client (navigazione SPA): legge subito localStorage → zero flash.
    // Su server (SSR): window è undefined → usa serverChar (dal cookie) → nessun mismatch.
    const [character, setCharacter] = useState<CharacterName>(() => {
        if (typeof window === 'undefined') return serverChar
        // Prima prova la cache per-utente (se sappiamo chi è loggato)
        const uid = localStorage.getItem(UID_KEY)
        if (uid) {
            const userChar = localStorage.getItem(userCharKey(uid)) as CharacterName | null
            if (userChar) return userChar
        }
        // Fallback al valore generale
        return (localStorage.getItem(CHAR_KEY) as CharacterName) ?? serverChar
    })

    // ── Gestione login / logout ───────────────────────────────────────────────
    useEffect(() => {
        if (authLoading) return // auth non ancora risolta, non agire

        if (!user?.id) {
            // Logout confermato: reset a Luly, rimuovi puntatore uid
            localStorage.removeItem(UID_KEY)
            localStorage.setItem(CHAR_KEY, 'luly')
            setCharacter('luly')
            return
        }

        // Login confermato: salva uid, ripristina carattere specifico dell'utente
        localStorage.setItem(UID_KEY, user.id)
        const userChar = localStorage.getItem(userCharKey(user.id)) as CharacterName | null
        if (userChar) {
            setCharacter(userChar)
            localStorage.setItem(CHAR_KEY, userChar)
        }
    }, [user?.id, authLoading]) // eslint-disable-line react-hooks/exhaustive-deps

    // ── Sincronizzazione con Supabase (fonte di verità) ───────────────────────
    // Quando il profilo carica, aggiorna stato + entrambe le cache localStorage.
    const profileTheme = ((profile as any)?.character_theme as CharacterName | null) ?? null
    useEffect(() => {
        if (!profileTheme || !user?.id) return
        setCharacter(profileTheme)
        localStorage.setItem(CHAR_KEY, profileTheme)
        localStorage.setItem(userCharKey(user.id), profileTheme)
    }, [profileTheme, user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

    // ── Cookie sync: scrivi il cookie ogni volta che il personaggio cambia ────
    // Il cookie 'lurumi_char' viene letto server-side in layout.tsx al prossimo refresh.
    // Garantisce che F5 mostri subito il personaggio corretto senza flash.
    useEffect(() => {
        document.cookie = `lurumi_char=${character}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`
    }, [character])

    return {
        character,
        getUrl: (slot: CharacterSlot) => getCharacterUrl(character, slot),
    }
}
