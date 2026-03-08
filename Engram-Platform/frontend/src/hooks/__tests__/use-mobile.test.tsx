import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useIsMobile } from '@/src/hooks/use-mobile';

type ChangeListener = () => void;

describe('useIsMobile', () => {
  const listeners = new Set<ChangeListener>();

  beforeEach(() => {
    listeners.clear();
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 500,
    });

    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockImplementation(() => ({
        matches: window.innerWidth < 768,
        media: '(max-width: 767px)',
        onchange: null,
        addEventListener: (_event: string, listener: ChangeListener) => listeners.add(listener),
        removeEventListener: (_event: string, listener: ChangeListener) =>
          listeners.delete(listener),
        dispatchEvent: vi.fn(),
      })),
    );
  });

  it('reports mobile when width is below breakpoint', async () => {
    const { result } = renderHook(() => useIsMobile());

    await waitFor(() => {
      expect(result.current).toBe(true);
    });
  });

  it('updates when media query change event fires', async () => {
    const { result } = renderHook(() => useIsMobile());

    await waitFor(() => {
      expect(result.current).toBe(true);
    });

    act(() => {
      window.innerWidth = 1024;
      listeners.forEach((listener) => {
        listener();
      });
    });

    await waitFor(() => {
      expect(result.current).toBe(false);
    });
  });
});
