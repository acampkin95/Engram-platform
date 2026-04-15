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
import Link from 'next/link';
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
import { SearchInput } from '@/src/design-system/components/SearchInput';
import { SidebarGroup } from '@/src/design-system/components/SidebarGroup';
import { StatusDot } from '@/src/design-system/components/StatusDot';
import { EngramLogo } from '@/src/design-system/EngramLogo';
import { useCommandPaletteKeyboard, usePowerUserShortcuts } from '@/src/hooks/useKeyboardShortcuts';
import { cn } from '@/src/lib/utils';
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
  const [searchQuery, setSearchQuery] = useState('');
  const [isNavScrolled, setIsNavScrolled] = useState(false);

  const filterNav = <T extends { href: string; icon: typeof LayoutDashboard; label: string }>(
    items: readonly T[],
  ): T[] => {
    if (!searchQuery.trim()) return [...items];
    return items.filter((item) => item.label.toLowerCase().includes(searchQuery.toLowerCase()));
  };

  const filteredCrawlerNav = filterNav(crawlerNav);
  const filteredMemoryNav = filterNav(memoryNav);
  const filteredIntelligenceNav = filterNav(intelligenceNav);
  const filteredAdminNav = filterNav(adminNav);

  const hasResults =
    filteredCrawlerNav.length > 0 ||
    filteredMemoryNav.length > 0 ||
    filteredIntelligenceNav.length > 0 ||
    filteredAdminNav.length > 0;

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

      {/* Search */}
      {!collapsed && (
        <div className="px-2 pb-3">
          <SearchInput
            placeholder="Search pages..."
            value={searchQuery}
            onChange={(value) => setSearchQuery(value)}
            className="h-8"
          />
        </div>
      )}

      {/* Navigation */}
      <nav
        aria-label="Main navigation"
        onScroll={(e) => setIsNavScrolled((e.target as HTMLElement).scrollTop > 0)}
        className={cn(
          'flex-1 px-2 py-3 overflow-y-auto space-y-1 transition-shadow',
          isNavScrolled && 'shadow-[inset_0_20px_20px_-20px_rgba(0,0,0,0.4)]',
        )}
      >
        {hasResults ? (
          <>
            {filteredCrawlerNav.length > 0 && (
              <SidebarGroup label="CRAWLER" defaultOpen>
                {filteredCrawlerNav.map((item) => (
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
            )}

            {filteredMemoryNav.length > 0 && (
              <SidebarGroup label="MEMORY" defaultOpen>
                {filteredMemoryNav.map((item) => (
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
            )}

            {filteredIntelligenceNav.length > 0 && (
              <SidebarGroup label="INTELLIGENCE" defaultOpen>
                {filteredIntelligenceNav.map((item) => (
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
            )}

            {filteredAdminNav.length > 0 && (
              <SidebarGroup label="ADMIN" defaultOpen>
                {filteredAdminNav.map((item) => (
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
            )}
          </>
        ) : (
          <div className="px-3 py-6 text-center text-xs text-[var(--color-text-muted)]">
            No pages found
          </div>
        )}
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

interface BreadcrumbItem {
  label: string;
  href?: string;
}

function getBreadcrumbs(pathname: string): BreadcrumbItem[] {
  const segments = pathname.split('/').filter(Boolean);
  const breadcrumbs: BreadcrumbItem[] = [{ label: 'Home', href: '/dashboard/home' }];

  if (segments.length <= 1) return breadcrumbs;

  if (segments.includes('crawler')) {
    breadcrumbs.push({ label: 'Crawler' });
    if (segments.includes('crawl'))
      breadcrumbs.push({ label: 'Crawl', href: '/dashboard/crawler/crawl' });
    else if (segments.includes('osint'))
      breadcrumbs.push({ label: 'OSINT', href: '/dashboard/crawler/osint' });
    else if (segments.includes('investigations'))
      breadcrumbs.push({ label: 'Investigations', href: '/dashboard/crawler/investigations' });
    else if (segments.includes('knowledge-graph'))
      breadcrumbs.push({ label: 'Knowledge Graph', href: '/dashboard/crawler/knowledge-graph' });
    else if (segments.includes('home'))
      breadcrumbs.push({ label: 'Overview', href: '/dashboard/crawler/home' });
  } else if (segments.includes('memory')) {
    breadcrumbs.push({ label: 'Memory' });
    if (segments.includes('memories'))
      breadcrumbs.push({ label: 'Memories', href: '/dashboard/memory/memories' });
    else if (segments.includes('timeline'))
      breadcrumbs.push({ label: 'Timeline', href: '/dashboard/memory/timeline' });
    else if (segments.includes('matters'))
      breadcrumbs.push({ label: 'Matters', href: '/dashboard/memory/matters' });
    else if (segments.includes('graph'))
      breadcrumbs.push({ label: 'Graph', href: '/dashboard/memory/graph' });
    else if (segments.includes('analytics'))
      breadcrumbs.push({ label: 'Analytics', href: '/dashboard/memory/analytics' });
    else if (segments.includes('home'))
      breadcrumbs.push({ label: 'Overview', href: '/dashboard/memory/home' });
  } else if (segments.includes('intelligence')) {
    breadcrumbs.push({ label: 'Intelligence' });
    if (segments.includes('search'))
      breadcrumbs.push({ label: 'Unified Search', href: '/dashboard/intelligence/search' });
    else if (segments.includes('investigations'))
      breadcrumbs.push({ label: 'Investigations', href: '/dashboard/intelligence/investigations' });
    else if (segments.includes('knowledge-graph'))
      breadcrumbs.push({
        label: 'Knowledge Graph',
        href: '/dashboard/intelligence/knowledge-graph',
      });
    else if (segments.includes('chat'))
      breadcrumbs.push({ label: 'RAG Chat', href: '/dashboard/intelligence/chat' });
    else if (segments.includes('canvas'))
      breadcrumbs.push({ label: 'OSINT Canvas', href: '/dashboard/intelligence/canvas' });
  } else if (segments.includes('system')) {
    breadcrumbs.push({ label: 'System' });
    if (segments.includes('health'))
      breadcrumbs.push({ label: 'System Health', href: '/dashboard/system/health' });
    else if (segments.includes('keys'))
      breadcrumbs.push({ label: 'API Keys', href: '/dashboard/system/keys' });
    else if (segments.includes('audit'))
      breadcrumbs.push({ label: 'Audit Log', href: '/dashboard/system/audit' });
  }

  return breadcrumbs;
}

function BreadcrumbNav({ pathname }: { pathname: string }) {
  const segments = getBreadcrumbs(pathname);
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm">
      {segments.map((seg) => (
        <span key={seg.href ?? seg.label} className="flex items-center gap-2">
          {segments.indexOf(seg) > 0 && (
            <ChevronRight className="w-3 h-3 text-[var(--color-text-muted)]" />
          )}
          {seg.href && segments.indexOf(seg) < segments.length - 1 ? (
            <Link
              href={seg.href}
              className="text-[var(--color-text-muted)] hover:text-[var(--color-amber)] transition-colors"
            >
              {seg.label}
            </Link>
          ) : (
            <span className="text-[var(--color-text-primary)] font-medium">{seg.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

function Header({ pathname }: Readonly<{ pathname: string }>) {
  const serviceStatus = useUIStore((s) => s.serviceStatus);

  return (
    <header className="h-14 bg-[var(--color-void)]/80 backdrop-blur-xl border-b border-white/[0.06] px-5 flex items-center justify-between flex-shrink-0 z-10">
      {/* Breadcrumb */}
      <BreadcrumbNav pathname={pathname} />

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
