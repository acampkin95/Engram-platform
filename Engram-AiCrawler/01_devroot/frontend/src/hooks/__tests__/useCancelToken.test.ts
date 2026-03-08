import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCancelToken } from '../useCancelToken';

describe('useCancelToken', () => {
  it('provides an AbortSignal initially not aborted', () => {
    const { result } = renderHook(() => useCancelToken());
    expect(result.current.signal).toBeInstanceOf(AbortSignal);
    expect(result.current.signal.aborted).toBe(false);
  });

  it('cancel() aborts the current signal', () => {
    const { result } = renderHook(() => useCancelToken());
    act(() => {
      result.current.cancel('test reason');
    });
    expect(result.current.signal.aborted).toBe(true);
  });

  it('reset() aborts the old signal and returns a new non-aborted signal', () => {
    const { result } = renderHook(() => useCancelToken());
    const originalSignal = result.current.signal;

    let newSignal!: AbortSignal;
    act(() => {
      newSignal = result.current.reset();
    });

    expect(originalSignal.aborted).toBe(true);
    expect(newSignal).toBeInstanceOf(AbortSignal);
    expect(newSignal.aborted).toBe(false);
  });

  it('reset() returns a different signal object than the original', () => {
    const { result } = renderHook(() => useCancelToken());
    const originalSignal = result.current.signal;
    let newSignal!: AbortSignal;
    act(() => {
      newSignal = result.current.reset();
    });
    expect(newSignal).not.toBe(originalSignal);
  });

  it('aborts signal on component unmount', () => {
    const { result, unmount } = renderHook(() => useCancelToken());
    const signal = result.current.signal;
    expect(signal.aborted).toBe(false);
    unmount();
    expect(signal.aborted).toBe(true);
  });

  it('cancel without reason still aborts signal', () => {
    const { result } = renderHook(() => useCancelToken());
    act(() => {
      result.current.cancel();
    });
    expect(result.current.signal.aborted).toBe(true);
  });
});
