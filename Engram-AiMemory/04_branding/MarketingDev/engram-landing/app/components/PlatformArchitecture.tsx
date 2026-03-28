'use client';

import { useState, useEffect } from 'react';
import { Card } from './ui/Card';

interface ServiceInfo {
  id: string;
  name: string;
  description: string;
  port: number;
  tech: string[];
  color: 'amber' | 'violet' | 'teal' | 'rose';
  colorVar: string;
  role?: string;
}

const services: ServiceInfo[] = [
  {
    id: 'memory',
    name: 'AiMemory',
    description: 'Persistent vector memory system with 3-tier architecture',
    port: 8000,
    tech: ['FastAPI', 'Weaviate', 'Redis'],
    color: 'amber',
    colorVar: 'var(--engram-amber)',
    role: 'Core memory layer',
  },
  {
    id: 'crawler',
    name: 'AiCrawler',
    description: 'OSINT web crawler with AI-powered analysis pipeline',
    port: 11235,
    tech: ['FastAPI', 'Crawl4AI', 'ChromaDB'],
    color: 'violet',
    colorVar: 'var(--engram-violet)',
    role: 'Web intelligence',
  },
  {
    id: 'mcp',
    name: 'MCP Server',
    description: 'Unified protocol server with dual transport support',
    port: 3000,
    tech: ['Node.js', 'TypeScript', 'Hono'],
    color: 'teal',
    colorVar: 'var(--engram-teal)',
    role: 'AI bridge',
  },
  {
    id: 'platform',
    name: 'Dashboard',
    description: 'Unified frontend with visual analytics and control',
    port: 3002,
    tech: ['Next.js 15', 'React 19', 'Tailwind'],
    color: 'rose',
    colorVar: 'var(--engram-rose)',
    role: 'Operations UI',
  },
];

const infrastructure: ServiceInfo[] = [
  {
    id: 'weaviate',
    name: 'Weaviate',
    description: 'Vector database for semantic search',
    port: 8080,
    tech: ['Weaviate', 'Vector DB'],
    color: 'amber',
    colorVar: 'var(--engram-amber)',
    role: 'Vector storage',
  },
  {
    id: 'redis',
    name: 'Redis Cache',
    description: 'High-speed caching layer',
    port: 6379,
    tech: ['Redis', 'Cache'],
    color: 'violet',
    colorVar: 'var(--engram-violet)',
    role: 'Hot cache',
  },
  {
    id: 'chromadb',
    name: 'ChromaDB',
    description: 'Vector embedding storage',
    port: 8000,
    tech: ['ChromaDB', 'Embeddings'],
    color: 'teal',
    colorVar: 'var(--engram-teal)',
    role: 'Embedding store',
  },
  {
    id: 'lmstudio',
    name: 'LM Studio',
    description: 'Local LLM inference server',
    port: 1234,
    tech: ['LM Studio', 'LLM'],
    color: 'rose',
    colorVar: 'var(--engram-rose)',
    role: 'LLM inference',
  },
];

function ServiceBlock({
  service,
  isHovered,
  onHover,
  isInfrastructure,
}: {
  service: ServiceInfo;
  isHovered: boolean;
  onHover: (id: string | null) => void;
  isInfrastructure?: boolean;
}) {
  return (
    <button
      onMouseEnter={() => onHover(service.id)}
      onMouseLeave={() => onHover(null)}
      onClick={() => {}}
      className="w-full text-left focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[var(--void)] group"
      style={{ '--focus-ring': service.colorVar } as React.CSSProperties}
    >
      <style jsx>{`
        @keyframes serviceSlideIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes dataFlow {
          0% {
            opacity: 0;
            offset-distance: 0%;
          }
          100% {
            opacity: 0;
            offset-distance: 100%;
          }
        }

        @keyframes particleFloat {
          0% {
            opacity: 0;
            transform: translate(0, 0) scale(0.8);
          }
          10% {
            opacity: 1;
          }
          90% {
            opacity: 1;
          }
          100% {
            opacity: 0;
            transform: translate(var(--tx), var(--ty))) scale(1);
          }
        }

        @keyframes borderPulse {
          0%,
          100% {
            border-color: ${service.colorVar}40;
          }
          50% {
            border-color: ${service.colorVar}80;
          }
        }

        @keyframes glassShimmer {
          0% {
            background-position: -1000px 0;
          }
          100% {
            background-position: 1000px 0;
          }
        }

        .service-block {
          animation: serviceSlideIn 0.5s cubic-bezier(0.23, 1, 0.32, 1) forwards;
        }

        .service-block-hover {
          border-color: ${isHovered ? service.colorVar : 'var(--border)'};
          box-shadow: ${
            isHovered
              ? `0 0 20px ${service.colorVar}30, 0 4px 16px rgba(0,0,0,0.4)`
              : '0 2px 8px rgba(0,0,0,0.15)'
          };
          transform: ${isHovered ? 'scale(1.02)' : 'scale(1)'};
          transition: all 0.3s cubic-bezier(0.23, 1, 0.32, 1);
        }
      `}</style>

      <Card
        variant="glass"
        padding="md"
        className={`
          relative overflow-hidden cursor-pointer service-block service-block-hover
          ${isInfrastructure ? 'opacity-90' : ''}
        `}
        style={{
          borderColor: isHovered ? service.colorVar : undefined,
          boxShadow: isHovered
            ? `0 0 20px ${service.colorVar}30, 0 4px 16px rgba(0,0,0,0.4)`
            : '0 2px 8px rgba(0,0,0,0.15)',
          transform: isHovered ? 'scale(1.02)' : 'scale(1)',
          transition: 'all 0.3s cubic-bezier(0.23, 1, 0.32, 1)',
        }}
      >
        {/* Animated Accent Left Border */}
        <div
          className="absolute left-0 top-0 bottom-0 w-1 transition-all duration-300"
          style={{
            backgroundColor: service.colorVar,
            opacity: isHovered ? 1 : 0.4,
          }}
        />

        {/* Glassmorphic Shimmer Effect on Hover */}
        {isHovered && (
          <div
            className="absolute inset-0 opacity-20 pointer-events-none"
            style={{
              background: `linear-gradient(
                90deg,
                transparent,
                ${service.colorVar}40,
                transparent
              )`,
              animation: 'glassShimmer 2s infinite',
              backgroundSize: '1000px 100%',
            }}
          />
        )}

        <div className="pl-3 relative z-10">
          {/* Service name and port */}
          <div className="flex items-start justify-between gap-2 mb-2">
            <h3 className="font-[var(--font-display)] font-bold text-sm text-[var(--text-primary)] group-hover:text-[inherit] transition-colors duration-300">
              {service.name}
            </h3>
            <span
              className="text-xs font-[var(--font-mono)] px-2.5 py-1 rounded-full transition-all duration-300"
              style={{
                backgroundColor: `${service.colorVar}15`,
                color: service.colorVar,
                border: `1px solid ${service.colorVar}40`,
                opacity: isHovered ? 1 : 0.8,
                transform: isHovered ? 'scale(1.05)' : 'scale(1)',
              }}
            >
              :{service.port}
            </span>
          </div>

          {/* Role Badge - visible on hover */}
          {isHovered && service.role && (
            <div
              className="text-xs text-[var(--text-secondary)] mb-2 font-[var(--font-mono)] py-1 px-2 rounded border"
              style={{
                borderColor: `${service.colorVar}30`,
                backgroundColor: `${service.colorVar}08`,
                color: service.colorVar,
                animation: 'fadeUp 0.3s ease',
              }}
            >
              {service.role}
            </div>
          )}

          {/* Description - visible on hover */}
          {isHovered && (
            <p
              className="text-xs text-[var(--text-secondary)] mb-3 line-clamp-2"
              style={{
                animation: 'fadeUp 0.3s ease',
              }}
            >
              {service.description}
            </p>
          )}

          {/* Tech stack */}
          <div className="flex flex-wrap gap-1">
            {service.tech.map((tech, i) => (
              <span
                key={tech}
                className="text-xs font-[var(--font-mono)] px-2 py-0.5 rounded border transition-all duration-300"
                style={{
                  backgroundColor: `${service.colorVar}10`,
                  color: service.colorVar,
                  borderColor: `${service.colorVar}40`,
                  opacity: isHovered ? 1 : 0.6,
                  transform: isHovered ? 'translateY(-2px)' : 'translateY(0)',
                  transitionDelay: `${i * 30}ms`,
                }}
              >
                {tech}
              </span>
            ))}
          </div>
        </div>
      </Card>
    </button>
  );
}


export function PlatformArchitecture() {
  const [hoveredService, setHoveredService] = useState<string | null>(null);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handleMotionChange = () => {
      setPrefersReducedMotion(mediaQuery.matches);
    };

    // Set initial value
    handleMotionChange();

    // Listen for prefers-reduced-motion changes
    mediaQuery.addEventListener('change', handleMotionChange);

    return () => {
      mediaQuery.removeEventListener('change', handleMotionChange);
    };
  }, []);

  return (
    <div className="space-y-8">
      <style jsx>{`
        @keyframes fadeUp {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes slideInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes connectionPulse {
          0%,
          100% {
            opacity: 0.5;
          }
          50% {
            opacity: 1;
          }
        }

        @keyframes lineDraw {
          0% {
            stroke-dashoffset: 1000;
          }
          100% {
            stroke-dashoffset: 0;
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

      {/* Legend */}
      <div
        className="flex flex-wrap gap-4 p-4 rounded-lg bg-[var(--surface-1)] border border-[var(--border)] text-xs font-[var(--font-mono)]"
        style={{
          animation: prefersReducedMotion ? 'none' : 'slideInUp 0.6s ease 0.2s both',
        }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: 'var(--engram-amber)' }}
          />
          <span className="text-[var(--text-secondary)]">Memory</span>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: 'var(--engram-violet)' }}
          />
          <span className="text-[var(--text-secondary)]">Intelligence</span>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: 'var(--engram-teal)' }}
          />
          <span className="text-[var(--text-secondary)]">Bridge</span>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: 'var(--engram-rose)' }}
          />
          <span className="text-[var(--text-secondary)]">Interface</span>
        </div>
      </div>

      {/* Services Layer */}
      <div className="space-y-3">
        <h3
          className="font-[var(--font-mono)] text-xs font-bold uppercase tracking-wider text-[var(--engram-amber)] mb-4"
          style={{
            animation: prefersReducedMotion ? 'none' : 'fadeUp 0.5s ease 0.1s both',
          }}
        >
          Core Services
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 relative">
          {services.map((service, i) => (
            <div
              key={service.id}
              style={{
                animation: prefersReducedMotion
                  ? 'none'
                  : `fadeUp 0.5s ease ${0.2 + i * 0.08}s both`,
              }}
            >
              <ServiceBlock
                service={service}
                isHovered={hoveredService === service.id}
                onHover={setHoveredService}
                isInfrastructure={false}
              />
            </div>
          ))}
        </div>

        {/* Connection Divider */}
        <div
          className="mt-6 pt-6 relative"
          style={{
            animation: prefersReducedMotion ? 'none' : 'slideInUp 0.6s ease 0.5s both',
          }}
        >
          <div className="flex items-center justify-center gap-2">
            <div
              className="flex-1 h-px"
              style={{
                background: 'linear-gradient(to right, transparent, var(--border), transparent)',
              }}
            />
            <span
              className="font-[var(--font-mono)] text-xs text-[var(--text-muted)] whitespace-nowrap px-2"
              style={{
                animation: prefersReducedMotion ? 'none' : 'connectionPulse 2s ease-in-out infinite',
              }}
            >
              ↓ Orchestrated ↓
            </span>
            <div
              className="flex-1 h-px"
              style={{
                background: 'linear-gradient(to right, transparent, var(--border), transparent)',
              }}
            />
          </div>
        </div>
      </div>

      {/* Infrastructure Layer */}
      <div className="space-y-3">
        <h3
          className="font-[var(--font-mono)] text-xs font-bold uppercase tracking-wider text-[var(--engram-violet)] mb-4"
          style={{
            animation: prefersReducedMotion ? 'none' : 'fadeUp 0.5s ease 0.3s both',
          }}
        >
          Infrastructure & Storage
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {infrastructure.map((service, i) => (
            <div
              key={service.id}
              style={{
                animation: prefersReducedMotion
                  ? 'none'
                  : `fadeUp 0.5s ease ${0.4 + i * 0.08}s both`,
                opacity: 0.95,
              }}
            >
              <ServiceBlock
                service={service}
                isHovered={hoveredService === service.id}
                onHover={setHoveredService}
                isInfrastructure={true}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Architecture Summary */}
      <div
        className="rounded-lg bg-[var(--surface-1)] border border-[var(--border)] p-4 space-y-3"
        style={{
          animation: prefersReducedMotion ? 'none' : 'slideInUp 0.6s ease 0.6s both',
        }}
      >
        <p className="text-xs text-[var(--text-secondary)] font-[var(--font-mono)] leading-relaxed">
          <span style={{ color: 'var(--engram-amber)' }} className="font-semibold">
            Docker Compose
          </span>{' '}
          orchestrates all services{' '}
          <span style={{ color: 'var(--engram-violet)', marginLeft: '4px', marginRight: '4px' }}>→</span>{' '}
          <span style={{ color: 'var(--engram-violet)' }} className="font-semibold">
            Nginx
          </span>{' '}
          reverse proxy routes traffic{' '}
          <span style={{ color: 'var(--engram-teal)', margin: '0 4px' }}>→</span>{' '}
          <span style={{ color: 'var(--engram-teal)' }} className="font-semibold">
            Weaviate
          </span>{' '}
          provides multi-tenant vector storage
        </p>

        <div
          className="flex items-center gap-2 text-xs text-[var(--text-muted)] font-[var(--font-mono)]"
          style={{
            animation: prefersReducedMotion ? 'none' : 'fadeUp 0.5s ease 0.8s both',
          }}
        >
          <div
            className="w-2 h-2 rounded-full"
            style={{
              backgroundColor: 'var(--engram-teal)',
              animation: prefersReducedMotion ? 'none' : 'connectionPulse 1.5s ease-in-out infinite',
            }}
          />
          <span>Production-grade: Multi-layer isolation, automatic scaling, full observability</span>
        </div>
      </div>

      {/* Responsive Notice */}
      <div
        className="text-xs text-[var(--text-muted)] font-[var(--font-mono)] italic px-4 py-2 border-l-2 border-[var(--border)] hidden md:block"
        style={{
          animation: prefersReducedMotion ? 'none' : 'fadeUp 0.5s ease 1s both',
        }}
      >
        💡 Responsive: Desktop shows full architecture diagram • Tablet simplifies to 2×2 grid •
        Mobile stacks vertically
      </div>
    </div>
  );
}
