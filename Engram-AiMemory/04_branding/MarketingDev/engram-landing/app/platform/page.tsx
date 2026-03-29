import type { Metadata } from 'next';
import Link from 'next/link';
import { products, getColorVar } from '@/app/lib/platform-data';
import { Button } from '@/app/components/ui/Button';
import * as Icons from 'lucide-react';

export const metadata: Metadata = {
  title: "Platform | Engram",
  description: "Explore the four core services that power Engram: Memory API for vector storage, Crawler for OSINT, MCP Server for unified access, and Dashboard for visualization.",
};

const iconMapClient: Record<string, React.ComponentType<{ size: number; className: string }>> = {
  Brain: Icons.Brain,
  Globe: Icons.Globe,
  Server: Icons.Server,
  LayoutDashboard: Icons.LayoutDashboard,
};

export default function PlatformPage() {
  return (
    <div className="space-y-32">
      {/* Hero Section */}
      <section className="relative py-20">
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-[var(--grad-deep)]" />
          <div className="strata-layer strata-layer-1" style={{ top: '20%' }} />
          <div className="strata-layer strata-layer-3" style={{ top: '60%' }} />
          <div
            className="absolute w-600 h-600 rounded-full blur-3xl opacity-10"
            style={{
              background: 'radial-gradient(circle, var(--engram-violet), transparent)',
              top: '-10%',
              right: '-5%',
            }}
          />
        </div>

        <div className="space-y-6 mb-16">
          <div className="font-[var(--font-mono)] text-xs text-[var(--engram-amber)] tracking-[0.2em] uppercase flex items-center gap-3">
            <div className="w-10 h-px bg-gradient-to-r from-[var(--engram-amber)] to-transparent" />
            The Engram Ecosystem
          </div>

          <h1 className="font-[var(--font-display)] font-black text-5xl md:text-6xl leading-[1.1] tracking-[0.15em]">
            <span
              style={{
                color: 'transparent',
                background:
                  'linear-gradient(135deg, #FFC15E 0%, #F2A93B 40%, #9B7DE0 100%)',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
              }}
            >
              Four Services.
              <br />
              One Platform.
            </span>
          </h1>

          <p className="font-[var(--font-body)] italic text-lg text-[var(--text-secondary)] max-w-3xl leading-relaxed">
            Each service is powerful alone. Together, they create an AI intelligence system that
            remembers, discovers, connects, and monitors.
          </p>
        </div>

        {/* Product Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-20">
          {products.map((product) => {
            const Icon = iconMapClient[product.icon];
            const colorVar = getColorVar(product.color);

            return (
              <Link key={product.slug} href={`/platform/${product.slug}`}>
                <div
                  className="group relative h-full rounded-xl border border-[var(--border)] bg-[var(--surface-1)]/40 backdrop-blur-xl hover:bg-[var(--surface-2)]/60 transition-all duration-500 p-8 overflow-hidden cursor-pointer hover:shadow-lg"
                  style={{
                    borderTop: `4px solid ${colorVar}`,
                  }}
                >
                  {/* Hover glow effect */}
                  <div
                    className="absolute inset-0 -z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-2xl"
                    style={{
                      background: `radial-gradient(600px at 50% 50%, ${colorVar}15, transparent)`,
                    }}
                  />

                  {/* Content */}
                  <div className="space-y-4 relative z-10">
                    {/* Icon and Header */}
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h2 className="font-[var(--font-display)] font-bold text-2xl text-[var(--text-primary)] group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r transition-all duration-300"
                          style={{
                            backgroundImage: `linear-gradient(135deg, ${colorVar}, var(--engram-amber))`,
                          }}>
                          {product.name}
                        </h2>
                        <p
                          className="text-sm font-[var(--font-mono)] mt-2 tracking-wide"
                          style={{ color: colorVar }}
                        >
                          {product.tagline}
                        </p>
                      </div>
                      {Icon && (
                        <div
                          style={{ color: colorVar }}
                          className="group-hover:scale-110 transition-transform duration-300"
                        >
                          <Icon
                            size={40}
                            className="group-hover:drop-shadow-lg flex-shrink-0"
                          />
                        </div>
                      )}
                    </div>

                    {/* Features */}
                    <div className="space-y-2 pt-4">
                      {product.features.slice(0, 3).map((feature, idx) => (
                        <div key={idx} className="flex items-start gap-3 group/item">
                          <div
                            className="w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0 group-hover/item:scale-125 transition-transform"
                            style={{ background: colorVar }}
                          />
                          <p className="text-sm text-[var(--text-secondary)] group-hover/item:text-[var(--text-primary)] transition-colors">
                            {feature.title}
                          </p>
                        </div>
                      ))}
                    </div>

                    {/* Tech Stack */}
                    <div className="pt-4 border-t border-[var(--border)]">
                      <div className="flex flex-wrap gap-2">
                        {product.techStack.slice(0, 3).map((tech) => (
                          <span
                            key={tech}
                            className="px-2.5 py-1 rounded-md text-xs font-[var(--font-mono)] bg-[var(--layer-1)]/60 text-[var(--text-muted)] border border-[var(--border)]/30 group-hover:border-[var(--border)] transition-colors"
                          >
                            {tech}
                          </span>
                        ))}
                        {product.techStack.length > 3 && (
                          <span className="px-2.5 py-1 text-xs font-[var(--font-mono)] text-[var(--text-muted)]">
                            +{product.techStack.length - 3}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Port and Link */}
                    <div className="flex items-center justify-between pt-4 border-t border-[var(--border)]">
                      <span className="text-xs font-[var(--font-mono)] text-[var(--text-muted)] tracking-wider">
                        PORT <span style={{ color: colorVar }} className="font-semibold">{product.port}</span>
                      </span>
                      <span
                        className="text-sm font-[var(--font-display)] font-semibold group-hover:translate-x-2 transition-transform duration-300 flex items-center gap-1"
                        style={{ color: colorVar }}
                      >
                        Explore
                        <Icons.ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Data Flow Section */}
      <section className="py-20">
        <div className="space-y-4 mb-16">
          <h2 className="font-[var(--font-display)] font-bold text-4xl text-center">
            How Engram Works
          </h2>
          <p className="text-center text-[var(--text-secondary)] text-sm max-w-2xl mx-auto">
            A coordinated pipeline where each service plays a critical role
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 md:gap-2">
          {[
            {
              product: 'Crawler',
              description: 'Discovers & scrapes content from across the web',
              color: 'violet',
            },
            {
              product: 'Memory',
              description: 'Stores vectors in organized tiers',
              color: 'amber',
            },
            {
              product: 'MCP',
              description: 'Exposes tools to AI clients',
              color: 'teal',
            },
            {
              product: 'Dashboard',
              description: 'Visualizes & manages everything',
              color: 'rose',
            },
          ].map((step, idx) => (
            <div key={idx} className="relative group">
              {/* Step Box */}
              <div
                className="rounded-lg border border-[var(--border)] bg-[var(--layer-1)]/40 backdrop-blur-md p-6 h-full flex flex-col justify-between hover:bg-[var(--layer-1)]/60 transition-all duration-300 hover:border-[var(--border)] hover:shadow-md"
                style={{
                  borderLeft: `3px solid var(--engram-${step.color})`,
                }}
              >
                <div>
                  <div
                    className="font-[var(--font-mono)] text-sm font-bold mb-3 tracking-wide"
                    style={{ color: `var(--engram-${step.color})` }}
                  >
                    {step.product}
                  </div>
                  <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </div>

              {/* Arrow (hidden on last) */}
              {idx < 3 && (
                <div className="hidden md:flex absolute -right-5 top-1/2 transform -translate-y-1/2 z-10">
                  <div
                    className="w-5 h-px group-hover:w-8 transition-all duration-300"
                    style={{
                      background: `linear-gradient(90deg, var(--engram-teal)80, transparent)`,
                    }}
                  />
                  <Icons.ChevronRight
                    size={20}
                    className="text-[var(--engram-teal)]/60 group-hover:text-[var(--engram-teal)] transition-colors"
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        <p className="text-center text-[var(--text-secondary)] text-sm mt-12 max-w-2xl mx-auto">
          Each service handles a specific intelligence task. MCP bridges them all, allowing any AI
          client to leverage the full platform.
        </p>
      </section>

      {/* Integration Callout */}
      <section className="relative rounded-xl border border-[var(--engram-amber)]/30 bg-gradient-to-br from-[var(--engram-amber-glow)]/5 via-transparent to-transparent p-12 overflow-hidden backdrop-blur-sm hover:border-[var(--engram-amber)]/50 transition-all duration-300">
        <div className="absolute inset-0 -z-10">
          <div
            className="absolute inset-0 opacity-20 blur-3xl"
            style={{
              background: `radial-gradient(ellipse at 20% 50%, var(--engram-amber)10, transparent)`,
            }}
          />
        </div>

        <div className="relative z-10 max-w-3xl">
          <h2 className="font-[var(--font-display)] font-bold text-3xl text-[var(--text-primary)] mb-4">
            Deploy Everything with One Command
          </h2>

          <p className="text-[var(--text-secondary)] mb-8 leading-relaxed">
            Use Docker Compose to spin up the entire Engram platform locally or on your
            infrastructure. All services coordinate automatically.
          </p>

          <div
            className="rounded-lg p-6 font-[var(--font-mono)] text-sm bg-[var(--layer-2)] border-l-4 border-[var(--engram-amber)] mb-8 overflow-x-auto shadow-md"
            style={{
              background: 'linear-gradient(135deg, var(--layer-2), var(--layer-1))',
            }}
          >
            <span className="text-[var(--engram-amber)]">$</span>{' '}
            <span className="text-[var(--text-primary)]">docker compose up -d</span>
          </div>

          <Link href="/getting-started">
            <Button>Start Setup Guide</Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
