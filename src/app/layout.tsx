import type { Metadata } from "next";
import { Inter, DM_Sans } from "next/font/google";
import "./globals.css";
import { LayoutShell } from "@/components/LayoutShell";
import { cookies } from "next/headers";
import { CharacterThemeProvider } from "@/components/CharacterThemeProvider";

const VALID_CHARS = ['luly', 'babol', 'clara', 'tommy', 'derek', 'sara', 'susy']

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://lurumi.it'),
  title: {
    default: "Lurumi — AI per uncinetto, amigurumi e maglia",
    template: "%s — Lurumi",
  },
  description: "Lurumi è la tua compagna AI per l'uncinetto, amigurumi e maglia. Gestisci progetti, conta i giri, usa strumenti AI e segui corsi dal vivo.",
  keywords: ["uncinetto", "amigurumi", "maglia", "AI", "crochet", "pattern", "giri", "contatore", "corsi uncinetto", "hobby creativo", "filet", "lavoro a maglia", "ricamo", "handmade", "fai da te", "tutorial uncinetto", "schema amigurumi"],
  authors: [{ name: "Lurumi", url: "https://lurumi.it" }],
  creator: "Lurumi",
  publisher: "Lurumi",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Lurumi",
  },
  icons: {
    icon: [
      { url: "/icon.png", type: "image/png" },
    ],
    apple: "/apple-icon.png",
    shortcut: "/icon.png",
  },
  openGraph: {
    type: "website",
    url: "https://lurumi.it",
    locale: "it_IT",
    siteName: "Lurumi",
    title: "Lurumi — AI per uncinetto, amigurumi e maglia",
    description: "Lurumi è la tua compagna AI per l'uncinetto, amigurumi e maglia. Gestisci progetti, conta i giri, usa strumenti AI e segui corsi dal vivo.",
    images: [{ url: "https://lurumi.it/images/logo/isologo-horizontal.png", width: 1920, height: 1080, alt: "Lurumi — AI per uncinetto e amigurumi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Lurumi — AI per uncinetto, amigurumi e maglia",
    description: "Lurumi è la tua compagna AI per l'uncinetto, amigurumi e maglia.",
    images: ["https://lurumi.it/images/logo/isologo-horizontal.png"],
  },
  alternates: {
    canonical: "https://lurumi.it",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export const viewport = {
  themeColor: "#B9E5F9",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};


export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies()
  const cookieChar = cookieStore.get('lurumi_char')?.value
  const initialChar = VALID_CHARS.includes(cookieChar ?? '') ? cookieChar! : 'luly'

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      "name": "Lurumi",
      "applicationCategory": "LifestyleApplication",
      "operatingSystem": "Web, iOS, Android",
      "offers": [
        { "@type": "Offer", "price": "0", "priceCurrency": "EUR", "name": "Piano Gratuito" },
        { "@type": "Offer", "price": "4.99", "priceCurrency": "EUR", "billingPeriod": "P1M", "name": "Piano Premium" },
      ],
      "description": "Lurumi è la compagna AI per uncinetto, amigurumi e maglia. Gestisci i tuoi progetti creativi, conta i giri con contatori avanzati, usa strumenti AI per creare immagini e ottenere aiuto con i pattern, segui tutorial YouTube con trascrizione automatica in italiano, prenota corsi dal vivo.",
      "url": "https://lurumi.it",
      "inLanguage": "it",
      "image": "https://lurumi.it/images/logo/isologo-horizontal.png",
      "screenshot": "https://lurumi.it/images/logo/isologo-horizontal.png",
      "featureList": [
        "Assistente AI per uncinetto e amigurumi",
        "Generazione immagini AI con DALL-E 3",
        "Analisi foto lavori a maglia con AI",
        "Contatore di giri avanzato per progetti",
        "Gestore progetti di uncinetto",
        "Trascrizione e traduzione tutorial YouTube",
        "Rimozione sfondo AI per foto prodotti",
        "Prenotazione corsi e workshop dal vivo",
        "Visualizzatore PDF per schemi di uncinetto"
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      "name": "Lurumi",
      "url": "https://lurumi.it",
      "logo": "https://lurumi.it/images/logo/isotipo.png",
      "sameAs": [],
      "contactPoint": {
        "@type": "ContactPoint",
        "contactType": "customer support",
        "email": "info@lurumi.it",
        "availableLanguage": "Italian",
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "name": "Lurumi",
      "url": "https://lurumi.it",
      "description": "App AI per uncinetto, amigurumi e maglia. Gestisci progetti, conta i giri, segui pattern e corsi dal vivo.",
      "inLanguage": "it",
      "potentialAction": {
        "@type": "SearchAction",
        "target": "https://lurumi.it/tutorials?q={search_term_string}",
        "query-input": "required name=search_term_string",
      },
    },
  ]

  return (
    <html lang="it">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd[0]) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd[1]) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd[2]) }}
        />
      </head>
      <body className={`${inter.variable} ${dmSans.variable} antialiased`}>
        <CharacterThemeProvider initialChar={initialChar}>
          <LayoutShell>
            {children}
          </LayoutShell>
        </CharacterThemeProvider>
      </body>
    </html>
  );
}
