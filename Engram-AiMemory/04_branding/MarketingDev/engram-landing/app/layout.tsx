import type { Metadata } from 'next';
import { Syne, Instrument_Serif, IBM_Plex_Mono } from 'next/font/google';
import { Footer } from './components/Footer';
import { Navigation } from './components/Navigation';
import './globals.css';
import './components.css';

const syne = Syne({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
  variable: "--font-syne",
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
  variable: "--font-instrument-serif",
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--font-ibm-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL('https://memory.velocitydigi.com'),
  title: 'ENGRAM — Unified AI Intelligence Platform',
  description:
    'Engram is a self-hosted AI intelligence platform for memory operations, OSINT pipelines, and MCP-powered agent workflows.',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'ENGRAM — Unified AI Intelligence Platform',
    description:
      'Self-hosted memory, crawler, MCP, and dashboard surfaces designed to work as one operational loop.',
    url: 'https://memory.velocitydigi.com',
    siteName: 'Engram Platform',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ENGRAM — Unified AI Intelligence Platform',
    description:
      'Memory operations, OSINT workflows, and MCP tooling for teams that need durable context.',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${syne.variable} ${instrumentSerif.variable} ${ibmPlexMono.variable}`}>
      <body className="min-h-screen bg-[var(--void)] text-[var(--text-primary)]">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:bg-[var(--engram-amber)] focus:text-[var(--void)] focus:px-4 focus:py-2 focus:rounded-lg focus:font-[var(--font-mono)] focus:text-sm"
        >
          Skip to content
        </a>
        <Navigation />
        <div id="main-content">
          {children}
        </div>
        <Footer />
      </body>
    </html>
  );
}
