"use client";

/**
 * useEcharts — wraps ECharts lifecycle for React.
 *
 * Usage:
 *   const { ref } = useEcharts({ option: myOption, theme: "brand-dark" });
 *   return <div ref={ref} style={{ height: 300 }} />;
 *
 * Key design decisions:
 * - Dynamic import of echarts (SSR-safe)
 * - ResizeObserver keeps chart responsive
 * - Dispose on unmount prevents memory leaks
 * - `option` is applied via setOption on every change (ECharts diffs internally)
 */

import type { EChartsOption } from "echarts";
import { useEffect, useRef } from "react";

interface UseEchartsOptions {
  option: EChartsOption;
  theme?: string;
  loading?: boolean;
}

export function useEcharts({ option, theme = "brand-dark", loading = false }: UseEchartsOptions) {
  const containerRef = useRef<HTMLDivElement>(null);
  // ECharts instance type is not exported; using unknown with type assertion at call sites
  const chartRef = useRef<unknown>(null);
  const roRef = useRef<ResizeObserver | null>(null);
  // Initialize chart
  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;

    // Dynamic import keeps echarts out of the SSR bundle
    import("@/lib/echarts").then(({ echarts }) => {
      if (cancelled || !containerRef.current) return;
      const chart = echarts.init(containerRef.current, theme, { renderer: "canvas" });
      chartRef.current = chart;
      roRef.current = new ResizeObserver(() => chart.resize());
      roRef.current.observe(containerRef.current);
    });

    return () => {
      cancelled = true;
      if (chartRef.current) {
        roRef.current?.disconnect();
        roRef.current = null;
        (chartRef.current as { dispose: () => void }).dispose();
        chartRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme]); // Re-init only when theme changes (key prop handles this from parent)

  // Update option without re-initializing
  useEffect(() => {
    if (!chartRef.current) return;
    (
      chartRef.current as { setOption: (opt: EChartsOption, opts: { notMerge: boolean }) => void }
    ).setOption(option, { notMerge: false });
  }, [option]);

  // Toggle loading state
  useEffect(() => {
    if (!chartRef.current) return;
    if (loading) {
      (
        chartRef.current as { showLoading: (type: string, opts: Record<string, unknown>) => void }
      ).showLoading("default", {
        text: "Loading...",
        color: "#06b6d4",
        textColor: "#94a3b8",
        maskColor: "rgba(15, 23, 42, 0.8)",
      });
    } else {
      (chartRef.current as { hideLoading: () => void }).hideLoading();
    }
  }, [loading]);

  return { ref: containerRef, chart: chartRef };
}
