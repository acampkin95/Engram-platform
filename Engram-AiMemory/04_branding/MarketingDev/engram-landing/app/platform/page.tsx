'use client';

import Link from 'next/link';
import { products, getColorVar } from '@/app/lib/platform-data';
import { Button } from '@/app/components/ui/Button';
import * as Icons from 'lucide-react';

const iconMap: Record<string, React.ComponentType<{ size: number; className: string }>> = {
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
            <div className="w-10 h-px bg-[var(--engram-amber)]" />
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
            const Icon = iconMap[product.icon];
            const colorVar = getColorVar(product.color);

            return (
              <Link key={product.slug} href={`/platform/${product.slug}`}>
                <div
                  className="group relative h-full rounded-lg border border-[var(--border)] bg-[var(--surface-1)] hover:bg-[var(--surface-2)] transition-all duration-300 p-8 overflow-hidden cursor-pointer"
                  style={{
                    borderTop: `2px solid ${colorVar}`,
                  }}
                >
                  {/* Hover glow effect */}
                  <div
                    className="absolute inset-0 -z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-xl"
                    style={{
                      background: `radial-gradient(600px at 50% 50%, ${colorVar}10, transparent)`,
                    }}
                  />

                  {/* Content */}
                  <div className="space-y-4">
                    {/* Icon and Header */}
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h2 className="font-[var(--font-display)] font-bold text-xl text-[var(--text-primary)]">
                          {product.name}
                        </h2>
                        <p
                          className="text-sm font-[var(--font-mono)] mt-1"
                          style={{ color: colorVar }}
                        >
                          {product.tagline}
                        </p>
                      </div>
                      {Icon && (
                        <div style={{ color: colorVar }}>
                          <Icon
                            size={32}
                            className="group-hover:text-[var(--engram-amber)] transition-colors flex-shrink-0"
                          />
                        </div>
                      )}
                    </div>

                    {/* Features */}
                    <div className="space-y-2 pt-4">
                      {product.features.slice(0, 3).map((feature, idx) => (
                        <div key={idx} className="flex items-start gap-2">
                          <div
                            className="w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0"
                            style={{ background: colorVar }}
                          />
                          <p className="text-sm text-[var(--text-secondary)]">{feature.title}</p>
                        </div>
                      ))}
                    </div>

                    {/* Tech Stack */}
                    <div className="pt-4 border-t border-[var(--border)]">
                      <div className="flex flex-wrap gap-2">
                        {product.techStack.slice(0, 3).map((tech) => (
                          <span
                            key={tech}
                            className="px-2 py-1 rounded text-xs font-[var(--font-mono)] bg-[var(--layer-1)] text-[var(--text-muted)]"
                          >
                            {tech}
                          </span>
                        ))}
                        {product.techStack.length > 3 && (
                          <span className="px-2 py-1 text-xs font-[var(--font-mono)] text-[var(--text-muted)]">
                            +{product.techStack.length - 3} more
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Port and Link */}
                    <div className="flex items-center justify-between pt-4 border-t border-[var(--border)]">
                      <span className="text-xs font-[var(--font-mono)] text-[var(--text-muted)]">
                        Port <span style={{ color: colorVar }}>{product.port}</span>
                      </span>
                      <span
                        className="text-sm font-[var(--font-display)] font-semibold group-hover:translate-x-1 transition-transform"
                        style={{ color: colorVar }}
                      >
                        Learn More →
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
        <h2 className="font-[var(--font-display)] font-bold text-3xl text-center mb-16">
          How Engram Works
        </h2>

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
            <div key={idx} className="relative">
              {/* Step Box */}
              <div
                className="rounded-lg border border-[var(--border)] bg-[var(--layer-1)] p-6 h-full flex flex-col justify-between"
                style={{
                  borderLeft: `2px solid var(--engram-${step.color})`,
                }}
              >
                <div>
                  <div
                    className="font-[var(--font-mono)] text-sm font-bold mb-2"
                    style={{ color: `var(--engram-${step.color})` }}
                  >
                    {step.product}
                  </div>
                  <p className="text-sm text-[var(--text-secondary)]">{step.description}</p>
                </div>
              </div>

              {/* Arrow (hidden on last) */}
              {idx < 3 && (
                <div className="hidden md:flex absolute -right-5 top-1/2 transform -translate-y-1/2 z-10">
                  <div
                    className="w-5 h-px"
                    style={{ background: 'var(--engram-teal)', opacity: 0.3 }}
                  />
                  <Icons.ChevronRight size={20} className="text-[var(--text-muted)]" />
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
      <section className="relative rounded-lg border border-[var(--engram-amber)] bg-gradient-to-br from-[var(--engram-amber-glow)] to-transparent p-12 overflow-hidden">
        <div className="absolute inset-0 -z-10 opacity-30 blur-2xl" />

        <div className="relative z-10 max-w-3xl">
          <h2 className="font-[var(--font-display)] font-bold text-3xl text-[var(--text-primary)] mb-4">
            Deploy Everything with One Command
          </h2>

          <p className="text-[var(--text-secondary)] mb-8">
            Use Docker Compose to spin up the entire Engram platform locally or on your
            infrastructure. All services coordinate automatically.
          </p>

          <div
            className="rounded-lg p-6 font-[var(--font-mono)] text-sm bg-[var(--layer-2)] border-l-2 border-[var(--engram-amber)] mb-8 overflow-x-auto"
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
