import type { Metadata, Viewport } from 'next';
import { DM_Sans, JetBrains_Mono, Playfair_Display } from 'next/font/google';
import { ThemeProvider } from '@/src/components/ThemeProvider';
import { Providers } from '@/src/providers/Providers';
import './globals.css';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3002';

// =============================================================================
// FONT OPTIMIZATION
// Using next/font for automatic optimization:
// - Fonts are self-hosted at build time (no Google Fonts CDN requests)
// - CSS size-adjust for reduced layout shift
// - font-display: swap for all fonts
// =============================================================================

const dmSans = DM_Sans({
  variable: '--font-dm-sans',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  preload: true,
  adjustFontFallback: true,
});

const playfairDisplay = Playfair_Display({
  variable: '--font-playfair',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800', '900'],
  style: ['normal', 'italic'],
  display: 'swap',
  preload: true,
  adjustFontFallback: true,
});

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-jetbrains',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  preload: true,
  adjustFontFallback: true,
});

// =============================================================================
// VIEWPORT CONFIGURATION
// =============================================================================

export const viewport: Viewport = {
  themeColor: '#F2A93B',
  colorScheme: 'dark light',
  width: 'device-width',
  initialScale: 1,
  // Prevent zoom on input focus (mobile optimization)
  maximumScale: 5,
};

// =============================================================================
// METADATA
// =============================================================================

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),

  title: {
    default: 'ENGRAM — Multi-Layer AI Memory System',
    template: '%s | ENGRAM',
  },
  description:
    'ENGRAM is a persistent AI memory system with a 5-tier cognitive architecture. Store, search, and retrieve memories across projects with semantic vector search powered by Weaviate.',
  keywords: [
    'AI memory',
    'vector database',
    'semantic search',
    'Weaviate',
    'multi-layer memory',
    'AI agent memory',
    'persistent memory',
    'knowledge graph',
    'RAG',
    'embeddings',
  ],
  authors: [{ name: 'ENGRAM' }],
  creator: 'ENGRAM',
  publisher: 'ENGRAM',

  alternates: {
    canonical: '/',
  },

  openGraph: {
    type: 'website',
    url: APP_URL,
    siteName: 'ENGRAM',
    title: 'ENGRAM — Multi-Layer AI Memory System',
    description:
      'Persistent intelligence layer with a 5-tier memory architecture. Semantic search, knowledge graphs, and cognitive memory for AI agents.',
    locale: 'en_US',
    images: [
      {
        url: '/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'ENGRAM — Multi-Layer AI Memory System',
      },
    ],
  },

  twitter: {
    card: 'summary_large_image',
    title: 'ENGRAM — Multi-Layer AI Memory System',
    description:
      'Persistent intelligence layer with a 5-tier memory architecture. Semantic search, knowledge graphs, and cognitive memory for AI agents.',
    images: ['/opengraph-image'],
  },

  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },

  icons: {
    icon: [{ url: '/icon', type: 'image/png' }],
    apple: [{ url: '/apple-icon', type: 'image/png' }],
    shortcut: '/icon',
  },

  manifest: '/manifest.json',

  applicationName: 'ENGRAM',
  category: 'technology',
};

// =============================================================================
// CRITICAL CSS (inlined for fastest render)
// These styles prevent FOUC (Flash of Unstyled Content) during hydration
// =============================================================================
const CRITICAL_CSS = `
  /* Critical render path styles */
  html { background-color: #03020a; color: #f0eef8; }
  body { margin: 0; min-height: 100vh; background-color: #03020a; }
  /* Prevent layout shift from font loading */
  .font-loading { font-family: system-ui, -apple-system, sans-serif; }
`;

// =============================================================================
// ROOT LAYOUT
// =============================================================================

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'ENGRAM',
    description:
      'Persistent AI memory system with a 5-tier cognitive architecture. Store, search, and retrieve memories across projects with semantic vector search.',
    url: APP_URL,
    applicationCategory: 'DeveloperApplication',
    operatingSystem: 'Web',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
  };

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${dmSans.variable} ${playfairDisplay.variable} ${jetbrainsMono.variable}`}
    >
      <head>
        {/* =================================================================
            RESOURCE HINTS & PRECONNECT
            These establish early connections to critical third-party domains
            ================================================================= */}

        {/* Preconnect to backend APIs (if cross-origin) */}
        <link rel="preconnect" href={APP_URL} />

        {/* Preconnect to Clerk authentication domain */}
        <link rel="preconnect" href="https://clerk.velocitydigi.com" />
        <link rel="preconnect" href="https://accounts.velocitydigi.com" />
        <link rel="preconnect" href="https://clerk.com" />

        {/* DNS prefetch for less critical domains */}
        <link rel="dns-prefetch" href="https://api.clerk.com" />
        <link rel="dns-prefetch" href="https://img.clerk.com" />

        {/* =================================================================
            CRITICAL RESOURCE PRELOADING
            Preload critical assets that are discovered late in parsing
            ================================================================= */}

        {/* Preload critical CSS variable definitions */}
        <style
          // biome-ignore lint/security/noDangerouslySetInnerHtml: Critical CSS must be inlined
          dangerouslySetInnerHTML={{ __html: CRITICAL_CSS }}
        />

        {/* Structured data for SEO */}
        <script
          type="application/ld+json"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD structured data requires dangerouslySetInnerHTML
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />

        {/* Service Worker Registration - Deferred to after load */}
        <script
          // biome-ignore lint/security/noDangerouslySetInnerHtml: Service worker registration
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                // Defer SW registration until after initial load
                if (document.readyState === 'complete') {
                  registerSW();
                } else {
                  window.addEventListener('load', registerSW);
                }

                function registerSW() {
                  // Delay SW registration to prioritize critical resources
                  setTimeout(function() {
                    navigator.serviceWorker.register('/sw.js').catch(function() {
                      // SW registration failed silently
                    });
                  }, 3000); // 3 second delay
                }
              }
            `,
          }}
        />

        {/* Performance Observer for Core Web Vitals tracking */}
        <script
          // biome-ignore lint/security/noDangerouslySetInnerHtml: Performance monitoring
          dangerouslySetInnerHTML={{
            __html: `
              // Mark navigation start
              if (window.performance) {
                window.performance.mark('navigation-start');
              }

              // Report Core Web Vitals in development only
              if (location.hostname === 'localhost') {
                try {
                  new PerformanceObserver((list) => {
                    for (const entry of list.getEntries()) {
                      console.debug('[Web Vitals]', entry.name, entry.value);
                    }
                  }).observe({ type: 'web-vitals' });
                } catch(e) { /* web-vitals not supported */ }
              }
            `,
          }}
        />
      </head>
      <body
        className="antialiased bg-void text-text-primary"
        // Prevent layout shift during font loading
        style={{
          fontFamily: 'var(--font-dm-sans), var(--font-playfair), system-ui, sans-serif',
        }}
      >
        <Providers>
          <ThemeProvider>{children}</ThemeProvider>
        </Providers>
      </body>
    </html>
  );
}
