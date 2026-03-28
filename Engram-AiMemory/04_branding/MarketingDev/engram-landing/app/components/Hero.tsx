'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from './ui/Button';

interface Service {
  name: string;
  description: string;
  color: 'amber' | 'violet' | 'teal' | 'rose';
  icon: string;
  port?: string;
}

const services: Service[] = [
  {
    name: 'AiMemory',
    description: '3-Tier Vector Memory',
    color: 'amber',
    icon: '🧠',
    port: ':8000',
  },
  {
    name: 'AiCrawler',
    description: 'OSINT Intelligence',
    color: 'violet',
    icon: '🔍',
    port: ':11235',
  },
  {
    name: 'MCP Server',
    description: 'Universal AI Bridge',
    color: 'teal',
    icon: '🌉',
    port: ':3000',
  },
  {
    name: 'Platform',
    description: 'Operations Dashboard',
    color: 'rose',
    icon: '📊',
    port: ':3002',
  },
];

const getColorBg = (color: string) => {
  const mapping = {
    amber: 'rgba(242,169,59,0.08)',
    violet: 'rgba(124,92,191,0.08)',
    teal: 'rgba(46,196,196,0.06)',
    rose: 'rgba(224,92,127,0.08)',
  };
  return mapping[color as keyof typeof mapping] || mapping.violet;
};

const getColorBorder = (color: string) => {
  const mapping = {
    amber: 'rgba(242,169,59,0.2)',
    violet: 'rgba(124,92,191,0.2)',
    teal: 'rgba(46,196,196,0.15)',
    rose: 'rgba(224,92,127,0.2)',
  };
  return mapping[color as keyof typeof mapping] || mapping.violet;
};

const getColorVar = (color: string) => {
  const mapping = {
    amber: 'var(--engram-amber)',
    violet: 'var(--engram-violet)',
    teal: 'var(--engram-teal)',
    rose: 'var(--engram-rose)',
  };
  return mapping[color as keyof typeof mapping] || mapping.violet;
};

export function Hero() {
  const [scrollY, setScrollY] = useState(0);
  const [hoveredService, setHoveredService] = useState<number | null>(null);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <section className="relative min-h-screen flex items-center justify-center px-6 pt-20 overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-[var(--grad-deep)]" />

      {/* Strata Lines */}
      <div className="absolute inset-0">
        <div className="strata-layer strata-layer-1" style={{ top: '20%' }} />
        <div className="strata-layer strata-layer-2" style={{ top: '38%' }} />
        <div className="strata-layer strata-layer-3" style={{ top: '55%' }} />
        <div className="strata-layer strata-layer-4" style={{ top: '72%' }} />
      </div>

      {/* Scan Line */}
      <div className="hero-scan absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute inset-0 bg-gradient-to-b from-transparent via-[rgba(242,169,59,0.03)] to-transparent"
          style={{ animation: 'scanDown 12s linear infinite' }}
        />
      </div>

      {/* Ambient Orbs */}
      <div className="hero-orb hero-orb-1" />
      <div className="hero-orb hero-orb-2" />

      <div className="relative z-10 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center w-full">
        {/* Left Content */}
        <div>
          <div
            className="font-[var(--font-mono)] text-xs text-[var(--engram-amber)] tracking-[0.2em] uppercase mb-8 flex items-center gap-3"
            style={{ animation: 'flickerIn 1s ease both' }}
          >
            <div className="w-10 h-px bg-[var(--engram-amber)]" />
            Unified AI Intelligence Platform
          </div>

          <h1
            className="font-[var(--font-display)] font-black text-[clamp(3rem,8vw,6rem)] leading-[0.9] tracking-[0.15em] mb-4"
            style={{
              color: 'transparent',
              background: 'linear-gradient(135deg, #FFC15E 0%, #F2A93B 40%, #9B7DE0 100%)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              animation: 'fadeUp 0.8s ease 0.2s both',
            }}
          >
            ENGRAM
          </h1>

          <p
            className="font-[var(--font-body)] italic text-[clamp(1.1rem,2vw,1.4rem)] text-[var(--text-secondary)] leading-relaxed mb-12"
            style={{ animation: 'fadeUp 0.8s ease 0.6s both' }}
          >
            Memory. Intelligence. Integration.
          </p>

          <p
            className="font-[var(--font-body)] text-lg text-[var(--text-secondary)] leading-relaxed mb-12 max-w-lg"
            style={{ animation: 'fadeUp 0.8s ease 0.7s both' }}
          >
            Four integrated services that give AI systems persistent memory, intelligent web
            crawling, unified tool access, and a powerful operations dashboard.
          </p>

          <div
            className="flex flex-wrap gap-6 mb-12"
            style={{ animation: 'fadeUp 0.8s ease 0.8s both' }}
          >
            <div className="border-t border-[var(--border-amber)] pt-3">
              <div className="font-[var(--font-mono)] text-xs text-[var(--text-muted)] uppercase tracking-[0.15em] mb-1">
                Version
              </div>
              <div className="font-[var(--font-display)] font-semibold text-sm">v1.1.0</div>
            </div>
            <div className="border-t border-[var(--border-amber)] pt-3">
              <div className="font-[var(--font-mono)] text-xs text-[var(--text-muted)] uppercase tracking-[0.15em] mb-1">
                Services
              </div>
              <div className="font-[var(--font-display)] font-semibold text-sm">4 Integrated</div>
            </div>
            <div className="border-t border-[var(--border-amber)] pt-3">
              <div className="font-[var(--font-mono)] text-xs text-[var(--text-muted)] uppercase tracking-[0.15em] mb-1">
                Status
              </div>
              <div className="font-[var(--font-display)] font-semibold text-sm text-[var(--engram-teal)]">
                Production Ready
              </div>
            </div>
            <div className="border-t border-[var(--border-amber)] pt-3">
              <div className="font-[var(--font-mono)] text-xs text-[var(--text-muted)] uppercase tracking-[0.15em] mb-1">
                License
              </div>
              <div className="font-[var(--font-display)] font-semibold text-sm">Apache 2.0</div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4" style={{ animation: 'fadeUp 0.8s ease 1s both' }}>
            <Button size="lg">Get Started</Button>
            <Link href="#platform">
              <Button variant="secondary" size="lg">
                Explore Platform
              </Button>
            </Link>
          </div>
        </div>

        {/* Right Content - Platform Services Visualization */}
        <div className="relative">
          <div className="space-y-6">
            {services.map((service, index) => (
              <button
                key={`${service.name}-${index}`}
                type="button"
                className="service-card w-full"
                style={{
                  background: getColorBg(service.color),
                  border: `1px solid ${getColorBorder(service.color)}`,
                  borderRadius: '12px',
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: '12px',
                  transition: 'all 0.3s ease',
                  animation: `slideInRight 0.6s ease ${0.3 + index * 0.15}s both`,
                  transform: `translateY(${scrollY * 0.05 * (index + 1)}px) ${
                    hoveredService === index ? 'translateY(-8px)' : 'translateY(0)'
                  }`,
                  cursor: 'pointer',
                }}
                onMouseEnter={() => setHoveredService(index)}
                onMouseLeave={() => setHoveredService(null)}
                aria-label={`Service: ${service.name} - ${service.description}`}
              >
                <div
                  className={`service-card ${service.color}`}
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: '4px',
                    borderRadius: '12px 0 0 12px',
                    background: getColorVar(service.color),
                  }}
                />
                <div style={{ position: 'relative', paddingLeft: '12px', width: '100%' }}>
                  <div
                    className="text-3xl mb-2"
                    style={{
                      animation: hoveredService === index ? 'synapseFlare 0.8s ease-in-out' : 'none',
                    }}
                  >
                    {service.icon}
                  </div>
                  <div className="flex-1">
                    <div
                      className="font-[var(--font-display)] font-semibold text-lg"
                      style={{ color: getColorVar(service.color) }}
                    >
                      {service.name}
                    </div>
                    <div className="font-[var(--font-mono)] text-sm text-[var(--text-secondary)] mt-1">
                      {service.description}
                    </div>
                    {service.port && (
                      <div className="font-[var(--font-mono)] text-xs text-[var(--text-muted)] mt-2">
                        {service.port}
                      </div>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
