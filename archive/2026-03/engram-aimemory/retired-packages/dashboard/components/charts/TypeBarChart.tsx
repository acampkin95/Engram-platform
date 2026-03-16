"use client";

import { useMemo } from "react";
import { Chart } from "./Chart";

interface TypeBarChartProps {
  byType?: Record<string, number>;
  loading?: boolean;
  height?: number;
  onTypeClick?: (type: string) => void;
}

export function TypeBarChart({ byType, loading, height = 280, onTypeClick }: TypeBarChartProps) {
  const option = useMemo((): import("echarts").EChartsOption => {
    if (!byType) return {};
    const entries = Object.entries(byType).sort(([, a], [, b]) => b - a);
    const colors = ["#F2A93B", "#9B7DE0", "#2EC4C4", "#7C5CBF"];
    return {
      tooltip: {
        trigger: "axis" as const,
        backgroundColor: "rgba(9,8,24,0.97)",
        borderColor: "rgba(255,255,255,0.08)",
        textStyle: { color: "#f0eef8", fontSize: 12 },
      },
      grid: { left: 80, right: 20, top: 20, bottom: 20, containLabel: true },
      xAxis: {
        type: "value" as const,
        axisLine: { lineStyle: { color: "rgba(255,255,255,0.08)" } },
        axisTick: { lineStyle: { color: "#5c5878" } },
        axisLabel: { color: "#a09bb8" },
        splitLine: { lineStyle: { color: "rgba(255,255,255,0.04)" } },
      },
      yAxis: {
        type: "category" as const,
        data: entries.map(([k]) => k),
        axisLabel: { fontSize: 11, color: "#a09bb8" },
      },
      series: [
        {
          type: "bar",
          data: entries.map(([k, v], idx) => ({
            value: v,
            name: k,
            itemStyle: {
              color: colors[idx % colors.length],
              borderRadius: [0, 4, 4, 0],
            },
          })),
          cursor: onTypeClick ? "pointer" : "default",
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowColor: "rgba(255,255,255,0.3)",
            },
          },
          label: { show: true, position: "right", fontSize: 11, color: "#a09bb8" },
        },
      ],
    };
  }, [byType, onTypeClick]);

  return (
    <Chart
      option={option}
      loading={loading}
      aria-label="Memory type breakdown bar chart"
      style={{ height }}
    >
      <span className="sr-only">
        Memory types:{" "}
        {Object.entries(byType ?? {})
          .map(([k, v]) => `${k}: ${v}`)
          .join(", ")}
      </span>
    </Chart>
  );
}
