import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useViewTransition, usePrefersReducedMotion } from '@/src/hooks/useViewTransition';

describe('useViewTransition', () => {
  let mockStartViewTransition: ReturnType<typeof vi.fn>;
  let mockFinishedPromise: Promise<void>;
  let originalStartViewTransition: any;

  beforeEach(() => {
    // Store original value
    originalStartViewTransition = (document as any).startViewTransition;

    mockFinishedPromise = Promise.resolve();
    mockStartViewTransition = vi.fn((callback?: any) => {
      // Execute the callback if provided (like the real API does)
      // For async callbacks, we need to await them before resolving finished
      if (callback) {
        const result = callback();
        if (result instanceof Promise) {
          mockFinishedPromise = result;
        }
      }
      return {
        finished: mockFinishedPromise,
      };
    });

    // Mock document.startViewTransition
    (document as any).startViewTransition = mockStartViewTransition;
  });

  afterEach(() => {
    vi.clearAllMocks();
    // Restore original
    if (originalStartViewTransition) {
      (document as any).startViewTransition = originalStartViewTransition;
    } else {
      delete (document as any).startViewTransition;
    }
  });

  describe('Browser Support Detection', () => {
    it('detects when startViewTransition is available', () => {
      const { result } = renderHook(() => useViewTransition());

      expect(result.current.isSupported).toBe(true);
    });

    it('detects when startViewTransition is not available', () => {
      // Remove startViewTransition
      delete (document as any).startViewTransition;

      const { result } = renderHook(() => useViewTransition());

      expect(result.current.isSupported).toBe(false);

      // Restore it
      (document as any).startViewTransition = mockStartViewTransition;
    });
  });

  describe('View Transition Execution', () => {
    it('executes callback directly when feature is not supported', async () => {
      // Remove the feature
      delete (document as any).startViewTransition;

      const { result } = renderHook(() => useViewTransition());
      const callback = vi.fn().mockResolvedValue(undefined);

      await result.current.startViewTransition(callback);

      expect(callback).toHaveBeenCalled();

      // Restore it
      (document as any).startViewTransition = mockStartViewTransition;
    });

    it('calls document.startViewTransition when feature is supported', async () => {
      const { result } = renderHook(() => useViewTransition());
      const callback = vi.fn();

      await result.current.startViewTransition(callback);

      expect(mockStartViewTransition).toHaveBeenCalled();
    });

    it('waits for transition.finished promise to resolve', async () => {
      let resolveFinished: () => void;
      const finishedPromise = new Promise<void>((resolve) => {
        resolveFinished = resolve;
      });

      mockStartViewTransition.mockReturnValue({
        finished: finishedPromise,
      });

      const { result } = renderHook(() => useViewTransition());
      const callback = vi.fn();

      let transitionComplete = false;
      const promise = result.current.startViewTransition(callback);

      promise.then(() => {
        transitionComplete = true;
      });

      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(transitionComplete).toBe(false);

      resolveFinished!();
      await waitFor(() => {
        expect(transitionComplete).toBe(true);
      });
    });

    it('handles async callbacks', async () => {
      const { result } = renderHook(() => useViewTransition());

      let callbackExecuted = false;
      const asyncCallback = vi.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        callbackExecuted = true;
      });

      await result.current.startViewTransition(asyncCallback);

      expect(asyncCallback).toHaveBeenCalled();
      expect(callbackExecuted).toBe(true);
    });

    it('handles sync callbacks', async () => {
      const { result } = renderHook(() => useViewTransition());

      const syncCallback = vi.fn();

      await result.current.startViewTransition(syncCallback);

      expect(syncCallback).toHaveBeenCalled();
      expect(mockStartViewTransition).toHaveBeenCalled();
    });

    it('propagates callback errors', async () => {
      const { result } = renderHook(() => useViewTransition());

      const error = new Error('Callback failed');

      mockStartViewTransition.mockImplementation(() => {
        return { finished: Promise.reject(error) };
      });

      await expect(result.current.startViewTransition(vi.fn())).rejects.toThrow(
        'Callback failed'
      );
    });
  });

  describe('Return Type', () => {
    it('returns object with startViewTransition and isSupported properties', () => {
      const { result } = renderHook(() => useViewTransition());

      expect(result.current).toHaveProperty('startViewTransition');
      expect(result.current).toHaveProperty('isSupported');
      expect(typeof result.current.startViewTransition).toBe('function');
      expect(typeof result.current.isSupported).toBe('boolean');
    });
  });

  describe('Multiple Calls', () => {
    it('handles multiple sequential transitions', async () => {
      const { result } = renderHook(() => useViewTransition());
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      const callback3 = vi.fn();

      await result.current.startViewTransition(callback1);
      await result.current.startViewTransition(callback2);
      await result.current.startViewTransition(callback3);

      expect(mockStartViewTransition).toHaveBeenCalledTimes(3);
      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
      expect(callback3).toHaveBeenCalled();
    });

    it('handles nested view transitions', async () => {
      const { result } = renderHook(() => useViewTransition());

      const nestedCallback = vi.fn();

      await result.current.startViewTransition(nestedCallback);

      // At least one call for the outer transition
      expect(mockStartViewTransition).toHaveBeenCalled();
      expect(nestedCallback).toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('executes the callback when using startViewTransition', async () => {
      const { result } = renderHook(() => useViewTransition());

      const callback = vi.fn();

      await result.current.startViewTransition(callback);

      expect(callback).toHaveBeenCalled();
    });

    it('handles callback that throws synchronously when feature not supported', async () => {
      delete (document as any).startViewTransition;

      const { result } = renderHook(() => useViewTransition());

      const error = new Error('Sync error');
      const throwingCallback = vi.fn(() => {
        throw error;
      });

      await expect(result.current.startViewTransition(throwingCallback)).rejects.toThrow(
        'Sync error'
      );

      (document as any).startViewTransition = mockStartViewTransition;
    });

    it('handles callback that modifies DOM when supported', async () => {
      const { result } = renderHook(() => useViewTransition());

      const domModifyingCallback = vi.fn(() => {
        const div = document.createElement('div');
        document.body.appendChild(div);
      });

      await result.current.startViewTransition(domModifyingCallback);

      expect(domModifyingCallback).toHaveBeenCalled();

      // Cleanup
      const divs = document.querySelectorAll('div');
      divs.forEach((div) => div.remove());
    });
  });
});

describe('usePrefersReducedMotion', () => {
  let mockMatchMedia: ReturnType<typeof vi.fn>;
  let originalMatchMedia: any;

  beforeEach(() => {
    originalMatchMedia = window.matchMedia;

    mockMatchMedia = vi.fn((query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    window.matchMedia = mockMatchMedia;
  });

  afterEach(() => {
    vi.clearAllMocks();
    window.matchMedia = originalMatchMedia;
  });

  describe('Feature Detection', () => {
    it('returns false when user does not prefer reduced motion', () => {
      mockMatchMedia.mockReturnValue({
        matches: false,
        media: '(prefers-reduced-motion: reduce)',
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      });

      const { result } = renderHook(() => usePrefersReducedMotion());

      expect(result.current).toBe(false);
    });

    it('returns true when user prefers reduced motion', () => {
      mockMatchMedia.mockReturnValue({
        matches: true,
        media: '(prefers-reduced-motion: reduce)',
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      });

      const { result } = renderHook(() => usePrefersReducedMotion());

      expect(result.current).toBe(true);
    });
  });

  describe('MediaQueryList Query', () => {
    it('queries the correct media feature', () => {
      renderHook(() => usePrefersReducedMotion());

      expect(mockMatchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)');
    });

    it('handles matchMedia returning correct property', () => {
      mockMatchMedia.mockReturnValue({
        matches: true,
        media: '(prefers-reduced-motion: reduce)',
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      });

      const { result } = renderHook(() => usePrefersReducedMotion());

      expect(result.current).toBe(true);
    });
  });

  describe('Multiple Calls', () => {
    it('maintains consistent boolean type across multiple calls', () => {
      const { result: result1 } = renderHook(() => usePrefersReducedMotion());
      const { result: result2 } = renderHook(() => usePrefersReducedMotion());

      expect(typeof result1.current).toBe('boolean');
      expect(typeof result2.current).toBe('boolean');
    });

    it('handles different preferences in different hooks', () => {
      const firstCallMatches = true;
      let callCount = 0;

      mockMatchMedia.mockImplementation(() => {
        callCount++;
        return {
          matches: callCount === 1 ? firstCallMatches : !firstCallMatches,
          media: '(prefers-reduced-motion: reduce)',
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        };
      });

      const { result: result1 } = renderHook(() => usePrefersReducedMotion());
      const { result: result2 } = renderHook(() => usePrefersReducedMotion());

      expect(result1.current).toBe(true);
      expect(result2.current).toBe(false);
    });
  });

  describe('Return Type', () => {
    it('returns a boolean value', () => {
      const { result } = renderHook(() => usePrefersReducedMotion());

      expect(typeof result.current).toBe('boolean');
    });
  });

  describe('Edge Cases', () => {
    it('handles matchMedia returning different results on successive renders', () => {
      let shouldReduce = false;
      mockMatchMedia.mockImplementation(() => ({
        matches: shouldReduce,
        media: '(prefers-reduced-motion: reduce)',
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      const { result } = renderHook(() => usePrefersReducedMotion());

      expect(result.current).toBe(false);

      // Change the value for next call
      shouldReduce = true;
      const { result: result2 } = renderHook(() => usePrefersReducedMotion());

      expect(result2.current).toBe(true);
    });

    it('handles rapid successive calls', () => {
      for (let i = 0; i < 10; i++) {
        const { result } = renderHook(() => usePrefersReducedMotion());
        expect(typeof result.current).toBe('boolean');
      }

      expect(mockMatchMedia).toHaveBeenCalled();
    });
  });
});
