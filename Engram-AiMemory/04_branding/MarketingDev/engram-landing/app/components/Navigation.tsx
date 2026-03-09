'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from './ui/Button';

interface NavItem {
  label: string;
  href: string;
  icon?: React.ReactNode;
}

const navItems: NavItem[] = [
  { label: 'Home', href: '/' },
  { label: 'Features', href: '#features' },
  { label: 'Architecture', href: '#architecture' },
  { label: 'Use Cases', href: '#use-cases' },
  { label: 'Documentation', href: '/docs' },
  { label: 'API Reference', href: '/api' },
  { label: 'Examples', href: '/examples' },
  { label: 'GitHub', href: 'https://github.com/engram/engram' },
];

export function Navigation() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  return (
    <>
      {/* Mobile Menu Button */}
      <Button
        variant="ghost"
        size="sm"
        className="fixed top-4 left-4 z-50 md:hidden"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="w-5 h-5 flex flex-col justify-center gap-1">
          <div className={`h-0.5 w-full bg-[var(--text-primary)] transition-transform ${isOpen ? 'rotate-45 translate-y-1.5' : ''}`} />
          <div className={`h-0.5 w-full bg-[var(--text-primary)] transition-opacity ${isOpen ? 'opacity-0' : ''}`} />
          <div className={`h-0.5 w-full bg-[var(--text-primary)] transition-transform ${isOpen ? '-rotate-45 -translate-y-1.5' : ''}`} />
        </div>
      </Button>

      {/* Navigation Sidebar */}
      <nav className={`
        fixed left-0 top-0 h-screen bg-[var(--deep)] border-r border-[var(--border)] z-40
        transition-transform duration-300 ease-in-out
        w-[260px] -translate-x-full md:translate-x-0
        ${isOpen ? 'translate-x-0' : ''}
      `}>
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
              Multi-layer AI Memory System
            </p>
          </div>

          {/* Navigation Items */}
          <div className="flex-1 p-4 overflow-y-auto">
            <div className="space-y-1">
              {navItems.map((item) => {
                const isActive = pathname === item.href || 
                               (item.href.startsWith('#') && typeof window !== 'undefined' && 
                                window.location.hash === item.href);
                
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`
                      flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200
                      font-[var(--font-mono)] text-sm
                      ${isActive 
                        ? 'bg-[var(--engram-amber-glow)] text-[var(--engram-amber)] border border-[var(--border-amber)]' 
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-1)]'
                      }
                    `}
                    onClick={() => setIsOpen(false)}
                  >
                    {item.icon && <span className="w-4 h-4">{item.icon}</span>}
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-[var(--border)]">
            <Button variant="primary" size="sm" className="w-full">
              Get Started
            </Button>
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
