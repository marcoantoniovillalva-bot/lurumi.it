import type { Metadata } from 'next'
import { ToolsDashboard } from '@/features/ai-tools/components/ToolsDashboard'

export const metadata: Metadata = {
    title: 'Strumenti AI',
    description: 'Strumenti AI per il tuo uncinetto: chat con assistente, analisi pattern da foto, generazione immagini amigurumi, lettore simboli e molto altro.',
    openGraph: {
        title: 'Strumenti AI — Lurumi',
        description: 'Chat AI, analisi pattern, generatore immagini e altri strumenti intelligenti per il tuo uncinetto e amigurumi.',
    },
}

export default function ToolsPage() {
    return (
        <ToolsDashboard />
    )
}
