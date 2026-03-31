'use client';

import { useEffect, useState } from 'react';
import {
  Terminal,
  Monitor,
  Bot,
  Cpu,
  Server,
  Globe,
  LayoutDashboard,
  Database,
  Zap,
  HardDrive,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Chip {
  id: string;
  label: string;
  icon: React.ReactNode;
}

interface Layer {
  id: string;
  label: string;
  sublabel: string;
  chips: Chip[];
  accentVar: string;
  bgVar: string;
  animDelay: string;
}

interface Connector {
  label: string;
  accentVar: string;
}

interface Stat {
  value: string;
  label: string;
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const LAYERS: Layer[] = [
  {
    id: 'clients',
    label: 'CLIENTS',
    sublabel: 'AI Consumers',
    chips: [
      { id: 'cc', label: 'Claude Code', icon: <Terminal size={13} /> },
      { id: 'cd', label: 'Claude Desktop', icon: <Monitor size={13} /> },
      { id: 'any', label: 'Any AI Client', icon: <Bot size={13} /> },
    ],
    accentVar: 'var(--engram-amber)',
    bgVar: 'rgba(242,169,59,0.06)',
    animDelay: '0.55s',
  },
  {
    id: 'mcp',
    label: 'MCP LAYER',
    sublabel: 'Protocol Bridge',
    chips: [
      { id: 'mcp', label: 'Engram MCP Server', icon: <Cpu size={13} /> },
      { id: 'tools', label: '25 Tools', icon: <Zap size={13} /> },
    ],
    accentVar: 'var(--engram-violet)',
    bgVar: 'rgba(124,92,191,0.06)',
    animDelay: '0.40s',
  },
  {
    id: 'platform',
    label: 'PLATFORM',
    sublabel: 'Core Services',
    chips: [
      { id: 'memapi', label: 'Memory API', icon: <Server size={13} /> },
      { id: 'crawler', label: 'Crawler API', icon: <Globe size={13} /> },
      { id: 'dash', label: 'Dashboard', icon: <LayoutDashboard size={13} /> },
    ],
    accentVar: 'var(--engram-teal)',
    bgVar: 'rgba(46,196,196,0.05)',
    animDelay: '0.25s',
  },
  {
    id: 'data',
    label: 'DATA',
    sublabel: 'Storage Layer',
    chips: [
      { id: 'weaviate', label: 'Weaviate', icon: <Database size={13} /> },
      { id: 'redis', label: 'Redis', icon: <Zap size={13} /> },
      { id: 'chromadb', label: 'ChromaDB', icon: <HardDrive size={13} /> },
    ],
    accentVar: 'rgba(160,155,184,0.9)',
    bgVar: 'rgba(255,255,255,0.025)',
    animDelay: '0.10s',
  },
];

const CONNECTORS: Connector[] = [
  { label: 'MCP Protocol', accentVar: 'var(--engram-amber)' },
  { label: 'HTTP REST', accentVar: 'var(--engram-violet)' },
  { label: 'TCP / Storage', accentVar: 'var(--engram-teal)' },
];

const STATS: Stat[] = [
  { value: '25', label: 'MCP Tools' },
  { value: '3-Tier', label: 'Memory' },
  { value: '<30ms', label: 'Search' },
  { value: '8', label: 'Docker Services' },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function ServiceChip({
  chip,
  accentVar,
  reduced,
}: {
  chip: Chip;
  accentVar: string;
  reduced: boolean;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <span
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={
        {
          display: 'inline-flex',
          alignItems: 'center',
          gap: '5px',
          padding: '5px 11px',
          borderRadius: '999px',
          fontSize: '11px',
          fontFamily: 'var(--font-mono)',
          letterSpacing: '0.02em',
          color: hovered ? accentVar : 'var(--text-secondary)',
          backgroundColor: hovered
            ? `color-mix(in srgb, ${accentVar} 14%, transparent)`
            : 'rgba(255,255,255,0.04)',
          border: `1px solid ${hovered ? accentVar : 'rgba(255,255,255,0.08)'}`,
          boxShadow: hovered && !reduced
            ? `0 0 12px color-mix(in srgb, ${accentVar} 30%, transparent), 0 0 4px color-mix(in srgb, ${accentVar} 20%, transparent)`
            : 'none',
          transition: reduced
            ? 'none'
            : 'all 0.22s cubic-bezier(0.23, 1, 0.32, 1)',
          cursor: 'default',
          userSelect: 'none',
          whiteSpace: 'nowrap',
        } as React.CSSProperties
      }
    >
      <span style={{ opacity: hovered ? 1 : 0.6, display: 'flex' }}>
        {chip.icon}
      </span>
      {chip.label}
    </span>
  );
}

function LayerConnector({
  connector,
  reduced,
}: {
  connector: Connector;
  reduced: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '10px',
        padding: '2px 0',
      }}
    >
      {/* Left filler line */}
      <div
        style={{
          flex: 1,
          height: '1px',
          background: `linear-gradient(to right, transparent, rgba(255,255,255,0.06))`,
        }}
      />

      {/* Arrow + label group */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '2px',
        }}
      >
        {/* Vertical line segment */}
        <div
          style={{
            width: '1px',
            height: '14px',
            backgroundColor: connector.accentVar,
            opacity: 0.45,
          }}
        />

        {/* Arrow SVG */}
        <svg width="10" height="7" viewBox="0 0 10 7" fill="none">
          <path
            d="M5 7L0 0H10L5 7Z"
            fill={connector.accentVar}
            opacity="0.7"
          />
        </svg>

        {/* Protocol label */}
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '9px',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: connector.accentVar,
            opacity: 0.75,
            marginTop: '1px',
            animation: reduced ? 'none' : 'arch-pulse 3s ease-in-out infinite',
          }}
        >
          {connector.label}
        </span>
      </div>

      {/* Right filler line */}
      <div
        style={{
          flex: 1,
          height: '1px',
          background: `linear-gradient(to left, transparent, rgba(255,255,255,0.06))`,
        }}
      />
    </div>
  );
}

function ArchLayer({
  layer,
  reduced,
  visible,
}: {
  layer: Layer;
  reduced: boolean;
  visible: boolean;
}) {
  return (
    <div
      role="region"
      aria-label={`${layer.label} — ${layer.sublabel}`}
      style={{
        display: 'flex',
        alignItems: 'stretch',
        borderRadius: '10px',
        overflow: 'hidden',
        border: `1px solid rgba(255,255,255,0.06)`,
        backgroundColor: layer.bgVar,
        backdropFilter: 'blur(8px)',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(16px)',
        transition: reduced
          ? 'none'
          : `opacity 0.5s ease ${layer.animDelay}, transform 0.5s cubic-bezier(0.23, 1, 0.32, 1) ${layer.animDelay}`,
        minHeight: '64px',
      }}
    >
      {/* Left accent bar + rotated label */}
      <div
        style={{
          width: '44px',
          flexShrink: 0,
          backgroundColor: `color-mix(in srgb, ${layer.accentVar} 12%, transparent)`,
          borderRight: `1px solid rgba(255,255,255,0.05)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%) rotate(-90deg)',
            whiteSpace: 'nowrap',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '8px',
              fontWeight: 700,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: layer.accentVar,
              opacity: 0.9,
            }}
          >
            {layer.label}
          </span>
        </div>
      </div>

      {/* Chips area */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '8px',
          padding: '14px 18px',
        }}
      >
        {layer.chips.map((chip) => (
          <ServiceChip
            key={chip.id}
            chip={chip}
            accentVar={layer.accentVar}
            reduced={reduced}
          />
        ))}
      </div>

      {/* Right sublabel */}
      <div
        style={{
          width: '80px',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderLeft: '1px solid rgba(255,255,255,0.04)',
          padding: '0 10px',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '9px',
            color: 'var(--text-muted)',
            letterSpacing: '0.06em',
            textAlign: 'center',
            lineHeight: 1.4,
          }}
        >
          {layer.sublabel}
        </span>
      </div>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function PlatformArchitecture() {
  const [visible, setVisible] = useState(false);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const handler = () => setReduced(mq.matches);
    mq.addEventListener('change', handler);

    // Trigger entrance after a single paint to allow CSS transition to fire
    const raf = requestAnimationFrame(() => setVisible(true));

    return () => {
      mq.removeEventListener('change', handler);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
      {/* Keyframes injected once */}
      <style>{`
        @keyframes arch-pulse {
          0%, 100% { opacity: 0.55; }
          50% { opacity: 0.9; }
        }
        @keyframes stat-count-in {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* ── Architecture diagram ── */}
      <div
        role="img"
        aria-label="Engram Platform Architecture Diagram — four layers: Clients, MCP Layer, Platform Services, and Data Storage connected by protocol arrows"
        style={{ display: 'flex', flexDirection: 'column', gap: '0' }}
      >
        {LAYERS.map((layer, i) => (
          <div key={layer.id}>
            <ArchLayer layer={layer} reduced={reduced} visible={visible} />
            {i < CONNECTORS.length && (
              <div style={{ padding: '4px 0' }}>
                <LayerConnector connector={CONNECTORS[i]} reduced={reduced} />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── Stats row ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '1px',
          marginTop: '24px',
          borderRadius: '10px',
          overflow: 'hidden',
          border: '1px solid rgba(255,255,255,0.06)',
          backgroundColor: 'rgba(255,255,255,0.04)',
          opacity: visible ? 1 : 0,
          transition: reduced ? 'none' : 'opacity 0.5s ease 0.75s',
        }}
      >
        {STATS.map((stat, i) => (
          <div
            key={stat.label}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '18px 12px',
              backgroundColor: 'rgba(255,255,255,0.02)',
              borderRight: i < STATS.length - 1
                ? '1px solid rgba(255,255,255,0.05)'
                : 'none',
              animation: visible && !reduced
                ? `stat-count-in 0.45s ease ${0.8 + i * 0.08}s both`
                : 'none',
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(18px, 3vw, 26px)',
                fontWeight: 700,
                color: 'var(--engram-amber)',
                lineHeight: 1,
                letterSpacing: '-0.02em',
              }}
            >
              {stat.value}
            </span>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '10px',
                color: 'var(--text-muted)',
                marginTop: '5px',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                textAlign: 'center',
              }}
            >
              {stat.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
