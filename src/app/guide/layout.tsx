import type { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Guide',
    description: 'Guide e risorse per imparare l\'uncinetto, leggere i simboli, creare amigurumi e usare al meglio gli strumenti AI di Lurumi.',
    openGraph: {
        title: 'Guide — Lurumi',
        description: 'Scopri guide pratiche su uncinetto, amigurumi, lettura simboli e uso degli strumenti AI.',
    },
}

export default function GuideLayout({ children }: { children: React.ReactNode }) {
    return children
}
