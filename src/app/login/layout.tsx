import type { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Accedi',
    description: 'Accedi a Lurumi per gestire i tuoi progetti di uncinetto, usare gli strumenti AI e prenotare i corsi dal vivo.',
    openGraph: {
        title: 'Accedi — Lurumi',
        description: 'Entra nella tua area Lurumi per gestire progetti di uncinetto e amigurumi con l\'aiuto dell\'AI.',
    },
    robots: { index: false, follow: false },
}

export default function LoginLayout({ children }: { children: React.ReactNode }) {
    return children
}
