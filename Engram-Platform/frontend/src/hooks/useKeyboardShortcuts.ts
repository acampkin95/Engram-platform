'use client';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef } from 'react';

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

const GOTO_ROUTES: Record<string, string> = {
  h: '/dashboard/home',
  m: '/dashboard/memory/memories',
  c: '/dashboard/crawler/crawl',
  t: '/dashboard/memory/timeline',
  g: '/dashboard/memory/graph',
  s: '/dashboard/system/health',
  i: '/dashboard/intelligence/chat',
};

const GOTO_LABELS: Record<string, string> = {
  h: 'Home',
  m: 'Memories',
  c: 'Crawl',
  t: 'Timeline',
  g: 'Graph',
  s: 'System',
  i: 'Intelligence',
};

export function usePowerUserShortcuts(opts?: {
  onShowShortcuts?: () => void;
  onToggleSidebar?: () => void;
  onFocusSearch?: () => void;
  enabled?: boolean;
}) {
  const router = useRouter();
  const gPressedRef = useRef(false);
  const gTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (opts?.enabled === false) return;

    const handler = (event: KeyboardEvent) => {
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        (event.target as HTMLElement)?.isContentEditable
      ) {
        return;
      }

      if (event.metaKey || event.ctrlKey || event.altKey) return;

      if (gPressedRef.current) {
        gPressedRef.current = false;
        if (gTimeoutRef.current) {
          clearTimeout(gTimeoutRef.current);
          gTimeoutRef.current = null;
        }

        const key = event.key.toLowerCase();
        const route = GOTO_ROUTES[key];
        if (route) {
          event.preventDefault();
          router.push(route);
          return;
        }
      }

      if (event.key === 'g' && !gPressedRef.current) {
        gPressedRef.current = true;
        gTimeoutRef.current = setTimeout(() => {
          gPressedRef.current = false;
          gTimeoutRef.current = null;
        }, 1000);
        return;
      }

      if (event.key === '?' && !event.shiftKey) {
        event.preventDefault();
        opts?.onShowShortcuts?.();
        return;
      }

      if (event.key === '/') {
        event.preventDefault();
        opts?.onFocusSearch?.();
        return;
      }
    };

    window.addEventListener('keydown', handler);
    return () => {
      window.removeEventListener('keydown', handler);
      if (gTimeoutRef.current) clearTimeout(gTimeoutRef.current);
    };
  }, [router, opts]);
}

export { GOTO_ROUTES, GOTO_LABELS };
