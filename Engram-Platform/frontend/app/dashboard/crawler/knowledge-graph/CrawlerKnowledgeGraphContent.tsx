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
import { useCallback, useEffect, useState } from 'react';
import useSWR from 'swr';
import '@xyflow/react/dist/style.css';

import { Network } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  ErrorState,
  LoadingState,
  SearchInput,
  SectionHeader,
} from '@/src/design-system/components';
import { useForceLayout } from '@/src/hooks/useForceLayout';
import { useMounted } from '@/src/hooks/useMounted';
import { crawlerClient, type KnowledgeGraphResponse } from '@/src/lib/crawler-client';
import { swrKeys } from '@/src/lib/swr-keys';

// ─── Design Tokens ────────────────────────────────────────────────────────────

const edgeStyle = {
  stroke: 'color-mix(in srgb, var(--color-violet) 40%, transparent)',
  strokeWidth: 1.5,
};

// ─── Custom Node ──────────────────────────────────────────────────────────────

interface CrawlerNodeData {
  label: string;
  type: string;
  properties?: Record<string, unknown>;
  [key: string]: unknown;
}

function CrawlerNode({ data, selected }: NodeProps<Node<CrawlerNodeData>>) {
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

const nodeTypes = { crawlerNode: CrawlerNode };

// ─── Graph Transform ─────────────────────────────────────────────────────────

type Entity = KnowledgeGraphResponse['entities'][number];
type Relationship = KnowledgeGraphResponse['relationships'][number];

function transformToFlow(
  entities: Entity[],
  relationships: Relationship[],
  filterText: string,
): { nodes: Node[]; edges: Edge[] } {
  const filteredEntities = filterText
    ? entities.filter((e) => e.name.toLowerCase().includes(filterText.toLowerCase()))
    : entities;

  const filteredIds = new Set(filteredEntities.map((e) => e.id));

  // Initialize positions randomly for the force layout
  const nodes: Node[] = filteredEntities.map((entity) => ({
    id: entity.id,
    type: 'crawlerNode',
    position: {
      x: Math.random() * 800,
      y: Math.random() * 600,
    },
    data: {
      label: entity.name,
      type: entity.type,
      properties: entity.properties,
    },
  }));

  const edges: Edge[] = relationships
    .filter((r) => filteredIds.has(r.source) && filteredIds.has(r.target))
    .map((r, i) => ({
      id: `edge-${i}-${r.source}-${r.target}`,
      source: r.source,
      target: r.target,
      label: r.type,
      style: edgeStyle,
      labelStyle: {
        fill: '#5c5878',
        fontSize: 10,
        fontFamily: 'IBM Plex Mono, monospace',
      },
      labelBgStyle: {
        fill: '#0d0b1a',
        fillOpacity: 0.8,
      },
      animated: false,
    }));

  return { nodes, edges };
}

// ─── Internal Graph Component with Layout ────────────────────────────────────

interface GraphProps {
  initialNodes: Node[];
  initialEdges: Edge[];
  onNodeClick: (node: Node) => void;
  onPaneClick: () => void;
}

function Graph({ initialNodes, initialEdges, onNodeClick, onPaneClick }: GraphProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Sync when initial data changes (e.g., from filtering)
  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  // Apply force layout
  useForceLayout({ strength: -400, distance: 150 });

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeClick={(_e, node) => onNodeClick(node)}
      onPaneClick={onPaneClick}
      nodeTypes={nodeTypes}
      fitView
      fitViewOptions={{ padding: 0.2 }}
      minZoom={0.1}
      maxZoom={3}
      defaultEdgeOptions={{ style: edgeStyle }}
      className="bg-void"
    >
      <Background color="#1a1830" gap={20} />
      <Controls className="bg-panel border border-white/[0.06] rounded-lg" />
      <MiniMap
        nodeColor="#9B7DE0"
        maskColor="rgba(3,2,10,0.8)"
        className="bg-deep border border-white/[0.06] rounded-lg"
      />
    </ReactFlow>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function CrawlerKnowledgeGraphContent() {
  const mounted = useMounted();
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [filterText, setFilterText] = useState('');

  const { data, error, isLoading, mutate } = useSWR(
    swrKeys.crawler.knowledgeGraph(),
    async () => {
      const res = await crawlerClient.getKnowledgeGraph();
      return res.data;
    },
    { revalidateOnFocus: false },
  );

  const handleNodeClick = useCallback((node: Node) => {
    setSelectedNode((prev) => (prev?.id === node.id ? null : node));
  }, []);

  const handlePaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  if (!mounted || isLoading) {
    return (
      <div className="flex flex-col h-full">
        <SectionHeader title="Knowledge Graph" breadcrumb={['CRAWLER', 'KNOWLEDGE GRAPH']} />
        <LoadingState label="Initializing graph..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col h-full">
        <SectionHeader title="Knowledge Graph" breadcrumb={['CRAWLER', 'KNOWLEDGE GRAPH']} />
        <ErrorState message="Failed to load knowledge graph" onRetry={() => mutate()} />
      </div>
    );
  }

  const { nodes, edges } = data
    ? transformToFlow(data.entities, data.relationships, filterText)
    : { nodes: [], edges: [] };

  const nodeCount = data?.entities?.length ?? 0;
  const edgeCount = data?.relationships?.length ?? 0;

  return (
    <div className="flex flex-col h-full gap-4">
      <SectionHeader title="Knowledge Graph" breadcrumb={['CRAWLER', 'KNOWLEDGE GRAPH']} />

      <div className="flex items-center gap-3">
        <SearchInput
          placeholder="Filter nodes..."
          value={filterText}
          onChange={setFilterText}
          className="w-64"
        />
        <Badge variant="crawler">{nodeCount} nodes</Badge>
        <Badge variant="neutral">{edgeCount} edges</Badge>
        <div className="flex-1" />
        <Button variant="secondary" size="sm" onClick={() => mutate()}>
          Refresh
        </Button>
      </div>

      <div className="flex flex-1 gap-4 min-h-0">
        <div className="flex-1 rounded-xl border border-white/[0.06] overflow-hidden min-h-[500px]">
          {nodes.length > 0 ? (
            <ReactFlowProvider>
              <Graph
                initialNodes={nodes}
                initialEdges={edges}
                onNodeClick={handleNodeClick}
                onPaneClick={handlePaneClick}
              />
            </ReactFlowProvider>
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-2">
              <Network className="w-8 h-8 text-[#5c5878] mb-2" />
              <p className="text-sm font-mono text-[#5c5878]">No graph data found</p>
              {filterText && (
                <Button variant="ghost" size="sm" onClick={() => setFilterText('')}>
                  Clear filter
                </Button>
              )}
            </div>
          )}
        </div>

        {selectedNode && (
          <Card className="w-72 flex-shrink-0 h-fit" variant="elevated">
            <h3 className="text-sm font-semibold text-[#f0eef8] mb-2">
              {selectedNode.data.label as string}
            </h3>
            <Badge variant="crawler" className="mb-3">
              {selectedNode.data.type as string}
            </Badge>

            {(() => {
              const data = selectedNode?.data as CrawlerNodeData;
              if (!data.properties || typeof data.properties !== 'object') return null;
              const entries = Object.entries(data.properties);
              if (entries.length === 0) return null;
              return (
                <div className="space-y-1.5 text-xs mt-3 pt-3 border-t border-white/[0.06]">
                  {entries.map(
                    ([key, val]) => (
                      <div key={key} className="flex flex-col gap-0.5 mb-2">
                        <span className="text-[10px] font-mono text-[#5c5878] uppercase">
                          {key}
                        </span>
                        <span className="text-[#a09bb8] break-words">
                          {String(val)}
                        </span>
                      </div>
                    ),
                  )}
                </div>
              );
            })()}
          </Card>
        )}
      </div>
    </div>
  );
}
