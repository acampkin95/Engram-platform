import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useOnlineStatus } from '../useOnlineStatus';

describe('useOnlineStatus', () => {
  const originalOnLine = Object.getOwnPropertyDescriptor(navigator, 'onLine');

  function setOnLine(value: boolean) {
    Object.defineProperty(navigator, 'onLine', { value, configurable: true });
  }

  beforeEach(() => {
    setOnLine(true);
  });

  afterEach(() => {
    if (originalOnLine) {
      Object.defineProperty(navigator, 'onLine', originalOnLine);
    }
  });

  it('returns true when navigator.onLine is true', () => {
    setOnLine(true);
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(true);
  });

  it('returns false when navigator.onLine is false', () => {
    setOnLine(false);
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(false);
  });

  it('updates to false when offline event fires', () => {
    setOnLine(true);
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(true);

    act(() => {
      setOnLine(false);
      window.dispatchEvent(new Event('offline'));
    });

    expect(result.current).toBe(false);
  });

  it('updates to true when online event fires', () => {
    setOnLine(false);
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(false);

    act(() => {
      setOnLine(true);
      window.dispatchEvent(new Event('online'));
    });

    expect(result.current).toBe(true);
  });

  it('unsubscribes event listeners on unmount', () => {
    setOnLine(true);
    const { result, unmount } = renderHook(() => useOnlineStatus());
    unmount();

    act(() => {
      setOnLine(false);
      window.dispatchEvent(new Event('offline'));
    });

    expect(result.current).toBe(true);
  });
});
