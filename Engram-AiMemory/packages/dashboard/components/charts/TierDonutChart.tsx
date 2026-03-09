"use client";

import type { EChartsOption } from "echarts";
import { useMemo } from "react";
import type { Stats } from "@/types";
import { Chart } from "./Chart";

interface TierDonutChartProps {
  stats?: Stats;
  loading?: boolean;
  height?: number;
  onTierClick?: (tier: 1 | 2 | 3) => void;
}

export function TierDonutChart({ stats, loading, height = 280, onTierClick }: TierDonutChartProps) {
  const option = useMemo((): EChartsOption => {
    if (!stats) return {};
    return {
      tooltip: {
        trigger: "item",
        backgroundColor: "rgba(9,8,24,0.97)",
        borderColor: "rgba(255,255,255,0.08)",
        textStyle: { color: "#f0eef8", fontSize: 12 },
        formatter: "{b}: {c} ({d}%)",
      },
      legend: { bottom: 0, textStyle: { color: "#a09bb8", fontSize: 11 } },
      series: [
        {
          type: "pie",
          radius: ["50%", "75%"],
          center: ["50%", "45%"],
          avoidLabelOverlap: false,
          label: { show: false },
          cursor: onTierClick ? "pointer" : "default",
          emphasis: {
            label: { show: true, fontSize: 14, fontWeight: "bold" },
            scale: true,
            scaleSize: 8,
          },
          data: [
            { value: stats.tier1_count, name: "Tier 1 — Project", itemStyle: { color: "#F2A93B" } },
            { value: stats.tier2_count, name: "Tier 2 — General", itemStyle: { color: "#9B7DE0" } },
            { value: stats.tier3_count, name: "Tier 3 — Global", itemStyle: { color: "#2EC4C4" } },
          ],
        },
      ],
    };
  }, [stats, onTierClick]);

  return (
    <Chart
      option={option}
      loading={loading}
      aria-label="Memory tier distribution donut chart"
      style={{ height }}
    >
      <span className="sr-only">
        Tier distribution: {stats?.tier1_count} project, {stats?.tier2_count} general,{" "}
        {stats?.tier3_count} global
      </span>
    </Chart>
  );
}
