import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { primaryNavigation, secondaryNavigation } from '@/app/lib/site-data';

const platformLinks = [
  { href: '/platform/memory', label: 'AiMemory' },
  { href: '/platform/crawler', label: 'AiCrawler' },
  { href: '/platform/mcp', label: 'MCP Server' },
  { href: '/dashboard', label: 'Unified Dashboard' },
];

export function Footer() {
  return (
    <footer className="border-t border-[var(--border)] bg-[rgba(6,4,20,0.94)]">
      <div className="mx-auto flex max-w-7xl flex-col gap-10 px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-8 rounded-[2rem] border border-[var(--border)] bg-[linear-gradient(135deg,rgba(255,193,94,0.12),rgba(10,8,26,0.84),rgba(46,196,196,0.12))] p-8 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-4">
            <p className="font-[var(--font-mono)] text-xs uppercase tracking-[0.3em] text-[var(--engram-amber)]">
              Ready To Operate
            </p>
            <h2 className="font-[var(--font-display)] text-3xl font-bold tracking-[var(--tracking-tight)] text-[var(--text-primary)] sm:text-4xl">
              Bring the memory loop, crawler pipeline, and unified dashboard online from the same surface.
            </h2>
            <p className="max-w-2xl text-base leading-7 text-[var(--text-secondary)]">
              Start with the docs if you need the architecture. Jump into the dashboard if you already
              have the services running. The path is explicit either way.
            </p>
          </div>

          <div className="grid gap-3 self-start">
            {secondaryNavigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="group flex items-center justify-between rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.04)] px-5 py-4 transition-all duration-300 hover:border-[var(--engram-amber)] hover:bg-[rgba(255,255,255,0.07)]"
              >
                <div>
                  <p className="font-[var(--font-display)] text-lg font-semibold text-[var(--text-primary)]">
                    {item.label}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">{item.blurb}</p>
                </div>
                <ArrowUpRight
                  className="shrink-0 text-[var(--engram-amber)] transition-transform duration-300 group-hover:-translate-y-1 group-hover:translate-x-1"
                  size={20}
                />
              </Link>
            ))}
          </div>
        </div>

        <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr_0.9fr]">
          <div className="space-y-4">
            <Link href="/" className="inline-flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--engram-amber)]">
                <div className="h-3.5 w-3.5 rounded-full bg-[var(--void)]" />
              </div>
              <div>
                <p className="font-[var(--font-display)] text-xl font-bold tracking-[0.24em] text-[var(--engram-amber)]">
                  ENGRAM
                </p>
                <p className="font-[var(--font-mono)] text-xs uppercase tracking-[0.24em] text-[var(--text-muted)]">
                  Unified Intelligence Platform
                </p>
              </div>
            </Link>
            <p className="max-w-md text-sm leading-7 text-[var(--text-secondary)]">
              Self-hosted memory, investigation, and MCP operations for teams that need a durable
              intelligence layer instead of another disposable chat session.
            </p>
          </div>

          <div>
            <p className="font-[var(--font-mono)] text-xs uppercase tracking-[0.26em] text-[var(--engram-amber)]">
              Explore
            </p>
            <div className="mt-4 grid gap-3">
              {primaryNavigation.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="text-sm text-[var(--text-secondary)] transition-colors duration-200 hover:text-[var(--text-primary)]"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>

          <div>
            <p className="font-[var(--font-mono)] text-xs uppercase tracking-[0.26em] text-[var(--engram-amber)]">
              Surfaces
            </p>
            <div className="mt-4 grid gap-3">
              {platformLinks.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="text-sm text-[var(--text-secondary)] transition-colors duration-200 hover:text-[var(--text-primary)]"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t border-[var(--border)] pt-6 text-sm text-[var(--text-muted)] sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 ENGRAM Platform. Built for self-hosted intelligence operations.</p>
          <p>Apache 2.0 licensed core, unified dashboard available at /dashboard.</p>
        </div>
      </div>
    </footer>
  );
}
