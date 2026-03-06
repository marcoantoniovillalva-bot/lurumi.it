import type { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Supporto',
    description: 'Hai bisogno di aiuto? Contatta il supporto Lurumi, segnala un bug o invia un feedback. Siamo qui per aiutarti.',
    openGraph: {
        title: 'Supporto — Lurumi',
        description: 'Centro di supporto Lurumi: segnalazioni bug, richieste e feedback.',
    },
    robots: { index: false, follow: false },
}

export default function SupportLayout({ children }: { children: React.ReactNode }) {
    return children
}
