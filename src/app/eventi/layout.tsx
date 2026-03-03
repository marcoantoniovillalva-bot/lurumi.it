import type { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Corsi ed Eventi',
    description: 'Partecipa ai corsi dal vivo di uncinetto e amigurumi con Lurumi. Prenota il tuo posto, scopri le date disponibili e migliora le tue tecniche con esperti.',
    openGraph: {
        title: 'Corsi ed Eventi — Lurumi',
        description: 'Corsi dal vivo di uncinetto e amigurumi. Prenota il tuo posto e impara nuove tecniche con istruttori esperti.',
    },
}

export default function EventiLayout({ children }: { children: React.ReactNode }) {
    return children
}
