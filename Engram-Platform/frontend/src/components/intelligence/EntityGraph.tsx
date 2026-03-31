'use client';

import {
  Background,
  Controls,
  type Edge,
  MiniMap,
  type Node,
  type NodeProps,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
} from '@xyflow/react';
import { Filter, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { cn } from '@/src/lib/utils';
import {
  type EntityType,
  type RelationshipType,
  type StatusColor,
  useIntelligenceStore,
} from '@/src/stores/canvasStore';
import '@xyflow/react/dist/style.css';

interface EntityNodeData extends Record<string, unknown> {
  label: string;
  entityType: EntityType;
  status: StatusColor;
  metadata?: Record<string, unknown>;
}

const entityTypeColors: Record<EntityType, string> = {
  person: 'var(--color-intelligence)',
  organization: 'var(--color-active)',
  location: 'var(--color-anomaly)',
  document: 'var(--color-success)',
  event: 'var(--color-critical)',
  artifact: 'var(--color-neutral)',
  unknown: 'var(--color-neutral)',
};

const entityTypeHexColors: Record<EntityType, string> = {
  person: '#00D4FF',
  organization: '#7C5CBF',
  location: '#FFB020',
  document: '#2EE6A6',
  event: '#FF4757',
  artifact: '#6B7280',
  unknown: '#6B7280',
};

const FILTERED_COLOR = 'rgba(107, 114, 128, 0.5)';
const _SELECTED_GLOW = 'rgba(0, 212, 255, 0.6)';

const statusStyles: Record<StatusColor, { glow: string; border: string }> = {
  intelligence: { glow: '0 0 20px rgba(0, 212, 255, 0.3)', border: 'rgba(0, 212, 255, 0.6)' },
  anomaly: { glow: '0 0 20px rgba(255, 176, 32, 0.3)', border: 'rgba(255, 176, 32, 0.6)' },
  active: { glow: '0 0 20px rgba(124, 92, 255, 0.3)', border: 'rgba(124, 92, 255, 0.6)' },
  success: { glow: '0 0 20px rgba(46, 230, 166, 0.3)', border: 'rgba(46, 230, 166, 0.6)' },
  critical: { glow: '0 0 20px rgba(255, 71, 87, 0.4)', border: 'rgba(255, 71, 87, 0.8)' },
  neutral: { glow: 'none', border: 'rgba(107, 114, 128, 0.4)' },
};

const ALL_ENTITY_TYPES: EntityType[] = [
  'person',
  'organization',
  'location',
  'document',
  'event',
  'artifact',
  'unknown',
];

function EntityNode({ data, selected }: NodeProps<Node<EntityNodeData>>) {
  const accentColor = entityTypeColors[data.entityType];
  const statusStyle = statusStyles[data.status];

  return (
    <div
      className={cn(
        'bg-[var(--color-void)] rounded-lg px-3 py-2 min-w-[140px] max-w-[200px]',
        'border transition-all duration-150',
      )}
      style={{
        borderColor: selected
          ? statusStyle.border
          : `color-mix(in srgb, ${accentColor} 30%, transparent)`,
        boxShadow: selected ? statusStyle.glow : 'none',
      }}
    >
      <div
        className="text-[9px] font-mono font-semibold tracking-widest uppercase mb-1"
        style={{ color: accentColor }}
      >
        {data.entityType}
      </div>
      <div className="text-[var(--color-text-primary)] text-xs font-medium leading-tight truncate">
        {data.label}
      </div>
      {data.metadata?.source != null && (
        <div className="text-[8px] text-[var(--color-neutral)] mt-1 font-mono truncate">
          via {String(data.metadata.source)}
        </div>
      )}
    </div>
  );
}

const nodeTypes = { entity: EntityNode };

const edgeStyle = {
  stroke: 'color-mix(in srgb, var(--color-active) 35%, transparent)',
  strokeWidth: 1.5,
};

const defaultEdgeOptions = {
  style: edgeStyle,
  labelStyle: {
    fill: 'var(--color-text-muted)',
    fontSize: 9,
    fontFamily: 'IBM Plex Mono, monospace',
  },
  labelBgStyle: {
    fill: 'var(--color-void)',
    fillOpacity: 0.9,
  },
  animated: false,
};

interface Entity {
  id: string;
  name: string;
  type: EntityType;
  status: StatusColor;
  metadata?: Record<string, unknown>;
}

interface Relationship {
  id: string;
  sourceId: string;
  targetId: string;
  type: RelationshipType;
}

interface EntityGraphProps {
  entities?: Entity[];
  relationships?: Relationship[];
  className?: string;
  onEntityClick?: (entityId: string) => void;
  onEntityHover?: (entityId: string | null) => void;
}

function transformToFlow(entities: Entity[], relationships: Relationship[]) {
  const nodes: Node<EntityNodeData>[] = entities.map((entity, i) => ({
    id: entity.id,
    type: 'entity',
    position: { x: (i % 10) * 80 + 40, y: Math.floor(i / 10) * 80 + 40 },
    data: {
      label: entity.name,
      entityType: entity.type,
      status: entity.status,
      metadata: entity.metadata,
    },
  }));

  const edges: Edge[] = relationships.map((rel) => ({
    id: rel.id,
    source: rel.sourceId,
    target: rel.targetId,
    label: rel.type.replace(/_/g, ' '),
    ...defaultEdgeOptions,
  }));

  return { nodes, edges };
}

function EntityTypeFilter({
  activeFilters,
  onToggle,
  entityCounts,
}: {
  activeFilters: EntityType[];
  onToggle: (type: EntityType) => void;
  entityCounts: Record<EntityType, number>;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 px-3 py-2 bg-[var(--color-panel)] border-b border-white/[0.06]">
      <Filter className="w-3 h-3 text-[var(--color-neutral)] mr-1" />
      <span className="text-[9px] font-mono uppercase tracking-widest text-[var(--color-neutral)] mr-1">
        Filter
      </span>
      {ALL_ENTITY_TYPES.map((type) => {
        const count = entityCounts[type] ?? 0;
        if (count === 0) return null;
        const isActive = activeFilters.length === 0 || activeFilters.includes(type);
        const color = entityTypeHexColors[type];
        return (
          <button
            key={type}
            type="button"
            onClick={() => onToggle(type)}
            className={cn(
              'flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono',
              'border transition-all duration-150',
              isActive
                ? 'border-white/20 bg-white/[0.06]'
                : 'border-white/[0.04] bg-transparent opacity-40',
            )}
            style={{
              color: isActive ? color : 'var(--color-neutral)',
            }}
            aria-pressed={isActive}
            aria-label={`Filter ${type} entities`}
          >
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
            {type}
            <span className="text-[var(--color-neutral)] ml-0.5">({count})</span>
          </button>
        );
      })}
      {activeFilters.length > 0 && (
        <button
          type="button"
          onClick={() => onToggle('unknown' as EntityType)}
          className="flex items-center gap-1 text-[10px] font-mono text-[var(--color-neutral)] hover:text-[var(--color-text-primary)] ml-1 transition-colors"
          aria-label="Clear all filters"
        >
          <X className="w-3 h-3" /> Clear
        </button>
      )}
    </div>
  );
}

interface MiniMapLegendProps {
  entityCounts: Record<EntityType, number>;
  filteredCounts: Record<EntityType, number>;
  onToggleType: (type: EntityType) => void;
  activeFilters: EntityType[];
}

function MiniMapLegend({
  entityCounts,
  filteredCounts,
  onToggleType,
  activeFilters,
}: MiniMapLegendProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const totalEntities = Object.values(entityCounts).reduce((a, b) => a + b, 0);
  const totalFiltered = Object.values(filteredCounts).reduce((a, b) => a + b, 0);

  return (
    <div className="absolute bottom-12 right-12 z-10">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        aria-label={isExpanded ? 'Collapse legend' : 'Expand legend'}
        aria-expanded={isExpanded}
        className={cn(
          'flex items-center gap-2 px-2 py-1.5 rounded-lg text-[10px] font-mono',
          'bg-[var(--color-panel)] border border-white/10',
          'hover:border-white/20 transition-colors',
          isExpanded && 'bg-[var(--color-panel)]',
        )}
      >
        <div
          className="w-3 h-3 rounded"
          style={{
            background: `linear-gradient(135deg, ${Object.entries(entityTypeHexColors)
              .slice(0, 5)
              .map(([, color]) => color)
              .join(', ')})`,
          }}
        />
        <span className="text-[var(--color-text-muted)]">
          {totalFiltered}/{totalEntities}
        </span>
      </button>

      {isExpanded && (
        <div className="mt-1 p-2 bg-[var(--color-panel)] border border-white/10 rounded-lg shadow-xl min-w-[140px]">
          <div className="text-[9px] font-mono uppercase tracking-wider text-[var(--color-neutral)] mb-2">
            Legend
          </div>
          <div className="space-y-1">
            {ALL_ENTITY_TYPES.map((type) => {
              const count = entityCounts[type];
              const filtered = filteredCounts[type];
              if (!count || count === 0) return null;
              const isFiltered = activeFilters.length > 0 && !activeFilters.includes(type);
              const color = entityTypeHexColors[type];

              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => onToggleType(type)}
                  className={cn(
                    'flex items-center gap-2 w-full px-1.5 py-1 rounded text-[10px] font-mono',
                    'hover:bg-white/5 transition-colors',
                    isFiltered && 'opacity-40',
                  )}
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: isFiltered ? FILTERED_COLOR : color }}
                  />
                  <span className="flex-1 text-left capitalize" style={{ color }}>
                    {type}
                  </span>
                  <span className="text-[var(--color-neutral)]">
                    {filtered}/{count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export function EntityGraph({
  entities = [],
  relationships = [],
  className,
  onEntityClick,
  onEntityHover,
}: EntityGraphProps) {
  const { selectEntity, deselectEntity, setHoveredEntity, entityTypeFilter, setEntityTypeFilter } =
    useIntelligenceStore();

  const entityCounts = useMemo(() => {
    const counts: Record<EntityType, number> = {
      person: 0,
      organization: 0,
      location: 0,
      document: 0,
      event: 0,
      artifact: 0,
      unknown: 0,
    };
    for (const entity of entities) {
      counts[entity.type] = (counts[entity.type] ?? 0) + 1;
    }
    return counts;
  }, [entities]);

  const filteredEntities = useMemo(() => {
    if (entityTypeFilter.length === 0) return entities;
    return entities.filter((e) => entityTypeFilter.includes(e.type));
  }, [entities, entityTypeFilter]);

  const filteredRelationships = useMemo(() => {
    const entityIds = new Set(filteredEntities.map((e) => e.id));
    return relationships.filter((r) => entityIds.has(r.sourceId) && entityIds.has(r.targetId));
  }, [filteredEntities, relationships]);

  const filteredCounts = useMemo(() => {
    const counts: Record<EntityType, number> = {
      person: 0,
      organization: 0,
      location: 0,
      document: 0,
      event: 0,
      artifact: 0,
      unknown: 0,
    };
    for (const entity of filteredEntities) {
      counts[entity.type] = (counts[entity.type] ?? 0) + 1;
    }
    return counts;
  }, [filteredEntities]);

  const { nodes: initialNodes, edges: initialEdges } = useMemo(
    () => transformToFlow(filteredEntities, filteredRelationships),
    [filteredEntities, filteredRelationships],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  const handleToggleFilter = useCallback(
    (type: EntityType) => {
      const current = entityTypeFilter;
      if (current.length === 0) {
        setEntityTypeFilter(ALL_ENTITY_TYPES.filter((t) => t !== type && entityCounts[t] > 0));
      } else if (current.includes(type)) {
        const next = current.filter((t) => t !== type);
        setEntityTypeFilter(next.length === 0 ? [] : next);
      } else {
        setEntityTypeFilter([...current, type]);
      }
    },
    [entityTypeFilter, setEntityTypeFilter, entityCounts],
  );

  const minimapNodeColor = useCallback(
    (node: Node) => {
      const data = node.data as EntityNodeData | undefined;
      if (!data?.entityType) return '#9B7DE0';

      if (entityTypeFilter.length > 0 && !entityTypeFilter.includes(data.entityType)) {
        return 'rgba(107, 114, 128, 0.15)';
      }

      return entityTypeHexColors[data.entityType] ?? '#9B7DE0';
    },
    [entityTypeFilter],
  );

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node<EntityNodeData>) => {
      selectEntity(node.id);
      onEntityClick?.(node.id);
    },
    [selectEntity, onEntityClick],
  );

  const handleNodeMouseEnter = useCallback(
    (_event: React.MouseEvent, node: Node<EntityNodeData>) => {
      setHoveredEntity(node.id);
      onEntityHover?.(node.id);
    },
    [setHoveredEntity, onEntityHover],
  );

  const handleNodeMouseLeave = useCallback(() => {
    setHoveredEntity(null);
    onEntityHover?.(null);
  }, [setHoveredEntity, onEntityHover]);

  const handlePaneClick = useCallback(() => {
    deselectEntity(undefined as unknown as string);
  }, [deselectEntity]);

  return (
    <div
      className={cn('h-full w-full flex flex-col', className)}
      role="application"
      aria-label="Knowledge graph visualization"
    >
      <span className="sr-only">
        Interactive knowledge graph. Use mouse to pan and zoom, click nodes to view details.
      </span>
      <EntityTypeFilter
        activeFilters={entityTypeFilter}
        onToggle={handleToggleFilter}
        entityCounts={entityCounts}
      />
      <div className="flex-1 min-h-0">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={handleNodeClick}
          onNodeMouseEnter={handleNodeMouseEnter}
          onNodeMouseLeave={handleNodeMouseLeave}
          onPaneClick={handlePaneClick}
          nodeTypes={nodeTypes}
          defaultEdgeOptions={defaultEdgeOptions}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.1}
          maxZoom={3}
          className="bg-[var(--color-void)]"
        >
          <Background color="#1a1830" gap={20} size={1} />
          <Controls
            className="bg-[var(--color-panel)] border border-white/10 rounded-lg overflow-hidden"
            showZoom={true}
            showFitView={true}
            showInteractive={false}
          />
          <MiniMap
            nodeColor={minimapNodeColor}
            nodeStrokeWidth={2}
            maskColor="rgba(3, 2, 10, 0.8)"
            className="bg-[var(--color-void)] border border-white/10 rounded"
            pannable
            zoomable
          />
          <MiniMapLegend
            entityCounts={entityCounts}
            filteredCounts={filteredCounts}
            onToggleType={handleToggleFilter}
            activeFilters={entityTypeFilter}
          />
        </ReactFlow>
      </div>
    </div>
  );
}

export function EntityGraphWrapper(props: EntityGraphProps) {
  return (
    <ReactFlowProvider>
      <EntityGraph {...props} />
    </ReactFlowProvider>
  );
}

export type { Entity, Relationship, EntityGraphProps };
