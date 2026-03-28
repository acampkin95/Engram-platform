'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from './ui/Button';
import { ChevronDown } from 'lucide-react';

interface Service {
  name: string;
  description: string;
  color: 'amber' | 'violet' | 'teal' | 'rose';
  icon: string;
  port?: string;
  tech?: string;
}

const services: Service[] = [
  {
    name: 'AiMemory',
    description: '3-Tier Vector Memory',
    color: 'amber',
    icon: '🧠',
    port: ':8000',
    tech: 'FastAPI • Weaviate • Redis',
  },
  {
    name: 'AiCrawler',
    description: 'OSINT Intelligence',
    color: 'violet',
    icon: '🔍',
    port: ':11235',
    tech: 'Crawl4AI • ChromaDB • LM Studio',
  },
  {
    name: 'MCP Server',
    description: 'Universal AI Bridge',
    color: 'teal',
    icon: '🌉',
    port: ':3000',
    tech: 'Node.js • TypeScript • Hono',
  },
  {
    name: 'Platform',
    description: 'Operations Dashboard',
    color: 'rose',
    icon: '📊',
    port: ':3002',
    tech: 'Next.js • React 19 • Tailwind',
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

const getColorBorderHover = (color: string) => {
  const mapping = {
    amber: 'rgba(242,169,59,0.4)',
    violet: 'rgba(124,92,191,0.4)',
    teal: 'rgba(46,196,196,0.35)',
    rose: 'rgba(224,92,127,0.4)',
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
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handleMotionChange = () => {
      setPrefersReducedMotion(mediaQuery.matches);
    };

    const handleScroll = () => setScrollY(window.scrollY);

    // Set initial value
    handleMotionChange();

    // Listen for prefers-reduced-motion changes
    mediaQuery.addEventListener('change', handleMotionChange);
    window.addEventListener('scroll', handleScroll);

    return () => {
      mediaQuery.removeEventListener('change', handleMotionChange);
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  return (
    <section className="relative min-h-screen flex items-center justify-center px-6 pt-20 overflow-hidden">
      <style jsx>{`
        @keyframes fadeUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes flickerIn {
          0% {
            opacity: 0;
          }
          50% {
            opacity: 0.5;
          }
          100% {
            opacity: 1;
          }
        }

        @keyframes slideInRight {
          from {
            opacity: 0;
            transform: translateX(40px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes scanDown {
          from {
            transform: translateY(-100%);
          }
          to {
            transform: translateY(100%);
          }
        }

        @keyframes synapseFlare {
          0% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.2);
          }
          100% {
            transform: scale(1);
          }
        }

        @keyframes ambientPulse1 {
          0% {
            opacity: 0.3;
            transform: translate(0, 0) scale(1);
          }
          50% {
            opacity: 0.2;
          }
          100% {
            opacity: 0.3;
            transform: translate(40px, -40px) scale(1.1);
          }
        }

        @keyframes ambientPulse2 {
          0% {
            opacity: 0.25;
            transform: translate(0, 0) scale(1);
          }
          50% {
            opacity: 0.15;
          }
          100% {
            opacity: 0.25;
            transform: translate(-30px, 50px) scale(1.15);
          }
        }

        @keyframes ambientPulse3 {
          0% {
            opacity: 0.2;
            transform: translate(0, 0) scale(1);
          }
          50% {
            opacity: 0.12;
          }
          100% {
            opacity: 0.2;
            transform: translate(50px, 30px) scale(1.12);
          }
        }

        @keyframes bounceChevron {
          0%,
          100% {
            transform: translateY(0);
            opacity: 1;
          }
          50% {
            transform: translateY(8px);
          }
          80% {
            opacity: 1;
          }
        }

        @keyframes fadeOutChevron {
          0% {
            opacity: 1;
          }
          100% {
            opacity: 0;
          }
        }

        @keyframes wordFadeUp {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes strapaParallax1 {
          from {
            transform: translateY(0px);
          }
          to {
            transform: translateY(${scrollY * 0.02}px);
          }
        }

        @keyframes serviceGlow {
          0% {
            box-shadow: 0 0 0 rgba(242, 169, 59, 0);
          }
          50% {
            box-shadow: 0 0 20px rgba(242, 169, 59, 0.2);
          }
          100% {
            box-shadow: 0 0 0 rgba(242, 169, 59, 0);
          }
        }

        ${prefersReducedMotion
          ? `
          * {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
        `
          : ''}
      `}</style>

      {/* Background Effects */}
      <div className="absolute inset-0 bg-[var(--grad-deep)]" />

      {/* Strata Lines with Parallax */}
      <div className="absolute inset-0">
        <div
          className="strata-layer strata-layer-1"
          style={{
            top: '20%',
            transform: `translateY(${scrollY * 0.015}px)`,
            transition: 'transform 0.3s ease-out',
          }}
        />
        <div
          className="strata-layer strata-layer-2"
          style={{
            top: '38%',
            transform: `translateY(${scrollY * 0.02}px)`,
            transition: 'transform 0.3s ease-out',
          }}
        />
        <div
          className="strata-layer strata-layer-3"
          style={{
            top: '55%',
            transform: `translateY(${scrollY * 0.025}px)`,
            transition: 'transform 0.3s ease-out',
          }}
        />
        <div
          className="strata-layer strata-layer-4"
          style={{
            top: '72%',
            transform: `translateY(${scrollY * 0.03}px)`,
            transition: 'transform 0.3s ease-out',
          }}
        />
      </div>

      {/* Scan Line */}
      <div className="hero-scan absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute inset-0 bg-gradient-to-b from-transparent via-[rgba(242,169,59,0.02)] to-transparent"
          style={{ animation: prefersReducedMotion ? 'none' : 'scanDown 12s linear infinite' }}
        />
      </div>

      {/* Ambient Orbs */}
      <div
        className="hero-orb hero-orb-1"
        style={{
          animation: prefersReducedMotion ? 'none' : 'ambientPulse1 12s ease-in-out infinite',
        }}
      />
      <div
        className="hero-orb hero-orb-2"
        style={{
          animation: prefersReducedMotion ? 'none' : 'ambientPulse2 14s ease-in-out infinite',
        }}
      />
      <div
        className="hero-orb hero-orb-3"
        style={{
          position: 'absolute',
          bottom: '10%',
          right: '5%',
          width: '300px',
          height: '300px',
          background: 'radial-gradient(circle, rgba(46,196,196,0.15) 0%, rgba(46,196,196,0) 70%)',
          borderRadius: '50%',
          filter: 'blur(80px)',
          animation: prefersReducedMotion ? 'none' : 'ambientPulse3 16s ease-in-out infinite',
          zIndex: 0,
        }}
      />

      <div className="relative z-10 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center w-full">
        {/* Left Content */}
        <div>
          <div
            className="font-[var(--font-mono)] text-xs text-[var(--engram-amber)] tracking-[0.2em] uppercase mb-8 flex items-center gap-3"
            style={{ animation: prefersReducedMotion ? 'none' : 'flickerIn 1s ease both' }}
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
              animation: prefersReducedMotion ? 'none' : 'fadeUp 0.8s ease 0.2s both',
            }}
          >
            ENGRAM
          </h1>

          {/* Animated subtitle words */}
          <p
            className="font-[var(--font-body)] italic text-[clamp(1.1rem,2vw,1.4rem)] text-[var(--text-secondary)] leading-relaxed mb-12"
            style={{
              display: 'flex',
              gap: '0.5em',
              flexWrap: 'wrap',
            }}
          >
            {['Memory.', 'Intelligence.', 'Integration.'].map((word, i) => (
              <span
                key={word}
                style={{
                  animation: prefersReducedMotion
                    ? 'none'
                    : `fadeUp 0.6s ease ${0.6 + i * 0.1}s both`,
                  display: 'inline-block',
                }}
              >
                {word}
              </span>
            ))}
          </p>

          <p
            className="font-[var(--font-body)] text-lg text-[var(--text-secondary)] leading-relaxed mb-12 max-w-lg"
            style={{ animation: prefersReducedMotion ? 'none' : 'fadeUp 0.8s ease 0.7s both' }}
          >
            Four integrated services that give AI systems persistent memory, intelligent web
            crawling, unified tool access, and a powerful operations dashboard.
          </p>

          {/* Meta Badges with Staggered Animation */}
          <div
            className="flex flex-wrap gap-6 mb-12"
            style={{
              display: 'flex',
              gap: '24px',
              marginBottom: '48px',
              flexWrap: 'wrap',
            }}
          >
            {[
              { label: 'Version', value: 'v1.1.0' },
              { label: 'Services', value: '4 Integrated' },
              { label: 'Status', value: 'Production Ready', highlight: true },
              { label: 'License', value: 'Apache 2.0' },
            ].map((badge, i) => (
              <div
                key={badge.label}
                className="border-t border-[var(--border-amber)] pt-3"
                style={{
                  animation: prefersReducedMotion
                    ? 'none'
                    : `fadeUp 0.6s ease ${0.8 + i * 0.08}s both`,
                }}
              >
                <div className="font-[var(--font-mono)] text-xs text-[var(--text-muted)] uppercase tracking-[0.15em] mb-1">
                  {badge.label}
                </div>
                <div
                  className="font-[var(--font-display)] font-semibold text-sm"
                  style={{
                    color: badge.highlight ? 'var(--engram-teal)' : 'inherit',
                  }}
                >
                  {badge.value}
                </div>
              </div>
            ))}
          </div>

          {/* CTA Buttons with Hover Effects */}
          <div
            className="flex flex-col sm:flex-row gap-4"
            style={{ animation: prefersReducedMotion ? 'none' : 'fadeUp 0.8s ease 1s both' }}
          >
            <Button size="lg">Get Started</Button>
            <Link href="#platform">
              <Button variant="secondary" size="lg">
                Explore Platform
              </Button>
            </Link>
          </div>
        </div>

        {/* Right Content - Service Cards */}
        <div className="relative">
          {/* Connecting Vertical Dashed Line */}
          <div
            className="absolute left-0 top-0 bottom-0 w-px"
            style={{
              background:
                'linear-gradient(to bottom, transparent, rgba(242,169,59,0.3), transparent)',
              opacity: hoveredService !== null ? 0.6 : 0.3,
              transition: 'opacity 0.3s ease',
              marginLeft: '-16px',
            }}
          />

          <div className="space-y-6">
            {services.map((service, index) => (
              <div key={`${service.name}-${index}`} className="relative">
                {/* Active Indicator Dot */}
                {hoveredService === index && (
                  <div
                    className="absolute -left-8 top-1/2 w-3 h-3 rounded-full"
                    style={{
                      background: getColorVar(service.color),
                      transform: 'translateY(-50%)',
                      animation: prefersReducedMotion ? 'none' : 'serviceGlow 1.5s ease infinite',
                      zIndex: 5,
                    }}
                  />
                )}

                <button
                  type="button"
                  className="service-card w-full group"
                  style={{
                    background: getColorBg(service.color),
                    border: `1px solid ${
                      hoveredService === index
                        ? getColorBorderHover(service.color)
                        : getColorBorder(service.color)
                    }`,
                    borderRadius: '12px',
                    padding: '24px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    gap: '12px',
                    transition:
                      'all 0.3s cubic-bezier(0.23, 1, 0.320, 1), box-shadow 0.3s ease',
                    animation: prefersReducedMotion
                      ? 'none'
                      : `slideInRight 0.6s ease ${0.3 + index * 0.15}s both`,
                    transform: `${
                      hoveredService === index
                        ? 'translateY(-8px) scale(1.03)'
                        : 'translateY(0) scale(1)'
                    } translateY(${scrollY * 0.05 * (index + 1)}px)`,
                    boxShadow:
                      hoveredService === index
                        ? `0 12px 32px rgba(0,0,0,0.2), 0 0 20px ${getColorVar(
                            service.color
                          )}15`
                        : '0 2px 8px rgba(0,0,0,0.1)',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={() => setHoveredService(index)}
                  onMouseLeave={() => setHoveredService(null)}
                  aria-label={`Service: ${service.name} - ${service.description}`}
                >
                  <div
                    className="service-card"
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: '4px',
                      borderRadius: '12px 0 0 12px',
                      background: getColorVar(service.color),
                      opacity: hoveredService === index ? 1 : 0.6,
                      transition: 'opacity 0.3s ease',
                    }}
                  />

                  <div style={{ position: 'relative', paddingLeft: '12px', width: '100%' }}>
                    <div
                      className="text-3xl mb-2 block"
                      style={{
                        animation:
                          hoveredService === index && !prefersReducedMotion
                            ? 'synapseFlare 0.6s ease-in-out'
                            : 'none',
                        transition: 'transform 0.3s ease',
                        transform:
                          hoveredService === index ? 'scale(1.1)' : 'scale(1)',
                      }}
                    >
                      {service.icon}
                    </div>

                    <div className="flex-1 w-full">
                      <div
                        className="font-[var(--font-display)] font-semibold text-lg"
                        style={{
                          color: getColorVar(service.color),
                          transition: 'color 0.3s ease',
                        }}
                      >
                        {service.name}
                      </div>

                      <div className="font-[var(--font-mono)] text-sm text-[var(--text-secondary)] mt-1">
                        {service.description}
                      </div>

                      {/* Tech Stack - Shows on Hover */}
                      {hoveredService === index && service.tech && (
                        <div
                          className="font-[var(--font-mono)] text-xs text-[var(--text-muted)] mt-3 pt-3 border-t border-[var(--border)]"
                          style={{
                            animation: prefersReducedMotion ? 'none' : 'fadeUp 0.3s ease',
                          }}
                        >
                          {service.tech}
                        </div>
                      )}

                      {service.port && (
                        <div
                          className="font-[var(--font-mono)] text-xs text-[var(--text-muted)] mt-2"
                          style={{
                            opacity: hoveredService === index ? 1 : 0.7,
                            transition: 'opacity 0.3s ease',
                          }}
                        >
                          {service.port}
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Scroll Indicator Chevron */}
      {scrollY < 100 && (
        <div
          className="absolute bottom-12 left-1/2 transform -translate-x-1/2 flex flex-col items-center gap-2"
          style={{
            animation: prefersReducedMotion
              ? 'none'
              : `${scrollY > 50 ? 'fadeOutChevron' : 'bounceChevron'} 2s ease infinite`,
            pointerEvents: 'none',
          }}
        >
          <span className="font-[var(--font-mono)] text-xs text-[var(--engram-amber)] uppercase tracking-[0.1em]">
            Explore
          </span>
          <ChevronDown size={20} color="var(--engram-amber)" strokeWidth={1.5} />
        </div>
      )}
    </section>
  );
}
