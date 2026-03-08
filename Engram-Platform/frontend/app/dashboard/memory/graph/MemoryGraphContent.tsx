'use client';

import {
  Background,
  Controls,
  type Edge,
  MiniMap,
  type Node,
  type OnEdgesChange,
  type OnNodesChange,
  type NodeProps,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
} from '@xyflow/react';
import { GitBranch, Layers, Network, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import useSWR from 'swr';
import { swrKeys } from '@/src/lib/swr-keys';
import '@xyflow/react/dist/style.css';
import { Badge } from '@/src/design-system/components/Badge';
import { Button } from '@/src/design-system/components/Button';
import { Tooltip } from '@/src/design-system/components/Tooltip';
import { addToast } from '@/src/design-system/components/Toast';
import { motion, AnimatePresence } from 'framer-motion';
import { EmptyState } from '@/src/design-system/components/EmptyState';
import { ErrorState } from '@/src/design-system/components/ErrorState';
import { LoadingState } from '@/src/design-system/components/LoadingState';
import { SectionHeader } from '@/src/design-system/components/SectionHeader';
import { useForceLayout } from '@/src/hooks/useForceLayout';
import { type Entity, type Matter, memoryClient, type Relation } from '@/src/lib/memory-client';

const edgeStyle = {
  stroke: 'color-mix(in srgb, var(--color-teal) 40%, transparent)',
  strokeWidth: 1.5,
};

interface EntityNodeData {
  label: string;
  entityType: string;
  [key: string]: unknown;
}

function EntityNode({ data, selected }: NodeProps<Node<EntityNodeData>>) {
  return (
    <div
      className="bg-panel rounded-lg text-text-primary text-xs font-mono px-3 py-2 min-w-[120px] border"
      style={{
        borderColor: selected
          ? 'color-mix(in srgb, var(--color-teal) 80%, transparent)'
          : 'color-mix(in srgb, var(--color-teal) 30%, transparent)',
        boxShadow: selected
          ? '0 0 12px color-mix(in srgb, var(--color-teal) 30%, transparent)'
          : 'none',
      }}
    >
      <div className="text-[11px] font-mono mb-0.5 uppercase tracking-wider" style={{ color: 'var(--color-teal)' }}>
        {data.entityType}
      </div>
      <div className="text-[#f0eef8] font-medium text-xs leading-tight max-w-[160px] truncate">{data.label}</div>
    </div>
  );
}

const nodeTypes = { entity: EntityNode };

function transformToFlow(entities: Entity[], relations: Relation[]): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = entities.map((entity) => ({
    id: entity.entity_id,
    type: 'entity',
    position: {
      x: Math.random() * 800,
      y: Math.random() * 600,
    },
    data: {
      label: entity.name,
      entityType: entity.entity_type,
    },
  }));

  const edges: Edge[] = relations.map((rel) => ({
    id: rel.relation_id,
    source: rel.source_id,
    target: rel.target_id,
    label: rel.relation_type,
    style: edgeStyle,
    labelStyle: {
      fill: '#5c5878',
      fontSize: 10,
      fontFamily: 'IBM Plex Mono, monospace',
    },
    labelBgStyle: {
      fill: '#0d0b1a',
      fillOpacity: 0.8,
      stroke: 'color-mix(in srgb, var(--color-teal) 50%, transparent)',
      strokeWidth: 1,
    },
    animated: true,
  }));

  return { nodes, edges };
}

interface EntityDetailPanelProps {
  entity: Entity;
  onClose: () => void;
}

function EntityDetailPanel({ entity, onClose }: EntityDetailPanelProps) {
  const [isRelViewerOpen, setIsRelViewerOpen] = useState(false);
  const properties = entity.properties ?? {};
  const propertyEntries = Object.entries(properties);

  return (
    <div
      className="w-72 flex-shrink-0 rounded-xl border border-[rgba(46,196,196,0.2)] bg-[rgba(46,196,196,0.03)] overflow-hidden flex flex-col"
      style={{ maxHeight: '100%' }}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2 min-w-0">
          <GitBranch className="w-3.5 h-3.5 text-[#2EC4C4] flex-shrink-0" />
          <span className="text-sm font-semibold text-[#f0eef8] truncate">{entity.name}</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded hover:bg-white/[0.06] text-[#5c5878] hover:text-[#a09bb8] transition-colors flex-shrink-0"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="p-4 space-y-4 overflow-y-auto flex-1">
        <div>
          <p className="text-[10px] font-mono text-[#5c5878] uppercase tracking-wider mb-1.5">Entity Type</p>
          <Badge variant="memory">{entity.entity_type}</Badge>
        </div>

        <div>
          <p className="text-[10px] font-mono text-[#5c5878] uppercase tracking-wider mb-1">Entity ID</p>
          <p className="text-xs font-mono text-[#a09bb8] break-all">{entity.entity_id}</p>
        </div>

        {propertyEntries.length > 0 && (
          <div>
            <p className="text-[10px] font-mono text-[#5c5878] uppercase tracking-wider mb-2">Properties</p>
            <dl className="space-y-1.5">
              {propertyEntries.map(([key, value]) => (
                <div key={key} className="flex flex-col gap-0.5">
                  <dt className="text-[10px] font-mono text-[#5c5878]">{key}</dt>
                  <dd className="text-xs text-[#a09bb8] break-words">
                    {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        <div className="pt-4 border-t border-[#1e1e3a] mt-4">
          <p className="text-xs font-mono text-[#a09bb8] mb-1">Created</p>
          <p className="text-xs font-mono text-[#a09bb8]">
            {new Date(entity.created_at).toLocaleDateString('en-AU', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </p>
        </div>

        <div className="pt-4 border-t border-[#1e1e3a] mt-4">
          <Button variant="secondary" className="w-full justify-center gap-2" onClick={() => setIsRelViewerOpen(true)}>
            <Network className="w-4 h-4" />
            Explore Relationships
          </Button>
        </div>
      </div>
    </div>
  );
}

interface RelationshipViewerModalProps {
  entity: Entity;
  isOpen: boolean;
  onClose: () => void;
}

function RelationshipViewerModal({ entity, isOpen, onClose }: RelationshipViewerModalProps) {
  const { data: graphData, isLoading } = useSWR(
    isOpen ? `memory-graph-${entity.entity_id}` : null,
    () => memoryClient.getKnowledgeGraph(),
  );

  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);

  useEffect(() => {
    if (graphData?.data) {
      const relatedEdges = (graphData.data.relations || []).filter(
        (r) => r.source_id === entity.entity_id || r.target_id === entity.entity_id,
      );

      const relatedEntityIds = new Set<string>();
      relatedEntityIds.add(entity.entity_id);

      relatedEdges.forEach((r) => {
        relatedEntityIds.add(r.source_id);
        relatedEntityIds.add(r.target_id);
      });

      const relatedEntities = (graphData.data.entities || []).filter((e) => relatedEntityIds.has(e.entity_id));

      const { nodes: n, edges: e } = transformToFlow(relatedEntities, relatedEdges);

      const rootNode = n.find((node) => node.id === entity.entity_id);
      if (rootNode) {
        rootNode.style = {
          ...rootNode.style,
          boxShadow: '0 0 20px rgba(46,196,196,0.8)',
          border: '2px solid #2EC4C4',
          zIndex: 10,
        };
      }

      setNodes(n);
      setEdges(e);
    }
  }, [graphData, entity.entity_id]);

  const onNodesChange: OnNodesChange = useCallback(() => {}, []);
  const onEdgesChange: OnEdgesChange = useCallback(() => {}, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#0d0d1a] border border-[#1e1e3a] rounded-xl w-[90vw] h-[85vh] max-w-6xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-4 border-b border-[#1e1e3a]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[rgba(46,196,196,0.12)] rounded-lg">
              <Network className="w-5 h-5 text-[#2EC4C4]" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-[#f0eef8]">Relationship Explorer</h2>
              <p className="text-xs text-[#a09bb8] font-mono">Focusing on: {entity.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-[#5c5878] hover:text-[#f0eef8] hover:bg-white/[0.06] rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 relative bg-background">
          {isLoading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <div className="w-6 h-6 border-2 border-[#2EC4C4] border-t-transparent rounded-full animate-spin" />
                <span className="text-sm font-mono text-[#a09bb8]">Mapping semantic connections...</span>
              </div>
            </div>
          ) : (
            <ReactFlowProvider>
              <GraphCanvas
                nodes={nodes}
                edges={edges}
                onNodeClick={() => {}}
                onPaneClick={() => {}}
              />
            </ReactFlowProvider>
          )}
        </div>
      </div>
    </div>
  );
}

function GraphCanvas({
  nodes,
  edges,
  onNodeClick,
  onNodeDoubleClick,
  onPaneClick,
}: {
  nodes: Node[];
  edges: Edge[];
  onNodeClick: (event: React.MouseEvent, node: Node) => void;
  onNodeDoubleClick?: (event: React.MouseEvent, node: Node) => void;
  onPaneClick: () => void;
}) {
  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodeClick={onNodeClick}
      onNodeDoubleClick={onNodeDoubleClick}
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
      <MiniMap nodeColor="#2EC4C4" maskColor="rgba(3,2,10,0.8)" className="bg-deep border border-white/[0.06] rounded-lg" />
    </ReactFlow>
  );
}

interface GraphContentProps {
  matters: Matter[];
}

function GraphContent({ matters }: GraphContentProps) {
  const [selectedMatterId, setSelectedMatterId] = useState<string>('');
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);

  const { data, error, isLoading } = useSWR(
    swrKeys.memory.knowledgeGraph(selectedMatterId || undefined),
    () => memoryClient.getKnowledgeGraph(selectedMatterId || undefined),
    { revalidateOnFocus: false },
  );

  useEffect(() => {
    if (!data?.data) return;
    const { entities, relations } = data.data;
    const { nodes: newNodes, edges: newEdges } = transformToFlow(entities, relations);
    setNodes(newNodes);
    setEdges(newEdges);
  }, [data]);

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      const entityData = data?.data?.entities.find((e) => e.entity_id === node.id);
      setSelectedEntity((prev) => (prev?.entity_id === node.id ? null : (entityData ?? null)));
    },
    [data],
  );

  const handleNodeDoubleClick = useCallback(
    (event: React.MouseEvent, node: Node) => {
      const entity = data?.data?.entities.find((e) => e.entity_id === node.id);
      if (entity) {
        setSelectedEntity(entity);
      }
    },
    [data],
  );

  const handlePaneClick = useCallback(() => {
    setSelectedEntity(null);
  }, []);

  const entityCount = data?.data?.entities.length ?? 0;
  const edgeCount = data?.data?.relations.length ?? 0;

  return (
    <div className="flex flex-col h-full">
      <SectionHeader title="Knowledge Graph" />

      <div className="flex items-center gap-4 mb-4">
        <div className="flex items-center gap-2">
          <Layers className="w-3.5 h-3.5 text-[#5c5878]" />
          <select
            value={selectedMatterId}
            onChange={(e) => {
              setSelectedMatterId(e.target.value);
              setSelectedEntity(null);
            }}
            className="bg-white/[0.04] border border-white/[0.08] rounded-lg text-xs text-[#a09bb8] px-3 py-1.5 font-mono focus:outline-none focus:border-[rgba(46,196,196,0.4)] transition-colors"
          >
            <option value="">All Matters</option>
            {matters.map((m) => (
              <option key={m.matter_id} value={m.matter_id}>
                {m.title}
              </option>
            ))}
          </select>
        </div>

        {!isLoading && (
          <div className="flex items-center gap-3 ml-auto">
            <span className="text-xs font-mono text-[#5c5878]">
              <span className="text-[#2EC4C4]">{entityCount}</span> entities
            </span>
            <span className="text-xs font-mono text-[#5c5878]">
              <span className="text-[#2EC4C4]">{edgeCount}</span> relations
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-1 gap-4 min-h-0">
        <div className="flex-1 rounded-xl border border-white/[0.06] overflow-hidden min-h-[500px]">
          {isLoading ? (
            <LoadingState label="Loading knowledge graph..." />
          ) : error || data?.error ? (
            <ErrorState message={data?.error ?? 'Failed to load graph'} />
          ) : entityCount === 0 ? (
            <EmptyState
              title="No entities in graph"
              description="Add memories and entities to see the knowledge graph."
              icon={<GitBranch className="w-6 h-6" />}
            />
          ) : (
            <ReactFlowProvider>
              <GraphCanvas
                nodes={nodes}
                edges={edges}
                onNodeClick={handleNodeClick}
                onNodeDoubleClick={handleNodeDoubleClick}
                onPaneClick={handlePaneClick}
              />
            </ReactFlowProvider>
          )}
        </div>

        <AnimatePresence>
          {selectedEntity && (
            <motion.div
              initial={{ opacity: 0, x: 50, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 50, scale: 0.95 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="absolute right-0 top-0 bottom-0 z-10 w-80 shadow-2xl"
            >
              <EntityDetailPanel entity={selectedEntity} onClose={() => setSelectedEntity(null)} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default function MemoryGraphContent() {
  const { data: mattersData } = useSWR(swrKeys.memory.matters(), () => memoryClient.getMatters(), {
    revalidateOnFocus: false,
  });

  const matters = mattersData?.data?.matters ?? [];

  return <GraphContent matters={matters} />;
}
