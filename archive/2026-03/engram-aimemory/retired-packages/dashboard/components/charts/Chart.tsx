"use client";

/**
 * Base Chart component.
 *
 * Wraps a div that ECharts mounts into via useEcharts.
 * Always `use client` — ECharts doesn't run on the server.
 *
 * Usage:
 *   <Chart option={myOption} style={{ height: 300 }} aria-label="Memory growth" />
 */

import type { EChartsOption } from "echarts";
import { useTheme } from "next-themes";
import type { CSSProperties, ReactNode } from "react";
import { useEcharts } from "@/hooks/useEcharts";

interface ChartProps {
  option: EChartsOption;
  style?: CSSProperties;
  className?: string;
  loading?: boolean;
  "aria-label": string;
  children?: ReactNode; // sr-only data table fallback
}

export function Chart({
  option,
  style,
  className,
  loading,
  "aria-label": ariaLabel,
  children,
}: ChartProps) {
  const { resolvedTheme } = useTheme();
  const theme = resolvedTheme === "light" ? "brand-light" : "brand-dark";

  const { ref } = useEcharts({ option, theme, loading });

  return (
    <figure aria-label={ariaLabel} className={className} style={{ position: "relative", ...style }}>
      {/* ECharts mounts here */}
      <div ref={ref} style={{ width: "100%", height: "100%" }} />
      {/* Accessible fallback — hidden visually but readable by screen readers */}
      {children}
    </figure>
  );
}
