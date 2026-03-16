"use client";

import type { EChartsOption } from "echarts";
import { useMemo } from "react";
import { Chart } from "./Chart";

interface SystemGaugeChartProps {
  value: number;
  label: string;
  unit?: string;
  max?: number;
  loading?: boolean;
  height?: number;
  warnThreshold?: number;
  criticalThreshold?: number;
}

export function SystemGaugeChart({
  value,
  label,
  unit = "",
  max = 100,
  loading,
  height = 200,
  warnThreshold = 60,
  criticalThreshold = 85,
}: SystemGaugeChartProps) {
  const option = useMemo((): EChartsOption => {
    const pct = (value / max) * 100;
    const color =
      pct >= criticalThreshold ? "#E05C7F" : pct >= warnThreshold ? "#F2A93B" : "#2EC4C4";

    return {
      series: [
        {
          type: "gauge",
          radius: "85%",
          min: 0,
          max,
          splitNumber: 5,
          axisLine: {
            lineStyle: {
              width: 8,
              color: [
                [warnThreshold / max, "#2EC4C4"],
                [criticalThreshold / max, "#F2A93B"],
                [1, "#E05C7F"],
              ],
            },
          },
          pointer: { itemStyle: { color } },
          axisTick: { show: false },
          splitLine: { length: 8, lineStyle: { color: "rgba(255,255,255,0.06)", width: 1 } },
          axisLabel: {
            color: "#5c5878",
            fontSize: 9,
            formatter: (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)),
          },
          detail: {
            valueAnimation: true,
            formatter: `{value}${unit}`,
            color,
            fontSize: 18,
            fontWeight: "bold",
            offsetCenter: [0, "65%"],
          },
          title: {
            offsetCenter: [0, "90%"],
            fontSize: 11,
            color: "#a09bb8",
          },
          data: [{ value, name: label }],
        },
      ],
    };
  }, [value, label, unit, max, warnThreshold, criticalThreshold]);

  return (
    <Chart
      option={option}
      loading={loading}
      aria-label={`${label} gauge: ${value}${unit}`}
      style={{ height }}
    >
      <span className="sr-only">
        {label}: {value}
        {unit} out of {max}
        {unit} maximum
      </span>
    </Chart>
  );
}
