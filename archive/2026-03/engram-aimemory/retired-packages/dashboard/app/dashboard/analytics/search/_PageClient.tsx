"use client";

import { Network, Search, Target } from "lucide-react";
import { useState } from "react";
import { KnowledgeGraphTreemap, SearchScatterChart } from "@/components/charts";
import {
  defaultTenantProjectContext,
  type TenantProjectContext,
  TenantProjectSelector,
} from "@/components/tenant-project-selector";
import { Card, CardContent, CardHeader, StatCard } from "@/components/ui";
import { useKnowledgeGraphStats, useSearchStats } from "@/hooks/useAnalytics";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default function SearchAnalyticsPage() {
  const [ctx, setCtx] = useState<TenantProjectContext>(defaultTenantProjectContext());

  const { data: searchStats, isLoading: searchLoading } = useSearchStats(ctx.tenantId);
  const { data: graphStats, isLoading: graphLoading } = useKnowledgeGraphStats(ctx.tenantId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-200">Search Analytics</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Query patterns, relevance scores, and knowledge graph
          </p>
        </div>
        <TenantProjectSelector apiUrl={API_URL} value={ctx} onChange={setCtx} />
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard
          label="Total Searches"
          value={searchStats?.total_searches ?? "—"}
          icon={<Search className="w-5 h-5" />}
        />
        <StatCard
          label="Avg Relevance Score"
          value={searchStats?.avg_score != null ? searchStats.avg_score.toFixed(2) : "—"}
          icon={<Target className="w-5 h-5" />}
        />
        <StatCard
          label="Knowledge Entities"
          value={graphStats?.total_entities ?? "—"}
          icon={<Network className="w-5 h-5" />}
        />
      </div>

      {/* Search Scatter */}
      <Card>
        <CardHeader
          title="Query Analytics"
          subtitle="Top queries by frequency and relevance score"
        />
        <CardContent>
          <SearchScatterChart stats={searchStats} loading={searchLoading} height={320} />
        </CardContent>
      </Card>

      {/* Knowledge Graph Treemap */}
      <Card>
        <CardHeader title="Knowledge Graph Composition" subtitle="Entity distribution by type" />
        <CardContent>
          <KnowledgeGraphTreemap data={graphStats} loading={graphLoading} height={320} />
        </CardContent>
      </Card>

      {/* Top Queries Table */}
      {searchStats?.top_queries && searchStats.top_queries.length > 0 && (
        <Card>
          <CardHeader title="Top Queries" />
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-500 border-b border-slate-800">
                  <th className="text-left py-2">Query</th>
                  <th className="text-right py-2">Count</th>
                  <th className="text-right py-2">Avg Score</th>
                </tr>
              </thead>
              <tbody>
                {searchStats.top_queries.map((q) => (
                  <tr key={q.query} className="border-b border-slate-800/50 text-slate-300">
                    <td className="py-2 font-mono text-xs">{q.query}</td>
                    <td className="py-2 text-right">{q.count}</td>
                    <td className="py-2 text-right text-cyan-400">{q.avg_score.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
