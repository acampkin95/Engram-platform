'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { Button } from './ui/Button';
import { primaryNavigation } from '@/app/lib/site-data';

function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Navigation() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-[rgba(3,2,10,0.84)] backdrop-blur-2xl">
      <div className="border-b border-[rgba(255,255,255,0.04)]">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-4 py-3 text-xs sm:px-6 lg:px-8">
          <p className="font-[var(--font-mono)] uppercase tracking-[0.28em] text-[var(--engram-amber)]">
            Memory Front Door
          </p>
          <p className="hidden text-right font-[var(--font-mono)] uppercase tracking-[0.2em] text-[var(--text-muted)] sm:block">
            Landing at /, unified dashboard at /dashboard
          </p>
        </div>
      </div>

      <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--engram-amber)] shadow-[0_0_30px_rgba(242,169,59,0.18)]">
              <div className="h-3.5 w-3.5 rounded-full bg-[var(--void)]" />
            </div>
            <div>
              <p className="font-[var(--font-display)] text-lg font-bold tracking-[0.24em] text-[var(--engram-amber)]">
                ENGRAM
              </p>
              <p className="font-[var(--font-mono)] text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                Unified Intelligence Platform
              </p>
            </div>
          </Link>
        </div>

        <nav className="hidden items-center gap-2 lg:flex" aria-label="Primary navigation">
          {primaryNavigation.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-full px-4 py-2 text-sm transition-all duration-200 ${
                  active
                    ? 'bg-[rgba(242,169,59,0.14)] text-[var(--engram-amber)]'
                    : 'text-[var(--text-secondary)] hover:bg-[rgba(255,255,255,0.05)] hover:text-[var(--text-primary)]'
                }`}
                aria-current={active ? 'page' : undefined}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <Link href="/getting-started">
            <Button variant="ghost" size="sm">
              Docs
            </Button>
          </Link>
          <Link href="/dashboard">
            <Button size="sm">Launch Dashboard</Button>
          </Link>
        </div>

        <button
          type="button"
          className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--border)] bg-[rgba(255,255,255,0.04)] text-[var(--text-primary)] lg:hidden"
          onClick={() => setIsOpen((value) => !value)}
          aria-expanded={isOpen}
          aria-controls="mobile-site-nav"
          aria-label={isOpen ? 'Close menu' : 'Open menu'}
        >
          {isOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {isOpen && (
        <div id="mobile-site-nav" className="border-t border-[var(--border)] bg-[rgba(6,4,20,0.98)] lg:hidden">
          <div className="mx-auto grid max-w-7xl gap-3 px-4 py-4 sm:px-6">
            {primaryNavigation.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  className={`rounded-2xl border px-4 py-4 ${
                    active
                      ? 'border-[var(--engram-amber)] bg-[rgba(242,169,59,0.12)]'
                      : 'border-[var(--border)] bg-[rgba(255,255,255,0.03)]'
                  }`}
                >
                  <p className="font-[var(--font-display)] text-lg font-semibold text-[var(--text-primary)]">
                    {item.label}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">{item.blurb}</p>
                </Link>
              );
            })}

            <div className="grid gap-3 pt-2">
              <Link href="/getting-started" onClick={() => setIsOpen(false)}>
                <Button variant="ghost" size="sm" className="w-full justify-center">
                  Open Docs
                </Button>
              </Link>
              <Link href="/dashboard" onClick={() => setIsOpen(false)}>
                <Button size="sm" className="w-full justify-center">
                  Launch Dashboard
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
