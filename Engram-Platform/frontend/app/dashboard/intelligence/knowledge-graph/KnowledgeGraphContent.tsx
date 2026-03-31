'use client';

import {
  Background,
  Controls,
  type Edge,
  type Node,
  type NodeProps,
  ReactFlow,
  useEdgesState,
  useNodesState,
} from '@xyflow/react';
import { RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import useSWR from 'swr';
import { swrKeys } from '@/src/lib/swr-keys';
import '@xyflow/react/dist/style.css';
import { Badge } from '@/src/design-system/components/Badge';
import { Button } from '@/src/design-system/components/Button';
import { LoadingState } from '@/src/design-system/components/LoadingState';
import { SectionHeader } from '@/src/design-system/components/SectionHeader';
import {
  type KnowledgeGraphResponse as CrawlerKGResponse,
  crawlerClient,
} from '@/src/lib/crawler-client';
import {
  type Entity,
  type KnowledgeGraphResponse as MemoryKGResponse,
  memoryClient,
  type Relation,
} from '@/src/lib/memory-client';

// ─── Types ─────────────────────────────────────────────────────────────────────

type ViewMode = 'side-by-side' | 'crawler-only' | 'memory-only';

// ─── View Toggle ───────────────────────────────────────────────────────────────

interface ViewToggleProps {
  value: ViewMode;
  onChange: (v: ViewMode) => void;
}

function ViewToggle({ value, onChange }: ViewToggleProps) {
  const options: { label: string; value: ViewMode }[] = [
    { label: 'Side by Side', value: 'side-by-side' },
    { label: 'Crawler Only', value: 'crawler-only' },
    { label: 'Memory Only', value: 'memory-only' },
  ];

  return (
    <div className="flex items-center gap-0.5 bg-white/[0.04] border border-white/[0.08] rounded-lg p-0.5">
      {options.map((opt) => (
        <Button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          variant={value === opt.value ? 'primary' : 'ghost'}
          size="sm"
          className={
            value === opt.value
              ? 'bg-white/[0.08] text-[#f0eef8]'
              : 'text-[#5c5878] hover:text-[#a09bb8]'
          }
        >
          {opt.label}
        </Button>
      ))}
    </div>
  );
}

// ─── Crawler Custom Node ───────────────────────────────────────────────────────

interface CrawlerNodeData {
  label: string;
  type: string;
  [key: string]: unknown;
}

function CrawlerEntityNode({ data, selected }: NodeProps<Node<CrawlerNodeData>>) {
  const isUrl = data.type.toLowerCase() === 'url';
  const isEntity = data.type.toLowerCase() === 'entity';

  const colorVar = isUrl ? '--color-violet' : isEntity ? '--color-amber' : '--color-teal';

  return (
    <div
      className="bg-panel rounded-lg text-text-primary text-xs font-mono px-3 py-2 min-w-[120px] border transition-all"
      style={{
        borderColor: selected
          ? `color-mix(in srgb, var(${colorVar}) 80%, transparent)`
          : `color-mix(in srgb, var(${colorVar}) 30%, transparent)`,
        boxShadow: selected
          ? `0 0 12px color-mix(in srgb, var(${colorVar}) 30%, transparent)`
          : 'none',
      }}
    >
      <div
        className="text-[11px] font-mono mb-0.5 uppercase tracking-wider"
        style={{ color: `var(${colorVar})` }}
      >
        {data.type}
      </div>
      <div className="text-[#f0eef8] font-medium text-xs leading-tight max-w-[160px] truncate">
        {data.label}
      </div>
    </div>
  );
}

const crawlerNodeTypes = { crawlerNode: CrawlerEntityNode };

// ─── Crawler Panel (React Flow) ────────────────────────────────────────────────

interface CrawlerPanelProps {
  data: CrawlerKGResponse | null;
  loading: boolean;
  error: string | null;
}

import { useForceLayout } from '@/src/hooks/useForceLayout';

function CrawlerPanelFlow({ data }: { data: CrawlerKGResponse }) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  useEffect(() => {
    if (!data) return;

    const initialNodes: Node[] = data.entities.map((entity, i) => ({
      id: entity.id,
      type: 'crawlerNode',
      position: { x: (i % 10) * 80 + 40, y: Math.floor(i / 10) * 80 + 40 },
      data: { label: entity.name, type: entity.type },
    }));

    const initialEdges: Edge[] = data.relationships.map((r, i) => ({
      id: `e-${i}-${r.source}-${r.target}`,
      source: r.source,
      target: r.target,
      label: r.type,
      style: {
        stroke: 'color-mix(in srgb, var(--color-violet) 40%, transparent)',
        strokeWidth: 1.5,
      },
      labelStyle: { fill: '#5c5878', fontSize: 10, fontFamily: 'IBM Plex Mono, monospace' },
      labelBgStyle: { fill: '#0d0b1a', fillOpacity: 0.8 },
      animated: false,
    }));

    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [data, setNodes, setEdges]);

  useForceLayout({ strength: -400, distance: 150 });

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      nodeTypes={crawlerNodeTypes}
      fitView
      fitViewOptions={{ padding: 0.2 }}
      minZoom={0.1}
      maxZoom={3}
      proOptions={{ hideAttribution: true }}
      className="bg-void"
    >
      <Background color="#1a1830" gap={20} />
      <Controls className="bg-panel border border-white/[0.06] rounded-lg" />
    </ReactFlow>
  );
}

function CrawlerPanel({ data, loading, error }: CrawlerPanelProps) {
  const entities = data?.entities ?? [];
  const relationships = data?.relationships ?? [];

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Panel header */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-mono text-[#9B7DE0] uppercase tracking-wider">
          Crawler Graph
        </span>
        <Badge variant="crawler">{entities.length} nodes</Badge>
        {relationships.length > 0 && <Badge variant="info">{relationships.length} edges</Badge>}
      </div>

      {/* Canvas */}
      <div className="flex-1 rounded-xl border border-[rgba(155,125,224,0.15)] bg-[#03020a] overflow-hidden relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center z-10 bg-[#03020a]">
            <LoadingState label="Loading crawler graph\u2026" />
          </div>
        )}
        {error && !loading && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <p className="text-xs font-mono text-[#FF6B6B]">Failed to load crawler graph</p>
          </div>
        )}
        {!loading && !error && entities.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-10 gap-2">
            <p className="text-xs font-mono text-[#5c5878]">No crawler graph data</p>
            <p className="text-[10px] text-[#3a3850]">Run investigations to build the graph</p>
          </div>
        )}
        {!loading && !error && data && entities.length > 0 && <CrawlerPanelFlow data={data} />}
      </div>
    </div>
  );
}

// ─── Memory Custom Node ────────────────────────────────────────────────────────

interface MemoryNodeData {
  label: string;
  entityType: string;
  [key: string]: unknown;
}

function MemoryEntityNode({ data, selected }: NodeProps<Node<MemoryNodeData>>) {
  return (
    <div
      className="bg-panel border rounded-lg text-text-primary text-[11px] font-mono px-2.5 py-1.5 min-w-[100px]"
      style={{
        borderColor: selected
          ? 'color-mix(in srgb, var(--color-teal) 80%, transparent)'
          : 'color-mix(in srgb, var(--color-teal) 30%, transparent)',
        boxShadow: selected
          ? '0 0 12px color-mix(in srgb, var(--color-teal) 20%, transparent)'
          : 'none',
      }}
    >
      <div className="text-[10px] text-[var(--color-teal)] font-mono mb-0.5 uppercase tracking-wider">
        {data.entityType}
      </div>
      <div className="text-[#f0eef8] text-xs leading-tight max-w-[160px] truncate">
        {data.label}
      </div>
    </div>
  );
}

const memoryNodeTypes = { entity: MemoryEntityNode };

// ─── Memory Panel (React Flow) ─────────────────────────────────────────────────

interface MemoryPanelProps {
  data: MemoryKGResponse | null;
  loading: boolean;
  error: string | null;
}

function transformMemoryToFlow(
  entities: Entity[],
  relations: Relation[],
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = entities.map((entity, i) => {
    return {
      id: entity.entity_id,
      type: 'entity',
      position: {
        x: (i % 10) * 80 + 40,
        y: Math.floor(i / 10) * 80 + 40,
      },
      data: {
        label: entity.name,
        entityType: entity.entity_type,
      },
    };
  });

  const edges: Edge[] = relations.map((rel) => ({
    id: rel.relation_id,
    source: rel.source_id,
    target: rel.target_id,
    label: rel.relation_type,
    style: { stroke: 'rgba(46,196,196,0.4)', strokeWidth: 1.5 },
    labelStyle: {
      fill: '#5c5878',
      fontSize: 10,
      fontFamily: 'IBM Plex Mono, monospace',
    },
    labelBgStyle: { fill: '#0d0b1a', fillOpacity: 0.8 },
    animated: false,
  }));

  return { nodes, edges };
}

function MemoryPanelFlow({ data }: { data: MemoryKGResponse }) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  useEffect(() => {
    if (!data) return;
    const { nodes: newNodes, edges: newEdges } = transformMemoryToFlow(
      data.entities,
      data.relations,
    );
    setNodes(newNodes);
    setEdges(newEdges);
  }, [data, setNodes, setEdges]);

  useForceLayout({ strength: -400, distance: 150 });

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      nodeTypes={memoryNodeTypes}
      fitView
      fitViewOptions={{ padding: 0.2 }}
      minZoom={0.1}
      maxZoom={3}
      proOptions={{ hideAttribution: true }}
      className="bg-void"
    >
      <Background color="#1a1830" gap={20} />
      <Controls className="bg-panel border border-white/[0.06] rounded-lg" />
    </ReactFlow>
  );
}

function MemoryPanel({ data, loading, error }: MemoryPanelProps) {
  const entities = data?.entities ?? [];
  const relations = data?.relations ?? [];

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Panel header */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-mono text-[#2EC4C4] uppercase tracking-wider">
          Memory Graph
        </span>
        <Badge variant="memory">{entities.length} nodes</Badge>
        {relations.length > 0 && <Badge variant="success">{relations.length} edges</Badge>}
      </div>

      {/* Canvas */}
      <div className="flex-1 rounded-xl border border-[rgba(46,196,196,0.15)] overflow-hidden relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center z-10 bg-[#03020a]">
            <LoadingState label="Loading memory graph\u2026" />
          </div>
        )}
        {error && !loading && (
          <div className="absolute inset-0 flex items-center justify-center z-10 bg-[#03020a]">
            <p className="text-xs font-mono text-[#FF6B6B]">Failed to load memory graph</p>
          </div>
        )}
        {!loading && !error && entities.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-[#03020a] gap-2">
            <p className="text-xs font-mono text-[#5c5878]">No memory graph data</p>
            <p className="text-[10px] text-[#3a3850]">Store memories to build the graph</p>
          </div>
        )}
        {!loading && !error && entities.length > 0 && data && <MemoryPanelFlow data={data} />}
      </div>
    </div>
  );
}

// ─── Main Content ──────────────────────────────────────────────────────────────

export default function KnowledgeGraphContent() {
  const [viewMode, setViewMode] = useState<ViewMode>('side-by-side');
  const [refreshKey, setRefreshKey] = useState(0);

  const {
    data: crawlerGraphData,
    isLoading: crawlerLoading,
    error: crawlerFetchError,
  } = useSWR(
    [swrKeys.crawler.knowledgeGraph(), refreshKey],
    () => crawlerClient.getKnowledgeGraph(),
    {
      revalidateOnFocus: false,
    },
  );

  const {
    data: memoryGraphData,
    isLoading: memoryLoading,
    error: memoryFetchError,
  } = useSWR(
    [swrKeys.memory.knowledgeGraph(), refreshKey],
    () => memoryClient.getKnowledgeGraph(),
    {
      revalidateOnFocus: false,
    },
  );

  const crawlerGraph: CrawlerKGResponse | null = crawlerGraphData?.data ?? null;
  const memoryGraph: MemoryKGResponse | null = memoryGraphData?.data ?? null;

  const crawlerError: string | null = crawlerFetchError ?? crawlerGraphData?.error ?? null;
  const memoryError: string | null = memoryFetchError ?? memoryGraphData?.error ?? null;

  const handleRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  const showCrawler = viewMode === 'side-by-side' || viewMode === 'crawler-only';
  const showMemory = viewMode === 'side-by-side' || viewMode === 'memory-only';

  return (
    <div className="flex flex-col h-full p-6 gap-4">
      <h1 className="sr-only">Intelligence Knowledge Graph</h1>
      {/* Header */}
      <SectionHeader
        title="Knowledge Graph"
        breadcrumb={['INTELLIGENCE', 'KNOWLEDGE GRAPH']}
        action={
          <div className="flex items-center gap-3">
            <ViewToggle value={viewMode} onChange={setViewMode} />
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              className="flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </Button>
          </div>
        }
      />

      {/* Graph panels */}
      <div className="flex gap-4 flex-1 min-h-0">
        {showCrawler && (
          <CrawlerPanel data={crawlerGraph} loading={crawlerLoading} error={crawlerError} />
        )}
        {showMemory && (
          <MemoryPanel data={memoryGraph} loading={memoryLoading} error={memoryError} />
        )}
      </div>
    </div>
  );
}
