import type { Metadata } from "next";
import { Inter, DM_Sans } from "next/font/google";
import "./globals.css";
import { LayoutShell } from "@/components/LayoutShell";

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
  title: "Lurumi - AI Powered Crafting",
  description: "La tua compagna AI per l'uncinetto, amigurumi e maglia.",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icon.png", type: "image/png" },
    ],
    apple: "/apple-icon.png",
    shortcut: "/icon.png",
  },
  openGraph: {
    title: "Lurumi",
    description: "La tua compagna AI per l'uncinetto, amigurumi e maglia.",
    images: [{ url: "/images/logo/isologo-horizontal.png", width: 960, height: 320 }],
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it">
      <body className={`${inter.variable} ${dmSans.variable} antialiased`}>
        <LayoutShell>
          {children}
        </LayoutShell>
      </body>
    </html>
  );
}
