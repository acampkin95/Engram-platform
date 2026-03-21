'use client';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect } from 'react';

export interface KeyboardShortcut {
  key: string;
  modifiers?: ('meta' | 'ctrl' | 'alt' | 'shift')[];
  description: string;
  action: () => void;
  scope?: string;
}

export interface KeyboardShortcutsConfig {
  shortcuts: KeyboardShortcut[];
  enabled?: boolean;
}

function matchesShortcut(event: KeyboardEvent, shortcut: KeyboardShortcut): boolean {
  const modifiers = shortcut.modifiers ?? [];

  if (modifiers.includes('meta') && !event.metaKey) return false;
  if (modifiers.includes('ctrl') && !event.ctrlKey) return false;
  if (modifiers.includes('alt') && !event.altKey) return false;
  if (modifiers.includes('shift') && !event.shiftKey) return false;

  const key = event.key.toLowerCase();
  const shortcutKey = shortcut.key.toLowerCase();

  if (modifiers.length === 0) {
    return key === shortcutKey && !event.metaKey && !event.ctrlKey && !event.altKey;
  }

  return key === shortcutKey;
}

export function useKeyboardShortcuts(config: KeyboardShortcutsConfig) {
  const { shortcuts, enabled = true } = config;

  useEffect(() => {
    if (!enabled) return;

    const handler = (event: KeyboardEvent) => {
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        (event.target as HTMLElement)?.isContentEditable
      ) {
        return;
      }

      for (const shortcut of shortcuts) {
        if (matchesShortcut(event, shortcut)) {
          event.preventDefault();
          shortcut.action();
          return;
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [shortcuts, enabled]);
}

export function useCommandPaletteKeyboard(
  onOpen: () => void,
  onClose: () => void,
  isOpen: boolean,
) {
  const router = useRouter();

  const handleOpen = useCallback(() => onOpen(), [onOpen]);
  const handleClose = useCallback(() => onClose(), [onClose]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        if (isOpen) {
          onClose();
        } else {
          onOpen();
        }
      }

      if (event.key === 'Escape' && isOpen) {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onOpen, onClose, isOpen]);

  useKeyboardShortcuts({
    shortcuts: [
      {
        key: 'k',
        modifiers: ['meta'],
        description: 'Open command palette',
        action: handleOpen,
        scope: 'global',
      },
      {
        key: 'Escape',
        description: 'Close command palette',
        action: handleClose,
        scope: 'command-palette',
      },
      {
        key: 'b',
        modifiers: ['ctrl'],
        description: 'Toggle sidebar',
        action: () => router.push('/'),
        scope: 'global',
      },
    ],
    enabled: true,
  });
}
