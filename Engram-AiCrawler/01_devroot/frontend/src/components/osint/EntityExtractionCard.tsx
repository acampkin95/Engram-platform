import { motion } from 'framer-motion';
import {
  FaUser,
  FaBuilding,
  FaLocationDot,
  FaGlobe,
  FaFingerprint,
  FaArrowUpRightFromSquare,
  FaTag,
} from 'react-icons/fa6';
import { staggerItem, useReducedMotion } from '../../lib/motion';

export type EntityType = 'person' | 'organization' | 'location' | 'url' | 'identifier' | 'unknown';

export interface ExtractedEntity {
  id: string;
  name: string;
  entity_type: EntityType;
  confidence?: number;
  source_url?: string;
  mentions?: number;
}

interface EntityExtractionCardProps {
  entity: ExtractedEntity;
  onSelect?: (entity: ExtractedEntity) => void;
  selected?: boolean;
}

type IconComponent = typeof FaUser;

const ENTITY_CONFIG: Record<EntityType, { icon: IconComponent; color: string; bg: string; label: string }> = {
  person:       { icon: FaUser,         color: 'text-cyan',      bg: 'bg-cyan/10',      label: 'Person' },
  organization: { icon: FaBuilding,     color: 'text-volt',      bg: 'bg-volt/10',      label: 'Org' },
  location:     { icon: FaLocationDot,  color: 'text-plasma',    bg: 'bg-plasma/10',    label: 'Location' },
  url:          { icon: FaGlobe,        color: 'text-acid',      bg: 'bg-acid/10',      label: 'URL' },
  identifier:   { icon: FaFingerprint,  color: 'text-fuchsia',   bg: 'bg-fuchsia/10',   label: 'ID' },
  unknown:      { icon: FaTag,          color: 'text-text-mute', bg: 'bg-abyss/30',     label: 'Unknown' },
};

function ConfidencePip({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = pct >= 80 ? 'bg-plasma' : pct >= 50 ? 'bg-volt' : 'bg-neon-r';
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex-1 h-1 bg-abyss rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] font-mono text-text-mute w-7 text-right">{pct}%</span>
    </div>
  );
}

export function EntityExtractionCard({
  entity,
  onSelect,
  selected = false,
}: EntityExtractionCardProps) {
  const prefersReduced = useReducedMotion();
  const config = ENTITY_CONFIG[entity.entity_type] ?? ENTITY_CONFIG.unknown;
  const Icon = config.icon;

  return (
    <motion.div
      variants={prefersReduced ? undefined : staggerItem}
      whileHover={prefersReduced ? undefined : { scale: 1.01 }}
      onClick={() => onSelect?.(entity)}
      role={onSelect ? 'button' : undefined}
      tabIndex={onSelect ? 0 : undefined}
      onKeyDown={onSelect ? (e) => { if (e.key === 'Enter' || e.key === ' ') onSelect(entity); } : undefined}
      className={`
        group relative flex items-start gap-3 p-4 border transition-all duration-150 cursor-default
        ${selected
          ? 'bg-cyan/5 border-cyan/40'
          : 'bg-surface border-border hover:border-border-hi hover:bg-raised'
        }
        ${onSelect ? 'cursor-pointer' : ''}
      `}
    >
      <div className={`p-2 ${config.bg} flex-shrink-0`}>
        <Icon className={`w-4 h-4 ${config.color}`} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <p className="text-sm font-medium text-text truncate">{entity.name}</p>
          <span className={`inline-flex items-center gap-1 text-[10px] font-mono uppercase flex-shrink-0 px-1.5 py-0.5 rounded-sm ${config.bg} ${config.color}`}>
            <Icon size={9} />
            {config.label}
          </span>
        </div>

        {entity.confidence !== undefined && (
          <ConfidencePip value={entity.confidence} />
        )}

        {entity.mentions !== undefined && entity.mentions > 0 && (
          <p className="text-[11px] text-text-mute mt-1">
            {entity.mentions} mention{entity.mentions !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {entity.source_url && (
        <a
          href={entity.source_url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="flex-shrink-0 p-1 text-text-mute hover:text-cyan transition-colors opacity-0 group-hover:opacity-100"
          aria-label={`Open source for ${entity.name}`}
        >
          <FaArrowUpRightFromSquare size={13} />
        </a>
      )}
    </motion.div>
  );
}

interface EntityListProps {
  entities: ExtractedEntity[];
  onSelect?: (entity: ExtractedEntity) => void;
  selectedId?: string;
  maxVisible?: number;
}

export function EntityList({
  entities,
  onSelect,
  selectedId,
  maxVisible = 10,
}: EntityListProps) {
  const prefersReduced = useReducedMotion();
  const visible = entities.slice(0, maxVisible);

  if (visible.length === 0) {
    return (
      <div className="py-6 text-center text-sm text-text-mute">
        No entities extracted yet.
      </div>
    );
  }

  return (
    <motion.div
      className="space-y-2"
      variants={prefersReduced ? undefined : {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { staggerChildren: 0.04 } },
      }}
      initial={prefersReduced ? undefined : 'hidden'}
      animate={prefersReduced ? undefined : 'visible'}
    >
      {visible.map((entity) => (
        <EntityExtractionCard
          key={entity.id}
          entity={entity}
          onSelect={onSelect}
          selected={entity.id === selectedId}
        />
      ))}
      {entities.length > maxVisible && (
        <p className="text-xs text-text-mute text-center py-2">
          +{entities.length - maxVisible} more entities
        </p>
      )}
    </motion.div>
  );
}
