"use client";

import { Brain, Database, Layers, TrendingUp } from "lucide-react";
import { useState } from "react";
import {
  ActivityHeatmap,
  ImportanceHistogram,
  MemoryGrowthChart,
  TierDonutChart,
  TypeBarChart,
} from "@/components/charts";
import {
  defaultTenantProjectContext,
  type TenantProjectContext,
  TenantProjectSelector,
} from "@/components/tenant-project-selector";
import { Card, CardContent, CardHeader, StatCard } from "@/components/ui";
import { useActivityTimeline, useMemoryGrowth } from "@/hooks/useAnalytics";
import { useStats } from "@/hooks/useStats";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default function MemoriesAnalyticsPage() {
  const [ctx, setCtx] = useState<TenantProjectContext>(defaultTenantProjectContext());
  const [period, setPeriod] = useState<"daily" | "weekly" | "monthly">("daily");

  const { data: stats, isLoading: statsLoading } = useStats(ctx.tenantId);
  const { data: growthData, isLoading: growthLoading } = useMemoryGrowth(ctx.tenantId, period);
  const { data: activityData, isLoading: activityLoading } = useActivityTimeline(ctx.tenantId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-200">Memory Analytics</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Growth trends, distribution, and activity patterns
          </p>
        </div>
        <TenantProjectSelector apiUrl={API_URL} value={ctx} onChange={setCtx} />
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          label="Total Memories"
          value={stats?.total_memories ?? "—"}
          icon={<Brain className="w-5 h-5" />}
        />
        <StatCard
          label="Tier 1 (Project)"
          value={stats?.tier1_count ?? "—"}
          icon={<Database className="w-5 h-5" />}
        />
        <StatCard
          label="Tier 2 (General)"
          value={stats?.tier2_count ?? "—"}
          icon={<Layers className="w-5 h-5" />}
        />
        <StatCard
          label="Avg Importance"
          value={stats?.avg_importance != null ? stats.avg_importance.toFixed(2) : "—"}
          icon={<TrendingUp className="w-5 h-5" />}
        />
      </div>

      {/* Memory Growth Chart — full width */}
      <Card>
        <CardHeader
          title="Memory Growth Over Time"
          subtitle="Cumulative memories by tier"
          action={
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as typeof period)}
              className="text-xs bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-300"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          }
        />
        <CardContent>
          <MemoryGrowthChart data={growthData} loading={growthLoading} height={320} />
        </CardContent>
      </Card>

      {/* Row: Tier Donut + Type Bar */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader title="Tier Distribution" />
          <CardContent>
            <TierDonutChart stats={stats} loading={statsLoading} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Memory Type Breakdown" />
          <CardContent>
            <TypeBarChart byType={stats?.by_type} loading={statsLoading} />
          </CardContent>
        </Card>
      </div>

      {/* Row: Importance Histogram + Activity Heatmap */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader
            title="Importance Distribution"
            subtitle="Score distribution across all memories"
          />
          <CardContent>
            <ImportanceHistogram
              avgImportance={stats?.avg_importance}
              distribution={
                stats?.importance_distribution
                  ? [
                      { bucket: "Low (0\u20130.4)", count: stats.importance_distribution.low },
                      {
                        bucket: "Medium (0.4\u20130.7)",
                        count: stats.importance_distribution.medium,
                      },
                      { bucket: "High (0.7\u20131.0)", count: stats.importance_distribution.high },
                    ]
                  : undefined
              }
              loading={statsLoading}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader
            title="Activity Timeline"
            subtitle={`${new Date().getFullYear()} daily activity`}
          />
          <CardContent>
            <ActivityHeatmap
              data={activityData}
              year={new Date().getFullYear()}
              loading={activityLoading}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
