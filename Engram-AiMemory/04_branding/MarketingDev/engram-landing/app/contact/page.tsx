import Link from 'next/link';
import { ArrowRight, ClipboardList, LayoutDashboard, ShieldCheck, Workflow } from 'lucide-react';
import { Button } from '@/app/components/ui/Button';

const engagementPaths = [
  {
    title: 'Deployment planning',
    body: 'Use this when you need to align infrastructure, services, and docs before operators touch the live dashboard.',
    icon: Workflow,
  },
  {
    title: 'Security review',
    body: 'Use this when the next gate is stakeholder confidence around access patterns, service boundaries, and open hardening items.',
    icon: ShieldCheck,
  },
  {
    title: 'Operational onboarding',
    body: 'Use this when services are already running and the team needs a clear handoff into /dashboard and the system workflows behind it.',
    icon: LayoutDashboard,
  },
];

const checklist = [
  'Confirm which service is the first production dependency: memory, crawler, MCP, or dashboard.',
  'Validate environment variables, auth posture, and reverse-proxy routing before inviting operators.',
  'Choose the dashboard workflows that must be ready on day one and ignore nice-to-have paths until later.',
];

export default function ContactPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
      <section className="grid gap-10 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-5">
          <p className="font-[var(--font-mono)] text-xs uppercase tracking-[0.3em] text-[var(--engram-amber)]">
            Rollout Planning
          </p>
          <h1 className="font-[var(--font-display)] text-5xl font-black tracking-[var(--tracking-tight)] text-[var(--text-primary)] sm:text-6xl">
            Choose the next action instead of dumping every decision onto the home page.
          </h1>
          <p className="text-lg leading-8 text-[var(--text-secondary)]">
            This page exists because the revised marketing flow needs an end state: docs, security,
            and dashboard entry are separate, and rollout conversations need a place to converge.
          </p>
        </div>

        <div className="rounded-[2rem] border border-[var(--border)] bg-[linear-gradient(135deg,rgba(242,169,59,0.16),rgba(8,6,22,0.92),rgba(124,92,191,0.16))] p-8">
          <div className="flex items-center gap-3">
            <ClipboardList className="text-[var(--engram-amber)]" size={22} />
            <p className="font-[var(--font-mono)] text-xs uppercase tracking-[0.26em] text-[var(--engram-amber)]">
              Fast Path
            </p>
          </div>
          <p className="mt-5 text-2xl font-semibold leading-10 text-[var(--text-primary)]">
            If the stack is already running, the next move is to open <span className="text-[var(--engram-amber)]">/dashboard</span>.
          </p>
          <p className="mt-4 text-base leading-8 text-[var(--text-secondary)]">
            If it is not running yet, start with the getting started guide and use the security page
            to review the intended operating posture before you expose the system to users.
          </p>
        </div>
      </section>

      <section className="mt-16 grid gap-5 lg:grid-cols-3">
        {engagementPaths.map((item) => {
          const Icon = item.icon;
          return (
            <article
              key={item.title}
              className="rounded-[2rem] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-7"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[rgba(255,193,94,0.14)]">
                <Icon size={20} className="text-[var(--engram-amber)]" />
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
          Operator Checklist
        </p>
        <div className="mt-8 grid gap-4">
          {checklist.map((item, index) => (
            <div
              key={item}
              className="flex gap-4 rounded-[1.5rem] border border-[rgba(255,255,255,0.06)] bg-[rgba(8,6,22,0.88)] px-5 py-5"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[rgba(255,193,94,0.16)] font-[var(--font-mono)] text-sm text-[var(--engram-amber)]">
                0{index + 1}
              </div>
              <p className="text-sm leading-7 text-[var(--text-secondary)]">{item}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-16 flex flex-col gap-4 sm:flex-row">
        <Link href="/getting-started">
          <Button variant="ghost" size="lg" className="w-full border border-[var(--border)] sm:w-auto">
            Open Getting Started
          </Button>
        </Link>
        <Link href="/dashboard">
          <Button size="lg" className="w-full gap-2 sm:w-auto">
            Open Dashboard
            <ArrowRight size={18} />
          </Button>
        </Link>
      </section>
    </main>
  );
}
