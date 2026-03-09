'use client';

import { useState, useEffect } from 'react';
import { Button } from './ui/Button';

interface MemoryLayer {
  name: string;
  type: string;
  color: 'amber' | 'violet' | 'teal' | 'violet-dim' | 'amber-dim';
  active: boolean;
}

const memoryLayers: MemoryLayer[] = [
  { name: 'Episodic', type: 'Events & Experiences', color: 'amber', active: true },
  { name: 'Semantic', type: 'Concepts & Knowledge', color: 'violet', active: true },
  { name: 'Procedural', type: 'Skills & Methods', color: 'teal', active: false },
  { name: 'Working', type: 'Active Processing', color: 'violet-dim', active: false },
  { name: 'Long-term', type: 'Persistent Storage', color: 'amber-dim', active: false },
];

export function Hero() {
  const [scrollY, setScrollY] = useState(0);
  const [hoveredLayer, setHoveredLayer] = useState<number | null>(null);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const getLayerBackground = (color: string) => {
    const backgrounds = {
      amber: 'rgba(242,169,59,0.08)',
      violet: 'rgba(124,92,191,0.08)',
      teal: 'rgba(46,196,196,0.06)',
      'violet-dim': 'rgba(124,92,191,0.05)',
      'amber-dim': 'rgba(242,169,59,0.04)',
    };
    return backgrounds[color as keyof typeof backgrounds] || backgrounds['amber-dim'];
  };

  const getLayerBorder = (color: string) => {
    const borders = {
      amber: 'rgba(242,169,59,0.2)',
      violet: 'rgba(124,92,191,0.2)',
      teal: 'rgba(46,196,196,0.15)',
      'violet-dim': 'rgba(124,92,191,0.12)',
      'amber-dim': 'rgba(242,169,59,0.1)',
    };
    return borders[color as keyof typeof borders] || borders['amber-dim'];
  };

  const getLayerColor = (color: string) => {
    const colors = {
      amber: 'var(--engram-amber)',
      violet: 'var(--engram-violet)',
      teal: 'var(--engram-teal)',
      'violet-dim': 'var(--engram-violet-dim)',
      'amber-dim': 'var(--engram-amber-dim)',
    };
    return colors[color as keyof typeof colors] || colors['amber-dim'];
  };

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
            Multi-layer AI Memory System
          </div>

          <h1 
            className="font-[var(--font-display)] font-black text-[clamp(3rem,8vw,6rem)] leading-[0.9] tracking-[0.15em] mb-4"
            style={{
              color: 'transparent',
              background: 'linear-gradient(135deg, #FFC15E 0%, #F2A93B 40%, #9B7DE0 100%)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              animation: 'fadeUp 0.8s ease 0.2s both'
            }}
          >
            ENGRAM
          </h1>

          <p 
            className="font-[var(--font-body)] italic text-[clamp(1.1rem,2vw,1.4rem)] text-[var(--text-secondary)] leading-relaxed mb-12"
            style={{ animation: 'fadeUp 0.8s ease 0.6s both' }}
          >
            A revolutionary vector database that mimics the human brain&#39;s multi-layered memory architecture, 
            enabling AI systems with persistent, contextual, and evolving intelligence.
          </p>

          <div 
            className="flex flex-wrap gap-6 mb-12"
            style={{ animation: 'fadeUp 0.8s ease 0.8s both' }}
          >
            <div className="border-t border-[var(--border-amber)] pt-3">
              <div className="font-[var(--font-mono)] text-xs text-[var(--text-muted)] uppercase tracking-[0.15em] mb-1">Version</div>
              <div className="font-[var(--font-display)] font-semibold text-sm">v2.4.0</div>
            </div>
            <div className="border-t border-[var(--border-amber)] pt-3">
              <div className="font-[var(--font-mono)] text-xs text-[var(--text-muted)] uppercase tracking-[0.15em] mb-1">License</div>
              <div className="font-[var(--font-display)] font-semibold text-sm">Apache 2.0</div>
            </div>
            <div className="border-t border-[var(--border-amber)] pt-3">
              <div className="font-[var(--font-mono)] text-xs text-[var(--text-muted)] uppercase tracking-[0.15em] mb-1">Status</div>
              <div className="font-[var(--font-display)] font-semibold text-sm text-[var(--engram-teal)]">Production Ready</div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4" style={{ animation: 'fadeUp 0.8s ease 1s both' }}>
            <Button size="lg">
              Get Started
            </Button>
            <Button variant="secondary" size="lg">
              View Documentation
            </Button>
          </div>
        </div>

        {/* Right Content - Memory Stack Visualization */}
        <div className="relative">
          <div className="memory-stack">
            {memoryLayers.map((layer, index) => (
              <button
                key={`${layer.name}-${index}`}
                type="button"
                className="memory-layer"
                style={{
                  background: getLayerBackground(layer.color),
                  border: `1px solid ${getLayerBorder(layer.color)}`,
                  animation: layer.active ? `layerPulse 4s ease-in-out infinite ${index * 0.8}s` : 'none',
                  transform: `translateY(${scrollY * 0.1 * (index + 1)}px) ${hoveredLayer === index ? 'translateX(-8px)' : 'translateX(0)'}`,
                  marginLeft: `${index * 8}px`,
                }}
                onMouseEnter={() => setHoveredLayer(index)}
                onMouseLeave={() => setHoveredLayer(null)}
                aria-label={`Memory layer: ${layer.name} - ${layer.type}`}
              >
                <div className="w-7 h-7 flex items-center justify-center">
                  <div 
                    className="w-3 h-3 rounded-full"
                    style={{ background: getLayerColor(layer.color) }}
                  />
                </div>
                <div className="flex-1">
                  <div className="font-[var(--font-mono)] text-xs font-medium tracking-[0.08em]">{layer.name}</div>
                  <div className="font-[var(--font-mono)] text-xs text-[var(--text-muted)] mt-0.5">{layer.type}</div>
                </div>
                <div 
                  className="w-2 h-2 rounded-full"
                  style={{ 
                    background: layer.active ? getLayerColor(layer.color) : 'var(--text-muted)',
                    opacity: layer.active ? 1 : 0.3
                  }}
                />
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
