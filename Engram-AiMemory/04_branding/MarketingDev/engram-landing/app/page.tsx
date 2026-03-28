import Link from 'next/link';
import { Navigation, Hero, Feature, Button, PlatformArchitecture } from './components';

const platformPillars = [
  {
    title: 'AiMemory',
    subtitle: '3-Tier Vector Memory',
    description:
      'Weaviate-powered persistent memory system with episodic, semantic, and procedural tiers. RAG pipeline, memory decay, and multi-tenancy support.',
    color: 'amber' as const,
    icon: (
      <div className="w-12 h-12 rounded-full bg-[var(--engram-amber)]/20 flex items-center justify-center">
        <div className="text-2xl">🧠</div>
      </div>
    ),
  },
  {
    title: 'AiCrawler',
    subtitle: 'OSINT Intelligence Engine',
    description:
      '5-stage pipeline for automated intelligence gathering: discover, crawl, analyze, store, and graph. Dark web monitoring and threat intelligence.',
    color: 'violet' as const,
    icon: (
      <div className="w-12 h-12 rounded-full bg-[var(--engram-violet)]/20 flex items-center justify-center">
        <div className="text-2xl">🔍</div>
      </div>
    ),
  },
  {
    title: 'MCP Server',
    subtitle: 'Universal AI Bridge',
    description:
      'Dual transport MCP server (stdio + HTTP) with OAuth 2.1, PKCE authentication. Expose tools, prompts, and resources to any AI client.',
    color: 'teal' as const,
    icon: (
      <div className="w-12 h-12 rounded-full bg-[var(--engram-teal)]/20 flex items-center justify-center">
        <div className="text-2xl">🌉</div>
      </div>
    ),
  },
  {
    title: 'Platform Dashboard',
    subtitle: 'Operations Command Center',
    description:
      'Real-time system monitoring, knowledge graph visualization, memory browser, and health dashboards built with Next.js 15 and React 19.',
    color: 'rose' as const,
    icon: (
      <div className="w-12 h-12 rounded-full bg-[var(--engram-rose)]/20 flex items-center justify-center">
        <div className="text-2xl">📊</div>
      </div>
    ),
  },
];

const useCases = [
  {
    title: 'OSINT Investigation',
    description: 'Automated intelligence gathering with dark web monitoring, breach scanning, and entity correlation.',
    color: 'violet' as const,
  },
  {
    title: 'AI Agent Memory',
    description: 'Persistent context for conversational AI and autonomous agents with semantic understanding.',
    color: 'amber' as const,
  },
  {
    title: 'Knowledge Management',
    description: 'Enterprise knowledge graphs with semantic search and relationship extraction.',
    color: 'teal' as const,
  },
  {
    title: 'Threat Intelligence',
    description: 'Real-time breach scanning, crypto tracing, and threat pattern analysis.',
    color: 'rose' as const,
  },
  {
    title: 'Research Automation',
    description: 'Web crawling with AI-powered analysis, extraction, and knowledge synthesis.',
    color: 'violet' as const,
  },
  {
    title: 'MCP Tool Server',
    description: 'Expose any capability as tools for Claude Desktop, Claude Code, and AI assistants.',
    color: 'teal' as const,
  },
];

const integrations = [
  { name: 'Claude Desktop', icon: '💬', description: 'MCP stdio transport' },
  { name: 'Claude Code', icon: '💻', description: 'Native integration' },
  { name: 'Any AI Client', icon: '🤖', description: 'HTTP streaming' },
  { name: 'Docker Compose', icon: '🐳', description: 'One-command deploy' },
  { name: 'Weaviate', icon: '🔍', description: 'Vector storage' },
  { name: 'Redis', icon: '⚡', description: 'Caching layer' },
];

const stats = [
  { value: '10M+', label: 'Vectors/sec', color: 'amber' as const },
  { value: '<10ms', label: 'Query Latency', color: 'violet' as const },
  { value: '4', label: 'Integrated Services', color: 'teal' as const },
  { value: '99.9%', label: 'Uptime', color: 'rose' as const },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-[var(--void)] text-[var(--text-primary)]">
      <Navigation />

      <div className="md:ml-[280px]">
        <Hero />

        {/* Platform Overview - 4 Pillars */}
        <section id="platform" className="py-32 px-6 bg-[var(--layer-0)] border-t border-[var(--border)]">
          <div className="max-w-6xl mx-auto">
            <div className="mb-16">
              <div className="font-[var(--font-mono)] text-xs text-[var(--engram-amber)] tracking-[0.2em] uppercase mb-4 flex items-center gap-3">
                <div className="w-10 h-px bg-[var(--engram-amber)]" />
                The Engram Ecosystem
              </div>
              <h2 className="font-[var(--font-display)] font-bold text-[clamp(2rem,4vw,3rem)] leading-[1.1] mb-4">
                Four Integrated Services
              </h2>
              <p className="font-[var(--font-body)] italic text-xl text-[var(--text-secondary)] max-w-3xl">
                A unified platform where each service complements the others, creating a
                cohesive ecosystem for AI intelligence.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {platformPillars.map((pillar) => (
                <Feature
                  key={pillar.title}
                  title={pillar.title}
                  description={`${pillar.subtitle} — ${pillar.description}`}
                  icon={pillar.icon}
                  color={pillar.color}
                  size="large"
                  className="h-full"
                />
              ))}
            </div>
          </div>
        </section>

        {/* Architecture Section */}
        <section id="architecture" className="py-32 px-6 bg-[var(--layer-1)]">
          <div className="max-w-6xl mx-auto">
            <div className="mb-16">
              <div className="font-[var(--font-mono)] text-xs text-[var(--engram-amber)] tracking-[0.2em] uppercase mb-4 flex items-center gap-3">
                <div className="w-10 h-px bg-[var(--engram-amber)]" />
                Technical Architecture
              </div>
              <h2 className="font-[var(--font-display)] font-bold text-[clamp(2rem,4vw,3rem)] leading-[1.1] mb-4">
                Engineered for Scale
              </h2>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center mb-16">
              <div>
                <h3 className="font-[var(--font-display)] font-semibold text-2xl mb-6 text-[var(--engram-violet-bright)]">
                  Performance Metrics
                </h3>
                <div className="space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="w-2 h-2 rounded-full bg-[var(--engram-amber)] mt-2 flex-shrink-0" />
                    <div>
                      <h4 className="font-[var(--font-display)] font-semibold mb-1">
                        Sub-10ms Latency
                      </h4>
                      <p className="font-[var(--font-body)] text-[var(--text-secondary)]">
                        Vector queries optimized for real-time AI interactions and responsive
                        dashboards.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="w-2 h-2 rounded-full bg-[var(--engram-amber)] mt-2 flex-shrink-0" />
                    <div>
                      <h4 className="font-[var(--font-display)] font-semibold mb-1">
                        Horizontal Scaling
                      </h4>
                      <p className="font-[var(--font-body)] text-[var(--text-secondary)]">
                        Docker Compose orchestration with built-in sharding for multi-tenant
                        deployments.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="w-2 h-2 rounded-full bg-[var(--engram-amber)] mt-2 flex-shrink-0" />
                    <div>
                      <h4 className="font-[var(--font-display)] font-semibold mb-1">
                        99.9% Uptime SLA
                      </h4>
                      <p className="font-[var(--font-body)] text-[var(--text-secondary)]">
                        Redundant services with automatic failover and health monitoring.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <PlatformArchitecture />
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  className="bg-[var(--surface-1)] border border-[var(--border)] rounded-2xl p-8 text-center"
                >
                  <div
                    className="font-[var(--font-display)] font-bold text-3xl mb-2"
                    style={{
                      color:
                        stat.color === 'amber'
                          ? 'var(--engram-amber)'
                          : stat.color === 'violet'
                            ? 'var(--engram-violet)'
                            : stat.color === 'teal'
                              ? 'var(--engram-teal)'
                              : 'var(--engram-rose)',
                    }}
                  >
                    {stat.value}
                  </div>
                  <div className="font-[var(--font-mono)] text-sm text-[var(--text-muted)]">
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Integration Section */}
        <section className="py-32 px-6 bg-[var(--layer-0)]">
          <div className="max-w-6xl mx-auto">
            <div className="mb-16">
              <div className="font-[var(--font-mono)] text-xs text-[var(--engram-amber)] tracking-[0.2em] uppercase mb-4 flex items-center gap-3">
                <div className="w-10 h-px bg-[var(--engram-amber)]" />
                Seamless Integration
              </div>
              <h2 className="font-[var(--font-display)] font-bold text-[clamp(2rem,4vw,3rem)] leading-[1.1] mb-4">
                Connect Everywhere
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {integrations.map((integration) => (
                <div
                  key={integration.name}
                  className="bg-[var(--surface-1)] border border-[var(--border)] rounded-2xl p-8 group hover:border-[var(--border-violet)] transition-all duration-300"
                >
                  <div className="text-4xl mb-4 group-hover:scale-110 transition-transform duration-300">
                    {integration.icon}
                  </div>
                  <h3 className="font-[var(--font-display)] font-bold text-xl mb-2">
                    {integration.name}
                  </h3>
                  <p className="font-[var(--font-mono)] text-sm text-[var(--text-muted)]">
                    {integration.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Use Cases Section */}
        <section className="py-32 px-6 bg-[var(--layer-1)]">
          <div className="max-w-6xl mx-auto">
            <div className="mb-16">
              <div className="font-[var(--font-mono)] text-xs text-[var(--engram-amber)] tracking-[0.2em] uppercase mb-4 flex items-center gap-3">
                <div className="w-10 h-px bg-[var(--engram-amber)]" />
                Real-World Applications
              </div>
              <h2 className="font-[var(--font-display)] font-bold text-[clamp(2rem,4vw,3rem)] leading-[1.1] mb-4">
                Built for Real-World Intelligence
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {useCases.map((useCase) => (
                <Feature
                  key={useCase.title}
                  title={useCase.title}
                  description={useCase.description}
                  color={useCase.color}
                  className="h-full"
                />
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-32 px-6 bg-[var(--layer-0)]">
          <div className="max-w-4xl mx-auto text-center">
            <div className="font-[var(--font-mono)] text-xs text-[var(--engram-amber)] tracking-[0.2em] uppercase mb-6">
              Ready to Get Started?
            </div>
            <h2 className="font-[var(--font-display)] font-bold text-[clamp(2rem,5vw,3.5rem)] leading-[1.1] mb-6">
              Deploy the Full Platform in Minutes
            </h2>
            <p className="font-[var(--font-body)] italic text-xl text-[var(--text-secondary)] mb-8 max-w-2xl mx-auto">
              One Docker Compose file orchestrates all four integrated services with proper networking,
              environment variables, and persistence.
            </p>

            <div className="code-block mb-12 text-center">
              <span>docker compose up -d</span>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/getting-started">
                <Button size="lg">Getting Started Guide</Button>
              </Link>
              <Link href="/knowledge-base">
                <Button variant="secondary" size="lg">
                  View Knowledge Base
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-12 px-6 bg-[var(--deep)] border-t border-[var(--border)]">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-6 h-6 bg-[var(--engram-amber)] rounded-full flex items-center justify-center">
                    <div className="w-2 h-2 bg-[var(--void)] rounded-full" />
                  </div>
                  <span className="font-[var(--font-display)] font-bold tracking-[0.2em] text-[var(--engram-amber)]">
                    ENGRAM
                  </span>
                </div>
                <p className="font-[var(--font-mono)] text-xs text-[var(--text-muted)]">
                  Unified AI Intelligence Platform
                </p>
              </div>

              <div>
                <h4 className="font-[var(--font-mono)] text-xs text-[var(--text-muted)] uppercase tracking-[0.15em] mb-3">
                  Platform
                </h4>
                <ul className="space-y-2">
                  <li>
                    <a
                      href="#platform"
                      className="font-[var(--font-mono)] text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    >
                      AiMemory
                    </a>
                  </li>
                  <li>
                    <a
                      href="#platform"
                      className="font-[var(--font-mono)] text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    >
                      AiCrawler
                    </a>
                  </li>
                  <li>
                    <a
                      href="#platform"
                      className="font-[var(--font-mono)] text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    >
                      MCP Server
                    </a>
                  </li>
                  <li>
                    <a
                      href="#platform"
                      className="font-[var(--font-mono)] text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    >
                      Dashboard
                    </a>
                  </li>
                </ul>
              </div>

              <div>
                <h4 className="font-[var(--font-mono)] text-xs text-[var(--text-muted)] uppercase tracking-[0.15em] mb-3">
                  Resources
                </h4>
                <ul className="space-y-2">
                  <li>
                    <a
                      href="/knowledge-base"
                      className="font-[var(--font-mono)] text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    >
                      Knowledge Base
                    </a>
                  </li>
                  <li>
                    <a
                      href="/getting-started"
                      className="font-[var(--font-mono)] text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    >
                      Getting Started
                    </a>
                  </li>
                  <li>
                    <a
                      href="#"
                      className="font-[var(--font-mono)] text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    >
                      API Docs
                    </a>
                  </li>
                  <li>
                    <a
                      href="#architecture"
                      className="font-[var(--font-mono)] text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    >
                      Architecture
                    </a>
                  </li>
                </ul>
              </div>

              <div>
                <h4 className="font-[var(--font-mono)] text-xs text-[var(--text-muted)] uppercase tracking-[0.15em] mb-3">
                  Community
                </h4>
                <ul className="space-y-2">
                  <li>
                    <a
                      href="https://github.com/engram"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-[var(--font-mono)] text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    >
                      GitHub
                    </a>
                  </li>
                  <li>
                    <a
                      href="https://discord.gg/engram"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-[var(--font-mono)] text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    >
                      Discord
                    </a>
                  </li>
                  <li>
                    <a
                      href="#"
                      className="font-[var(--font-mono)] text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    >
                      Changelog
                    </a>
                  </li>
                </ul>
              </div>
            </div>

            <div className="pt-8 border-t border-[var(--border)] text-center">
              <p className="font-[var(--font-mono)] text-xs text-[var(--text-muted)]">
                © 2026 ENGRAM Platform. Licensed under Apache 2.0.
              </p>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
