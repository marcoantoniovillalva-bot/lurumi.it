'use client'

import { createContext, useContext } from 'react'

// Contiene il carattere iniziale letto dal cookie lato server.
// Passato dal layout server → client, elimina il flash di Luly al refresh.
export const CharacterThemeContext = createContext<string>('luly')

export function CharacterThemeProvider({
    initialChar,
    children,
}: {
    initialChar: string
    children: React.ReactNode
}) {
    return (
        <CharacterThemeContext.Provider value={initialChar}>
            {children}
        </CharacterThemeContext.Provider>
    )
}

export function useCharacterThemeContext() {
    return useContext(CharacterThemeContext)
}
