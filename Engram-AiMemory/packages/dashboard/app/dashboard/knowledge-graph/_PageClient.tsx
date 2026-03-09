"use client";

import {
  Background,
  type ColorMode,
  Controls,
  type Edge,
  Handle,
  MarkerType,
  MiniMap,
  type Node,
  type NodeTypes,
  Panel,
  Position,
  ReactFlow,
  useEdgesState,
  useNodesState,
} from "@xyflow/react";
import { AnimatePresence, motion } from "framer-motion";
import { Layers, Network, RefreshCw, Search as SearchIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  defaultTenantProjectContext,
  type TenantProjectContext,
  TenantProjectSelector,
} from "@/components/tenant-project-selector";
import { authHeaders } from "@/lib/auth";
import "@xyflow/react/dist/style.css";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface KnowledgeEntity {
  entity_id: string;
  name: string;
  entity_type: string;
  description?: string;
}

interface KnowledgeRelation {
  relation_id: string;
  source_entity_id: string;
  target_entity_id: string;
  relation_type: string;
  weight: number;
}

interface GraphQueryResponse {
  root_entity_id: string;
  entities: KnowledgeEntity[];
  relations: KnowledgeRelation[];
  depth: number;
}

interface EntitySummary {
  entity_id: string;
  name: string;
  entity_type: string;
  description?: string;
  project_id?: string;
  created_at?: string;
}

interface ListEntitiesResponse {
  entities: EntitySummary[];
  total: number;
  limit: number;
  offset: number;
}

type EntityNodeData = {
  label: string;
  entity_type: string;
  description: string;
  entity_id: string;
};

// ---------------------------------------------------------------------------
// Entity type colour map
// ---------------------------------------------------------------------------

const ENTITY_TYPE_COLORS: Record<
  string,
  { border: string; glow: string; badge: string; dot: string }
> = {
  person: {
    border: "#3b82f6",
    glow: "rgba(59,130,246,0.4)",
    badge: "text-blue-400 bg-blue-500/10",
    dot: "#3b82f6",
  },
  project: {
    border: "#10b981",
    glow: "rgba(16,185,129,0.4)",
    badge: "text-emerald-400 bg-emerald-500/10",
    dot: "#10b981",
  },
  tool: {
    border: "#f59e0b",
    glow: "rgba(245,158,11,0.4)",
    badge: "text-amber-400 bg-amber-500/10",
    dot: "#f59e0b",
  },
  concept: {
    border: "#8b5cf6",
    glow: "rgba(139,92,246,0.4)",
    badge: "text-violet-400 bg-violet-500/10",
    dot: "#8b5cf6",
  },
  database: {
    border: "#ef4444",
    glow: "rgba(239,68,68,0.4)",
    badge: "text-red-400 bg-red-500/10",
    dot: "#ef4444",
  },
  default: {
    border: "#06b6d4",
    glow: "rgba(6,182,212,0.4)",
    badge: "text-cyan-400 bg-cyan-500/10",
    dot: "#06b6d4",
  },
};

// ---------------------------------------------------------------------------
// Animated Entity Node
// ---------------------------------------------------------------------------

function EntityNode({ data }: { data: EntityNodeData }) {
  const colors = ENTITY_TYPE_COLORS[data.entity_type] ?? ENTITY_TYPE_COLORS.default;

  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      whileHover={{ scale: 1.06 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className="px-4 py-3 rounded-xl min-w-[160px] text-center bg-[#090818]/95 backdrop-blur border-2 relative overflow-hidden"
      style={{
        borderColor: colors.border,
        boxShadow: `0 0 20px ${colors.glow}, inset 0 0 20px ${colors.glow}20`,
      }}
    >
      {/* Subtle inner glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at 50% 0%, ${colors.glow}20 0%, transparent 70%)`,
        }}
      />

      <Handle
        type="target"
        position={Position.Top}
        className="!w-2 !h-2"
        style={{ background: colors.border, border: "none" }}
      />

      <p className={`text-[10px] font-medium uppercase tracking-wider mb-1 ${colors.badge}`}>
        {data.entity_type}
      </p>
      <p className="text-sm font-semibold text-white">{data.label}</p>
      {data.description && (
        <p className="text-[10px] text-[#a09bb8] mt-1 line-clamp-2 leading-relaxed">
          {data.description}
        </p>
      )}

      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-2 !h-2"
        style={{ background: colors.border, border: "none" }}
      />
    </motion.div>
  );
}

const nodeTypes: NodeTypes = {
  entity: EntityNode,
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function KnowledgeGraphPage() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedEntity, setSelectedEntity] = useState<string>("");
  const [depth, setDepth] = useState<number>(1);
  const [ctx, setCtx] = useState<TenantProjectContext>(defaultTenantProjectContext());
  const [entityName, setEntityName] = useState<string>("");

  // Entity list for the browse panel
  const [entityList, setEntityList] = useState<EntitySummary[]>([]);
  const [entityListLoading, setEntityListLoading] = useState(false);

  // Auto-refresh toggle
  const [autoRefresh, setAutoRefresh] = useState(false);

  // Fetch entity list when ctx changes
  useEffect(() => {
    async function fetchEntities() {
      setEntityListLoading(true);
      try {
        const params = new URLSearchParams({
          tenant_id: ctx.tenantId,
          project_id: ctx.projectId,
          limit: "100",
        });
        const res = await fetch(`${API_URL}/graph/entities?${params}`, { headers: authHeaders() });
        if (!res.ok) return;
        const data: ListEntitiesResponse = await res.json();
        setEntityList(data.entities);
      } catch {
        // silent fail — entity list is optional
      } finally {
        setEntityListLoading(false);
      }
    }
    void fetchEntities();
  }, [ctx]);

  const fetchGraph = useCallback(async () => {
    if (!selectedEntity && !entityName) {
      setError("Please enter an entity name to query");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      let entityId = selectedEntity;

      if (entityName && !selectedEntity) {
        const searchRes = await fetch(
          `${API_URL}/graph/entities/by-name?name=${encodeURIComponent(entityName)}&tenant_id=${encodeURIComponent(ctx.tenantId)}&project_id=${encodeURIComponent(ctx.projectId)}`,
          { headers: authHeaders() }
        );
        if (!searchRes.ok) throw new Error(`Entity '${entityName}' not found`);
        const entityData = await searchRes.json();
        entityId = entityData.entity_id;
      }

      if (!entityId) throw new Error("No entity ID to query");

      const res = await fetch(`${API_URL}/graph/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          entity_id: entityId,
          tenant_id: ctx.tenantId,
          project_id: ctx.projectId,
          depth,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Query failed (${res.status})`);
      }

      const data: GraphQueryResponse = await res.json();

      const newNodes: Node[] = data.entities.map((entity, idx) => ({
        id: entity.entity_id,
        type: "entity",
        position: {
          x: (idx % 4) * 260,
          y: Math.floor(idx / 4) * 190,
        },
        data: {
          label: entity.name,
          entity_type: entity.entity_type,
          description: entity.description || "",
          entity_id: entity.entity_id,
        },
      }));

      const newEdges: Edge[] = data.relations.map((rel, idx) => ({
        id: `e-${idx}`,
        source: rel.source_entity_id,
        target: rel.target_entity_id,
        label: rel.relation_type,
        type: "smoothstep",
        animated: true,
        style: { stroke: "#9b7de0", strokeWidth: 2 },
        labelStyle: { fill: "#9b7de0", fontSize: 10 },
        labelBgStyle: { fill: "#090818" },
        labelBgPadding: [4, 2] as [number, number],
        labelBgBorderRadius: 4,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: "#9b7de0",
        },
      }));

      setNodes(newNodes);
      setEdges(newEdges);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setNodes([]);
      setEdges([]);
    } finally {
      setIsLoading(false);
    }
  }, [selectedEntity, entityName, ctx, depth, setNodes, setEdges]);

  // Auto-refresh effect
  useEffect(() => {
    if (!autoRefresh || (!selectedEntity && !entityName)) return;
    const interval = setInterval(() => {
      if (selectedEntity || entityName) fetchGraph();
    }, 30_000);
    return () => clearInterval(interval);
  }, [autoRefresh, selectedEntity, entityName, fetchGraph]);

  return (
    <motion.div
      className="space-y-6 animate-page-enter"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* Page Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-[#F2A93B] to-[#ffc15e] bg-clip-text text-transparent">
            Entity Graph
          </h1>
          <p className="text-[#a09bb8] mt-1 text-sm">
            Explore knowledge graph entity relationships
          </p>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          <TenantProjectSelector
            apiUrl={API_URL}
            value={ctx}
            onChange={(c) => {
              setCtx(c);
              setSelectedEntity("");
            }}
          />
          <div className="flex items-center gap-2 px-3 py-1.5 bg-[#090818]/80 rounded-xl border border-white/[0.08]">
            <Layers className="w-4 h-4 text-[#2ec4c4]" />
            <span className="text-xs text-[#a09bb8]">
              {nodes.length} entities · {edges.length} relations
            </span>
          </div>
          <button
            type="button"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all ${
              autoRefresh
                ? "bg-[#2ec4c4]/20 border-[#2ec4c4]/50 text-[#2ec4c4]"
                : "bg-[#090818]/80 border-white/[0.08] text-[#a09bb8] hover:text-[#f0eef8]"
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${autoRefresh ? "animate-spin" : ""}`} />
            {autoRefresh ? "Auto" : "Manual"}
          </button>
        </div>
      </div>

      {/* Query Controls */}
      <motion.div
        className="bg-[#090818]/80 backdrop-blur-xl rounded-2xl p-5 border border-white/[0.08]"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[200px]">
            <label
              htmlFor="entity-name"
              className="block text-xs text-[#5c5878] uppercase tracking-wider mb-2"
            >
              Entity Name
            </label>
            <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#5c5878]" />
              <input
                id="entity-name"
                type="text"
                value={entityName}
                onChange={(e) => setEntityName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && fetchGraph()}
                placeholder="e.g., FastAPI, Weaviate"
                className="w-full pl-9 pr-4 py-2.5 bg-[#1a1638] border border-white/[0.08] rounded-xl text-sm text-[#f0eef8] placeholder-[#5c5878] focus:outline-none focus:border-[#2ec4c4]/50 focus:ring-1 focus:ring-[#2ec4c4]/20 transition-all"
              />
            </div>
          </div>

          <div className="w-28">
            <label
              htmlFor="graph-depth"
              className="block text-xs text-[#5c5878] uppercase tracking-wider mb-2"
            >
              Depth
            </label>
            <select
              id="graph-depth"
              value={depth}
              onChange={(e) => setDepth(Number(e.target.value))}
              className="w-full px-3 py-2.5 bg-[#1a1638] border border-white/[0.08] rounded-xl text-sm text-[#f0eef8] focus:outline-none focus:border-[#2ec4c4]/50 transition-all"
            >
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={3}>3</option>
            </select>
          </div>

          <motion.button
            type="button"
            onClick={fetchGraph}
            disabled={isLoading}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-[#F2A93B] hover:bg-[#ffc15e] text-[#03020a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 0.8, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </motion.div>
                Querying…
              </>
            ) : (
              <>
                <Network className="w-3.5 h-3.5" />
                Query
              </>
            )}
          </motion.button>
        </div>
      </motion.div>

      {/* Entity List Panel */}
      {(entityListLoading || entityList.length > 0) && (
        <motion.div
          className="bg-[#090818]/80 backdrop-blur-xl rounded-2xl p-4 border border-white/[0.08]"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <p className="text-xs text-[#5c5878] uppercase tracking-wider mb-3 flex items-center gap-2">
            <Network className="w-3 h-3" />
            Entities
            {!entityListLoading && <span className="text-[#5c5878]">({entityList.length})</span>}
          </p>

          {entityListLoading ? (
            <div className="flex items-center gap-2 text-xs text-[#5c5878]">
              <div className="animate-spin w-3 h-3 border-2 border-[#F2A93B] border-t-transparent rounded-full" />
              Loading entities…
            </div>
          ) : entityList.length === 0 ? (
            <div className="text-center py-6 text-[#5c5878]">
              <p className="text-2xl mb-2">🕸</p>
              <p className="text-xs text-[#a09bb8]">No entities yet</p>
              <p className="text-xs text-[#5c5878] mt-1">Add entities via the MCP tools or API</p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2 max-h-28 overflow-y-auto">
              {entityList.map((e) => {
                const colors = ENTITY_TYPE_COLORS[e.entity_type] ?? ENTITY_TYPE_COLORS.default;
                return (
                  <button
                    key={e.entity_id}
                    type="button"
                    onClick={() => {
                      setEntityName(e.name);
                      setSelectedEntity("");
                    }}
                    className="px-2.5 py-1 rounded-lg text-xs border transition-colors hover:text-[#2ec4c4]"
                    style={{
                      borderColor: `${colors.border}40`,
                      color: colors.dot,
                      background: `${colors.glow}10`,
                    }}
                  >
                    {e.name}
                  </button>
                );
              })}
            </div>
          )}
        </motion.div>
      )}

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="bg-red-950/50 border border-red-800/60 text-red-300 rounded-xl p-4 text-sm"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Graph Canvas */}
      <motion.div
        className="rounded-2xl border border-slate-800/80 overflow-hidden relative"
        style={{
          height: 540,
          background: "#0a0f1a",
          boxShadow: "inset 0 0 60px rgba(242,169,59,0.03)",
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        {nodes.length === 0 && !isLoading ? (
          <div className="flex items-center justify-center h-full text-[#5c5878]">
            <div className="text-center">
              <motion.div
                animate={{
                  scale: [1, 1.05, 1],
                  opacity: [0.4, 0.7, 0.4],
                }}
                transition={{ duration: 3, repeat: Number.POSITIVE_INFINITY }}
              >
                <Network className="w-12 h-12 mx-auto mb-3" />
              </motion.div>
              <p className="text-base font-medium text-[#5c5878]">No graph data</p>
              <p className="text-sm text-[#5c5878] mt-1">
                Enter an entity name above and click Query
              </p>
            </div>
          </div>
        ) : (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={(_, node) => {
              // Set the clicked entity as the root for a new query
              setEntityName((node.data as { label: string }).label);
              setSelectedEntity(node.id);
            }}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.25 }}
            colorMode={"dark" as ColorMode}
            proOptions={{ hideAttribution: true }}
          >
            <Background color="#1a2234" gap={24} size={1} />
            <Controls
              showInteractive={false}
              className="!bg-[#090818] !border-white/[0.08] !rounded-xl [&>button]:!bg-[#090818] [&>button]:!border-white/[0.08] [&>button]:!text-[#a09bb8] [&>button:hover]:!bg-[#1a1638] [&>button:hover]:!text-[#2ec4c4]"
            />
            <MiniMap
              nodeColor={(n) => {
                const et = (n.data as unknown as EntityNodeData)?.entity_type;
                return ENTITY_TYPE_COLORS[et]?.dot ?? ENTITY_TYPE_COLORS.default.dot;
              }}
              maskColor="rgba(10,15,26,0.75)"
              className="!bg-[#090818]/90 !border-white/[0.08] !rounded-xl"
            />

            {/* Legend Panel */}
            <Panel position="top-right">
              <div className="bg-[#090818]/90 backdrop-blur border border-white/[0.08] rounded-xl p-3 space-y-1.5">
                <p className="text-[10px] text-[#5c5878] uppercase tracking-widest font-medium mb-2">
                  Entity Types
                </p>
                {Object.entries(ENTITY_TYPE_COLORS)
                  .filter(([k]) => k !== "default")
                  .map(([type, colors]) => (
                    <div key={type} className="flex items-center gap-2 text-xs">
                      <div
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ background: colors.dot, boxShadow: `0 0 6px ${colors.glow}` }}
                      />
                      <span className="text-[#a09bb8] capitalize">{type}</span>
                    </div>
                  ))}
              </div>
            </Panel>

            {/* Stats Panel */}
            <Panel position="top-left">
              <div className="bg-[#090818]/90 backdrop-blur border border-white/[0.08] rounded-xl p-3">
                <p className="text-[10px] text-[#5c5878] uppercase tracking-widest font-medium mb-2">
                  Graph Stats
                </p>
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-6">
                    <span className="text-xs text-[#a09bb8]">Entities</span>
                    <span className="text-xs font-bold text-[#2ec4c4]">{nodes.length}</span>
                  </div>
                  <div className="flex items-center justify-between gap-6">
                    <span className="text-xs text-[#a09bb8]">Relations</span>
                    <span className="text-xs font-bold text-[#2ec4c4]">{edges.length}</span>
                  </div>
                  <div className="flex items-center justify-between gap-6">
                    <span className="text-xs text-[#a09bb8]">Depth</span>
                    <span className="text-xs font-bold text-[#2ec4c4]">{depth}</span>
                  </div>
                </div>
              </div>
            </Panel>
          </ReactFlow>
        )}
      </motion.div>
    </motion.div>
  );
}
