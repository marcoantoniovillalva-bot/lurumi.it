import { Suspense } from "react";
import type { Metadata } from "next";
import { Pricing } from "@/features/monetization/components/Pricing";

export const metadata: Metadata = {
    title: "Piani e Prezzi",
    description: "Scopri i piani Lurumi: gratuito per iniziare, Premium per sbloccare AI illimitata, corsi e strumenti avanzati per l'uncinetto.",
    openGraph: {
        title: "Piani e Prezzi — Lurumi",
        description: "Piano gratuito o Premium: trova il piano giusto per i tuoi progetti di uncinetto e amigurumi.",
    },
};

const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
        {
            "@type": "Question",
            "name": "Lurumi è gratuito?",
            "acceptedAnswer": {
                "@type": "Answer",
                "text": "Sì, Lurumi ha un piano gratuito con 50 crediti AI al mese. Il piano Premium offre 300 crediti, accesso ai corsi dal vivo e strumenti avanzati.",
            },
        },
        {
            "@type": "Question",
            "name": "Posso disdire l'abbonamento Premium quando voglio?",
            "acceptedAnswer": {
                "@type": "Answer",
                "text": "Sì, puoi disdire il tuo abbonamento Premium in qualsiasi momento direttamente dal tuo profilo, senza penali.",
            },
        },
        {
            "@type": "Question",
            "name": "Cosa sono i crediti AI?",
            "acceptedAnswer": {
                "@type": "Answer",
                "text": "I crediti AI si consumano usando le funzioni intelligenti di Lurumi: chat con AI (2 cr), analisi foto pattern (5 cr), generazione immagini veloci (8 cr) e immagini HD (20 cr). Si resettano ogni mese.",
            },
        },
    ],
};

export default function PricingPage() {
    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
            />
            <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="w-8 h-8 rounded-full border-2 border-[#7B5CF6] border-t-transparent animate-spin" /></div>}>
                <Pricing />
            </Suspense>
        </>
    );
}
