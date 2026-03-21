import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useKeyboardShortcuts } from '@/src/hooks/useKeyboardShortcuts';
import type { KeyboardShortcut } from '@/src/hooks/useKeyboardShortcuts';

function fireKey(
  key: string,
  opts: Partial<KeyboardEventInit> = {},
  target?: EventTarget,
) {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    ...opts,
  });
  (target ?? window).dispatchEvent(event);
  return event;
}

describe('useKeyboardShortcuts', () => {
  let action: ReturnType<typeof vi.fn<() => void>>;

  beforeEach(() => {
    action = vi.fn<() => void>();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls action when matching key is pressed', () => {
    const shortcuts: KeyboardShortcut[] = [
      { key: 'a', description: 'test', action },
    ];
    renderHook(() => useKeyboardShortcuts({ shortcuts }));

    fireKey('a');
    expect(action).toHaveBeenCalledTimes(1);
  });

  it('does not call action for non-matching key', () => {
    const shortcuts: KeyboardShortcut[] = [
      { key: 'a', description: 'test', action },
    ];
    renderHook(() => useKeyboardShortcuts({ shortcuts }));

    fireKey('b');
    expect(action).not.toHaveBeenCalled();
  });

  it('matches key case-insensitively', () => {
    const shortcuts: KeyboardShortcut[] = [
      { key: 'A', description: 'test', action },
    ];
    renderHook(() => useKeyboardShortcuts({ shortcuts }));

    fireKey('a');
    expect(action).toHaveBeenCalledTimes(1);
  });

  it('matches shortcut with meta modifier', () => {
    const shortcuts: KeyboardShortcut[] = [
      { key: 'k', modifiers: ['meta'], description: 'test', action },
    ];
    renderHook(() => useKeyboardShortcuts({ shortcuts }));

    fireKey('k', { metaKey: true });
    expect(action).toHaveBeenCalledTimes(1);
  });

  it('does not match when required meta modifier is missing', () => {
    const shortcuts: KeyboardShortcut[] = [
      { key: 'k', modifiers: ['meta'], description: 'test', action },
    ];
    renderHook(() => useKeyboardShortcuts({ shortcuts }));

    fireKey('k');
    expect(action).not.toHaveBeenCalled();
  });

  it('matches shortcut with ctrl modifier', () => {
    const shortcuts: KeyboardShortcut[] = [
      { key: 'b', modifiers: ['ctrl'], description: 'test', action },
    ];
    renderHook(() => useKeyboardShortcuts({ shortcuts }));

    fireKey('b', { ctrlKey: true });
    expect(action).toHaveBeenCalledTimes(1);
  });

  it('matches shortcut with multiple modifiers', () => {
    const shortcuts: KeyboardShortcut[] = [
      { key: 's', modifiers: ['ctrl', 'shift'], description: 'test', action },
    ];
    renderHook(() => useKeyboardShortcuts({ shortcuts }));

    fireKey('s', { ctrlKey: true, shiftKey: true });
    expect(action).toHaveBeenCalledTimes(1);
  });

  it('does not match when one of multiple modifiers is missing', () => {
    const shortcuts: KeyboardShortcut[] = [
      { key: 's', modifiers: ['ctrl', 'shift'], description: 'test', action },
    ];
    renderHook(() => useKeyboardShortcuts({ shortcuts }));

    fireKey('s', { ctrlKey: true }); // missing shift
    expect(action).not.toHaveBeenCalled();
  });

  it('rejects key without modifiers when meta is held but not required', () => {
    const shortcuts: KeyboardShortcut[] = [
      { key: 'a', description: 'test', action },
    ];
    renderHook(() => useKeyboardShortcuts({ shortcuts }));

    fireKey('a', { metaKey: true });
    expect(action).not.toHaveBeenCalled();
  });

  it('does not fire when enabled is false', () => {
    const shortcuts: KeyboardShortcut[] = [
      { key: 'a', description: 'test', action },
    ];
    renderHook(() => useKeyboardShortcuts({ shortcuts, enabled: false }));

    fireKey('a');
    expect(action).not.toHaveBeenCalled();
  });

  it('ignores keydown events from input elements', () => {
    const shortcuts: KeyboardShortcut[] = [
      { key: 'a', description: 'test', action },
    ];
    renderHook(() => useKeyboardShortcuts({ shortcuts }));

    const input = document.createElement('input');
    document.body.appendChild(input);
    fireKey('a', {}, input);
    document.body.removeChild(input);

    expect(action).not.toHaveBeenCalled();
  });

  it('ignores keydown events from textarea elements', () => {
    const shortcuts: KeyboardShortcut[] = [
      { key: 'a', description: 'test', action },
    ];
    renderHook(() => useKeyboardShortcuts({ shortcuts }));

    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);
    fireKey('a', {}, textarea);
    document.body.removeChild(textarea);

    expect(action).not.toHaveBeenCalled();
  });

  it('removes event listener on unmount', () => {
    const shortcuts: KeyboardShortcut[] = [
      { key: 'a', description: 'test', action },
    ];
    const { unmount } = renderHook(() => useKeyboardShortcuts({ shortcuts }));

    unmount();
    fireKey('a');
    expect(action).not.toHaveBeenCalled();
  });

  it('calls only the first matching shortcut when multiple match', () => {
    const action2 = vi.fn<() => void>();
    const shortcuts: KeyboardShortcut[] = [
      { key: 'a', description: 'first', action },
      { key: 'a', description: 'second', action: action2 },
    ];
    renderHook(() => useKeyboardShortcuts({ shortcuts }));

    fireKey('a');
    expect(action).toHaveBeenCalledTimes(1);
    expect(action2).not.toHaveBeenCalled();
  });
});
