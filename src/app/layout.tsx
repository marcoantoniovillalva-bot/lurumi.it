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
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3010'),
  title: {
    default: "Lurumi — AI per uncinetto, amigurumi e maglia",
    template: "%s — Lurumi",
  },
  description: "Lurumi è la tua compagna AI per l'uncinetto, amigurumi e maglia. Gestisci progetti, conta i giri, usa strumenti AI e segui corsi dal vivo.",
  keywords: ["uncinetto", "amigurumi", "maglia", "AI", "crochet", "pattern", "giri", "contatore", "corsi uncinetto"],
  authors: [{ name: "Lurumi", url: "https://lurumi.it" }],
  creator: "Lurumi",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icon.png", type: "image/png" },
    ],
    apple: "/apple-icon.png",
    shortcut: "/icon.png",
  },
  openGraph: {
    type: "website",
    locale: "it_IT",
    siteName: "Lurumi",
    title: "Lurumi — AI per uncinetto, amigurumi e maglia",
    description: "Gestisci i tuoi progetti di uncinetto con l'aiuto dell'AI. Conta i giri, segui pattern, crea amigurumi.",
    images: [{ url: "/images/logo/isologo-horizontal.png", width: 960, height: 320, alt: "Lurumi logo" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Lurumi — AI per uncinetto, amigurumi e maglia",
    description: "Gestisci i tuoi progetti di uncinetto con l'aiuto dell'AI.",
    images: ["/images/logo/isologo-horizontal.png"],
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

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "Lurumi",
    "applicationCategory": "LifestyleApplication",
    "operatingSystem": "Web, iOS, Android",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "EUR",
    },
    "description": "App AI per uncinetto, amigurumi e maglia. Gestisci progetti, conta i giri, segui pattern e corsi dal vivo.",
    "url": "https://lurumi.it",
    "inLanguage": "it",
  }

  return (
    <html lang="it">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
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
