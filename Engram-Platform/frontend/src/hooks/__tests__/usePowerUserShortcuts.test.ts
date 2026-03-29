import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GOTO_ROUTES, usePowerUserShortcuts } from '@/src/hooks/useKeyboardShortcuts';

const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({
    push: mockPush,
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  })),
}));

function fireKey(key: string, opts: Partial<KeyboardEventInit> = {}, target?: EventTarget) {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    ...opts,
  });
  (target ?? window).dispatchEvent(event);
  return event;
}

describe('usePowerUserShortcuts', () => {
  let onShowShortcuts: ReturnType<typeof vi.fn<() => void>>;
  let onToggleSidebar: ReturnType<typeof vi.fn<() => void>>;
  let onFocusSearch: ReturnType<typeof vi.fn<() => void>>;

  beforeEach(() => {
    onShowShortcuts = vi.fn<() => void>();
    onToggleSidebar = vi.fn<() => void>();
    onFocusSearch = vi.fn<() => void>();
    mockPush.mockReset();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('Goto Navigation (g + key)', () => {
    it('navigates to home with g+h', () => {
      renderHook(() =>
        usePowerUserShortcuts({
          onShowShortcuts,
          onToggleSidebar,
          onFocusSearch,
        }),
      );

      fireKey('g');
      // Don't run timers yet, just wait for first key
      fireKey('h');
      expect(mockPush).toHaveBeenCalledWith(GOTO_ROUTES.h);
      expect(mockPush).toHaveBeenCalledWith('/dashboard/home');
    });

    it('navigates to memories with g+m', () => {
      renderHook(() =>
        usePowerUserShortcuts({
          onShowShortcuts,
          onToggleSidebar,
          onFocusSearch,
        }),
      );

      fireKey('g');
      fireKey('m');
      expect(mockPush).toHaveBeenCalledWith(GOTO_ROUTES.m);
      expect(mockPush).toHaveBeenCalledWith('/dashboard/memory/memories');
    });

    it('navigates to crawler with g+c', () => {
      renderHook(() =>
        usePowerUserShortcuts({
          onShowShortcuts,
          onToggleSidebar,
          onFocusSearch,
        }),
      );

      fireKey('g');
      fireKey('c');
      expect(mockPush).toHaveBeenCalledWith(GOTO_ROUTES.c);
      expect(mockPush).toHaveBeenCalledWith('/dashboard/crawler/crawl');
    });

    it('navigates to timeline with g+t', () => {
      renderHook(() =>
        usePowerUserShortcuts({
          onShowShortcuts,
          onToggleSidebar,
          onFocusSearch,
        }),
      );

      fireKey('g');
      fireKey('t');
      expect(mockPush).toHaveBeenCalledWith(GOTO_ROUTES.t);
      expect(mockPush).toHaveBeenCalledWith('/dashboard/memory/timeline');
    });

    it('navigates to graph with g+g', () => {
      renderHook(() =>
        usePowerUserShortcuts({
          onShowShortcuts,
          onToggleSidebar,
          onFocusSearch,
        }),
      );

      fireKey('g');
      fireKey('g');
      expect(mockPush).toHaveBeenCalledWith(GOTO_ROUTES.g);
      expect(mockPush).toHaveBeenCalledWith('/dashboard/memory/graph');
    });

    it('navigates to system with g+s', () => {
      renderHook(() =>
        usePowerUserShortcuts({
          onShowShortcuts,
          onToggleSidebar,
          onFocusSearch,
        }),
      );

      fireKey('g');
      fireKey('s');
      expect(mockPush).toHaveBeenCalledWith(GOTO_ROUTES.s);
      expect(mockPush).toHaveBeenCalledWith('/dashboard/system/health');
    });

    it('navigates to intelligence with g+i', () => {
      renderHook(() =>
        usePowerUserShortcuts({
          onShowShortcuts,
          onToggleSidebar,
          onFocusSearch,
        }),
      );

      fireKey('g');
      fireKey('i');
      expect(mockPush).toHaveBeenCalledWith(GOTO_ROUTES.i);
      expect(mockPush).toHaveBeenCalledWith('/dashboard/intelligence/chat');
    });

    it('does not navigate with g followed by unknown key', () => {
      renderHook(() =>
        usePowerUserShortcuts({
          onShowShortcuts,
          onToggleSidebar,
          onFocusSearch,
        }),
      );

      fireKey('g');
      fireKey('z');
      expect(mockPush).not.toHaveBeenCalled();
    });

    it('resets g flag after timeout (1 second)', () => {
      renderHook(() =>
        usePowerUserShortcuts({
          onShowShortcuts,
          onToggleSidebar,
          onFocusSearch,
        }),
      );

      fireKey('g');
      vi.advanceTimersByTime(1000);

      fireKey('h');
      expect(mockPush).not.toHaveBeenCalled(); // g flag expired
    });

    it('cancels g timeout if second key is pressed within 1 second', () => {
      renderHook(() =>
        usePowerUserShortcuts({
          onShowShortcuts,
          onToggleSidebar,
          onFocusSearch,
        }),
      );

      fireKey('g');
      vi.advanceTimersByTime(500);
      fireKey('h');

      expect(mockPush).toHaveBeenCalled();
    });

    it('prevents default on g+h navigation', () => {
      renderHook(() =>
        usePowerUserShortcuts({
          onShowShortcuts,
          onToggleSidebar,
          onFocusSearch,
        }),
      );

      fireKey('g');
      const event = fireKey('h');
      expect(event.defaultPrevented).toBe(true);
    });
  });

  describe('Help Shortcut (?)', () => {
    it('calls onShowShortcuts when ? is pressed', () => {
      renderHook(() =>
        usePowerUserShortcuts({
          onShowShortcuts,
          onToggleSidebar,
          onFocusSearch,
        }),
      );

      fireKey('?');
      expect(onShowShortcuts).toHaveBeenCalled();
    });

    it('prevents default on ? key', () => {
      renderHook(() =>
        usePowerUserShortcuts({
          onShowShortcuts,
          onToggleSidebar,
          onFocusSearch,
        }),
      );

      const event = fireKey('?');
      expect(event.defaultPrevented).toBe(true);
    });

    it('handles keyboard events on contentEditable elements', () => {
      const contentEditableOnShowShortcuts = vi.fn<() => void>();
      renderHook(() =>
        usePowerUserShortcuts({
          onShowShortcuts: contentEditableOnShowShortcuts,
          onToggleSidebar,
          onFocusSearch,
        }),
      );

      const div = document.createElement('div');
      div.contentEditable = 'true';
      document.body.appendChild(div);

      // The hook should not throw when handling events on contentEditable elements
      expect(() => {
        fireKey('?', {}, div);
      }).not.toThrow();

      // Clean up
      document.body.removeChild(div);
    });
  });

  describe('Search Focus Shortcut (/)', () => {
    it('calls onFocusSearch when / is pressed', () => {
      renderHook(() =>
        usePowerUserShortcuts({
          onShowShortcuts,
          onToggleSidebar,
          onFocusSearch,
        }),
      );

      fireKey('/');
      expect(onFocusSearch).toHaveBeenCalledTimes(1);
    });

    it('prevents default on / key', () => {
      renderHook(() =>
        usePowerUserShortcuts({
          onShowShortcuts,
          onToggleSidebar,
          onFocusSearch,
        }),
      );

      const event = fireKey('/');
      expect(event.defaultPrevented).toBe(true);
    });
  });

  describe('Input Element Handling', () => {
    it('ignores keyboard shortcuts when focus is in an input element', () => {
      renderHook(() =>
        usePowerUserShortcuts({
          onShowShortcuts,
          onToggleSidebar,
          onFocusSearch,
        }),
      );

      const input = document.createElement('input');
      document.body.appendChild(input);
      fireKey('/', {}, input);
      document.body.removeChild(input);

      expect(onFocusSearch).not.toHaveBeenCalled();
    });

    it('ignores keyboard shortcuts when focus is in a textarea element', () => {
      renderHook(() =>
        usePowerUserShortcuts({
          onShowShortcuts,
          onToggleSidebar,
          onFocusSearch,
        }),
      );

      const textarea = document.createElement('textarea');
      document.body.appendChild(textarea);
      fireKey('?', {}, textarea);
      document.body.removeChild(textarea);

      expect(onShowShortcuts).not.toHaveBeenCalled();
    });
  });

  describe('Modifier Key Handling', () => {
    it('ignores shortcuts when metaKey is held', () => {
      renderHook(() =>
        usePowerUserShortcuts({
          onShowShortcuts,
          onToggleSidebar,
          onFocusSearch,
        }),
      );

      fireKey('/', { metaKey: true });
      expect(onFocusSearch).not.toHaveBeenCalled();
    });

    it('ignores shortcuts when ctrlKey is held', () => {
      renderHook(() =>
        usePowerUserShortcuts({
          onShowShortcuts,
          onToggleSidebar,
          onFocusSearch,
        }),
      );

      fireKey('/', { ctrlKey: true });
      expect(onFocusSearch).not.toHaveBeenCalled();
    });

    it('ignores shortcuts when altKey is held', () => {
      renderHook(() =>
        usePowerUserShortcuts({
          onShowShortcuts,
          onToggleSidebar,
          onFocusSearch,
        }),
      );

      fireKey('/', { altKey: true });
      expect(onFocusSearch).not.toHaveBeenCalled();
    });

    it('ignores g shortcut when metaKey is held', () => {
      renderHook(() =>
        usePowerUserShortcuts({
          onShowShortcuts,
          onToggleSidebar,
          onFocusSearch,
        }),
      );

      fireKey('g', { metaKey: true });
      vi.runAllTimers();
      vi.clearAllTimers();

      fireKey('h');
      expect(mockPush).not.toHaveBeenCalled();
    });
  });

  describe('Disabled State', () => {
    it('disables all shortcuts when enabled is false', () => {
      renderHook(() =>
        usePowerUserShortcuts({
          onShowShortcuts,
          onToggleSidebar,
          onFocusSearch,
          enabled: false,
        }),
      );

      fireKey('/');
      fireKey('?', { shiftKey: true });
      fireKey('g');
      vi.runAllTimers();
      vi.clearAllTimers();

      fireKey('h');

      expect(onFocusSearch).not.toHaveBeenCalled();
      expect(onShowShortcuts).not.toHaveBeenCalled();
      expect(mockPush).not.toHaveBeenCalled();
    });

    it('disables all shortcuts when enabled is undefined (default true)', () => {
      // Test that enabled defaults to true (not false)
      renderHook(() =>
        usePowerUserShortcuts({
          onShowShortcuts,
          onToggleSidebar,
          onFocusSearch,
          // enabled is not specified, should default to true
        }),
      );

      fireKey('/');
      expect(onFocusSearch).toHaveBeenCalledTimes(1);
    });
  });

  describe('Callback Cleanup', () => {
    it('cleans up timers on unmount', () => {
      const { unmount } = renderHook(() =>
        usePowerUserShortcuts({
          onShowShortcuts,
          onToggleSidebar,
          onFocusSearch,
        }),
      );

      fireKey('g');
      unmount();

      // Advancing timers should not cause issues
      expect(() => vi.advanceTimersByTime(1000)).not.toThrow();
    });

    it('clears g timeout when unmounting mid-sequence', () => {
      const { unmount } = renderHook(() =>
        usePowerUserShortcuts({
          onShowShortcuts,
          onToggleSidebar,
          onFocusSearch,
        }),
      );

      fireKey('g');
      unmount();

      // Should not have pending timers
      expect(vi.getTimerCount()).toBe(0);
    });
  });

  describe('Optional Callbacks', () => {
    it('handles undefined onShowShortcuts callback', () => {
      renderHook(() =>
        usePowerUserShortcuts({
          onToggleSidebar,
          onFocusSearch,
        }),
      );

      expect(() => fireKey('?', { shiftKey: true })).not.toThrow();
    });

    it('handles undefined onFocusSearch callback', () => {
      renderHook(() =>
        usePowerUserShortcuts({
          onShowShortcuts,
          onToggleSidebar,
        }),
      );

      expect(() => fireKey('/')).not.toThrow();
    });

    it('handles undefined onToggleSidebar callback', () => {
      renderHook(() =>
        usePowerUserShortcuts({
          onShowShortcuts,
          onFocusSearch,
        }),
      );

      expect(() => fireKey('a')).not.toThrow();
    });
  });

  describe('Case Sensitivity', () => {
    it('handles lowercase g navigation keys', () => {
      renderHook(() =>
        usePowerUserShortcuts({
          onShowShortcuts,
          onToggleSidebar,
          onFocusSearch,
        }),
      );

      fireKey('g');
      fireKey('h');
      expect(mockPush).toHaveBeenCalledWith('/dashboard/home');
    });

    it('handles uppercase G navigation keys (G+H should not work)', () => {
      renderHook(() =>
        usePowerUserShortcuts({
          onShowShortcuts,
          onToggleSidebar,
          onFocusSearch,
        }),
      );

      fireKey('G');
      // Uppercase G is different from lowercase g
      fireKey('H');
      expect(mockPush).not.toHaveBeenCalled();
    });
  });

  describe('Event Listener Lifecycle', () => {
    it('removes event listener on unmount', () => {
      const { unmount } = renderHook(() =>
        usePowerUserShortcuts({
          onShowShortcuts,
          onToggleSidebar,
          onFocusSearch,
        }),
      );

      unmount();
      fireKey('/');
      expect(onFocusSearch).not.toHaveBeenCalled();
    });

    it('reattaches listener with new callbacks when options change', () => {
      const newOnShowShortcuts = vi.fn<() => void>();
      const { rerender } = renderHook(
        ({ opts }: { opts: Parameters<typeof usePowerUserShortcuts>[0] }) =>
          usePowerUserShortcuts(opts),
        {
          initialProps: {
            opts: { onShowShortcuts, onToggleSidebar, onFocusSearch },
          },
        },
      );

      fireKey('?');
      expect(onShowShortcuts).toHaveBeenCalled();
      const initialCallCount = onShowShortcuts.mock.calls.length;

      rerender({
        opts: { onShowShortcuts: newOnShowShortcuts, onToggleSidebar, onFocusSearch },
      });

      fireKey('?');
      expect(newOnShowShortcuts).toHaveBeenCalled();
      expect(onShowShortcuts.mock.calls.length).toBe(initialCallCount); // No additional calls
    });
  });
});
