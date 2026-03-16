"use client";

import type { EChartsOption } from "echarts";
import { useMemo } from "react";
import type { KnowledgeGraphStats } from "@/types";
import { Chart } from "./Chart";

interface KnowledgeGraphTreemapProps {
  data?: KnowledgeGraphStats;
  loading?: boolean;
  height?: number;
}

export function KnowledgeGraphTreemap({ data, loading, height = 300 }: KnowledgeGraphTreemapProps) {
  const option = useMemo((): EChartsOption => {
    if (!data?.entities_by_type) return {};

    const colors = ["#F2A93B", "#9B7DE0", "#2EC4C4", "#7C5CBF", "#E05C7F", "#B87B20", "#FFC15E"];

    const treemapData = Object.entries(data.entities_by_type).map(([name, value], i) => ({
      name,
      value,
      itemStyle: { color: colors[i % colors.length] },
    }));

    return {
      tooltip: {
        formatter: "{b}: {c} entities",
        backgroundColor: "rgba(9,8,24,0.97)",
        borderColor: "rgba(255,255,255,0.08)",
        textStyle: { color: "#f0eef8", fontSize: 12 },
      },
      series: [
        {
          type: "treemap",
          data: treemapData,
          width: "100%",
          height: "90%",
          label: {
            show: true,
            formatter: "{b}\n{c}",
            fontSize: 12,
            color: "#fff",
          },
          itemStyle: { borderColor: "#03020A", borderWidth: 2, gapWidth: 2 },
          emphasis: { itemStyle: { borderColor: "#F2A93B", borderWidth: 2 } },
          breadcrumb: { show: false },
        },
      ],
    };
  }, [data]);

  return (
    <Chart
      option={option}
      loading={loading}
      aria-label="Knowledge graph entity type treemap"
      style={{ height }}
    >
      <span className="sr-only">
        {data?.total_entities ?? 0} total entities across{" "}
        {Object.keys(data?.entities_by_type ?? {}).length} types
      </span>
    </Chart>
  );
}
