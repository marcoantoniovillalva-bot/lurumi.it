import { ChatInterface } from '@/features/ai-tools/components/ChatInterface'

export default function TroubleshooterPage() {
    const suggestions = [
        "Come posso sistemare questo punto attorcigliato?",
        "Ho fatto un errore nel mio schema. Puoi aiutarmi a correggerlo?",
        "Questo punto sembra irregolare — perché?"
    ]

    return (
        <ChatInterface
            title="Come risolvere...?"
            placeholder="Descrivi il problema"
            suggestions={suggestions}
        />
    )
}
