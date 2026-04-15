import Link from 'next/link';
import {
  ArrowRight,
  Brain,
  Network,
  Radar,
  Sparkles,
  Workflow,
} from 'lucide-react';
import { Hero } from './components';
import { Button } from './components/ui/Button';
import { products } from './lib/platform-data';

const productIcons = {
  Brain,
  Globe: Radar,
  Server: Network,
  LayoutDashboard: Workflow,
} as const;

const operatingLoop = [
  {
    step: '01',
    title: 'Collect',
    body: 'Capture web, entity, and operator inputs through crawler and platform ingestion flows.',
  },
  {
    step: '02',
    title: 'Store',
    body: 'Persist high-signal context into tiered memory with tenant-aware retrieval semantics.',
  },
  {
    step: '03',
    title: 'Expose',
    body: 'Publish the same intelligence surfaces through MCP for agents and through the dashboard for operators.',
  },
  {
    step: '04',
    title: 'Operate',
    body: 'Monitor system health, investigations, and retrieval quality from the unified dashboard.',
  },
];

const solutionCards = [
  {
    title: 'Agent Memory',
    body: 'Give internal agents durable project and operator context instead of forcing them to rediscover state.',
  },
  {
    title: 'Investigation Ops',
    body: 'Run crawler, memory, and intelligence work from one surface when cases move faster than tabs can keep up.',
  },
  {
    title: 'Knowledge Operations',
    body: 'Keep documents, extracted entities, and learned patterns in one retrievable operational layer.',
  },
  {
    title: 'Self-Hosted AI Control',
    body: 'Keep the stack on infrastructure you control while exposing the useful pieces through MCP and the dashboard.',
  },
];

const trustSignals = [
  {
    title: 'Network-first deployment model',
    body: 'The intended operating posture is private networking and controlled service exposure instead of public-by-default tooling.',
    href: '/security',
  },
  {
    title: 'Explicit rollout path',
    body: 'Marketing, documentation, security posture, and dashboard entry are now separate surfaces with a clear order.',
    href: '/contact',
  },
];

function SectionIntro({
  eyebrow,
  title,
  body,
}: {
  eyebrow: string;
  title: string;
  body: string;
}) {
  return (
    <div className="max-w-3xl space-y-4">
      <p className="font-[var(--font-mono)] text-xs uppercase tracking-[0.28em] text-[var(--engram-amber)]">
        {eyebrow}
      </p>
      <h2 className="font-[var(--font-display)] text-3xl font-bold tracking-[var(--tracking-tight)] text-[var(--text-primary)] sm:text-4xl">
        {title}
      </h2>
      <p className="text-base leading-8 text-[var(--text-secondary)] sm:text-lg">{body}</p>
    </div>
  );
}

export default function Home() {
  return (
    <>
      <Hero />

      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
        <div className="grid gap-10 lg:grid-cols-[0.92fr_1.08fr] lg:items-start">
          <SectionIntro
            eyebrow="Connected Surfaces"
            title="One operating model across memory, crawling, MCP, and the dashboard."
            body="The services stay independent, but the experience no longer forces people to guess where to begin. The landing site frames the system, and /dashboard is where live work begins."
          />

          <div className="grid gap-4 sm:grid-cols-2">
            {products.map((product) => {
              const Icon = productIcons[product.icon as keyof typeof productIcons] ?? Sparkles;
              const href = product.slug === 'dashboard' ? '/dashboard' : `/platform/${product.slug}`;
              const accent = `var(--engram-${product.color})`;
              const summary = product.features[0]?.description ?? product.description;

              return (
                <Link
                  key={product.slug}
                  href={href}
                  className="group rounded-[1.8rem] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-6 transition-all duration-300 hover:-translate-y-1 hover:border-[rgba(255,193,94,0.5)] hover:bg-[rgba(255,255,255,0.05)]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-[var(--font-mono)] text-[11px] uppercase tracking-[0.24em] text-[var(--text-muted)]">
                        {product.tagline}
                      </p>
                      <h3 className="mt-3 font-[var(--font-display)] text-2xl font-bold text-[var(--text-primary)]">
                        {product.name}
                      </h3>
                    </div>
                    <div
                      className="flex h-11 w-11 items-center justify-center rounded-2xl"
                      style={{ backgroundColor: `${accent}22` }}
                    >
                      <Icon size={20} style={{ color: accent }} />
                    </div>
                  </div>
                  <p className="mt-4 text-sm leading-7 text-[var(--text-secondary)]">{summary}</p>
                  <div className="mt-6 flex items-center justify-between border-t border-[var(--border)] pt-4">
                    <span className="font-[var(--font-mono)] text-[11px] uppercase tracking-[0.22em] text-[var(--text-muted)]">
                      Port {product.port}
                    </span>
                    <span className="inline-flex items-center gap-2 text-sm text-[var(--engram-amber)]">
                      Open
                      <ArrowRight size={16} className="transition-transform duration-300 group-hover:translate-x-1" />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section className="border-y border-[var(--border)] bg-[rgba(255,255,255,0.02)]">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
          <SectionIntro
            eyebrow="Operating Loop"
            title="Move from collection to retrieval without breaking context."
            body="This is the actual product story: collect signal, persist it, expose it to tools, then operate it from a shared dashboard. The IA now reflects that loop instead of scattering it."
          />

          <div className="mt-12 grid gap-4 lg:grid-cols-4">
            {operatingLoop.map((item) => (
              <div
                key={item.step}
                className="rounded-[1.8rem] border border-[var(--border)] bg-[linear-gradient(180deg,rgba(124,92,191,0.14),rgba(8,6,22,0.9))] p-6"
              >
                <p className="font-[var(--font-mono)] text-xs uppercase tracking-[0.3em] text-[var(--engram-amber)]">
                  {item.step}
                </p>
                <h3 className="mt-5 font-[var(--font-display)] text-2xl font-bold text-[var(--text-primary)]">
                  {item.title}
                </h3>
                <p className="mt-4 text-sm leading-7 text-[var(--text-secondary)]">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
        <div className="grid gap-10 lg:grid-cols-[1fr_1fr]">
          <div className="space-y-8 rounded-[2rem] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-8">
            <SectionIntro
              eyebrow="Deployment Tracks"
              title="Choose the track that matches the pressure you are under."
              body="Some teams need persistent agent memory first. Others need investigator tooling or a consolidated operations surface. The solutions page now makes those entry points explicit."
            />

            <div className="grid gap-4">
              {solutionCards.map((item) => (
                <div
                  key={item.title}
                  className="rounded-[1.4rem] border border-[rgba(255,255,255,0.06)] bg-[rgba(8,6,22,0.84)] p-5"
                >
                  <h3 className="font-[var(--font-display)] text-xl font-semibold text-[var(--text-primary)]">
                    {item.title}
                  </h3>
                  <p className="mt-3 text-sm leading-7 text-[var(--text-secondary)]">{item.body}</p>
                </div>
              ))}
            </div>

            <Link href="/solutions">
              <Button variant="ghost" size="md" className="border border-[var(--border)]">
                Explore Solutions
              </Button>
            </Link>
          </div>

          <div className="space-y-6 rounded-[2rem] border border-[var(--border)] bg-[linear-gradient(145deg,rgba(46,196,196,0.12),rgba(8,6,22,0.92),rgba(224,92,127,0.12))] p-8">
            <SectionIntro
              eyebrow="Trust Layer"
              title="Security and rollout guidance now live in dedicated pages."
              body="The previous landing page buried critical deployment information. Security posture, rollout sequencing, and the next operator action now have their own destinations."
            />

            <div className="grid gap-4">
              {trustSignals.map((item) => (
                <Link
                  key={item.title}
                  href={item.href}
                  className="group rounded-[1.6rem] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] p-5 transition-all duration-300 hover:border-[var(--engram-amber)]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-[var(--font-display)] text-xl font-semibold text-[var(--text-primary)]">
                        {item.title}
                      </h3>
                      <p className="mt-3 text-sm leading-7 text-[var(--text-secondary)]">
                        {item.body}
                      </p>
                    </div>
                    <ArrowRight
                      size={18}
                      className="mt-1 shrink-0 text-[var(--engram-amber)] transition-transform duration-300 group-hover:translate-x-1"
                    />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-[var(--border)] bg-[rgba(255,255,255,0.02)]">
        <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-20 sm:px-6 lg:flex-row lg:items-end lg:justify-between lg:px-8 lg:py-24">
          <div className="max-w-3xl space-y-4">
            <p className="font-[var(--font-mono)] text-xs uppercase tracking-[0.28em] text-[var(--engram-amber)]">
              Start Here
            </p>
            <h2 className="font-[var(--font-display)] text-3xl font-bold tracking-[var(--tracking-tight)] text-[var(--text-primary)] sm:text-4xl">
              Use the landing site to orient. Use <span className="text-[var(--engram-amber)]">/dashboard</span> to operate.
            </h2>
            <p className="text-base leading-8 text-[var(--text-secondary)] sm:text-lg">
              That split is now intentional in the routing, in the IA, and in the design. If the
              services are up, go straight to the dashboard. If you need architecture, security, or
              rollout context first, the marketing site now gives it to you without the clutter.
            </p>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row">
            <Link href="/dashboard">
              <Button size="lg" className="w-full gap-2 sm:w-auto">
                Open /dashboard
                <ArrowRight size={18} />
              </Button>
            </Link>
            <Link href="/contact">
              <Button variant="ghost" size="lg" className="w-full border border-[var(--border)] sm:w-auto">
                Plan A Rollout
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
