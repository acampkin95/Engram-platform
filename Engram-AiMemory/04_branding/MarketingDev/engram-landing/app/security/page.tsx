import Link from 'next/link';
import { ArrowRight, LockKeyhole, Radar, ServerCrash, ShieldCheck } from 'lucide-react';
import { Button } from '@/app/components/ui/Button';

const controlAreas = [
  {
    title: 'Network boundaries',
    body: 'The intended posture is private networking and reverse-proxy control, with the marketing site at the root and dashboard operations segmented at /dashboard.',
    icon: ShieldCheck,
    accent: 'var(--engram-amber)',
  },
  {
    title: 'Service exposure',
    body: 'Dashboard-only routes, internal auth flows, platform APIs, and shared assets now have explicit proxy handling instead of leaking through the landing surface.',
    icon: LockKeyhole,
    accent: 'var(--engram-violet)',
  },
  {
    title: 'Operational visibility',
    body: 'System health, notifications, and controller actions remain inside the unified dashboard and its internal APIs, rather than being buried in the marketing experience.',
    icon: Radar,
    accent: 'var(--engram-teal)',
  },
];

const roadmap = [
  'Encryption at rest for Weaviate and Redis remains an active follow-up item.',
  'Security hotspot review is still open and should be part of rollout acceptance.',
  'MFA and additional admin hardening are planned next-stage controls.',
];

export default function SecurityPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
      <section className="grid gap-10 lg:grid-cols-[1fr_0.85fr]">
        <div className="space-y-5">
          <p className="font-[var(--font-mono)] text-xs uppercase tracking-[0.3em] text-[var(--engram-amber)]">
            Security
          </p>
          <h1 className="font-[var(--font-display)] text-5xl font-black tracking-[var(--tracking-tight)] text-[var(--text-primary)] sm:text-6xl">
            Trust the split between the public front door and the live operations surface.
          </h1>
          <p className="text-lg leading-8 text-[var(--text-secondary)]">
            The revised experience makes the operating boundary legible. Marketing content explains
            the system. The dashboard handles live work. The proxy and deployment model now reflect
            that separation instead of blurring it.
          </p>
        </div>

        <div className="rounded-[2rem] border border-[var(--border)] bg-[linear-gradient(145deg,rgba(224,92,127,0.18),rgba(8,6,22,0.92),rgba(46,196,196,0.12))] p-8">
          <div className="flex items-center gap-3">
            <ServerCrash className="text-[var(--engram-rose)]" size={22} />
            <p className="font-[var(--font-mono)] text-xs uppercase tracking-[0.26em] text-[var(--engram-rose)]">
              Current Hardening View
            </p>
          </div>
          <p className="mt-5 text-base leading-8 text-[var(--text-secondary)]">
            This page intentionally describes both what is in place and what is still open. It is
            not useful to pretend the roadmap items are already closed.
          </p>
        </div>
      </section>

      <section className="mt-16 grid gap-5 lg:grid-cols-3">
        {controlAreas.map((item) => {
          const Icon = item.icon;
          return (
            <article
              key={item.title}
              className="rounded-[2rem] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-7"
            >
              <div
                className="flex h-12 w-12 items-center justify-center rounded-2xl"
                style={{ backgroundColor: `${item.accent}22` }}
              >
                <Icon size={20} style={{ color: item.accent }} />
              </div>
              <h2 className="mt-6 font-[var(--font-display)] text-2xl font-bold text-[var(--text-primary)]">
                {item.title}
              </h2>
              <p className="mt-4 text-sm leading-7 text-[var(--text-secondary)]">{item.body}</p>
            </article>
          );
        })}
      </section>

      <section className="mt-16 rounded-[2rem] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-8">
        <p className="font-[var(--font-mono)] text-xs uppercase tracking-[0.28em] text-[var(--engram-amber)]">
          Open Work
        </p>
        <h2 className="mt-4 font-[var(--font-display)] text-4xl font-bold text-[var(--text-primary)]">
          Hardening items still on the roadmap
        </h2>
        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          {roadmap.map((item) => (
            <div
              key={item}
              className="rounded-[1.5rem] border border-[rgba(255,255,255,0.06)] bg-[rgba(8,6,22,0.88)] px-5 py-5 text-sm leading-7 text-[var(--text-secondary)]"
            >
              {item}
            </div>
          ))}
        </div>
      </section>

      <section className="mt-16 flex flex-col gap-4 sm:flex-row">
        <Link href="/knowledge-base">
          <Button variant="ghost" size="lg" className="w-full border border-[var(--border)] sm:w-auto">
            Review Knowledge Base
          </Button>
        </Link>
        <Link href="/contact">
          <Button size="lg" className="w-full gap-2 sm:w-auto">
            Plan Deployment Review
            <ArrowRight size={18} />
          </Button>
        </Link>
      </section>
    </main>
  );
}
