import { useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Card, CardHeader, CardBody } from '../ui';
import { useReducedMotion } from '../../lib/motion';
import { BaseChart } from './BaseChart';
import { TOKENS } from '../../lib/chartTheme';

interface ConfidenceData {
  range: string;
  min: number;
  max: number;
  count: number;
}

interface ConfidenceHistogramProps {
  data?: number[];
  onRangeClick?: (min: number, max: number) => void;
}

const DEFAULT_DATA: ConfidenceData[] = [
  { range: '0-20%',   min: 0,  max: 20,  count: 3  },
  { range: '20-40%',  min: 20, max: 40,  count: 7  },
  { range: '40-60%',  min: 40, max: 60,  count: 15 },
  { range: '60-80%',  min: 60, max: 80,  count: 22 },
  { range: '80-100%', min: 80, max: 100, count: 18 },
];

/**
 * Gradient from neon-r (low confidence) → volt → acid → cyan (high confidence).
 * Index 0 = lowest bucket, 4 = highest.
 */
const CONFIDENCE_COLORS = [
  TOKENS.neonR,   // 0-20%  — critical/low
  TOKENS.fuchsia, // 20-40% — elevated
  TOKENS.volt,    // 40-60% — warning
  TOKENS.acid,    // 60-80% — good
  TOKENS.cyan,    // 80-100% — excellent
];

function generateHistogramData(confidences: number[]): ConfidenceData[] {
  const buckets: ConfidenceData[] = [
    { range: '0-20%',   min: 0,  max: 20,  count: 0 },
    { range: '20-40%',  min: 20, max: 40,  count: 0 },
    { range: '40-60%',  min: 40, max: 60,  count: 0 },
    { range: '60-80%',  min: 60, max: 80,  count: 0 },
    { range: '80-100%', min: 80, max: 100, count: 0 },
  ];
  confidences.forEach((c) => {
    const bucketIndex = Math.min(Math.floor(c / 20), 4);
    buckets[bucketIndex].count++;
  });
  return buckets;
}

export function ConfidenceHistogram({ data, onRangeClick }: ConfidenceHistogramProps) {
  const prefersReduced = useReducedMotion();
  const histogramData = useMemo(() => {
    if (data && data.length > 0) return generateHistogramData(data);
    return DEFAULT_DATA;
  }, [data]);

  const total = useMemo(() => histogramData.reduce((sum, d) => sum + d.count, 0), [histogramData]);
  const averageConfidence = useMemo(() => {
    if (!data || data.length === 0) return 72;
    return Math.round(data.reduce((sum, c) => sum + c, 0) / data.length);
  }, [data]);

  const option = useMemo(() => ({
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
      formatter: (params: { dataIndex: number; value: number }[]) => {
        const p = params[0];
        if (!p) return '';
        const bucket = histogramData[p.dataIndex];
        return `<div style="font-family:'Space Mono',monospace;font-size:11px;line-height:1.8">
          <span style="color:${CONFIDENCE_COLORS[p.dataIndex]};font-weight:bold">${bucket?.range ?? ''}</span><br/>
          <span style="color:${TOKENS.textDim}">Count: </span><span style="color:${TOKENS.text};font-weight:bold">${p.value}</span>
        </div>`;
      },
    },
    grid: { left: '3%', right: '4%', bottom: '10%', top: '15%', containLabel: true },
    xAxis: {
      type: 'category',
      data: histogramData.map(d => d.range),
      axisLabel: {
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
      data: histogramData.map((d, i) => ({
        value: d.count,
        itemStyle: {
          color: CONFIDENCE_COLORS[i],
          borderRadius: [2, 2, 0, 0],
          shadowBlur: 8,
          shadowColor: `${CONFIDENCE_COLORS[i]}40`,
        },
      })),
      barMaxWidth: 50,
      emphasis: {
        itemStyle: {
          shadowBlur: 20,
          shadowColor: 'rgba(80,255,255,0.4)',
        },
      },
    }],
  }), [histogramData]);

  const handleClick = useCallback((params: unknown) => {
    const p = params as { dataIndex?: number };
    if (p.dataIndex !== undefined && histogramData[p.dataIndex] && onRangeClick) {
      const { min, max } = histogramData[p.dataIndex];
      onRangeClick(min, max);
    }
  }, [histogramData, onRangeClick]);

  return (
    <motion.div
      initial={prefersReduced ? undefined : { opacity: 0, scale: 0.98 }}
      animate={prefersReduced ? undefined : { opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, delay: 0.1 }}
    >
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <h2 className="text-lg font-display font-semibold">Confidence Distribution</h2>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-text-dim">Avg:</span>
            <span className={`font-bold font-mono ${averageConfidence >= 70 ? 'text-cyan' : averageConfidence >= 40 ? 'text-volt' : 'text-neon-r'}`}>
              {averageConfidence}%
            </span>
            <span className="text-text-dim">Total:</span>
            <span className="font-bold font-mono text-cyan">{total}</span>
          </div>
        </CardHeader>
        <CardBody>
          <BaseChart
            option={option}
            height={180}
            onEvents={{ click: handleClick }}
          />
          <div className="flex items-center justify-between mt-4 px-2">
            {[
              { label: 'Low',       color: TOKENS.neonR,   range: '0-40%'    },
              { label: 'Medium',    color: TOKENS.volt,    range: '40-60%'   },
              { label: 'High',      color: TOKENS.acid,    range: '60-80%'   },
              { label: 'Excellent', color: TOKENS.cyan,    range: '80-100%'  },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-2">
                <span className="w-3 h-3" style={{ backgroundColor: item.color }} />
                <span className="text-xs text-text-dim font-mono">
                  {item.label}{' '}
                  <span className="text-text-mute">({item.range})</span>
                </span>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>
    </motion.div>
  );
}
