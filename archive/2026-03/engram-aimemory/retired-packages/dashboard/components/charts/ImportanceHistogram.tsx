"use client";

import { useMemo } from "react";
import { Chart } from "./Chart";

interface ImportanceDistribution {
  bucket: string;
  count: number;
}

interface ImportanceHistogramProps {
  avgImportance?: number;
  distribution?: ImportanceDistribution[];
  loading?: boolean;
  height?: number;
}

/**
 * Memory importance histogram showing score distribution.
 *
 * When `distribution` data is provided, shows a real histogram of importance scores.
 * Falls back to a single bar showing average when no distribution is available.
 *
 * TODO: Connect to real API when /stats includes importance_distribution endpoint
 */
export function ImportanceHistogram({
  avgImportance,
  distribution,
  loading,
  height = 280,
}: ImportanceHistogramProps) {
  const option = useMemo((): import("echarts").EChartsOption => {
    // If we have distribution data, show a real histogram
    if (distribution && distribution.length > 0) {
      const sortedData = [...distribution].sort((a, b) => {
        const aNum = Number.parseFloat(a.bucket);
        const bNum = Number.parseFloat(b.bucket);
        return aNum - bNum;
      });

      return {
        tooltip: {
          trigger: "axis" as const,
          backgroundColor: "rgba(9,8,24,0.97)",
          borderColor: "rgba(255,255,255,0.08)",
          textStyle: { color: "#f0eef8", fontSize: 12 },
          formatter: (params: unknown) => {
            const p = params as Array<{ name: string; value: number }>;
            return p.map((pt) => `${pt.name}: ${pt.value} memories`).join("<br/>");
          },
        },
        grid: { left: 40, right: 20, top: 20, bottom: 40, containLabel: true },
        xAxis: {
          type: "category" as const,
          data: sortedData.map((d) => d.bucket),
          axisLabel: { formatter: "{value}", fontSize: 10, color: "#a09bb8" },
          name: "Importance",
          nameLocation: "middle",
          nameGap: 25,
          axisLine: { lineStyle: { color: "rgba(255,255,255,0.08)" } },
          axisTick: { lineStyle: { color: "#5c5878" } },
          splitLine: { lineStyle: { color: "rgba(255,255,255,0.04)" } },
        },
        yAxis: {
          type: "value" as const,
          name: "Count",
          axisLabel: { fontSize: 10, color: "#a09bb8" },
          axisLine: { lineStyle: { color: "rgba(255,255,255,0.08)" } },
          axisTick: { lineStyle: { color: "#5c5878" } },
          splitLine: { lineStyle: { color: "rgba(255,255,255,0.04)" } },
        },
        series: [
          {
            type: "bar",
            data: sortedData.map((d) => d.count),
            barMaxWidth: 32,
            itemStyle: {
              color: "#F2A93B",
              borderRadius: [4, 4, 0, 0],
            },
          },
        ],
      };
    }

    // Fallback: single average bar (original behavior)
    if (avgImportance == null) return {};
    const pct = Math.round(avgImportance * 100);
    return {
      tooltip: {
        trigger: "axis" as const,
        formatter: "Avg Importance: {c}%",
        backgroundColor: "rgba(9,8,24,0.97)",
        borderColor: "rgba(255,255,255,0.08)",
        textStyle: { color: "#f0eef8", fontSize: 12 },
      },
      grid: { left: 20, right: 40, top: 20, bottom: 20, containLabel: true },
      xAxis: {
        type: "value" as const,
        max: 100,
        axisLabel: { formatter: "{value}%", color: "#a09bb8" },
        axisLine: { lineStyle: { color: "rgba(255,255,255,0.08)" } },
        axisTick: { lineStyle: { color: "#5c5878" } },
        splitLine: { lineStyle: { color: "rgba(255,255,255,0.04)" } },
      },
      yAxis: { type: "category" as const, data: ["Importance"], show: false },
      series: [
        {
          type: "bar",
          data: [pct],
          barMaxWidth: 40,
          itemStyle: {
            color: avgImportance >= 0.7 ? "#2EC4C4" : avgImportance >= 0.4 ? "#F2A93B" : "#E05C7F",
            borderRadius: [0, 4, 4, 0],
          },
          label: {
            show: true,
            position: "right",
            formatter: `${pct}%`,
            color: "#a09bb8",
          },
        },
      ],
    };
  }, [avgImportance, distribution]);

  const hasDistribution = distribution && distribution.length > 0;

  return (
    <Chart
      option={option}
      loading={loading}
      aria-label={
        hasDistribution ? "Memory importance score distribution" : "Average memory importance score"
      }
      style={{ height }}
    >
      <span className="sr-only">
        {hasDistribution
          ? `Importance distribution across ${distribution?.reduce((sum, d) => sum + d.count, 0) ?? 0} memories`
          : `Average memory importance score: ${avgImportance != null ? Math.round(avgImportance * 100) : 0}%`}
      </span>
    </Chart>
  );
}
