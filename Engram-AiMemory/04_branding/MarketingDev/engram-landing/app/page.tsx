'use client';

import { Navigation, Hero, Feature, Button } from './components';

export default function Home() {
  const features = [
    {
      title: 'Episodic Memory',
      description: 'Store and retrieve specific events and experiences with full contextual metadata, enabling AI to remember and learn from past interactions.',
      icon: <div className="w-8 h-8 rounded-full bg-[var(--engram-amber)]/20 flex items-center justify-center">
        <div className="w-4 h-4 rounded-full bg-[var(--engram-amber)]" />
      </div>,
      color: 'amber' as const,
    },
    {
      title: 'Semantic Memory',
      description: 'Organize and connect concepts, facts, and knowledge in a structured network that grows and adapts with new information.',
      icon: <div className="w-8 h-8 rounded-full bg-[var(--engram-violet)]/20 flex items-center justify-center">
        <div className="w-4 h-4 rounded-full bg-[var(--engram-violet)]" />
      </div>,
      color: 'violet' as const,
    },
    {
      title: 'Procedural Memory',
      description: 'Capture and refine skills, methods, and processes that improve over time through practice and reinforcement.',
      icon: <div className="w-8 h-8 rounded-full bg-[var(--engram-teal)]/20 flex items-center justify-center">
        <div className="w-4 h-4 rounded-full bg-[var(--engram-teal)]" />
      </div>,
      color: 'teal' as const,
    },
  ];

  const useCases = [
    {
      title: 'Conversational AI',
      description: 'Maintain context across long conversations, remember user preferences, and build personalized relationships.',
      color: 'violet' as const,
    },
    {
      title: 'Knowledge Management',
      description: 'Create intelligent documentation systems that understand context and suggest relevant information.',
      color: 'violet' as const,
    },
    {
      title: 'Autonomous Agents',
      description: 'Enable agents with persistent memory to learn from experience and adapt to new environments.',
      color: 'violet' as const,
    },
    {
      title: 'Recommendation Systems',
      description: 'Deliver hyper-personalized recommendations by understanding behavior patterns and preferences.',
      color: 'teal' as const,
    },
    {
      title: 'Research Assistant',
      description: 'Accelerate research with AI that remembers previous findings and connects concepts across domains.',
      color: 'teal' as const,
    },
    {
      title: 'Creative Companion',
      description: 'Foster creativity with AI that remembers artistic preferences and builds on previous ideas.',
      color: 'teal' as const,
    },
  ];

  return (
    <div className="min-h-screen bg-[var(--void)] text-[var(--text-primary)]">
      <Navigation />

      <div className="md:ml-[260px]">
        <Hero />

        {/* Features Section */}
        <section id="features" className="py-32 px-6 bg-[var(--layer-0)] border-t border-[var(--border)]">
          <div className="max-w-6xl mx-auto">
            <div className="mb-16">
              <div className="font-[var(--font-mono)] text-xs text-[var(--engram-amber)] tracking-[0.2em] uppercase mb-4 flex items-center gap-3">
                <div className="w-10 h-px bg-[var(--engram-amber)]" />
                Core Capabilities
              </div>
              <h2 className="font-[var(--font-display)] font-bold text-[clamp(2rem,4vw,3rem)] leading-[1.1] mb-4">
                Multi-Layer Memory Architecture
              </h2>
              <p className="font-[var(--font-body)] italic text-xl text-[var(--text-secondary)] max-w-3xl">
                ENGRAM implements a sophisticated memory system that mirrors the human brain&apos;s natural information processing,
                enabling AI applications with unprecedented contextual awareness and learning capabilities.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {features.map((feature) => (
                <Feature
                  key={feature.title}
                  title={feature.title}
                  description={feature.description}
                  icon={feature.icon}
                  color={feature.color}
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
                Built for Performance & Scale
              </h2>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
              <div>
                <h3 className="font-[var(--font-display)] font-semibold text-2xl mb-6 text-[var(--engram-violet-bright)]">
                  Advanced Vector Operations
                </h3>
                <div className="space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="w-2 h-2 rounded-full bg-[var(--engram-amber)] mt-2 flex-shrink-0" />
                    <div>
                      <h4 className="font-[var(--font-display)] font-semibold mb-1">Hybrid Search</h4>
                      <p className="font-[var(--font-body)] text-[var(--text-secondary)]">
                        Combine semantic and keyword search for optimal relevance and performance.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="w-2 h-2 rounded-full bg-[var(--engram-amber)] mt-2 flex-shrink-0" />
                    <div>
                      <h4 className="font-[var(--font-display)] font-semibold mb-1">Dynamic Indexing</h4>
                      <p className="font-[var(--font-body)] text-[var(--text-secondary)]">
                        Adaptive indexing strategies that optimize for your data patterns in real-time.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="w-2 h-2 rounded-full bg-[var(--engram-amber)] mt-2 flex-shrink-0" />
                    <div>
                      <h4 className="font-[var(--font-display)] font-semibold mb-1">Distributed Storage</h4>
                      <p className="font-[var(--font-body)] text-[var(--text-secondary)]">
                        Scale horizontally with built-in sharding and replication for enterprise needs.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-[var(--surface-1)] border border-[var(--border)] rounded-2xl p-8">
                <div className="grid grid-cols-2 gap-8">
                  <div className="text-center">
                    <div className="font-[var(--font-display)] font-bold text-3xl text-[var(--engram-amber)] mb-2">10M+</div>
                    <div className="font-[var(--font-mono)] text-sm text-[var(--text-muted)]">Vectors/sec</div>
                  </div>
                  <div className="text-center">
                    <div className="font-[var(--font-display)] font-bold text-3xl text-[var(--engram-violet)] mb-2">&lt;10ms</div>
                    <div className="font-[var(--font-mono)] text-sm text-[var(--text-muted)]">Query Latency</div>
                  </div>
                  <div className="text-center">
                    <div className="font-[var(--font-display)] font-bold text-3xl text-[var(--engram-teal)] mb-2">99.9%</div>
                    <div className="font-[var(--font-mono)] text-sm text-[var(--text-muted)]">Uptime</div>
                  </div>
                  <div className="text-center">
                    <div className="font-[var(--font-display)] font-bold text-3xl text-[var(--engram-rose)] mb-2">PB</div>
                    <div className="font-[var(--font-mono)] text-sm text-[var(--text-muted)]">Scale</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Use Cases Section */}
        <section id="use-cases" className="py-32 px-6 bg-[var(--layer-0)]">
          <div className="max-w-6xl mx-auto">
            <div className="mb-16">
              <div className="font-[var(--font-mono)] text-xs text-[var(--engram-amber)] tracking-[0.2em] uppercase mb-4">
                Real-World Applications
              </div>
              <h2 className="font-[var(--font-display)] font-bold text-[clamp(2rem,4vw,3rem)] leading-[1.1] mb-4">
                Powering the Next Generation of AI
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
        <section className="py-32 px-6 bg-[var(--layer-1)]">
          <div className="max-w-4xl mx-auto text-center">
            <div className="font-[var(--font-mono)] text-xs text-[var(--engram-amber)] tracking-[0.2em] uppercase mb-6">
              Ready to Get Started?
            </div>
            <h2 className="font-[var(--font-display)] font-bold text-[clamp(2rem,5vw,3.5rem)] leading-[1.1] mb-6">
              Build Memory-Aware AI Today
            </h2>
            <p className="font-[var(--font-body)] italic text-xl text-[var(--text-secondary)] mb-12 max-w-2xl mx-auto">
              Join thousands of developers building the next generation of intelligent applications
              with ENGRAM&apos;s multi-layer memory architecture.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg">
                Start Building
              </Button>
              <Button variant="secondary" size="lg">
                View Documentation
              </Button>
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
                  Multi-layer AI Memory System
                </p>
              </div>

              <div>
                <h4 className="font-[var(--font-mono)] text-xs text-[var(--text-muted)] uppercase tracking-[0.15em] mb-3">Product</h4>
                <ul className="space-y-2">
                  <li><a href="#features" className="font-[var(--font-mono)] text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]">Features</a></li>
                  <li><a href="#pricing" className="font-[var(--font-mono)] text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]">Pricing</a></li>
                  <li><a href="#enterprise" className="font-[var(--font-mono)] text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]">Enterprise</a></li>
                </ul>
              </div>

              <div>
                <h4 className="font-[var(--font-mono)] text-xs text-[var(--text-muted)] uppercase tracking-[0.15em] mb-3">Resources</h4>
                <ul className="space-y-2">
                  <li><a href="#docs" className="font-[var(--font-mono)] text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]">Documentation</a></li>
                  <li><a href="#api" className="font-[var(--font-mono)] text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]">API Reference</a></li>
                  <li><a href="#examples" className="font-[var(--font-mono)] text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]">Examples</a></li>
                </ul>
              </div>

              <div>
                <h4 className="font-[var(--font-mono)] text-xs text-[var(--text-muted)] uppercase tracking-[0.15em] mb-3">Community</h4>
                <ul className="space-y-2">
                  <li><a href="https://github.com/engram/engram" target="_blank" rel="noopener noreferrer" className="font-[var(--font-mono)] text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]">GitHub</a></li>
                  <li><a href="https://discord.gg/engram" target="_blank" rel="noopener noreferrer" className="font-[var(--font-mono)] text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]">Discord</a></li>
                  <li><a href="#blog" className="font-[var(--font-mono)] text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]">Blog</a></li>
                </ul>
              </div>
            </div>

            <div className="pt-8 border-t border-[var(--border)] text-center">
              <p className="font-[var(--font-mono)] text-xs text-[var(--text-muted)]">
                © 2024 ENGRAM. Licensed under Apache 2.0.
              </p>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
