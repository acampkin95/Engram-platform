'use client';

import { useCallback } from 'react';

interface ViewTransition {
  startViewTransition: (callback: () => Promise<void> | void) => Promise<void>;
  isSupported: boolean;
}

export function useViewTransition(): ViewTransition {
  const isSupported = typeof document !== 'undefined' && 'startViewTransition' in document;

  const startViewTransition = useCallback(
    async (callback: () => Promise<void> | void) => {
      if (!isSupported) {
        await callback();
        return;
      }

      const doc = document as Document & {
        startViewTransition: (callback: () => Promise<void> | void) => { finished: Promise<void> };
      };

      const transition = doc.startViewTransition(callback);
      await transition.finished;
    },
    [isSupported],
  );

  return { startViewTransition, isSupported };
}

export function usePrefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
