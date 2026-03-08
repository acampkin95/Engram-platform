import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getFontLoadingClasses,
  injectResourceHints,
  measureRenderTime,
  minifyCSS,
  observeLongTasks,
  preloadCriticalFonts,
  trackWebVitals,
  useFontLoading,
} from '@/src/lib/performance';

describe('performance utilities', () => {
  const originalEnv = process.env;
  const originalFontsDescriptor = Object.getOwnPropertyDescriptor(document, 'fonts');

  beforeEach(() => {
    process.env = { ...originalEnv };
    document.head.innerHTML = '';
  });

  afterEach(() => {
    process.env = originalEnv;
    if (originalFontsDescriptor) {
      Object.defineProperty(document, 'fonts', originalFontsDescriptor);
    } else {
      delete (document as { fonts?: unknown }).fonts;
    }
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('minifies CSS and strips comments', () => {
    const css = '/* comment */ .foo { color: red;  margin: 0; }';
    expect(minifyCSS(css)).toBe('.foo{color: red;margin: 0}');
  });

  it('returns font loading class names', () => {
    expect(getFontLoadingClasses(true)).toBe('fonts-loaded');
    expect(getFontLoadingClasses(false)).toBe('fonts-loading');
  });

  it('tracks font loading success in useFontLoading', async () => {
    Object.defineProperty(document, 'fonts', {
      configurable: true,
      value: {
        ready: Promise.resolve(),
      },
    });

    const { result } = renderHook(() => useFontLoading('Syne'));

    await waitFor(() => {
      expect(result.current.loaded).toBe(true);
      expect(result.current.error).toBe(false);
    });
  });

  it('tracks font loading failure in useFontLoading', async () => {
    const rejectedReady = Promise.reject(new Error('font failure'));
    rejectedReady.catch(() => {});

    Object.defineProperty(document, 'fonts', {
      configurable: true,
      value: {
        ready: rejectedReady,
      },
    });

    const { result } = renderHook(() => useFontLoading('Syne'));

    await waitFor(() => {
      expect(result.current.loaded).toBe(false);
      expect(result.current.error).toBe(true);
    });
  });

  it('preloads critical fonts and adds them to document.fonts', async () => {
    const addSpy = vi.fn();
    Object.defineProperty(document, 'fonts', {
      configurable: true,
      value: {
        add: addSpy,
      },
    });

    const loadSpy = vi.fn().mockResolvedValue({ family: 'Syne' });
    vi.stubGlobal(
      'FontFace',
      class FontFace {
        load = loadSpy;
      },
    );

    preloadCriticalFonts();
    await Promise.resolve();
    await Promise.resolve();

    expect(loadSpy).toHaveBeenCalled();
    expect(addSpy).toHaveBeenCalled();
  });

  it('injects resource hints once per domain', () => {
    injectResourceHints(['https://cdn.example.com/']);

    const linksAfterFirstCall = document.querySelectorAll('link[href="https://cdn.example.com/"]');
    expect(linksAfterFirstCall).toHaveLength(2);

    injectResourceHints(['https://cdn.example.com/']);

    const linksAfterSecondCall = document.querySelectorAll('link[href="https://cdn.example.com/"]');
    expect(linksAfterSecondCall).toHaveLength(2);
  });

  it('tracks web vitals through PerformanceObserver callbacks', () => {
    type ObserverRecord = {
      callback: (list: { getEntries: () => unknown[] }) => void;
      options?: { entryTypes?: string[] };
    };

    const observers: ObserverRecord[] = [];

    class MockPerformanceObserver {
      private callback: (list: { getEntries: () => unknown[] }) => void;

      constructor(callback: (list: { getEntries: () => unknown[] }) => void) {
        this.callback = callback;
        observers.push({ callback: this.callback });
      }

      observe = (options: { entryTypes: string[] }) => {
        const record = observers.find((entry) => entry.callback === this.callback);
        if (record) {
          record.options = options;
        }
      };
    }

    vi.stubGlobal('PerformanceObserver', MockPerformanceObserver);
    vi.spyOn(performance, 'getEntriesByType').mockReturnValue([
      {
        startTime: 0,
        responseStart: 1200,
      } as unknown as PerformanceEntry,
    ] as unknown as PerformanceEntryList);

    const metrics: Array<{ name: string; value: number }> = [];

    trackWebVitals((metric) => {
      metrics.push({ name: metric.name, value: metric.value });
    });

    const trigger = (entryType: string, entries: unknown[]) => {
      const observer = observers.find((item) => item.options?.entryTypes?.includes(entryType));
      observer?.callback({ getEntries: () => entries });
    };

    trigger('largest-contentful-paint', [{ startTime: 2200 }]);
    trigger('first-input', [{ entryType: 'first-input', processingStart: 250, startTime: 100 }]);
    trigger('layout-shift', [{ hadRecentInput: false, value: 0.2 }]);
    trigger('paint', [{ name: 'first-contentful-paint', startTime: 1000 }]);

    expect(metrics.map((metric) => metric.name)).toEqual(
      expect.arrayContaining(['LCP', 'FID', 'CLS', 'FCP', 'TTFB']),
    );
  });

  it('observes long tasks and exposes cleanup function', () => {
    let observerCallback:
      | ((list: { getEntries: () => Array<{ duration: number }> }) => void)
      | null = null;
    const disconnectSpy = vi.fn();

    class MockPerformanceObserver {
      constructor(callback: (list: { getEntries: () => Array<{ duration: number }> }) => void) {
        observerCallback = callback;
      }

      observe = vi.fn();
      disconnect = disconnectSpy;
    }

    vi.stubGlobal('PerformanceObserver', MockPerformanceObserver);

    const durations: number[] = [];
    const stop = observeLongTasks((duration) => durations.push(duration));

    if (!observerCallback) {
      throw new Error('Observer callback was not registered');
    }

    const invokeObserver = observerCallback as (list: {
      getEntries: () => Array<{ duration: number }>;
    }) => void;

    invokeObserver({
      getEntries: () => [{ duration: 65 }, { duration: 12 }],
    });

    expect(durations).toEqual([65]);

    stop();
    expect(disconnectSpy).toHaveBeenCalledOnce();
  });

  it('measures slow render times in development', () => {
    process.env = { ...process.env, NODE_ENV: 'development' };
    vi.spyOn(performance, 'now').mockReturnValueOnce(0).mockReturnValueOnce(24);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const endMeasurement = measureRenderTime('DashboardWidget');
    act(() => {
      endMeasurement();
    });

    expect(warnSpy).toHaveBeenCalledWith('[Performance] DashboardWidget render took 24.00ms');
  });
});
