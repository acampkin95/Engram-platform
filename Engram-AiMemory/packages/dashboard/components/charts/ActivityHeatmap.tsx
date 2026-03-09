"use client";

import type { EChartsOption } from "echarts";
import { useMemo } from "react";
import type { ActivityDay } from "@/types";
import { Chart } from "./Chart";

interface ActivityHeatmapProps {
  data?: ActivityDay[];
  year?: number;
  loading?: boolean;
  height?: number;
}

export function ActivityHeatmap({
  data,
  year = new Date().getFullYear(),
  loading,
  height = 200,
}: ActivityHeatmapProps) {
  const option = useMemo((): EChartsOption => {
    if (!data) return {};

    const maxCount = Math.max(...data.map((d) => d.count), 1);

    return {
      tooltip: {
        trigger: "item",
        backgroundColor: "rgba(9,8,24,0.97)",
        borderColor: "rgba(255,255,255,0.08)",
        textStyle: { color: "#f0eef8", fontSize: 12 },
        formatter: ((p: unknown) => {
          const d = (p as { data: [string, number] }).data;
          return `${d[0]}: ${d[1]} memories`;
        }) as never,
      },
      visualMap: {
        min: 0,
        max: maxCount,
        calculable: true,
        orient: "horizontal",
        left: "center",
        bottom: 0,
        inRange: { color: ["#090818", "#7C5CBF", "#9B7DE0", "#F2A93B"] },
        textStyle: { fontSize: 10 },
      },
      calendar: {
        top: 20,
        left: 30,
        right: 30,
        cellSize: ["auto", 14],
        range: String(year),
        itemStyle: { borderWidth: 0.5, borderColor: "rgba(255,255,255,0.04)" },
        yearLabel: { show: false },
        dayLabel: { color: "#5c5878", fontSize: 10 },
        monthLabel: { color: "#5c5878", fontSize: 10 },
      },
      series: [
        {
          type: "heatmap",
          coordinateSystem: "calendar",
          data: data.map((d) => [d.date, d.count]),
        },
      ],
    };
  }, [data, year]);

  return (
    <Chart
      option={option}
      loading={loading}
      aria-label={`Activity heatmap for ${year}`}
      style={{ height }}
    >
      <span className="sr-only">
        Calendar heatmap showing {data?.length ?? 0} active days in {year}
      </span>
    </Chart>
  );
}
