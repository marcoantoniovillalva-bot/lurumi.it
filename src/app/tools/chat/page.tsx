"use client";

import { ChatInterface } from "@/features/ai-tools/components/ChatInterface";

export default function ChatPage() {
    return (
        <ChatInterface
            title="Chat AI"
            placeholder="Chiedi a Lurumi..."
            suggestions={[
                "Come si fa un anello magico?",
                "Consigliami un filato per una coperta estiva",
                "Traduci questo schema dall'inglese",
                "Quanto filo serve per un amigurumi di 20cm?"
            ]}
        />
    );
}
