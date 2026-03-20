import withBundleAnalyzer from '@next/bundle-analyzer';
import { withSentryConfig } from '@sentry/nextjs';
import type { NextConfig } from 'next';

const withAnalyzer = withBundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

const nextConfig: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,

  // =============================================================================
  // EXPERIMENTAL OPTIMIZATIONS
  // =============================================================================
  experimental: {
    // Package import optimization - reduces initial bundle size
    optimizePackageImports: [
      'lucide-react',
      'react-icons',
      'date-fns',
      '@radix-ui/react-dialog',
      '@radix-ui/react-popover',
      '@radix-ui/react-select',
      '@radix-ui/react-tabs',
      '@radix-ui/react-tooltip',
      '@radix-ui/react-slider',
      '@radix-ui/react-separator',
      '@radix-ui/react-label',
      'framer-motion',
      'echarts',
      'echarts-for-react',
      '@xyflow/react',
      'react-markdown',
      '@tanstack/react-table',
    ],

    // Enable 103 Early Hints for faster resource loading

    // Optimize CSS (removes unused CSS in production)
    optimizeCss: true,

    // Server Actions optimization
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },

  // =============================================================================
  // IMAGE OPTIMIZATION
  // =============================================================================
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 days
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    // Remote patterns for external images (if needed)
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.clerk.com',
      },
      {
        protocol: 'https',
        hostname: 'img.clerk.com',
      },
    ],
  },

  // =============================================================================
  // BUNDLING OPTIMIZATIONS
  // =============================================================================

  // Modularize imports for common libraries
  modularizeImports: {
    'lucide-react': {
      transform: 'lucide-react/dist/esm/icons/{{kebabCase member}}',
    },
    'date-fns': {
      transform: 'date-fns/{{member}}',
    },
  },

  // =============================================================================
  // HEADERS - PERFORMANCE & SECURITY
  // =============================================================================
  async headers() {
    return [
      {
        // Global security and performance headers
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload',
          },
          // Additional performance headers
          {
            key: 'X-Content-Security-Policy',
            value:
              "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://img.clerk.com https://clerk.com; connect-src 'self' https://*.clerk.com https://clerk.com; font-src 'self' data:;",
          },
        ],
      },
      {
        // Static assets: 1 year immutable cache
        source: '/(.*\\.(?:js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot|webp|avif))',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
          {
            key: 'Vary',
            value: 'Accept-Encoding',
          },
        ],
      },
      {
        // Service worker: no cache
        source: '/sw.js',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, must-revalidate',
          },
          {
            key: 'Service-Worker-Allowed',
            value: '/',
          },
        ],
      },
      {
        // API routes: stale-while-revalidate for better UX
        source: '/api/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=60, stale-while-revalidate=300',
          },
        ],
      },
      {
        // Font files: long cache with revalidation
        source: '/(.*\\.(?:woff|woff2|ttf|otf))',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
          {
            key: 'Vary',
            value: 'Accept-Encoding',
          },
        ],
      },
      {
        // OpenGraph images: 1 hour cache
        source: '/opengraph-image',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=3600, stale-while-revalidate=86400',
          },
        ],
      },
    ];
  },

  // =============================================================================
  // REDIRECTS
  // =============================================================================
  async redirects() {
    return [
      // Redirect HTTP to HTTPS handled by nginx
      // These are fallback redirects for standalone mode
      {
        source: '/:path*',
        has: [
          {
            type: 'header',
            key: 'x-forwarded-proto',
            value: 'http',
          },
        ],
        permanent: true,
        destination: 'https://:path*',
      },
    ];
  },

  // =============================================================================
  // WEBPACK CUSTOMIZATION (Advanced optimizations)
  // =============================================================================
  webpack: (config, { isServer, dev }) => {
    // Production optimizations only
    if (!dev && !isServer) {
      // Split chunks more aggressively for better caching
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            // Vendor chunk for node_modules
            vendor: {
              test: /[\\\\/]node_modules[\\\\/]/,
              name: 'vendors',
              chunks: 'all',
              priority: 10,
            },
            // Common chunk for shared code
            common: {
              minChunks: 2,
              chunks: 'all',
              enforce: true,
              priority: 5,
            },
            // Clerk chunk (large auth library)
            clerk: {
              test: /[\\\\/]node_modules[\\\\/]@clerk[\\\\/]/,
              name: 'clerk',
              chunks: 'all',
              priority: 15,
            },
            // Radix UI chunk (component library)
            radix: {
              test: /[\\\\/]node_modules[\\\\/]@radix-ui[\\\\/]/,
              name: 'radix',
              chunks: 'all',
              priority: 12,
            },
          },
        },
      };

      // Enable tree shaking
      config.optimization.usedExports = true;
      config.optimization.sideEffects = false;
    }

    return config;
  },

  // =============================================================================
  // TYPESCRIPT CONFIGURATION
  // =============================================================================
  typescript: {
    // All TS errors resolved - fail build on regressions
    ignoreBuildErrors: false,
  },

  eslint: {
    // Using Biome instead of ESLint
    ignoreDuringBuilds: true,
  },

  // =============================================================================
  // TRAILING SLASH & CLEAN URLS
  // =============================================================================
  trailingSlash: false,

  // Note: API rewrites are handled by nginx upstream proxy.
  // Next.js rewrites are intentionally removed to avoid double-proxying.
  // nginx routes: /api/crawler/ -> crawler-api:11235, /api/memory/ -> memory-api:8000
};

export default withSentryConfig(withAnalyzer(nextConfig), {
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  // Disable source map upload and generation when no auth token is present
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
    deleteSourcemapsAfterUpload: true,
  },
});
