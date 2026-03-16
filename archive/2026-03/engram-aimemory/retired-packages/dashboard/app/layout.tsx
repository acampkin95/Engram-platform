import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Instrument_Serif, Syne } from "next/font/google";
import { OfflineBanner } from "@/components/offline-banner";
import { SWRProvider } from "@/components/SWRProvider";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ToastContainer } from "@/components/ui/Toast";
import "./globals.css";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001";

const syne = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
});

// ---------------------------------------------------------------------------
// Viewport (must be separate from metadata in Next.js 15)
// ---------------------------------------------------------------------------

export const viewport: Viewport = {
  themeColor: "#F2A93B",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

// ---------------------------------------------------------------------------
// Root metadata
// ---------------------------------------------------------------------------

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),

  title: {
    default: "ENGRAM — Multi-Layer AI Memory System",
    template: "%s | ENGRAM",
  },
  description:
    "ENGRAM is a persistent AI memory system with a 5-tier cognitive architecture. Store, search, and retrieve memories across projects with semantic vector search powered by Weaviate.",
  keywords: [
    "AI memory",
    "vector database",
    "semantic search",
    "Weaviate",
    "multi-layer memory",
    "AI agent memory",
    "persistent memory",
    "knowledge graph",
    "RAG",
    "embeddings",
  ],
  authors: [{ name: "ENGRAM" }],
  creator: "ENGRAM",
  publisher: "ENGRAM",

  // Canonical
  alternates: {
    canonical: "/",
  },

  // Open Graph
  openGraph: {
    type: "website",
    url: APP_URL,
    siteName: "ENGRAM",
    title: "ENGRAM — Multi-Layer AI Memory System",
    description:
      "Persistent intelligence layer with a 5-tier memory architecture. Semantic search, knowledge graphs, and cognitive memory for AI agents.",
    locale: "en_US",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "ENGRAM — Multi-Layer AI Memory System",
      },
    ],
  },

  // Twitter / X
  twitter: {
    card: "summary_large_image",
    title: "ENGRAM — Multi-Layer AI Memory System",
    description:
      "Persistent intelligence layer with a 5-tier memory architecture. Semantic search, knowledge graphs, and cognitive memory for AI agents.",
    images: ["/opengraph-image"],
  },

  // Robots
  robots: {
    index: false, // Dashboard is private — do not index
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },

  // Icons
  icons: {
    icon: [{ url: "/icon", type: "image/png" }],
    apple: [{ url: "/apple-icon", type: "image/png" }],
    shortcut: "/icon",
  },

  // Manifest
  manifest: "/manifest.webmanifest",

  // App metadata
  applicationName: "ENGRAM",
  category: "technology",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "ENGRAM",
    description:
      "Persistent AI memory system with a 5-tier cognitive architecture. Store, search, and retrieve memories across projects with semantic vector search.",
    url: APP_URL,
    applicationCategory: "DeveloperApplication",
    operatingSystem: "Web",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
  };

  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD structured data requires dangerouslySetInnerHTML
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body
        className={`${syne.variable} ${instrumentSerif.variable} ${ibmPlexMono.variable} antialiased`}
        style={{ background: "#03020a", color: "#f0eef8" }}
      >
        <SWRProvider>
          <ThemeProvider>
            <OfflineBanner />
            {children}
            <ToastContainer />
          </ThemeProvider>
        </SWRProvider>
      </body>
    </html>
  );
}
