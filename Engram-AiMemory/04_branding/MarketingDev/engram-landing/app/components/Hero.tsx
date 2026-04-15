import Link from 'next/link';
import { ArrowRight, Brain, Network, Radar, ShieldCheck } from 'lucide-react';
import { Button } from './ui/Button';

const snapshots = [
  {
    label: 'Memory',
    value: '3-tier recall',
    detail: 'Project, operator, and shared memory with tenant isolation.',
    accent: 'var(--engram-amber)',
    icon: Brain,
  },
  {
    label: 'Crawler',
    value: 'OSINT intake',
    detail: 'Collection, ranking, and enrichment before storage.',
    accent: 'var(--engram-violet)',
    icon: Radar,
  },
  {
    label: 'MCP',
    value: 'Tool bridge',
    detail: 'Expose the same intelligence layer to agents and operators.',
    accent: 'var(--engram-teal)',
    icon: Network,
  },
  {
    label: 'Security',
    value: 'Self-hosted',
    detail: 'Tailscale-first access model with operational controls.',
    accent: 'var(--engram-rose)',
    icon: ShieldCheck,
  },
];

const proofStrip = [
  { value: '4', label: 'Connected surfaces' },
  { value: '< 10ms', label: 'Targeted vector lookup' },
  { value: '25+', label: 'MCP tools exposed' },
];

export function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-[var(--border)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(242,169,59,0.16),transparent_28%),radial-gradient(circle_at_80%_20%,rgba(46,196,196,0.12),transparent_30%),linear-gradient(180deg,#03020A_0%,#0B0919_40%,#120F2B_100%)]" />
      <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(255,193,94,0.55),transparent)]" />

      <div className="relative mx-auto grid max-w-7xl gap-14 px-4 py-18 sm:px-6 lg:grid-cols-[0.96fr_1.04fr] lg:items-center lg:px-8 lg:py-24">
        <div className="space-y-8">
          <div className="space-y-5">
            <p className="font-[var(--font-mono)] text-xs uppercase tracking-[0.34em] text-[var(--engram-amber)]">
              Self-Hosted Intelligence Operations
            </p>
            <h1 className="max-w-4xl font-[var(--font-display)] text-[clamp(2.9rem,7vw,5.6rem)] font-black leading-[0.95] tracking-[var(--tracking-tighter)] text-[var(--text-primary)]">
              Durable memory for agents.
              <span className="block text-[rgba(240,238,248,0.58)]">Operational control for teams.</span>
            </h1>
            <p className="max-w-xl text-base leading-8 text-[var(--text-secondary)] sm:text-lg">
              Engram connects persistent memory, crawling, MCP tooling, and a unified dashboard so
              your intelligence loop survives beyond a single chat window or one analyst session.
            </p>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row">
            <Link href="/dashboard">
              <Button size="lg" className="w-full gap-2 sm:w-auto">
                Launch Dashboard
                <ArrowRight size={18} />
              </Button>
            </Link>
            <Link href="/getting-started">
              <Button variant="ghost" size="lg" className="w-full border border-[var(--border)] sm:w-auto">
                Review Getting Started
              </Button>
            </Link>
          </div>

          <div className="grid gap-4 rounded-[2rem] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-5 shadow-[0_20px_80px_rgba(0,0,0,0.35)] sm:grid-cols-3">
            {proofStrip.map((item) => (
              <div key={item.label} className="rounded-[1.4rem] border border-[rgba(255,255,255,0.05)] bg-[rgba(8,6,22,0.92)] p-4">
                <p className="font-[var(--font-display)] text-3xl font-bold text-[var(--text-primary)]">
                  {item.value}
                </p>
                <p className="mt-1 font-[var(--font-mono)] text-[11px] uppercase tracking-[0.24em] text-[var(--text-muted)]">
                  {item.label}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-4">
          <div className="rounded-[2rem] border border-[var(--border)] bg-[rgba(10,8,26,0.8)] p-5 shadow-[0_30px_100px_rgba(0,0,0,0.4)]">
            <div className="grid gap-4 sm:grid-cols-2">
              {snapshots.map((item) => {
                const Icon = item.icon;

                return (
                  <div
                    key={item.label}
                    className="rounded-[1.5rem] border p-5"
                    style={{
                      borderColor: `${item.accent}55`,
                      background:
                        `linear-gradient(180deg, ${item.accent}18 0%, rgba(11,9,25,0.92) 38%)`,
                    }}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-[var(--font-mono)] text-[11px] uppercase tracking-[0.24em] text-[var(--text-muted)]">
                          {item.label}
                        </p>
                        <p className="mt-3 font-[var(--font-display)] text-2xl font-bold text-[var(--text-primary)]">
                          {item.value}
                        </p>
                      </div>
                      <div
                        className="flex h-11 w-11 items-center justify-center rounded-2xl"
                        style={{ backgroundColor: `${item.accent}22` }}
                      >
                        <Icon size={20} style={{ color: item.accent }} />
                      </div>
                    </div>
                    <p className="mt-4 text-sm leading-6 text-[var(--text-secondary)]">{item.detail}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-[2rem] border border-[var(--border)] bg-[linear-gradient(135deg,rgba(124,92,191,0.18),rgba(8,6,22,0.92),rgba(242,169,59,0.12))] p-6">
            <p className="font-[var(--font-mono)] text-xs uppercase tracking-[0.28em] text-[var(--engram-teal)]">
              Recommended Flow
            </p>
            <div className="mt-5 grid gap-3">
              {[
                'Land on the marketing site and align the operating model.',
                'Move into /dashboard for live crawler, memory, and system work.',
                'Use the knowledge base and security pages to support rollout decisions.',
              ].map((step, index) => (
                <div key={step} className="flex gap-4 rounded-[1.4rem] border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.04)] px-4 py-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[rgba(255,193,94,0.16)] font-[var(--font-mono)] text-sm text-[var(--engram-amber)]">
                    0{index + 1}
                  </div>
                  <p className="text-sm leading-6 text-[var(--text-secondary)]">{step}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
