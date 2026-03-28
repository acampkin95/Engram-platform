'use client';

import { AnimatePresence, motion } from 'framer-motion';
import {
  Building2,
  Calendar,
  ExternalLink,
  FileText,
  Globe,
  MapPin,
  Tag,
  User,
  X,
  Zap,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { type EntityType, type StatusColor, useIntelligenceStore } from '@/src/stores/canvasStore';

interface EntityData {
  id: string;
  name: string;
  type: EntityType;
  status: StatusColor;
  description?: string;
  metadata?: Record<string, string | number | boolean>;
  relationships?: {
    entityId: string;
    entityName: string;
    relationshipType: string;
  }[];
  sources?: {
    type: string;
    url?: string;
    timestamp: Date;
  }[];
}

interface InspectorPanelProps {
  entity?: EntityData | null;
  className?: string;
  onClose?: () => void;
  onPin?: (entityId: string) => void;
  onNavigate?: (entityId: string) => void;
}

const entityTypeConfig: Record<
  EntityType,
  {
    icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
    color: string;
    label: string;
  }
> = {
  person: { icon: User, color: 'var(--color-intelligence)', label: 'Person' },
  organization: { icon: Building2, color: 'var(--color-active)', label: 'Organization' },
  location: { icon: MapPin, color: 'var(--color-anomaly)', label: 'Location' },
  document: { icon: FileText, color: 'var(--color-success)', label: 'Document' },
  event: { icon: Zap, color: 'var(--color-critical)', label: 'Event' },
  artifact: { icon: Tag, color: 'var(--color-neutral)', label: 'Artifact' },
  unknown: { icon: Globe, color: 'var(--color-neutral)', label: 'Unknown' },
};

const statusConfig: Record<StatusColor, { bgClass: string; textClass: string; label: string }> = {
  intelligence: {
    bgClass: 'bg-[var(--color-intelligence)]',
    textClass: 'text-[var(--color-intelligence)]',
    label: 'INTEL',
  },
  anomaly: {
    bgClass: 'bg-[var(--color-anomaly)]',
    textClass: 'text-[var(--color-anomaly)]',
    label: 'ANOMALY',
  },
  active: {
    bgClass: 'bg-[var(--color-active)]',
    textClass: 'text-[var(--color-active)]',
    label: 'ACTIVE',
  },
  success: {
    bgClass: 'bg-[var(--color-success)]',
    textClass: 'text-[var(--color-success)]',
    label: 'SUCCESS',
  },
  critical: {
    bgClass: 'bg-[var(--color-critical)]',
    textClass: 'text-[var(--color-critical)]',
    label: 'CRITICAL',
  },
  neutral: {
    bgClass: 'bg-[var(--color-neutral)]',
    textClass: 'text-[var(--color-neutral)]',
    label: 'NEUTRAL',
  },
};

export function InspectorPanel({
  entity,
  className,
  onClose,
  onPin,
  onNavigate,
}: InspectorPanelProps) {
  const { pinnedEntities, pinEntity, unpinEntity } = useIntelligenceStore();
  const isPinned = entity ? pinnedEntities.has(entity.id) : false;

  if (!entity) {
    return (
      <div className={cn('flex flex-col h-full', className)}>
        <div className="flex-1 flex items-center justify-center text-center p-8">
          <div className="text-[var(--color-neutral)] opacity-50">
            <Tag className="w-12 h-12 mx-auto mb-4" />
            <div className="text-sm font-mono">Select an entity to inspect</div>
            <div className="text-xs text-[var(--color-neutral)] mt-1">
              Click a node in the graph or stream item
            </div>
          </div>
        </div>
      </div>
    );
  }

  const typeConfig = entityTypeConfig[entity.type];
  const status = statusConfig[entity.status];
  const Icon = typeConfig.icon;

  const handlePin = () => {
    if (isPinned) {
      unpinEntity(entity.id);
    } else {
      pinEntity(entity.id);
    }
    onPin?.(entity.id);
  };

  return (
    <div className={cn('flex flex-col h-full', className)}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 shrink-0">
        <div className="flex items-center gap-3">
          <Icon className="w-4 h-4" style={{ color: typeConfig.color }} />
          <span className="text-sm font-semibold" style={{ color: typeConfig.color }}>
            {typeConfig.label}
          </span>
          <span
            className={cn(
              'px-2 py-0.5 text-[9px] font-mono font-semibold rounded',
              status.bgClass,
              'text-black',
            )}
          >
            {status.label}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePin}
            className={cn(
              'px-2 py-1 text-xs font-mono rounded transition-colors',
              isPinned
                ? 'bg-[var(--color-intelligence)]/20 text-[var(--color-intelligence)]'
                : 'bg-white/5 text-[var(--color-neutral)] hover:bg-white/10',
            )}
          >
            {isPinned ? 'PINNED' : 'PIN'}
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1 text-[var(--color-neutral)] hover:text-[var(--color-text-primary)] transition-colors"
              aria-label="Close inspector"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
        <div>
          <h3 className="text-base font-semibold text-[var(--color-text-primary)] mb-2">
            {entity.name}
          </h3>
          {entity.description && (
            <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
              {entity.description}
            </p>
          )}
        </div>

        {entity.metadata && Object.keys(entity.metadata).length > 0 && (
          <div>
            <div className="text-[9px] font-mono font-semibold text-[var(--color-neutral)] uppercase tracking-wider mb-2">
              Metadata
            </div>
            <div className="space-y-1.5">
              {Object.entries(entity.metadata).map(([key, value]) => (
                <div key={key} className="flex items-start gap-3 text-xs">
                  <span className="text-[var(--color-neutral)] font-mono shrink-0">{key}:</span>
                  <span className="text-[var(--color-text-muted)] font-mono">{String(value)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {entity.relationships && entity.relationships.length > 0 && (
          <div>
            <div className="text-[9px] font-mono font-semibold text-[var(--color-neutral)] uppercase tracking-wider mb-2">
              Relationships ({entity.relationships.length})
            </div>
            <div className="space-y-1.5">
              <AnimatePresence>
                {entity.relationships.map((rel) => (
                  <motion.button
                    key={rel.entityId}
                    type="button"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    onClick={() => onNavigate?.(rel.entityId)}
                    className={cn(
                      'w-full flex items-center gap-3 p-2 rounded',
                      'text-left text-xs',
                      'bg-[var(--color-void)] border border-white/5',
                      'hover:border-[var(--color-intelligence)]/30 hover:bg-white/[0.02]',
                      'transition-colors cursor-pointer',
                    )}
                  >
                    <div className="w-1 h-8 rounded bg-[var(--color-intelligence)]/30" />
                    <div className="flex-1 min-w-0">
                      <div className="text-[var(--color-text-primary)] truncate">
                        {rel.entityName}
                      </div>
                      <div className="text-[9px] text-[var(--color-neutral)] font-mono">
                        {rel.relationshipType}
                      </div>
                    </div>
                    <ExternalLink className="w-3 h-3 text-[var(--color-neutral)]" />
                  </motion.button>
                ))}
              </AnimatePresence>
            </div>
          </div>
        )}

        {entity.sources && entity.sources.length > 0 && (
          <div>
            <div className="text-[9px] font-mono font-semibold text-[var(--color-neutral)] uppercase tracking-wider mb-2">
              Sources ({entity.sources.length})
            </div>
            <div className="space-y-1.5">
              {entity.sources.map((source) => (
                <div
                  key={`${source.type}-${source.url || source.timestamp?.toISOString() || Math.random()}`}
                  className="flex items-center gap-3 p-2 rounded bg-[var(--color-void)] border border-white/5"
                >
                  <Globe className="w-3 h-3 text-[var(--color-neutral)] shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-[var(--color-text-muted)]">{source.type}</div>
                    {source.url && (
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-[var(--color-intelligence)] hover:underline truncate block"
                      >
                        {source.url}
                      </a>
                    )}
                  </div>
                  {source.timestamp && (
                    <div className="text-[9px] text-[var(--color-neutral)] font-mono shrink-0 flex items-center gap-1">
                      <Calendar className="w-2.5 h-2.5" />
                      {source.timestamp.toLocaleDateString()}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export type { EntityData, InspectorPanelProps };
