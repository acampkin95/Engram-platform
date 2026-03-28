import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('performance utilities', () => {
  describe('minifyCSS', () => {
    let minifyCSS: typeof import('../performance')['minifyCSS'];

    beforeEach(async () => {
      vi.resetModules();
      const mod = await import('../performance');
      minifyCSS = mod.minifyCSS;
    });

    it('removes CSS comments', () => {
      expect(minifyCSS('/* comment */ body { color: red; }')).toBe('body{color: red}');
    });

    it('collapses whitespace', () => {
      expect(minifyCSS('body  {  color:  red;  }')).toBe('body{color: red}');
    });

    it('removes whitespace around delimiters', () => {
      expect(minifyCSS('a { color: red ; background: blue ; }')).toBe(
        'a{color: red;background: blue}',
      );
    });

    it('removes trailing semicolons before closing braces', () => {
      expect(minifyCSS('a { color: red; }')).toBe('a{color: red}');
    });

    it('handles empty input', () => {
      expect(minifyCSS('')).toBe('');
    });

    it('handles multiline CSS', () => {
      const input = `
        .container {
          display: flex;
          /* padding */
          gap: 1rem;
        }
      `;
      expect(minifyCSS(input)).toBe('.container{display: flex;gap: 1rem}');
    });
  });

  describe('getFontLoadingClasses', () => {
    let getFontLoadingClasses: typeof import('../performance')['getFontLoadingClasses'];

    beforeEach(async () => {
      vi.resetModules();
      const mod = await import('../performance');
      getFontLoadingClasses = mod.getFontLoadingClasses;
    });

    it('returns fonts-loaded when loaded is true', () => {
      expect(getFontLoadingClasses(true)).toBe('fonts-loaded');
    });

    it('returns fonts-loading when loaded is false', () => {
      expect(getFontLoadingClasses(false)).toBe('fonts-loading');
    });
  });

  describe('injectResourceHints', () => {
    let injectResourceHints: typeof import('../performance')['injectResourceHints'];

    beforeEach(async () => {
      vi.resetModules();
      const mod = await import('../performance');
      injectResourceHints = mod.injectResourceHints;
      // Clear any previously injected links
      document.head
        .querySelectorAll('link[rel="preconnect"], link[rel="dns-prefetch"]')
        .forEach((el) => {
          el.remove();
        });
    });

    it('adds preconnect and dns-prefetch links to document head', () => {
      injectResourceHints(['https://example.com']);
      const preconnect = document.head.querySelector(
        'link[rel="preconnect"][href="https://example.com"]',
      );
      const dnsPrefetch = document.head.querySelector(
        'link[rel="dns-prefetch"][href="https://example.com"]',
      );
      expect(preconnect).toBeTruthy();
      expect(dnsPrefetch).toBeTruthy();
    });

    it('does not duplicate links for the same URL', () => {
      injectResourceHints(['https://example.com']);
      injectResourceHints(['https://example.com']);
      const links = document.head.querySelectorAll('link[href="https://example.com"]');
      expect(links.length).toBe(2); // preconnect + dns-prefetch, not 4
    });

    it('handles multiple URLs', () => {
      injectResourceHints(['https://a.com', 'https://b.com']);
      expect(document.head.querySelector('link[href="https://a.com"]')).toBeTruthy();
      expect(document.head.querySelector('link[href="https://b.com"]')).toBeTruthy();
    });

    it('handles empty array', () => {
      const before = document.head.querySelectorAll('link').length;
      injectResourceHints([]);
      expect(document.head.querySelectorAll('link').length).toBe(before);
    });
  });

  describe('trackWebVitals', () => {
    let trackWebVitals: typeof import('../performance')['trackWebVitals'];

    beforeEach(async () => {
      vi.resetModules();
      const mod = await import('../performance');
      trackWebVitals = mod.trackWebVitals;
    });

    it('calls onMetric with TTFB from navigation entries', () => {
      const onMetric = vi.fn();
      // jsdom has performance.getEntriesByType but returns empty
      vi.spyOn(performance, 'getEntriesByType').mockReturnValue([
        { responseStart: 42 } as unknown as PerformanceEntry,
      ]);

      trackWebVitals(onMetric);
      expect(onMetric).toHaveBeenCalledWith({ name: 'TTFB', value: 42 });
    });

    it('does nothing when PerformanceObserver is undefined', () => {
      const original = globalThis.PerformanceObserver;
      // @ts-expect-error — testing missing API
      globalThis.PerformanceObserver = undefined;

      const onMetric = vi.fn();
      trackWebVitals(onMetric);
      // Should not throw
      expect(onMetric).not.toHaveBeenCalled();

      globalThis.PerformanceObserver = original;
    });
  });

  describe('observeLongTasks', () => {
    let observeLongTasks: typeof import('../performance')['observeLongTasks'];

    beforeEach(async () => {
      vi.resetModules();
      const mod = await import('../performance');
      observeLongTasks = mod.observeLongTasks;
    });

    it('returns a cleanup function', () => {
      const cleanup = observeLongTasks(vi.fn());
      expect(typeof cleanup).toBe('function');
      cleanup();
    });

    it('returns noop when PerformanceObserver is undefined', () => {
      const original = globalThis.PerformanceObserver;
      // @ts-expect-error — testing missing API
      globalThis.PerformanceObserver = undefined;

      const cleanup = observeLongTasks(vi.fn());
      expect(cleanup()).toBeUndefined();

      globalThis.PerformanceObserver = original;
    });
  });

  describe('measureRenderTime', () => {
    let measureRenderTime: typeof import('../performance')['measureRenderTime'];

    beforeEach(async () => {
      vi.resetModules();
      vi.stubEnv('NODE_ENV', 'development');
      const mod = await import('../performance');
      measureRenderTime = mod.measureRenderTime;
    });

    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it('returns a function', () => {
      const end = measureRenderTime('test');
      expect(typeof end).toBe('function');
    });

    it('warns for slow renders in development', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      // Mock performance.now to simulate a 20ms render
      let call = 0;
      vi.spyOn(performance, 'now').mockImplementation(() => {
        call++;
        return call === 1 ? 0 : 20;
      });

      const end = measureRenderTime('TestComponent');
      end();

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('[Performance] TestComponent'));
      warnSpy.mockRestore();
    });

    it('does not warn for fast renders', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      let call = 0;
      vi.spyOn(performance, 'now').mockImplementation(() => {
        call++;
        return call === 1 ? 0 : 10; // 10ms — under 16ms threshold
      });

      const end = measureRenderTime('FastComponent');
      end();

      expect(warnSpy).not.toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });
});
