'use client';

import { useState } from 'react';
import { Card } from './ui/Card';

interface ServiceInfo {
  id: string;
  name: string;
  description: string;
  port: number;
  tech: string[];
  color: 'amber' | 'violet' | 'teal' | 'rose';
  colorVar: string;
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
  },
  {
    id: 'crawler',
    name: 'AiCrawler',
    description: 'OSINT web crawler with AI-powered analysis pipeline',
    port: 11235,
    tech: ['FastAPI', 'Crawl4AI', 'ChromaDB'],
    color: 'violet',
    colorVar: 'var(--engram-violet)',
  },
  {
    id: 'mcp',
    name: 'MCP Server',
    description: 'Unified protocol server with dual transport support',
    port: 3000,
    tech: ['Node.js', 'TypeScript', 'Hono'],
    color: 'teal',
    colorVar: 'var(--engram-teal)',
  },
  {
    id: 'platform',
    name: 'Dashboard',
    description: 'Unified frontend with visual analytics and control',
    port: 3002,
    tech: ['Next.js 15', 'React 19', 'Tailwind'],
    color: 'rose',
    colorVar: 'var(--engram-rose)',
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
  },
  {
    id: 'redis',
    name: 'Redis Cache',
    description: 'High-speed caching layer',
    port: 6379,
    tech: ['Redis', 'Cache'],
    color: 'violet',
    colorVar: 'var(--engram-violet)',
  },
  {
    id: 'chromadb',
    name: 'ChromaDB',
    description: 'Vector embedding storage',
    port: 8000,
    tech: ['ChromaDB', 'Embeddings'],
    color: 'teal',
    colorVar: 'var(--engram-teal)',
  },
  {
    id: 'lmstudio',
    name: 'LM Studio',
    description: 'Local LLM inference server',
    port: 1234,
    tech: ['LM Studio', 'LLM'],
    color: 'rose',
    colorVar: 'var(--engram-rose)',
  },
];

function ServiceBlock({
  service,
  isHovered,
  onHover,
}: {
  service: ServiceInfo;
  isHovered: boolean;
  onHover: (id: string | null) => void;
}) {
  return (
    <button
      onMouseEnter={() => onHover(service.id)}
      onMouseLeave={() => onHover(null)}
      onClick={() => {}}
      className="w-full text-left focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[var(--void)]"
      style={{ '--focus-ring': service.colorVar } as React.CSSProperties}
    >
      <Card
        variant="glass"
        padding="md"
        className={`
          relative overflow-hidden transition-all duration-300 cursor-pointer
          ${
            isHovered
              ? 'border-current shadow-lg'
              : 'border-[var(--border)] hover:border-[var(--border)]/80'
          }
        `}
        style={{
          borderColor: isHovered ? service.colorVar : undefined,
          boxShadow: isHovered
            ? `0 0 20px ${service.colorVar}20, 0 4px 12px rgba(0,0,0,0.3)`
            : undefined,
        }}
      >
        {/* Accent left border */}
        <div
          className="absolute left-0 top-0 bottom-0 w-1 transition-all duration-300"
          style={{
            backgroundColor: service.colorVar,
            opacity: isHovered ? 1 : 0.3,
          }}
        />

        <div className="pl-3">
          {/* Service name and port */}
          <div className="flex items-start justify-between gap-2 mb-2">
            <h3 className="font-[var(--font-display)] font-bold text-sm text-[var(--text-primary)]">
              {service.name}
            </h3>
            <span
              className="text-xs font-[var(--font-mono)] px-2 py-1 rounded-full"
              style={{
                backgroundColor: `${service.colorVar}20`,
                color: service.colorVar,
                border: `1px solid ${service.colorVar}40`,
              }}
            >
              :{service.port}
            </span>
          </div>

          {/* Description - visible on hover */}
          {isHovered && (
            <p className="text-xs text-[var(--text-secondary)] mb-3 line-clamp-2">
              {service.description}
            </p>
          )}

          {/* Tech stack */}
          <div className="flex flex-wrap gap-1">
            {service.tech.map((tech) => (
              <span
                key={tech}
                className="text-xs font-[var(--font-mono)] px-2 py-0.5 rounded border transition-all duration-300"
                style={{
                  backgroundColor: `${service.colorVar}10`,
                  color: service.colorVar,
                  borderColor: `${service.colorVar}40`,
                  opacity: isHovered ? 1 : 0.6,
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

  return (
    <div className="space-y-8">
      {/* Services Layer */}
      <div className="space-y-3">
        <h3 className="font-[var(--font-mono)] text-xs font-bold uppercase tracking-wider text-[var(--engram-amber)] mb-4">
          Services
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {services.map((service) => (
            <ServiceBlock
              key={service.id}
              service={service}
              isHovered={hoveredService === service.id}
              onHover={setHoveredService}
            />
          ))}
        </div>

        {/* Connection lines visual indicator */}
        <div className="mt-6 pt-6 border-t border-[var(--border)]/50">
          <div className="flex items-center justify-center text-xs text-[var(--text-muted)] font-[var(--font-mono)]">
            <span className="w-12 h-px bg-gradient-to-r from-transparent to-[var(--engram-amber)]/50" />
            <span className="mx-2">CONNECTED</span>
            <span className="w-12 h-px bg-gradient-to-l from-transparent to-[var(--engram-amber)]/50" />
          </div>
        </div>
      </div>

      {/* Infrastructure Layer */}
      <div className="space-y-3">
        <h3 className="font-[var(--font-mono)] text-xs font-bold uppercase tracking-wider text-[var(--engram-violet)] mb-4">
          Infrastructure
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {infrastructure.map((service) => (
            <ServiceBlock
              key={service.id}
              service={service}
              isHovered={hoveredService === service.id}
              onHover={setHoveredService}
            />
          ))}
        </div>
      </div>

      {/* Architecture summary */}
      <div className="rounded-lg bg-[var(--surface-1)] border border-[var(--border)] p-4">
        <p className="text-xs text-[var(--text-secondary)] font-[var(--font-mono)] leading-relaxed">
          <span className="text-[var(--engram-amber)]">→</span> All services orchestrated via Docker Compose{' '}
          <span className="text-[var(--engram-violet)]">→</span> Nginx reverse proxy handles routing{' '}
          <span className="text-[var(--engram-teal)]">→</span> Multi-tenant isolation at database level
        </p>
      </div>
    </div>
  );
}
