"use client";

import { useMemo } from "react";
import type { MemoryGrowthPoint } from "@/types";
import { Chart } from "./Chart";

interface MemoryGrowthChartProps {
  data?: MemoryGrowthPoint[];
  loading?: boolean;
  height?: number;
}

export function MemoryGrowthChart({ data, loading, height = 300 }: MemoryGrowthChartProps) {
  const option = useMemo((): import("echarts").EChartsOption => {
    if (!data?.length) return {};

    const dates = data.map((d) => d.date);

    return {
      tooltip: {
        trigger: "axis" as const,
        axisPointer: { type: "cross" as const },
        backgroundColor: "rgba(9,8,24,0.97)",
        borderColor: "rgba(255,255,255,0.08)",
        textStyle: { color: "#f0eef8", fontSize: 12 },
      },
      legend: {
        data: ["Total", "Tier 1 (Project)", "Tier 2 (General)", "Tier 3 (Global)"],
        bottom: 0,
        textStyle: { color: "#a09bb8", fontSize: 11 },
      },
      grid: { left: 40, right: 20, top: 20, bottom: 70, containLabel: true },
      xAxis: {
        type: "category" as const,
        data: dates,
        axisLabel: {
          formatter: (val: string) => val.slice(5), // "MM-DD"
          rotate: 30,
          fontSize: 10,
          color: "#a09bb8",
        },
        axisLine: { lineStyle: { color: "rgba(255,255,255,0.08)" } },
        axisTick: { lineStyle: { color: "#5c5878" } },
        splitLine: { lineStyle: { color: "rgba(255,255,255,0.04)" } },
      },
      yAxis: {
        type: "value" as const,
        minInterval: 1,
        axisLine: { lineStyle: { color: "rgba(255,255,255,0.08)" } },
        axisTick: { lineStyle: { color: "#5c5878" } },
        axisLabel: { color: "#a09bb8" },
        splitLine: { lineStyle: { color: "rgba(255,255,255,0.04)" } },
      },
      series: [
        {
          name: "Total",
          type: "line",
          data: data.map((d) => d.total),
          smooth: true,
          lineStyle: { color: "#f0eef8", width: 1, type: "dashed", opacity: 0.4 },
          itemStyle: { color: "#f0eef8" },
          symbol: "none",
          sampling: "lttb",
        },
        {
          name: "Tier 1 (Project)",
          type: "line",
          data: data.map((d) => d.tier1),
          smooth: true,
          lineStyle: { width: 1.5, color: "#F2A93B" },
          symbol: "none",
          sampling: "lttb",
        },
        {
          name: "Tier 2 (General)",
          type: "line",
          data: data.map((d) => d.tier2),
          smooth: true,
          lineStyle: { width: 1.5, color: "#9B7DE0" },
          symbol: "none",
          sampling: "lttb",
        },
        {
          name: "Tier 3 (Global)",
          type: "line",
          data: data.map((d) => d.tier3),
          smooth: true,
          lineStyle: { width: 1.5, color: "#2EC4C4" },
          symbol: "none",
          sampling: "lttb",
        },
      ],
      dataZoom: [
        {
          type: "slider" as const,
          show: true,
          bottom: 10,
          height: 20,
          start: 0,
          end: 100,
          borderColor: "transparent",
          backgroundColor: "rgba(9,8,24,0.8)",
          fillerColor: "rgba(242,169,59,0.2)",
          handleStyle: { color: "#F2A93B" },
          textStyle: { color: "#5c5878", fontSize: 10 },
          dataBackground: {
            lineStyle: { color: "#F2A93B" },
            areaStyle: { color: "rgba(242,169,59,0.2)" },
          },
        },
        {
          type: "inside" as const,
          start: 0,
          end: 100,
        },
      ],
    };
  }, [data]);

  return (
    <Chart
      option={option}
      loading={loading}
      aria-label="Memory growth over time by tier"
      style={{ height }}
    >
      <span className="sr-only">
        Memory growth chart showing {data?.length ?? 0} data points across 3 tiers
      </span>
    </Chart>
  );
}
