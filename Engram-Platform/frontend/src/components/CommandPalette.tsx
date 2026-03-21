'use client';
import {
  Bell,
  ChevronRight,
  Circle,
  Command,
  Database,
  FileSearch,
  Globe,
  Home,
  LayoutDashboard,
  Search,
  Settings,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/src/lib/utils';
import { usePreferencesStore } from '@/src/stores/preferencesStore';
import { useUIStore } from '@/src/stores/uiStore';

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ElementType;
  shortcut?: string;
  action: () => void;
  section: string;
}

interface CommandPaletteProps {
  onClose: () => void;
  onShowShortcuts?: () => void;
}

const NAV_ITEMS: CommandItem[] = [
  {
    id: 'home',
    label: 'Dashboard Home',
    icon: Home,
    action: () => {},
    section: 'Navigate',
    shortcut: 'G then H',
  },
  {
    id: 'crawl',
    label: 'Crawl',
    icon: Globe,
    action: () => {},
    section: 'Navigate',
    shortcut: 'G then C',
  },
  { id: 'osint', label: 'OSINT', icon: Search, action: () => {}, section: 'Navigate' },
  {
    id: 'memories',
    label: 'Memories',
    icon: Database,
    action: () => {},
    section: 'Navigate',
    shortcut: 'G then M',
  },
  {
    id: 'investigations',
    label: 'Investigations',
    icon: FileSearch,
    action: () => {},
    section: 'Navigate',
  },
  { id: 'system', label: 'System Health', icon: Settings, action: () => {}, section: 'Admin' },
];

const ACTIONS: CommandItem[] = [
  {
    id: 'toggle-sidebar',
    label: 'Toggle Sidebar',
    icon: LayoutDashboard,
    action: () => {},
    section: 'Actions',
    shortcut: '⌘B',
  },
  {
    id: 'keyboard-shortcuts',
    label: 'Keyboard Shortcuts',
    icon: Command,
    action: () => {},
    section: 'Actions',
    shortcut: '?',
  },
  { id: 'preferences', label: 'Preferences', icon: Settings, action: () => {}, section: 'Actions' },
];

function buildCommandItems(
  router: ReturnType<typeof useRouter>,
  onClose: () => void,
  toggleSidebar: () => void,
  onShowShortcuts?: () => void,
): CommandItem[] {
  const nav = NAV_ITEMS.map((item) => {
    const hrefMap: Record<string, string> = {
      home: '/dashboard/home',
      crawl: '/dashboard/crawler/crawl',
      osint: '/dashboard/crawler/osint',
      memories: '/dashboard/memory/memories',
      investigations: '/dashboard/crawler/investigations',
      system: '/dashboard/system/health',
    };
    return {
      ...item,
      action: () => {
        const href = hrefMap[item.id];
        if (href) router.push(href);
        onClose();
      },
    };
  });

  const actions = ACTIONS.map((item) => {
    if (item.id === 'toggle-sidebar') {
      return {
        ...item,
        action: () => {
          toggleSidebar();
          onClose();
        },
      };
    }
    if (item.id === 'keyboard-shortcuts') {
      return {
        ...item,
        action: () => {
          onClose();
          onShowShortcuts?.();
        },
      };
    }
    return { ...item, action: () => onClose() };
  });

  return [...nav, ...actions];
}

export function CommandPalette({ onClose, onShowShortcuts }: CommandPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);

  const items = buildCommandItems(router, onClose, toggleSidebar, onShowShortcuts);
  const dismissHint = usePreferencesStore((s) => s.dismissCommandPaletteHint);

  const filtered = items.filter(
    (item) =>
      query === '' ||
      item.label.toLowerCase().includes(query.toLowerCase()) ||
      item.section.toLowerCase().includes(query.toLowerCase()),
  );

  const grouped = filtered.reduce<Record<string, CommandItem[]>>((acc, item) => {
    if (!acc[item.section]) acc[item.section] = [];
    acc[item.section].push(item);
    return acc;
  }, {});

  useEffect(() => {
    setMounted(true);
    inputRef.current?.focus();
    dismissHint();
  }, [dismissHint]);

  useEffect(() => {
    setSelectedIndex(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setSelectedIndex is stable, query is the trigger
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        filtered[selectedIndex]?.action();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    },
    [filtered, selectedIndex, onClose],
  );

  const flatFiltered = Object.values(grouped).flat();
  let globalIndex = 0;

  const overlay = (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center pt-[15vh]"
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="application"
        className="relative w-full max-w-xl bg-[#090818] border border-white/[0.08] rounded-2xl shadow-2xl shadow-black/50 overflow-hidden animate-in fade-in-0 zoom-in-95 duration-150"
        tabIndex={-1}
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/[0.06]">
          <Search className="w-4 h-4 text-[#5c5878] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search commands, pages, or actions…"
            className="flex-1 bg-transparent text-sm text-[#f0eef8] placeholder-[#5c5878] outline-none"
            aria-label="Search commands"
            role="combobox"
            aria-expanded="true"
            aria-controls="command-list"
            aria-autocomplete="list"
          />
          <div className="flex items-center gap-1">
            <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-mono text-[#5c5878]">
              <span>esc</span>
            </kbd>
            <button
              type="button"
              onClick={onClose}
              className="ml-2 rounded-md p-1 text-[#5c5878] hover:text-[#f0eef8] hover:bg-white/[0.06] transition-colors"
              aria-label="Close command palette"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div
          ref={listRef}
          id="command-list"
          role="listbox"
          className="max-h-80 overflow-y-auto py-2"
        >
          {flatFiltered.length === 0 && (
            <div className="py-12 text-center text-sm text-[#5c5878]">
              No results for &ldquo;{query}&rdquo;
            </div>
          )}
          {Object.entries(grouped).map(([section, sectionItems]) => (
            <div key={section}>
              <p className="px-4 py-2 text-[10px] font-mono uppercase tracking-widest text-[#3a3850]">
                {section}
              </p>
              {sectionItems.map((item) => {
                const idx = globalIndex++;
                const isSelected = idx === selectedIndex;
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => item.action()}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
                      isSelected
                        ? 'bg-[#2EC4C4]/10 text-[#f0eef8]'
                        : 'text-[#a09bb8] hover:bg-white/[0.04]',
                    )}
                  >
                    <Icon
                      className={cn(
                        'w-4 h-4 shrink-0',
                        isSelected ? 'text-[#2EC4C4]' : 'text-[#5c5878]',
                      )}
                    />
                    <span className="flex-1 text-sm">{item.label}</span>
                    {item.shortcut && (
                      <kbd className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-mono text-[#5c5878]">
                        {item.shortcut}
                      </kbd>
                    )}
                    {isSelected && <ChevronRight className="w-3.5 h-3.5 text-[#2EC4C4]" />}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <div className="flex items-center gap-4 px-4 py-2.5 border-t border-white/[0.06] text-[10px] font-mono text-[#3a3850]">
          <span>
            <kbd className="rounded bg-white/[0.06] px-1 py-0.5">↑↓</kbd> navigate
          </span>
          <span>
            <kbd className="rounded bg-white/[0.06] px-1 py-0.5">↵</kbd> select
          </span>
          <span>
            <kbd className="rounded bg-white/[0.06] px-1 py-0.5">esc</kbd> close
          </span>
        </div>
      </div>
    </div>
  );

  if (!mounted) return null;
  return createPortal(overlay, document.body);
}

export function CommandPaletteHint() {
  const dismissed = usePreferencesStore((s) => s.commandPaletteHintDismissed);
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const timer = setTimeout(() => setVisible(true), 2000);
    return () => clearTimeout(timer);
  }, []);

  if (!mounted || dismissed || !visible) return null;

  return (
    <div className="fixed bottom-20 right-6 z-[150] animate-in fade-in-0 slide-in-from-bottom-4 duration-300">
      <div className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-[#0d0b1a] px-4 py-3 shadow-xl shadow-black/30">
        <div className="flex items-center gap-1.5 rounded-lg bg-white/[0.06] px-2 py-1">
          <kbd className="text-[10px] font-mono text-[#f0eef8]">⌘</kbd>
          <kbd className="text-[10px] font-mono text-[#f0eef8]">K</kbd>
        </div>
        <p className="text-xs text-[#a09bb8]">Command palette</p>
        <button
          type="button"
          onClick={() => setVisible(false)}
          className="ml-2 rounded-md p-0.5 text-[#5c5878] hover:text-[#f0eef8] transition-colors"
          aria-label="Dismiss hint"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

export function KeyboardShortcutsModal({ onClose }: { onClose: () => void }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const shortcuts = [
    {
      category: 'Global',
      items: [
        { key: '⌘ K', description: 'Open command palette' },
        { key: '⌘ B', description: 'Toggle sidebar' },
        { key: '?', description: 'Show keyboard shortcuts' },
        { key: 'G then H', description: 'Go to Home' },
        { key: 'G then M', description: 'Go to Memories' },
        { key: 'G then C', description: 'Go to Crawl' },
      ],
    },
    {
      category: 'Data Tables',
      items: [
        { key: '↑ / ↓', description: 'Navigate rows' },
        { key: 'Enter', description: 'Select / edit row' },
        { key: 'Esc', description: 'Cancel / close' },
      ],
    },
    {
      category: 'Modals',
      items: [
        { key: 'Esc', description: 'Close modal' },
        { key: 'Tab', description: 'Navigate fields' },
        { key: 'Enter', description: 'Submit form' },
      ],
    },
  ];

  const overlay = (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
    >
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative w-full max-w-lg bg-[#090818] border border-white/[0.08] rounded-2xl shadow-2xl shadow-black/50 overflow-hidden animate-in fade-in-0 zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
          <h2 className="text-sm font-semibold text-[#f0eef8] font-display">Keyboard Shortcuts</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-[#5c5878] hover:text-[#f0eef8] hover:bg-white/[0.06] transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-6 py-4 max-h-80 overflow-y-auto space-y-6">
          {shortcuts.map((section) => (
            <div key={section.category}>
              <p className="text-[10px] font-mono uppercase tracking-widest text-[#3a3850] mb-3">
                {section.category}
              </p>
              <div className="space-y-2">
                {section.items.map((item) => (
                  <div key={item.key} className="flex items-center justify-between">
                    <span className="text-sm text-[#a09bb8]">{item.description}</span>
                    <kbd className="rounded bg-white/[0.06] border border-white/[0.08] px-2 py-1 text-xs font-mono text-[#f0eef8]">
                      {item.key}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  if (!mounted) return null;
  return createPortal(overlay, document.body);
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<
    Array<{
      id: string;
      type: 'info' | 'success' | 'warning' | 'error';
      message: string;
      time: Date;
    }>
  >([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const unread = notifications.length;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-lg p-2 text-[#5c5878] hover:text-[#f0eef8] hover:bg-white/[0.06] transition-colors"
        aria-label={`Notifications${unread > 0 ? `, ${unread} unread` : ''}`}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <Bell className="w-4 h-4" />
        {unread > 0 && (
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#2EC4C4] text-[10px] font-bold text-[#03020a]">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open &&
        mounted &&
        createPortal(
          <div
            className="fixed inset-0 z-[190]"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />,
          document.body,
        )}

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-xl border border-white/[0.08] bg-[#090818] shadow-xl shadow-black/40 overflow-hidden animate-in fade-in-0 slide-in-from-top-2 duration-150 z-[200]">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
            <h3 className="text-sm font-semibold text-[#f0eef8]">Notifications</h3>
            {notifications.length > 0 && (
              <button
                type="button"
                onClick={() => setNotifications([])}
                className="text-xs text-[#5c5878] hover:text-[#f0eef8] transition-colors"
              >
                Clear all
              </button>
            )}
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            {notifications.length === 0 ? (
              <div className="py-8 text-center text-sm text-[#5c5878]">No notifications</div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className="flex items-start gap-3 px-4 py-3 hover:bg-white/[0.04] transition-colors"
                >
                  <Circle
                    className={`w-2 h-2 shrink-0 mt-1.5 text-[#${n.type === 'success' ? '2EC4C4' : n.type === 'error' ? 'FF6B6B' : n.type === 'warning' ? 'F2A93B' : '9B7DE0'}]`}
                    fill="currentColor"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-[#f0eef8]">{n.message}</p>
                    <p className="text-[10px] text-[#5c5878] font-mono mt-0.5">
                      {n.time.toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
