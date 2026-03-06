import { ChatInterface } from '@/features/ai-tools/components/ChatInterface'

export default function SymbolReaderPage() {
    const suggestions = [
        "Cosa significa questo simbolo nel mio schema all'uncinetto?",
        "Puoi spiegarmi l'abbreviazione 'mb'?",
        "Qual è il significato di questo simbolo nella maglia?",
        "Come si lavora questo punto in base allo schema?"
    ]

    return <ChatInterface title="Lettore di Simboli" suggestions={suggestions} />
}
