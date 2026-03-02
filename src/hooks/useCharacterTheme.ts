'use client'

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

export function getCharacterUrl(character: CharacterName, slot: CharacterSlot): string {
    return `${SUPABASE_URL}/storage/v1/object/public/character-themes/${character}/${slot}.png`
}

// URL dell'immagine originale del personaggio (usata nel picker)
export function getCharacterPreviewUrl(character: CharacterName): string {
    return `${SUPABASE_URL}/storage/v1/object/public/character-themes/${character}/welcome.png`
}

export function useCharacterTheme() {
    const { profile } = useUserProfile()
    const character = ((profile as any)?.character_theme as CharacterName) ?? 'luly'

    return {
        character,
        getUrl: (slot: CharacterSlot) => getCharacterUrl(character, slot),
    }
}
