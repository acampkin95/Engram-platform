"use client";

import {
  Background,
  type ColorMode,
  Controls,
  type Edge,
  Handle,
  MiniMap,
  type Node,
  type NodeTypes,
  Panel,
  Position,
  ReactFlow,
  useEdgesState,
  useNodesState,
} from "@xyflow/react";
import { useCallback, useEffect, useState } from "react";
import "@xyflow/react/dist/style.css";
import { clsx } from "clsx";
import { apiClient } from "@/lib/api-client";
import type { Stats } from "@/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TierNodeData = {
  label: string;
  tier: number;
  count: number;
  description: string;
};

// ---------------------------------------------------------------------------
// Custom Node
// ---------------------------------------------------------------------------

const TIER_COLORS: Record<number, { border: string; bg: string; glow: string }> = {
  1: {
    border: "border-[#F2A93B]",
    bg: "bg-[#F2A93B]/10",
    glow: "shadow-[0_0_15px_rgba(242,169,59,0.3)]",
  },
  2: {
    border: "border-[#9B7DE0]",
    bg: "bg-[#9B7DE0]/10",
    glow: "shadow-[0_0_15px_rgba(155,125,224,0.3)]",
  },
  3: {
    border: "border-[#2EC4C4]",
    bg: "bg-[#2EC4C4]/10",
    glow: "shadow-[0_0_15px_rgba(46,196,196,0.3)]",
  },
};

function TierNode({ data }: { data: TierNodeData }) {
  const colors = TIER_COLORS[data.tier] ?? TIER_COLORS[1];

  return (
    <div
      className={clsx(
        "px-6 py-4 rounded-xl border-2 min-w-[180px] text-center",
        colors.border,
        colors.bg,
        colors.glow
      )}
    >
      <Handle type="target" position={Position.Top} className="!bg-slate-500" />

      <p className="text-xs text-slate-400 mb-1">Tier {data.tier}</p>
      <p className="text-base font-semibold text-slate-100">{data.label}</p>
      <p className="text-xs text-slate-400 mt-1">{data.description}</p>
      <p className="text-lg font-bold text-slate-200 mt-2">{data.count} memories</p>

      <Handle type="source" position={Position.Bottom} className="!bg-slate-500" />
    </div>
  );
}

const nodeTypes: NodeTypes = {
  tier: TierNode,
};

// ---------------------------------------------------------------------------
// Initial Data
// ---------------------------------------------------------------------------

const initialNodes: Node<TierNodeData>[] = [
  {
    id: "tier-1",
    type: "tier",
    position: { x: 0, y: 0 },
    data: {
      label: "Project Memory",
      tier: 1,
      count: 0,
      description: "Short-term, project-scoped",
    },
  },
  {
    id: "tier-2",
    type: "tier",
    position: { x: 300, y: 0 },
    data: {
      label: "General Memory",
      tier: 2,
      count: 0,
      description: "Mid-term, cross-project",
    },
  },
  {
    id: "tier-3",
    type: "tier",
    position: { x: 600, y: 0 },
    data: {
      label: "Global Memory",
      tier: 3,
      count: 0,
      description: "Long-term, universal",
    },
  },
];

const initialEdges: Edge[] = [
  {
    id: "e-1-2",
    source: "tier-1",
    target: "tier-2",
    animated: true,
    style: { stroke: "#475569" },
    label: "promotes",
    labelStyle: { fill: "#94a3b8", fontSize: 11 },
    labelBgStyle: { fill: "#1e293b" },
    labelBgPadding: [6, 4] as [number, number],
    labelBgBorderRadius: 4,
  },
  {
    id: "e-2-3",
    source: "tier-2",
    target: "tier-3",
    animated: true,
    style: { stroke: "#475569" },
    label: "promotes",
    labelStyle: { fill: "#94a3b8", fontSize: 11 },
    labelBgStyle: { fill: "#1e293b" },
    labelBgPadding: [6, 4] as [number, number],
    labelBgBorderRadius: 4,
  },
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function GraphPage() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, _setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch stats and patch node counts
  const fetchStats = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await apiClient.get<Stats>("/stats");

      setNodes((nds) =>
        nds.map((n) => {
          if (n.id === "tier-1") return { ...n, data: { ...n.data, count: data.tier1_count } };
          if (n.id === "tier-2") return { ...n, data: { ...n.data, count: data.tier2_count } };
          if (n.id === "tier-3") return { ...n, data: { ...n.data, count: data.tier3_count } };
          return n;
        })
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, [setNodes]);

  // Load on mount and poll every 30 seconds
  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 30_000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Knowledge Graph</h1>
          <p className="text-slate-400">Visual overview of the 3-tier memory architecture</p>
        </div>

        <button
          type="button"
          onClick={fetchStats}
          disabled={isLoading}
          className="px-4 py-1.5 rounded-lg text-xs font-medium bg-slate-700 text-slate-400 hover:bg-slate-600 transition-colors"
        >
          {isLoading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-900/30 border border-red-700 text-red-300 rounded-xl p-4 text-sm">
          {error}
        </div>
      )}

      {/* Graph Canvas */}
      <div
        className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden"
        style={{ height: 520 }}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.4 }}
          colorMode={"dark" as ColorMode}
          proOptions={{ hideAttribution: true }}
        >
          <Background color="#334155" gap={20} />
          <Controls
            showInteractive={false}
            className="!bg-slate-700 !border-slate-600 !rounded-lg [&>button]:!bg-slate-700 [&>button]:!border-slate-600 [&>button]:!text-slate-300 [&>button:hover]:!bg-slate-600"
          />
          <MiniMap
            nodeColor={(n) => {
              const tier = (n.data as TierNodeData)?.tier;
              if (tier === 1) return "#10b981";
              if (tier === 2) return "#f59e0b";
              if (tier === 3) return "#8b5cf6";
              return "#475569";
            }}
            maskColor="rgba(15, 23, 42, 0.7)"
            className="!bg-slate-800 !border-slate-700 !rounded-lg"
          />

          {/* Legend Panel */}
          <Panel position="top-right">
            <div className="bg-slate-800/90 backdrop-blur border border-slate-700 rounded-lg p-3 space-y-1.5">
              <p className="text-xs text-slate-400 font-medium mb-1">Tiers</p>
              <div className="flex items-center gap-2 text-xs">
                <div className="w-3 h-3 rounded" style={{ background: "#10b981" }} />
                <span className="text-slate-300">Tier 1 – Project</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <div className="w-3 h-3 rounded" style={{ background: "#f59e0b" }} />
                <span className="text-slate-300">Tier 2 – General</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <div className="w-3 h-3 rounded" style={{ background: "#8b5cf6" }} />
                <span className="text-slate-300">Tier 3 – Global</span>
              </div>
            </div>
          </Panel>
        </ReactFlow>
      </div>

      {/* Loading Overlay */}
      {isLoading && (
        <div className="flex items-center justify-center py-4">
          <div className="animate-spin w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full" />
        </div>
      )}
    </div>
  );
}
