"use client";

import { clsx } from "clsx";
import { Activity, Brain, Database, Globe, Layers, TrendingUp } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { TierDonutChart } from "@/components/charts";
import {
  defaultTenantProjectContext,
  type TenantProjectContext,
  TenantProjectSelector,
} from "@/components/tenant-project-selector";
import { Card, CardContent, CardHeader, StatCard } from "@/components/ui";
import { useHealth } from "@/hooks/useHealth";
import { useStats } from "@/hooks/useStats";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default function DashboardPage() {
  const [ctx, setCtx] = useState<TenantProjectContext>(defaultTenantProjectContext());
  const { data: stats, isLoading: statsLoading } = useStats(ctx.tenantId);
  const { data: health } = useHealth();

  const isOnline = health?.weaviate && health?.redis;

  return (
    <div className="space-y-6 animate-page-enter">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-[#f0eef8]">Overview</h1>
          <p className="text-xs text-[#a09bb8] mt-0.5">
            System status:{" "}
            <span className={clsx(isOnline ? "text-[#2ec4c4]" : "text-[#e05c7f]")}>
              {isOnline ? "All systems operational" : "Degraded"}
            </span>
          </p>
        </div>
        <TenantProjectSelector apiUrl={API_URL} value={ctx} onChange={setCtx} />
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          label="Total Memories"
          value={stats?.total_memories ?? "—"}
          icon={<Brain className="w-5 h-5" />}
        />
        <StatCard
          label="Tier 1 — Project"
          value={stats?.tier1_count ?? "—"}
          icon={<Database className="w-5 h-5" />}
        />
        <StatCard
          label="Tier 2 — General"
          value={stats?.tier2_count ?? "—"}
          icon={<Layers className="w-5 h-5" />}
        />
        <StatCard
          label="Tier 3 — Global"
          value={stats?.tier3_count ?? "—"}
          icon={<Globe className="w-5 h-5" />}
        />
      </div>

      {/* Row: Mini Donut + Quick Links */}
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-1">
          <Card>
            <CardHeader title="Tier Distribution" />
            <CardContent>
              <TierDonutChart stats={stats} loading={statsLoading} height={220} />
            </CardContent>
          </Card>
        </div>

        <div className="col-span-2 grid grid-cols-2 gap-4 content-start">
          {/* Avg Importance */}
          <Card className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#2ec4c4]/10 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-[#2ec4c4]" />
              </div>
              <div>
                <p className="text-xs text-[#a09bb8]">Avg Importance</p>
                <p className="text-xl font-bold text-[#f0eef8]">
                  {stats?.avg_importance != null ? stats.avg_importance.toFixed(2) : "—"}
                </p>
              </div>
            </div>
          </Card>

          {/* System Health */}
          <Card className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#2ec4c4]/10 flex items-center justify-center">
                <Activity className="w-5 h-5 text-[#2ec4c4]" />
              </div>
              <div>
                <p className="text-xs text-[#a09bb8]">Infrastructure</p>
                <p className="text-sm font-semibold text-[#f0eef8] mt-0.5">
                  Weaviate:{" "}
                  <span className={health?.weaviate ? "text-[#2ec4c4]" : "text-[#e05c7f]"}>
                    {health?.weaviate ? "Online" : "Offline"}
                  </span>
                </p>
                <p className="text-sm font-semibold text-[#f0eef8]">
                  Redis:{" "}
                  <span className={health?.redis ? "text-[#2ec4c4]" : "text-[#e05c7f]"}>
                    {health?.redis ? "Online" : "Offline"}
                  </span>
                </p>
              </div>
            </div>
          </Card>

          {/* Quick nav to analytics */}
          <Card className="col-span-2 p-5">
            <p className="text-xs text-[#a09bb8] mb-3 uppercase tracking-wider">Quick Access</p>
            <div className="flex gap-3">
              {[
                { href: "/dashboard/analytics/memories", label: "Memory Analytics" },
                { href: "/dashboard/analytics/search", label: "Search Analytics" },
                { href: "/dashboard/analytics/system", label: "System Health" },
                { href: "/dashboard/memories", label: "Browse Memories" },
              ].map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="px-3 py-1.5 rounded-lg bg-[#1a1638] text-xs text-[#a09bb8] hover:bg-[#221d45] hover:text-[#f0eef8] transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
