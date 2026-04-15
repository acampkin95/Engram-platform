import Link from 'next/link';
import { ArrowRight, Brain, Network, Radar, ShieldCheck } from 'lucide-react';
import { Button } from '@/app/components/ui/Button';

const tracks = [
  {
    title: 'Persistent Agent Memory',
    icon: Brain,
    accent: 'var(--engram-amber)',
    summary:
      'For teams that need agents to retain project context, operator preferences, and reusable knowledge instead of starting cold every session.',
    bullets: [
      'Project, general, and shared memory tiers.',
      'RAG-ready retrieval for operators and agents.',
      'A dashboard view for validating what the memory layer is doing.',
    ],
  },
  {
    title: 'Investigation Operations',
    icon: Radar,
    accent: 'var(--engram-violet)',
    summary:
      'For analysts running crawler, OSINT, and intelligence workflows where collection and case management need to sit closer together.',
    bullets: [
      'Crawler intake and investigation surfaces in one place.',
      'Memory-backed entity and timeline context.',
      'A clearer handoff from intake to analysis to recall.',
    ],
  },
  {
    title: 'MCP Tool Surface',
    icon: Network,
    accent: 'var(--engram-teal)',
    summary:
      'For teams already using agent clients and needing a controlled bridge into memory and system functions over MCP.',
    bullets: [
      'Expose the memory layer through MCP instead of bespoke glue.',
      'Keep one operational definition across UI and tool clients.',
      'Support local operators and AI clients from the same intelligence backbone.',
    ],
  },
  {
    title: 'Self-Hosted Governance',
    icon: ShieldCheck,
    accent: 'var(--engram-rose)',
    summary:
      'For platform owners who need the deployment, security posture, and next actions framed before opening the live dashboard.',
    bullets: [
      'Dedicated security and rollout pages for stakeholder review.',
      'Dashboard entry moved to a deliberate /dashboard surface.',
      'Support for Tailscale-first private operating patterns.',
    ],
  },
];

const rolloutPhases = [
  {
    phase: 'Phase 1',
    title: 'Stand up the core services',
    body: 'Bring up memory, crawler, MCP, and the unified dashboard through the compose stack. Validate health before user onboarding.',
  },
  {
    phase: 'Phase 2',
    title: 'Decide the first workflow',
    body: 'Choose whether your first real deployment is agent memory, investigation operations, or documentation-backed knowledge retrieval.',
  },
  {
    phase: 'Phase 3',
    title: 'Operationalize from the dashboard',
    body: 'Use /dashboard as the single control plane while the landing site and docs support onboarding, trust, and rollout conversations.',
  },
];

export default function SolutionsPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
      <section className="grid gap-10 lg:grid-cols-[0.92fr_1.08fr] lg:items-end">
        <div className="space-y-5">
          <p className="font-[var(--font-mono)] text-xs uppercase tracking-[0.3em] text-[var(--engram-amber)]">
            Solutions
          </p>
          <h1 className="font-[var(--font-display)] text-5xl font-black tracking-[var(--tracking-tight)] text-[var(--text-primary)] sm:text-6xl">
            Pick the deployment track that matches the pressure you are solving.
          </h1>
          <p className="text-lg leading-8 text-[var(--text-secondary)]">
            The marketing flow now separates product explanation from live operations. These tracks
            make the likely first deployment paths explicit so teams stop guessing where Engram fits.
          </p>
        </div>

        <div className="rounded-[2rem] border border-[var(--border)] bg-[linear-gradient(135deg,rgba(124,92,191,0.16),rgba(8,6,22,0.9),rgba(242,169,59,0.12))] p-8">
          <p className="font-[var(--font-mono)] text-xs uppercase tracking-[0.28em] text-[var(--engram-teal)]">
            Outcome
          </p>
          <p className="mt-4 text-2xl font-semibold leading-10 text-[var(--text-primary)]">
            One front door for explanation, one dashboard for operation, and a cleaner path between
            the two.
          </p>
        </div>
      </section>

      <section className="mt-16 grid gap-5 lg:grid-cols-2">
        {tracks.map((track) => {
          const Icon = track.icon;

          return (
            <article
              key={track.title}
              className="rounded-[2rem] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-7"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-[var(--font-mono)] text-xs uppercase tracking-[0.22em] text-[var(--text-muted)]">
                    Solution Track
                  </p>
                  <h2 className="mt-3 font-[var(--font-display)] text-3xl font-bold text-[var(--text-primary)]">
                    {track.title}
                  </h2>
                </div>
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-2xl"
                  style={{ backgroundColor: `${track.accent}22` }}
                >
                  <Icon size={20} style={{ color: track.accent }} />
                </div>
              </div>

              <p className="mt-5 text-sm leading-7 text-[var(--text-secondary)]">{track.summary}</p>

              <ul className="mt-6 grid gap-3">
                {track.bullets.map((bullet) => (
                  <li
                    key={bullet}
                    className="rounded-[1.3rem] border border-[rgba(255,255,255,0.06)] bg-[rgba(8,6,22,0.84)] px-4 py-4 text-sm leading-7 text-[var(--text-secondary)]"
                  >
                    {bullet}
                  </li>
                ))}
              </ul>
            </article>
          );
        })}
      </section>

      <section className="mt-20 rounded-[2rem] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-8">
        <div className="max-w-3xl space-y-4">
          <p className="font-[var(--font-mono)] text-xs uppercase tracking-[0.28em] text-[var(--engram-amber)]">
            Rollout Shape
          </p>
          <h2 className="font-[var(--font-display)] text-4xl font-bold text-[var(--text-primary)]">
            The revised UX gives teams a sequence instead of a maze.
          </h2>
          <p className="text-base leading-8 text-[var(--text-secondary)]">
            Each phase has a surface now: marketing for orientation, docs for guidance, security for
            trust review, and /dashboard for operational work.
          </p>
        </div>

        <div className="mt-10 grid gap-4 lg:grid-cols-3">
          {rolloutPhases.map((item) => (
            <div
              key={item.phase}
              className="rounded-[1.6rem] border border-[rgba(255,255,255,0.06)] bg-[rgba(8,6,22,0.88)] p-5"
            >
              <p className="font-[var(--font-mono)] text-xs uppercase tracking-[0.24em] text-[var(--engram-amber)]">
                {item.phase}
              </p>
              <h3 className="mt-4 font-[var(--font-display)] text-2xl font-semibold text-[var(--text-primary)]">
                {item.title}
              </h3>
              <p className="mt-3 text-sm leading-7 text-[var(--text-secondary)]">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-16 flex flex-col gap-4 sm:flex-row">
        <Link href="/dashboard">
          <Button size="lg" className="w-full gap-2 sm:w-auto">
            Launch Dashboard
            <ArrowRight size={18} />
          </Button>
        </Link>
        <Link href="/contact">
          <Button variant="ghost" size="lg" className="w-full border border-[var(--border)] sm:w-auto">
            Plan A Rollout
          </Button>
        </Link>
      </section>
    </main>
  );
}
