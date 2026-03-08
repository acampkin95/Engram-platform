'use client';
import { ThemeToggle } from '@/src/components/ThemeToggle';
import {
  BarChart2,
  Brain,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Database,
  FileSearch,
  FolderOpen,
  GitBranch,
  Globe,
  Layers,
  LayoutDashboard,
  MessageSquare,
  Network,
  Search,
  SearchCode,
  Share2,
} from 'lucide-react';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { NavItem } from '@/src/design-system/components/NavItem';
import { SidebarGroup } from '@/src/design-system/components/SidebarGroup';
import { StatusDot } from '@/src/design-system/components/StatusDot';
import { EngramLogo } from '@/src/design-system/EngramLogo';
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
  { href: '/dashboard/intelligence/search', icon: SearchCode, label: 'Unified Search' },
  { href: '/dashboard/intelligence/investigations', icon: FileSearch, label: 'Investigations' },
  { href: '/dashboard/intelligence/knowledge-graph', icon: Share2, label: 'Knowledge Graph' },
  { href: '/dashboard/intelligence/chat', icon: MessageSquare, label: 'RAG Chat' },
] as const;

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function Sidebar({ pathname, collapsed }: Readonly<{ pathname: string; collapsed: boolean }>) {
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);

  return (
    <aside
      className="flex flex-col flex-shrink-0 bg-[#090818] border-r border-white/[0.06] transition-all duration-300 overflow-hidden"
      style={{ width: collapsed ? 64 : 240 }}
    >
      {/* Logo */}
      <div className="px-3 py-4 border-b border-white/[0.06] flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0">
            <EngramLogo size={32} />
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <h1 className="text-sm font-bold leading-none tracking-[0.2em] text-[#F2A93B] font-display">
                ENGRAM
              </h1>
              <p className="text-[10px] text-[#5c5878] mt-0.5 leading-none font-mono tracking-widest uppercase">
                PLATFORM
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-3 overflow-y-auto space-y-1">
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
      </nav>

      {/* Collapse toggle */}
      <div className="px-2 py-3 border-t border-[#1e1e3a] flex-shrink-0">
        <button
          type="button"
          onClick={toggleSidebar}
          className="flex items-center justify-center w-full h-8 rounded-lg text-[#5c5878] hover:text-[#f0eef8] hover:bg-white/[0.06] transition-colors"
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
  if (pathname.startsWith('/dashboard/memory/matters')) return 'Matters';
  if (pathname.startsWith('/dashboard/memory/graph')) return 'Memory Graph';
  if (pathname.startsWith('/dashboard/memory/analytics')) return 'Analytics';
  if (pathname.startsWith('/dashboard/intelligence/search')) return 'Unified Search';
  if (pathname.startsWith('/dashboard/intelligence/investigations')) return 'Investigations';
  if (pathname.startsWith('/dashboard/intelligence/knowledge-graph')) return 'Knowledge Graph';
  if (pathname.startsWith('/dashboard/intelligence/chat')) return 'RAG Chat';
  return 'Platform';
}

function Header({ pathname }: Readonly<{ pathname: string }>) {
  const serviceStatus = useUIStore((s) => s.serviceStatus);
  const title = getPageTitle(pathname);

  return (
    <header className="h-14 bg-[#070710]/80 backdrop-blur-xl border-b border-[#1e1e3a] px-5 flex items-center justify-between flex-shrink-0 z-10">
      {/* Breadcrumb / page title */}
      <div className="flex items-center gap-3">
        <div className="w-1.5 h-1.5 rounded-full bg-[#F2A93B] shadow-[0_0_8px_rgba(242,169,59,0.8)]" />
        <h2 className="text-sm font-medium text-[#f0eef8] tracking-wide font-display">{title}</h2>
      </div>

      {/* Service status dots and theme toggle */}
      <div className="flex items-center gap-4">
        <ThemeToggle />
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-mono text-[#5c5878] tracking-widest uppercase">
            CRAWLER
          </span>
          <StatusDot variant={serviceStatus.crawler} />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-mono text-[#5c5878] tracking-widest uppercase">
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

  return (
    <MotionProvider>
      <Sidebar pathname={pathname} collapsed={collapsed} />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header pathname={pathname} />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </MotionProvider>
  );
}
