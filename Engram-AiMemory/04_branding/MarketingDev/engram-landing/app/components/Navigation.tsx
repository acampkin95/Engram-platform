'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from './ui/Button';
import {
  Home,
  Layers,
  Brain,
  Globe,
  Server,
  LayoutDashboard,
  BookOpen,
  Rocket,
  Code,
  GitBranch,
  ChevronRight,
  GitCommit,
} from 'lucide-react';

interface NavSection {
  label: string;
  items: NavItem[];
}

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  external?: boolean;
  dotColor?: string;
}

const navSections: NavSection[] = [
  {
    label: 'OVERVIEW',
    items: [
      { label: 'Home', href: '/', icon: <Home size={16} /> },
      { label: 'Platform', href: '/platform', icon: <Layers size={16} /> },
    ],
  },
  {
    label: 'PRODUCTS',
    items: [
      {
        label: 'AiMemory',
        href: '/platform/memory',
        icon: <Brain size={16} />,
        dotColor: 'var(--engram-amber)',
      },
      {
        label: 'AiCrawler',
        href: '/platform/crawler',
        icon: <Globe size={16} />,
        dotColor: 'var(--engram-violet)',
      },
      {
        label: 'MCP Server',
        href: '/platform/mcp',
        icon: <Server size={16} />,
        dotColor: 'var(--engram-teal)',
      },
      {
        label: 'Dashboard',
        href: '/platform/dashboard',
        icon: <LayoutDashboard size={16} />,
        dotColor: 'var(--engram-rose)',
      },
    ],
  },
  {
    label: 'RESOURCES',
    items: [
      {
        label: 'Knowledge Base',
        href: '/knowledge-base',
        icon: <BookOpen size={16} />,
      },
      {
        label: 'Getting Started',
        href: '/getting-started',
        icon: <Rocket size={16} />,
      },
      { label: 'API Reference', href: '/knowledge-base/api-reference', icon: <Code size={16} /> },
      {
        label: 'GitHub',
        href: 'https://github.com/engram',
        icon: <GitCommit size={16} />,
        external: true,
      },
      {
        label: 'Launch Dashboard',
        href: 'https://memory.velocitydigi.com',
        icon: <LayoutDashboard size={16} />,
        external: true,
      },
    ],
  },
];

interface NavItemProps {
  item: NavItem;
  isActive: boolean;
}

function NavItemComponent({ item, isActive }: NavItemProps) {
  const content = (
    <div className="flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 font-[var(--font-mono)] text-sm relative">
      {item.dotColor && (
        <div
          className="absolute left-0 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full opacity-0 transition-opacity duration-200"
          style={{
            backgroundColor: item.dotColor,
            opacity: isActive ? 1 : 0.4,
          }}
        />
      )}

      <span className="w-4 h-4 flex-shrink-0">{item.icon}</span>
      <span className="flex-1">{item.label}</span>

      {isActive && (
        <ChevronRight size={14} className="opacity-60 flex-shrink-0" />
      )}
    </div>
  );

  const baseClasses = `
    flex w-full text-left transition-all duration-200
    font-[var(--font-mono)] text-sm
    ${
      isActive
        ? 'text-[var(--engram-amber)] bg-[var(--engram-amber-glow)] border-l-2 border-[var(--engram-amber)] rounded-lg'
        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-1)]'
    }
  `;

  if (item.external) {
    return (
      <a href={item.href} target="_blank" rel="noopener noreferrer" aria-label={`${item.label} (opens in new tab)`} className={baseClasses}>
        {content}
      </a>
    );
  }

  return (
    <Link href={item.href} className={baseClasses} aria-current={isActive ? 'page' : undefined}>
      {content}
    </Link>
  );
}

export function Navigation() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed top-4 left-4 z-50 md:hidden p-2 hover:bg-[var(--surface-1)] rounded-lg transition-colors"
        aria-label="Toggle navigation"
      >
        <div className="w-5 h-5 flex flex-col justify-center gap-1">
          <div
            className={`h-0.5 w-full bg-[var(--text-primary)] transition-transform ${
              isOpen ? 'rotate-45 translate-y-1.5' : ''
            }`}
          />
          <div
            className={`h-0.5 w-full bg-[var(--text-primary)] transition-opacity ${
              isOpen ? 'opacity-0' : ''
            }`}
          />
          <div
            className={`h-0.5 w-full bg-[var(--text-primary)] transition-transform ${
              isOpen ? '-rotate-45 -translate-y-1.5' : ''
            }`}
          />
        </div>
      </button>

      {/* Navigation Sidebar */}
      <nav
        className={`
          fixed left-0 top-0 h-screen bg-[var(--deep)] border-r border-[var(--border)] z-40
          transition-transform duration-300 ease-in-out
          w-[280px] -translate-x-full md:translate-x-0
          ${isOpen ? 'translate-x-0' : ''}
        `}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="p-8 border-b border-[var(--border)]">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="w-8 h-8 bg-[var(--engram-amber)] rounded-full flex items-center justify-center">
                <div className="w-3 h-3 bg-[var(--void)] rounded-full animate-[synapseFlare_2.5s_ease-in-out_infinite]" />
              </div>
              <span className="font-[var(--font-display)] font-bold text-xl tracking-[0.2em] text-[var(--engram-amber)]">
                ENGRAM
              </span>
            </Link>
            <p className="font-[var(--font-mono)] text-xs text-[var(--text-muted)] uppercase tracking-[0.12em] mt-2">
              Unified AI Intelligence Platform
            </p>
          </div>

          {/* Navigation Sections */}
          <div className="flex-1 p-4 overflow-y-auto space-y-6">
            {navSections.map((section) => (
              <div key={section.label}>
                <h3 className="font-[var(--font-mono)] text-xs font-bold uppercase tracking-wider text-[var(--engram-amber)] px-4 mb-3">
                  {section.label}
                </h3>
                <div className="space-y-1">
                  {section.items.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                      <NavItemComponent
                        key={item.href}
                        item={item}
                        isActive={isActive}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-[var(--border)] space-y-2">
            <Link href="/getting-started" className="block">
              <Button variant="primary" size="sm" className="w-full">
                Get Started
              </Button>
            </Link>
            <a href="https://memory.velocitydigi.com" target="_blank" rel="noopener noreferrer" className="block">
              <Button variant="secondary" size="sm" className="w-full">
                Launch Dashboard
              </Button>
            </a>
          </div>
        </div>
      </nav>

      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-[var(--void)]/80 backdrop-blur-sm z-30 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
