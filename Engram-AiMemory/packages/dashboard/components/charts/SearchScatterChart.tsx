"use client";

import type { EChartsOption } from "echarts";
import { useMemo } from "react";
import type { SearchStats } from "@/types";
import { Chart } from "./Chart";

interface SearchScatterChartProps {
  stats?: SearchStats;
  loading?: boolean;
  height?: number;
}

export function SearchScatterChart({ stats, loading, height = 300 }: SearchScatterChartProps) {
  const option = useMemo((): EChartsOption => {
    if (!stats?.top_queries?.length) return {};

    return {
      tooltip: {
        backgroundColor: "rgba(9,8,24,0.97)",
        borderColor: "rgba(255,255,255,0.08)",
        textStyle: { color: "#f0eef8", fontSize: 12 },
        formatter: ((p: unknown) => {
          const d = (p as { data: [number, number, number, string] }).data;
          return `<strong>Query:</strong> "${d[3]}"<br/>Count: ${d[0]}<br/>Avg Score: ${d[1].toFixed(2)}`;
        }) as never,
      },
      grid: { left: 50, right: 20, top: 20, bottom: 60, containLabel: true },
      xAxis: {
        type: "value",
        name: "Search Count",
        nameLocation: "middle",
        nameGap: 25,
        axisLine: { lineStyle: { color: "rgba(255,255,255,0.08)" } },
        axisTick: { lineStyle: { color: "#5c5878" } },
        axisLabel: { color: "#a09bb8" },
        splitLine: { lineStyle: { color: "rgba(255,255,255,0.04)" } },
      },
      yAxis: {
        type: "value",
        name: "Avg Score",
        nameLocation: "middle",
        nameGap: 40,
        min: 0,
        max: 1,
        axisLine: { lineStyle: { color: "rgba(255,255,255,0.08)" } },
        axisTick: { lineStyle: { color: "#5c5878" } },
        axisLabel: { color: "#a09bb8" },
        splitLine: { lineStyle: { color: "rgba(255,255,255,0.04)" } },
      },
      series: [
        {
          type: "scatter",
          data: stats.top_queries.map((q) => [q.count, q.avg_score, q.count, q.query]),
          symbolSize: (data: number[]) => Math.sqrt(data[0]) * 8,
          itemStyle: {
            color: "#9B7DE0",
            opacity: 0.8,
          },
          label: {
            show: true as const,
            formatter: ((p: unknown) =>
              (p as { data: [number, number, number, string] }).data[3]) as never,
            position: "top" as const,
            fontSize: 10,
            color: "#a09bb8",
          },
          emphasis: {
            scale: 1.5,
            itemStyle: {
              shadowBlur: 10,
              shadowColor: "rgba(155,125,224,0.5)",
            },
          },
        },
      ],
      dataZoom: [
        {
          type: "slider" as const,
          show: true,
          bottom: 10,
          height: 18,
          start: 0,
          end: 100,
          borderColor: "transparent",
          backgroundColor: "rgba(9,8,24,0.8)",
          fillerColor: "rgba(155,125,224,0.2)",
          handleStyle: { color: "#9B7DE0" },
          textStyle: { color: "#5c5878", fontSize: 9 },
        },
        {
          type: "inside" as const,
          start: 0,
          end: 100,
        },
      ],
    };
  }, [stats]);

  if (!loading && !stats?.top_queries?.length) {
    return (
      <div className="flex flex-col items-center justify-center text-slate-500" style={{ height }}>
        <span className="text-3xl mb-3">&#x1F50D;</span>
        <p className="text-sm font-medium text-slate-400">No search data yet</p>
        <p className="text-xs text-slate-600 mt-1">
          Search queries will appear here once users start searching memories
        </p>
      </div>
    );
  }

  return (
    <Chart
      option={option}
      loading={loading}
      aria-label="Search query analytics scatter chart"
      style={{ height }}
    >
      <span className="sr-only">
        {stats?.top_queries?.length ?? 0} top queries shown. Total searches: {stats?.total_searches}
      </span>
    </Chart>
  );
}
