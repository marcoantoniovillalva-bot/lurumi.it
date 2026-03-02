'use client'

import { useEffect, useState } from 'react'
import { useAuth } from './useAuth'
import { useUserProfile } from './useUserProfile'

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

export function getCharacterUrl(character: CharacterName, slot: CharacterSlot): string {
    return `${SUPABASE_URL}/storage/v1/object/public/character-themes/${character}/${slot}.png`
}

export function getCharacterPreviewUrl(character: CharacterName): string {
    return `${SUPABASE_URL}/storage/v1/object/public/character-themes/${character}/welcome.png`
}

export function useCharacterTheme() {
    const { user, loading: authLoading } = useAuth()
    const { profile } = useUserProfile()

    // ── Lazy initializer: gira nel render, NON dopo ───────────────────────────
    // Su client (navigazione SPA): legge subito localStorage → zero flash.
    // Su server (SSR): window è undefined → 'luly' → React hydrates senza mismatch
    // grazie a suppressHydrationWarning sulle <img> che usano getUrl().
    const [character, setCharacter] = useState<CharacterName>(() => {
        if (typeof window === 'undefined') return 'luly'
        // Prima prova la cache per-utente (se sappiamo chi è loggato)
        const uid = localStorage.getItem(UID_KEY)
        if (uid) {
            const userChar = localStorage.getItem(userCharKey(uid)) as CharacterName | null
            if (userChar) return userChar
        }
        // Fallback al valore generale
        return (localStorage.getItem(CHAR_KEY) as CharacterName) ?? 'luly'
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

    return {
        character,
        getUrl: (slot: CharacterSlot) => getCharacterUrl(character, slot),
    }
}
