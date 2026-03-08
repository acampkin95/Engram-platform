# Engram Platform — PageSpeed Optimization Guide

## 🚀 Implemented Optimizations

### 1. Font Optimization
- **Self-hosted fonts** via `next/font/google` (no external requests)
- **font-display: swap** for all fonts to prevent FOIT
- **Preload critical fonts** (Syne, IBM Plex Mono)
- **adjustFontFallback** to minimize CLS during font swap
- **Non-critical font deferred** (Instrument Serif)

### 2. Critical CSS
- **Inlined critical CSS** in layout.tsx to prevent FOUC
- **Base styles** for immediate render
- **Font loading states** to manage transition

### 3. Image Optimization
- **OptimizedImage component** with blur placeholders
- **Intersection Observer** for lazy loading
- **AVIF/WebP formats** with fallbacks
- **Responsive sizes** for different viewports
- **Priority loading** for above-fold images

### 4. Code Splitting & Bundling
- **Experimental optimizePackageImports** for 17 libraries
- **ModularizeImports** for lucide-react and date-fns
- **Aggressive chunk splitting** in webpack:
  - Vendor chunk (node_modules)
  - Clerk chunk (auth library)
  - Radix chunk (UI components)
- **Tree shaking** enabled for unused code elimination

### 5. Caching Strategy
- **Static assets**: 1 year immutable cache
- **Service worker**: No cache (always fresh)
- **API routes**: 60s cache with stale-while-revalidate=300s
- **Font files**: 1 year immutable cache

### 6. Resource Hints
- **Preconnect** to:
  - Backend API (APP_URL)
  - Clerk domains (auth)
- **DNS-prefetch** for:
  - api.clerk.com
  - img.clerk.com

### 7. Compression
- **Brotli** (level 4) - primary compression
- **Gzip** (level 5) - fallback compression
- **Vary: Accept-Encoding** header for CDN cache

### 8. Skeleton Loading States
- **Shimmer animation** for perceived performance
- **Aspect ratio preservation** to prevent CLS
- **Staggered animations** for lists
- **Multiple skeleton types** (Card, Table, Stats, Chart)

### 9. Performance Utilities
- **useFontLoading hook** - track font loading state
- **trackWebVitals** - Core Web Vitals monitoring
- **LazyLoad component** - intersection observer wrapper
- **measureRenderTime** - component performance tracking

### 10. Experimental Features
- **Early Hints (103)** - faster resource loading
- **optimizeCss** - removes unused CSS in production
- **SWC minify** - faster builds and smaller bundles

## 📊 Expected Performance Improvements

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| LCP | ~3.5s | ~2.0s | -43% |
| CLS | ~0.15 | ~0.02 | -87% |
| TBT | ~350ms | ~150ms | -57% |
| Bundle Size | ~450KB | ~320KB | -29% |

## 🛠️ Usage Examples

### Optimized Image
```tsx
import { OptimizedImage } from '@/src/components/OptimizedImage';

<OptimizedImage
  src="/hero-image.jpg"
  alt="Hero"
  priority // Above-fold image
  quality={90}
  sizes="100vw"
/>
```

### Skeleton Loading
```tsx
import { CardSkeleton, TableSkeleton } from '@/src/components/ui/Skeleton';

// While data loads
<CardSkeleton header lines={3} />
<TableSkeleton rows={5} columns={4} />
```

### Lazy Load Components
```tsx
import { LazyLoad } from '@/src/components/OptimizedImage';

<LazyLoad rootMargin="200px">
  <HeavyChartComponent />
</LazyLoad>
```

### Track Performance
```tsx
import { useEffect } from 'react';
import { trackWebVitals } from '@/src/lib/performance';

useEffect(() => {
  trackWebVitals((metric) => {
    console.log('[Web Vitals]', metric.name, metric.value, metric.rating);
    // Send to analytics: analytics.track(metric.name, metric)
  });
}, []);
```

## 🔧 Build Commands

```bash
# Analyze bundle size
npm run analyze

# Production build with optimizations
npm run build

# Serve and test locally
npm start
```

## 🧪 Testing Performance

1. **Lighthouse CI**: Run in Chrome DevTools
2. **Web Vitals Extension**: Install Chrome extension
3. **PageSpeed Insights**: https://pagespeed.web.dev/
4. **GTmetrix**: https://gtmetrix.com/

## 📈 Monitoring

Track these Core Web Vitals in production:

- **LCP** (Largest Contentful Paint): < 2.5s
- **FID** (First Input Delay): < 100ms
- **CLS** (Cumulative Layout Shift): < 0.1
- **FCP** (First Contentful Paint): < 1.8s
- **TTFB** (Time to First Byte): < 800ms
- **INP** (Interaction to Next Paint): < 200ms

## 🎯 Additional Recommendations

1. **Enable HTTP/3** on your CDN for faster connections
2. **Use a CDN** for static assets (Cloudflare, Fastly)
3. **Implement edge caching** for API responses
4. **Monitor real-user metrics** with RUM tools
5. **Set up performance budgets** in CI/CD

## 📝 Files Modified

- `app/layout.tsx` - Font loading, critical CSS, resource hints
- `next.config.ts` - Optimizations, caching headers, webpack config
- `app/globals.css` - Shimmer animation, performance utilities
- `src/components/OptimizedImage.tsx` - NEW: Lazy loading image
- `src/components/ui/Skeleton.tsx` - Enhanced: Loading skeletons
- `src/lib/performance.ts` - NEW: Performance utilities
- `app/critical.css` - NEW: Critical CSS styles
