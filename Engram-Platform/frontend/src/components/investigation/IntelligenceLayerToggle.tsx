'use client';

import { ChevronDown, Clock, Layers, Layers2, Layers3 } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/src/lib/utils';
import { type IntelligenceLayer, useIntelligenceStore } from '@/src/stores/canvasStore';

const layerConfig: Record<
  IntelligenceLayer,
  {
    icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
    color: string;
    label: string;
    description: string;
  }
> = {
  raw: {
    icon: Layers3,
    color: 'var(--color-neutral)',
    label: 'RAW',
    description: 'Unprocessed source data',
  },
  processed: {
    icon: Layers2,
    color: 'var(--color-intelligence)',
    label: 'PROCESSED',
    description: 'Filtered & analyzed',
  },
  agent: {
    icon: Layers,
    color: 'var(--color-active)',
    label: 'AGENT',
    description: 'AI-derived insights',
  },
};

const layerOrder: IntelligenceLayer[] = ['raw', 'processed', 'agent'];

interface IntelligenceLayerToggleProps {
  className?: string;
  compact?: boolean;
}

const memoryDepthOptions: { hours: number; label: string }[] = [
  { hours: 1, label: '1h' },
  { hours: 6, label: '6h' },
  { hours: 24, label: '24h' },
  { hours: 48, label: '48h' },
  { hours: 168, label: '1w' },
  { hours: 720, label: '30d' },
];

export function IntelligenceLayerToggle({
  className,
  compact = false,
}: IntelligenceLayerToggleProps) {
  const { intelligenceLayer, setIntelligenceLayer, memoryDepthHours, setMemoryDepth } =
    useIntelligenceStore();
  const [depthOpen, setDepthOpen] = useState(false);

  const currentDepthLabel =
    memoryDepthOptions.find((o) => o.hours === memoryDepthHours)?.label ?? `${memoryDepthHours}h`;

  return (
    <div className={cn('flex flex-col gap-3', compact && 'flex-row gap-2', className)}>
      <div
        className={cn(
          'text-[9px] font-mono font-semibold text-[var(--color-neutral)] uppercase tracking-wider',
          compact && 'sr-only',
        )}
      >
        Intelligence Layer
      </div>

      <div className={cn('flex gap-2', compact ? 'flex-row gap-1' : 'flex-col')}>
        {layerOrder.map((layer) => {
          const config = layerConfig[layer];
          const Icon = config.icon;
          const isActive = intelligenceLayer === layer;

          return (
            <button
              key={layer}
              type="button"
              onClick={() => setIntelligenceLayer(layer)}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-lg transition-all',
                'border',
                isActive ? 'border-transparent' : 'border-white/5 hover:border-white/10',
                compact ? 'flex-row' : 'flex-col',
              )}
              style={{
                backgroundColor: isActive
                  ? `color-mix(in srgb, ${config.color} 10%, transparent)`
                  : 'transparent',
              }}
            >
              <Icon
                className={cn('w-4 h-4', isActive ? 'opacity-100' : 'opacity-40')}
                style={{ color: isActive ? config.color : 'var(--color-neutral)' }}
              />
              <div className="flex-1 min-w-0">
                <div
                  className={cn(
                    'text-xs font-semibold',
                    isActive ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-neutral)]',
                  )}
                >
                  {config.label}
                </div>
                {!compact && (
                  <div className="text-[10px] text-[var(--color-text-muted)]">
                    {config.description}
                  </div>
                )}
              </div>
            </button>
          );
        })}

        {compact && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setDepthOpen((o) => !o)}
              className={cn(
                'flex items-center gap-1 px-2 py-2 rounded-lg transition-all',
                'border border-white/5 hover:border-white/10 bg-transparent',
              )}
            >
              <Clock className="w-3.5 h-3.5 text-[var(--color-neutral)]" />
              <span className="text-xs font-mono text-[var(--color-neutral)]">
                {currentDepthLabel}
              </span>
              <ChevronDown className="w-3 h-3 text-[var(--color-neutral)]" />
            </button>

            {depthOpen && (
              <div className="absolute top-full right-0 mt-1 bg-[var(--color-void)] border border-white/10 rounded-lg shadow-xl py-1 z-50 min-w-[80px]">
                {memoryDepthOptions.map((opt) => (
                  <button
                    key={opt.hours}
                    type="button"
                    onClick={() => {
                      setMemoryDepth(opt.hours);
                      setDepthOpen(false);
                    }}
                    className={cn(
                      'w-full text-left px-3 py-1.5 text-xs font-mono transition-colors',
                      opt.hours === memoryDepthHours
                        ? 'text-[var(--color-intelligence)] bg-white/5'
                        : 'text-[var(--color-neutral)] hover:text-[var(--color-text-primary)] hover:bg-white/5',
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {!compact && (
        <div className="space-y-2">
          <div className="text-[9px] font-mono font-semibold text-[var(--color-neutral)] uppercase tracking-wider">
            Memory Depth
          </div>
          <div className="flex flex-wrap gap-1">
            {memoryDepthOptions.map((opt) => (
              <button
                key={opt.hours}
                type="button"
                onClick={() => setMemoryDepth(opt.hours)}
                className={cn(
                  'px-2 py-1 text-[10px] font-mono rounded border transition-all',
                  opt.hours === memoryDepthHours
                    ? 'bg-[var(--color-intelligence)]/10 border-[var(--color-intelligence)]/30 text-[var(--color-intelligence)]'
                    : 'bg-transparent border-white/5 text-[var(--color-neutral)] hover:border-white/10',
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="text-[8px] text-[var(--color-neutral)] mt-2">
        {intelligenceLayer === 'raw' && '● High volume'}
        {intelligenceLayer === 'processed' && '● Standard view'}
        {intelligenceLayer === 'agent' && '● AI insights'}
      </div>
    </div>
  );
}
