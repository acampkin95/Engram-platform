import { useState, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Card, CardHeader, CardBody } from '../ui';
import { useReducedMotion } from '../../lib/motion';
import { BaseChart } from './BaseChart';
import { PLATFORM_COLORS, TOKENS } from '../../lib/chartTheme';

type ViewMode = 'bar' | 'pie';

interface PlatformData {
  platform: string;
  count: number;
}

interface PlatformDistributionChartProps {
  data?: PlatformData[];
  onPlatformClick?: (platform: string) => void;
}

const DEFAULT_DATA: PlatformData[] = [
  { platform: 'twitter',   count: 12 },
  { platform: 'github',    count: 8  },
  { platform: 'linkedin',  count: 6  },
  { platform: 'instagram', count: 15 },
  { platform: 'facebook',  count: 4  },
  { platform: 'reddit',    count: 7  },
];

/** Resolve platform color from design-system map, fallback to plasma */
function getPlatformColor(platform: string): string {
  return PLATFORM_COLORS[platform.toLowerCase()] ?? TOKENS.plasma;
}

export function PlatformDistributionChart({
  data = DEFAULT_DATA,
  onPlatformClick,
}: PlatformDistributionChartProps) {
  const prefersReduced = useReducedMotion();
  const [viewMode, setViewMode] = useState<ViewMode>('bar');

  const total = useMemo(() => data.reduce((sum, d) => sum + d.count, 0), [data]);

  const barOption = useMemo(() => ({
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: TOKENS.surface,
      borderColor: TOKENS.border,
      textStyle: {
        color: TOKENS.text,
        fontSize: 11,
        fontFamily: "'Space Mono', monospace",
      },
      extraCssText: 'box-shadow: 0 0 16px rgba(80,255,255,0.15);',
      formatter: (params: { dataIndex: number; value: number; name: string }[]) => {
        const p = params[0];
        if (!p) return '';
        const pct = total > 0 ? ((p.value / total) * 100).toFixed(1) : '0';
        return `<div style="font-family:'Space Mono',monospace;font-size:11px;line-height:1.8">
          <span style="color:${getPlatformColor(p.name)};font-weight:bold;text-transform:capitalize">${p.name}</span><br/>
          <span style="color:${TOKENS.textDim}">Count: </span><span style="color:${TOKENS.text};font-weight:bold">${p.value}</span>
          <span style="color:${TOKENS.textDim}"> (${pct}%)</span>
        </div>`;
      },
    },
    grid: { left: '3%', right: '4%', bottom: '15%', top: '10%', containLabel: true },
    xAxis: {
      type: 'category',
      data: data.map(d => d.platform),
      axisLabel: {
        rotate: 45,
        interval: 0,
        color: TOKENS.textDim,
        fontSize: 10,
        fontFamily: "'Space Mono', monospace",
      },
      axisLine: { lineStyle: { color: TOKENS.border } },
      axisTick: { lineStyle: { color: TOKENS.border } },
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        color: TOKENS.textDim,
        fontFamily: "'Space Mono', monospace",
      },
      splitLine: { lineStyle: { color: TOKENS.border, type: 'dashed' } },
    },
    series: [{
      type: 'bar',
      data: data.map(d => ({
        value: d.count,
        name: d.platform,
        itemStyle: {
          color: getPlatformColor(d.platform),
          borderRadius: [2, 2, 0, 0],
          shadowBlur: 6,
          shadowColor: `${getPlatformColor(d.platform)}30`,
        },
      })),
      barMaxWidth: 40,
      emphasis: {
        itemStyle: {
          shadowBlur: 20,
          shadowColor: 'rgba(80,255,255,0.4)',
        },
      },
    }],
  }), [data, total]);

  const pieOption = useMemo(() => ({
    tooltip: {
      trigger: 'item',
      backgroundColor: TOKENS.surface,
      borderColor: TOKENS.border,
      textStyle: {
        color: TOKENS.text,
        fontSize: 11,
        fontFamily: "'Space Mono', monospace",
      },
      extraCssText: 'box-shadow: 0 0 16px rgba(80,255,255,0.15);',
      formatter: (params: { name: string; value: number; percent: number }) =>
        `<div style="font-family:'Space Mono',monospace;font-size:11px;line-height:1.8">
          <span style="color:${getPlatformColor(params.name)};font-weight:bold;text-transform:capitalize">${params.name}</span><br/>
          <span style="color:${TOKENS.textDim}">Count: </span><span style="color:${TOKENS.text};font-weight:bold">${params.value}</span>
          <span style="color:${TOKENS.textDim}"> (${params.percent.toFixed(1)}%)</span>
        </div>`,
    },
    legend: {
      orient: 'vertical',
      right: 10,
      top: 'center',
      textStyle: {
        color: TOKENS.textDim,
        fontFamily: "'Space Mono', monospace",
        fontSize: 10,
      },
    },
    series: [{
      type: 'pie',
      radius: ['40%', '70%'],
      center: ['40%', '50%'],
      avoidLabelOverlap: false,
      itemStyle: {
        borderRadius: 2,
        borderColor: TOKENS.surface,
        borderWidth: 2,
      },
      label: { show: false },
      emphasis: {
        label: {
          show: true,
          fontSize: 14,
          fontWeight: 'bold',
          color: TOKENS.text,
          fontFamily: "'Space Mono', monospace",
        },
        itemStyle: {
          shadowBlur: 20,
          shadowColor: 'rgba(80,255,255,0.4)',
        },
      },
      data: data.map(d => ({
        name: d.platform,
        value: d.count,
        itemStyle: { color: getPlatformColor(d.platform) },
      })),
    }],
  }), [data]);

  const handleClick = useCallback((params: unknown) => {
    const p = params as { name?: string };
    if (p.name && onPlatformClick) onPlatformClick(p.name);
  }, [onPlatformClick]);

  return (
    <motion.div
      initial={prefersReduced ? undefined : { opacity: 0, scale: 0.98 }}
      animate={prefersReduced ? undefined : { opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
    >
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <h2 className="text-lg font-display font-semibold">Platform Distribution</h2>
          <div className="flex bg-void border border-border rounded overflow-hidden">
            {(['bar', 'pie'] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1 text-xs font-medium transition-colors capitalize font-mono ${
                  viewMode === mode ? 'bg-cyan/20 text-cyan' : 'text-text-dim hover:text-text'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </CardHeader>
        <CardBody>
          <div className="flex items-center gap-4 mb-2 text-sm">
            <span className="text-text-dim">Total:</span>
            <span className="font-bold font-mono text-cyan">{total}</span>
            <span className="text-text-dim">results</span>
          </div>
          <BaseChart
            option={viewMode === 'bar' ? barOption : pieOption}
            height={220}
            onEvents={onPlatformClick ? { click: handleClick } : undefined}
          />
          <div className="flex flex-wrap gap-2 mt-4">
            {data.map((d) => (
              <button
                key={d.platform}
                type="button"
                onClick={() => onPlatformClick?.(d.platform)}
                className="flex items-center gap-1.5 px-2 py-1 text-xs bg-abyss hover:bg-raised transition-colors"
              >
                <span
                  className="w-2 h-2"
                  style={{ backgroundColor: getPlatformColor(d.platform) }}
                />
                <span className="text-text-dim capitalize font-mono">{d.platform}</span>
                <span className="text-text font-bold font-mono">{d.count}</span>
              </button>
            ))}
          </div>
        </CardBody>
      </Card>
    </motion.div>
  );
}
