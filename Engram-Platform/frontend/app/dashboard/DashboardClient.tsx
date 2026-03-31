'use client';
import {
  BarChart2,
  Brain,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Database,
  FileSearch,
  FolderOpen,
  GitBranch,
  Globe,
  Key,
  Layers,
  LayoutDashboard,
  MessageSquare,
  Network,
  Search,
  SearchCode,
  Server,
  Share2,
} from 'lucide-react';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { PageTransition } from '@/src/components/Animations';
import {
  CommandPalette,
  CommandPaletteHint,
  KeyboardShortcutsModal,
  NotificationBell,
} from '@/src/components/CommandPalette';
import { FocusTrap } from '@/src/components/FocusTrap';
import { OnboardingTour } from '@/src/components/OnboardingTour';
import { PreferencesManager } from '@/src/components/PreferencesManager';
import { ThemeToggle } from '@/src/components/ThemeToggle';
import { NavItem } from '@/src/design-system/components/NavItem';
import { SidebarGroup } from '@/src/design-system/components/SidebarGroup';
import { StatusDot } from '@/src/design-system/components/StatusDot';
import { EngramLogo } from '@/src/design-system/EngramLogo';
import { useCommandPaletteKeyboard, usePowerUserShortcuts } from '@/src/hooks/useKeyboardShortcuts';
import { MotionProvider } from '@/src/providers/MotionProvider';
import { useUIStore } from '@/src/stores/uiStore';

// ─── Nav structure ────────────────────────────────────────────────────────────

const crawlerNav = [
  { href: '/dashboard/crawler/home', icon: LayoutDashboard, label: 'Overview' },
  { href: '/dashboard/crawler/crawl', icon: Globe, label: 'Crawl' },
  { href: '/dashboard/crawler/osint', icon: Search, label: 'OSINT' },
  { href: '/dashboard/crawler/investigations', icon: FolderOpen, label: 'Investigations' },
  { href: '/dashboard/crawler/knowledge-graph', icon: Network, label: 'Knowledge Graph' },
] as const;

const memoryNav = [
  { href: '/dashboard/memory/home', icon: Brain, label: 'Overview' },
  { href: '/dashboard/memory/memories', icon: Database, label: 'Memories' },
  { href: '/dashboard/memory/timeline', icon: Calendar, label: 'Timeline' },
  { href: '/dashboard/memory/matters', icon: Layers, label: 'Matters' },
  { href: '/dashboard/memory/graph', icon: GitBranch, label: 'Graph' },
  { href: '/dashboard/memory/analytics', icon: BarChart2, label: 'Analytics' },
] as const;

const intelligenceNav = [
  { href: '/dashboard/intelligence/canvas', icon: Layers, label: 'OSINT Canvas' },
  { href: '/dashboard/intelligence/search', icon: SearchCode, label: 'Unified Search' },
  { href: '/dashboard/intelligence/investigations', icon: FileSearch, label: 'Investigations' },
  { href: '/dashboard/intelligence/knowledge-graph', icon: Share2, label: 'Knowledge Graph' },
  { href: '/dashboard/intelligence/chat', icon: MessageSquare, label: 'RAG Chat' },
] as const;

const adminNav = [
  { href: '/dashboard/system/health', icon: Server, label: 'System Health' },
  { href: '/dashboard/system/keys', icon: Key, label: 'API Keys' },
  { href: '/dashboard/system/audit', icon: ClipboardList, label: 'Audit Log' },
] as const;

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function Sidebar({ pathname, collapsed }: Readonly<{ pathname: string; collapsed: boolean }>) {
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);

  return (
    <aside
      className="flex flex-col flex-shrink-0 bg-[var(--color-deep)] border-r border-white/[0.06] transition-all duration-300 overflow-hidden contain-layout"
      style={{ width: collapsed ? 64 : 240, willChange: 'width' }}
    >
      {/* Logo */}
      <div className="px-3 py-4 border-b border-white/[0.06] flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0">
            <EngramLogo size={32} />
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <h1 className="text-sm font-bold leading-none tracking-[0.2em] text-[var(--color-amber)] font-display">
                ENGRAM
              </h1>
              <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5 leading-none font-mono tracking-widest uppercase">
                PLATFORM
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav aria-label="Main navigation" className="flex-1 px-2 py-3 overflow-y-auto space-y-1">
        <SidebarGroup label="CRAWLER" defaultOpen>
          {crawlerNav.map((item) => (
            <NavItem
              key={item.href}
              href={item.href}
              label={item.label}
              icon={item.icon}
              isActive={pathname === item.href || pathname.startsWith(`${item.href}/`)}
              section="crawler"
              collapsed={collapsed}
            />
          ))}
        </SidebarGroup>

        <SidebarGroup label="MEMORY" defaultOpen>
          {memoryNav.map((item) => (
            <NavItem
              key={item.href}
              href={item.href}
              label={item.label}
              icon={item.icon}
              isActive={pathname === item.href || pathname.startsWith(`${item.href}/`)}
              section="memory"
              collapsed={collapsed}
            />
          ))}
        </SidebarGroup>

        <SidebarGroup label="INTELLIGENCE" defaultOpen>
          {intelligenceNav.map((item) => (
            <NavItem
              key={item.href}
              href={item.href}
              label={item.label}
              icon={item.icon}
              isActive={pathname === item.href || pathname.startsWith(`${item.href}/`)}
              section="intelligence"
              collapsed={collapsed}
            />
          ))}
        </SidebarGroup>

        <SidebarGroup label="ADMIN" defaultOpen>
          {adminNav.map((item) => (
            <NavItem
              key={item.href}
              href={item.href}
              label={item.label}
              icon={item.icon}
              isActive={pathname === item.href || pathname.startsWith(`${item.href}/`)}
              section="admin"
              collapsed={collapsed}
            />
          ))}
        </SidebarGroup>
      </nav>

      {/* Collapse toggle */}
      <div className="px-2 py-3 border-t border-white/[0.06] flex-shrink-0">
        <button
          type="button"
          onClick={toggleSidebar}
          className="flex items-center justify-center w-full h-8 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-white/[0.06] transition-colors"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>
    </aside>
  );
}

// ─── Header ───────────────────────────────────────────────────────────────────

function getPageTitle(pathname: string): string {
  if (pathname === '/dashboard' || pathname === '/dashboard/home') return 'Dashboard';
  if (pathname.startsWith('/dashboard/crawler/home')) return 'Crawler Overview';
  if (pathname.startsWith('/dashboard/crawler/crawl')) return 'Crawl';
  if (pathname.startsWith('/dashboard/crawler/osint')) return 'OSINT';
  if (pathname.startsWith('/dashboard/crawler/investigations')) return 'Investigations';
  if (pathname.startsWith('/dashboard/crawler/knowledge-graph')) return 'Knowledge Graph';
  if (pathname.startsWith('/dashboard/memory/home')) return 'Memory Overview';
  if (pathname.startsWith('/dashboard/memory/memories')) return 'Memories';
  if (pathname.startsWith('/dashboard/memory/timeline')) return 'Timeline';
  if (pathname.startsWith('/dashboard/memory/matters')) return 'Matters';
  if (pathname.startsWith('/dashboard/memory/graph')) return 'Memory Graph';
  if (pathname.startsWith('/dashboard/memory/analytics')) return 'Analytics';
  if (pathname.startsWith('/dashboard/intelligence/search')) return 'Unified Search';
  if (pathname.startsWith('/dashboard/intelligence/investigations')) return 'Investigations';
  if (pathname.startsWith('/dashboard/intelligence/knowledge-graph')) return 'Knowledge Graph';
  if (pathname.startsWith('/dashboard/intelligence/chat')) return 'RAG Chat';
  if (pathname.startsWith('/dashboard/intelligence/canvas')) return 'OSINT Canvas';
  if (pathname.startsWith('/dashboard/system/health')) return 'System Health';
  if (pathname.startsWith('/dashboard/system/keys')) return 'API Keys';
  if (pathname.startsWith('/dashboard/system/audit')) return 'Audit Log';
  return 'Platform';
}

function Header({ pathname }: Readonly<{ pathname: string }>) {
  const serviceStatus = useUIStore((s) => s.serviceStatus);
  const title = getPageTitle(pathname);

  return (
    <header className="h-14 bg-[var(--color-void)]/80 backdrop-blur-xl border-b border-white/[0.06] px-5 flex items-center justify-between flex-shrink-0 z-10">
      {/* Breadcrumb / page title */}
      <div className="flex items-center gap-3">
        <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-amber)] shadow-[0_0_8px_rgba(242,169,59,0.8)]" />
        <h2 className="text-sm font-medium text-[var(--color-text-primary)] tracking-wide font-display">
          {title}
        </h2>
      </div>

      <div className="flex items-center gap-4">
        <NotificationBell />
        <ThemeToggle />
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-mono text-[var(--color-text-muted)] tracking-widest uppercase">
            CRAWLER
          </span>
          <StatusDot variant={serviceStatus.crawler} />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-mono text-[var(--color-text-muted)] tracking-widest uppercase">
            MEMORY
          </span>
          <StatusDot variant={serviceStatus.memory} />
        </div>
      </div>
    </header>
  );
}

// ─── DashboardClient (root client shell) ─────────────────────────────────────

export function DashboardClient({ children }: Readonly<{ children: ReactNode }>) {
  const pathname = usePathname();
  const collapsed = useUIStore((s) => s.sidebarCollapsed);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [shortcutsModalOpen, setShortcutsModalOpen] = useState(false);
  const isCanvasRoute = pathname.includes('/canvas');

  useCommandPaletteKeyboard(
    () => setCommandPaletteOpen(true),
    () => setCommandPaletteOpen(false),
    commandPaletteOpen,
  );

  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  usePowerUserShortcuts({
    onShowShortcuts: () => setShortcutsModalOpen(true),
    onToggleSidebar: toggleSidebar,
  });

  return (
    <MotionProvider>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      >
        Skip to main content
      </a>
      <Sidebar pathname={pathname} collapsed={collapsed} />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header pathname={pathname} />
        <main
          id="main-content"
          className={
            isCanvasRoute ? 'flex-1 overflow-hidden' : 'flex-1 overflow-y-auto p-6 scroll-container'
          }
        >
          <PageTransition>{children}</PageTransition>
        </main>
      </div>
      {commandPaletteOpen && (
        <FocusTrap active={commandPaletteOpen} onEscape={() => setCommandPaletteOpen(false)}>
          <CommandPalette
            onClose={() => setCommandPaletteOpen(false)}
            onShowShortcuts={() => setShortcutsModalOpen(true)}
          />
        </FocusTrap>
      )}
      <CommandPaletteHint />
      {shortcutsModalOpen && (
        <FocusTrap active={shortcutsModalOpen} onEscape={() => setShortcutsModalOpen(false)}>
          <KeyboardShortcutsModal onClose={() => setShortcutsModalOpen(false)} />
        </FocusTrap>
      )}
      <OnboardingTour />
      <PreferencesManager />
    </MotionProvider>
  );
}
