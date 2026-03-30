import { useEffect, useState } from 'react';

type Metric = {
  name: 'LCP' | 'FID' | 'CLS' | 'FCP' | 'TTFB';
  value: number;
};

export function minifyCSS(css: string): string {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*([{};,])\s*/g, '$1')
    .replace(/\{\s+/g, '{')
    .replace(/;}/g, '}')
    .trim();
}

export function getFontLoadingClasses(loaded: boolean): string {
  return loaded ? 'fonts-loaded' : 'fonts-loading';
}

export function useFontLoading(_fontFamily: string): { loaded: boolean; error: boolean } {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fonts = (document as Document & { fonts?: { ready?: Promise<unknown> } }).fonts;
    const readyPromise = fonts?.ready;
    if (readyPromise === undefined) {
      setLoaded(true);
      return;
    }

    let active = true;
    readyPromise
      .then(() => {
        if (active) {
          setLoaded(true);
          setError(false);
        }
      })
      .catch(() => {
        if (active) {
          setLoaded(false);
          setError(true);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  return { loaded, error };
}

export function preloadCriticalFonts(): void {
  const fonts = [
    { family: 'Syne', source: 'url(/fonts/syne.woff2)' },
    { family: 'IBM Plex Mono', source: 'url(/fonts/ibm-plex-mono.woff2)' },
  ];

  for (const font of fonts) {
    void new FontFace(font.family, font.source)
      .load()
      .then((loadedFont) => {
        (document as Document & { fonts?: { add?: (fontFace: FontFace) => void } }).fonts?.add?.(
          loadedFont as FontFace,
        );
      })
      .catch(() => undefined);
  }
}

export function injectResourceHints(urls: string[]): void {
  for (const url of urls) {
    const existing = document.querySelectorAll(`link[href="${url}"]`);
    if (existing.length > 0) {
      continue;
    }

    const preconnect = document.createElement('link');
    preconnect.rel = 'preconnect';
    preconnect.href = url;
    document.head.appendChild(preconnect);

    const dnsPrefetch = document.createElement('link');
    dnsPrefetch.rel = 'dns-prefetch';
    dnsPrefetch.href = url;
    document.head.appendChild(dnsPrefetch);
  }
}

export function trackWebVitals(onMetric: (metric: Metric) => void): void {
  const Observer = globalThis.PerformanceObserver;
  if (typeof Observer === 'undefined') {
    return;
  }

  const emit = (name: Metric['name'], value: number) => onMetric({ name, value });

  const lcpObserver = new Observer(((list: PerformanceObserverEntryList) => {
    const entry = list.getEntries().at(-1);
    if (entry) emit('LCP', entry.startTime);
  }) as PerformanceObserverCallback);
  lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });

  const fidObserver = new Observer(((list: PerformanceObserverEntryList) => {
    const entry = list.getEntries()[0] as PerformanceEventTiming | undefined;
    if (entry) emit('FID', entry.processingStart - entry.startTime);
  }) as PerformanceObserverCallback);
  fidObserver.observe({ entryTypes: ['first-input'] });

  const clsObserver = new Observer(((list: PerformanceObserverEntryList) => {
    let cls = 0;
    for (const entry of list.getEntries()) {
      const le = entry as unknown as { hadRecentInput: boolean; value: number };
      if (!le.hadRecentInput) {
        cls += le.value;
      }
    }
    emit('CLS', cls);
  }) as PerformanceObserverCallback);
  clsObserver.observe({ entryTypes: ['layout-shift'] });

  const paintObserver = new Observer(((list: PerformanceObserverEntryList) => {
    for (const entry of list.getEntries()) {
      if (entry.name === 'first-contentful-paint') {
        emit('FCP', entry.startTime);
      }
    }
  }) as PerformanceObserverCallback);
  paintObserver.observe({ entryTypes: ['paint'] });

  const navigationEntries = performance.getEntriesByType('navigation') as unknown as Array<{
    responseStart: number;
  }>;
  const navigation = navigationEntries[0];
  if (navigation) {
    emit('TTFB', navigation.responseStart);
  }
}

export function observeLongTasks(onLongTask: (duration: number) => void): () => void {
  const Observer = globalThis.PerformanceObserver;
  if (typeof Observer === 'undefined') {
    return () => undefined;
  }

  const observer = new Observer((list: { getEntries: () => Array<{ duration: number }> }) => {
    for (const entry of list.getEntries()) {
      if (entry.duration >= 50) {
        onLongTask(entry.duration);
      }
    }
  });

  observer.observe({ entryTypes: ['longtask'] });
  return () => observer.disconnect();
}

export function measureRenderTime(label: string): () => void {
  const startedAt = performance.now();
  return () => {
    if (process.env.NODE_ENV !== 'development') {
      return;
    }
    const duration = performance.now() - startedAt;
    if (duration > 16) {
      console.warn(`[Performance] ${label} render took ${duration.toFixed(2)}ms`);
    }
  };
}
