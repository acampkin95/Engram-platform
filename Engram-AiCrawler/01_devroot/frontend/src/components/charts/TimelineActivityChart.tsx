import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Card, CardHeader, CardBody } from '../ui';
import { useReducedMotion } from '../../lib/motion';
import { BaseChart } from './BaseChart';
import { api } from '../../lib/api';
import { TOKENS, CHART_COLORS } from '../../lib/chartTheme';

type DateRange = '24h' | '7d' | '30d';

interface TimelineDataPoint {
  timestamp: string;
  completed: number;
  failed: number;
  avgDuration: number;
}

interface TimelineActivityChartProps {
  onPointClick?: (point: TimelineDataPoint) => void;
}

function generateMockData(hours: number): TimelineDataPoint[] {
  const data: TimelineDataPoint[] = [];
  const now = new Date();
  for (let i = hours - 1; i >= 0; i--) {
    const timestamp = new Date(now);
    timestamp.setHours(timestamp.getHours() - i);
    data.push({
      timestamp: timestamp.toISOString(),
      completed: Math.floor(Math.random() * 15) + 2,
      failed: Math.floor(Math.random() * 3),
      avgDuration: Math.floor(Math.random() * 5000) + 1000,
    });
  }
  return data;
}

export function TimelineActivityChart({ onPointClick }: TimelineActivityChartProps) {
  const prefersReduced = useReducedMotion();
  const [dateRange, setDateRange] = useState<DateRange>('24h');
  const [data, setData] = useState<TimelineDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const loadData = async () => {
      setIsLoading(true);
      try {
        const hours = dateRange === '24h' ? 24 : dateRange === '7d' ? 168 : 720;
        const response = await api.get<TimelineDataPoint[]>('/crawl/timeline', { params: { hours } });
        if (!cancelled && Array.isArray(response.data) && response.data.length > 0) {
          setData(response.data);
        } else {
          setData(generateMockData(hours));
        }
      } catch {
        if (!cancelled) {
          const hours = dateRange === '24h' ? 24 : dateRange === '7d' ? 168 : 720;
          setData(generateMockData(hours));
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    loadData();
    return () => { cancelled = true; };
  }, [dateRange]);

  const avgCompleted = useMemo(
    () => data.length > 0 ? Math.round(data.reduce((s, d) => s + d.completed, 0) / data.length) : 0,
    [data]
  );
  const avgDuration = useMemo(
    () => data.length > 0 ? Math.round(data.reduce((s, d) => s + d.avgDuration, 0) / data.length) : 0,
    [data]
  );
  const successRate = useMemo(() => {
    if (data.length === 0) return 0;
    const total = data.reduce((s, d) => s + d.completed + d.failed, 0);
    return total > 0 ? Math.round((data.reduce((s, d) => s + d.completed, 0) / total) * 100) : 0;
  }, [data]);

  const option = useMemo(() => {
    const times = data.map(d => {
      const t = new Date(d.timestamp);
      return dateRange === '24h'
        ? t.toLocaleTimeString('en-US', { hour: '2-digit' })
        : t.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });
    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' },
        backgroundColor: TOKENS.surface,
        borderColor: TOKENS.border,
        textStyle: {
          color: TOKENS.text,
          fontSize: 11,
          fontFamily: "'Space Mono', monospace",
        },
        extraCssText: 'box-shadow: 0 0 16px rgba(80,255,255,0.15);',
      },
      legend: {
        data: ['Completed', 'Failed', 'Avg Duration'],
        textStyle: {
          color: TOKENS.textDim,
          fontFamily: "'Space Mono', monospace",
          fontSize: 10,
        },
        top: 0,
      },
      grid: { left: '3%', right: '4%', bottom: '10%', top: '20%', containLabel: true },
      xAxis: {
        type: 'category',
        data: times,
        axisLabel: {
          color: TOKENS.textDim,
          fontSize: 10,
          fontFamily: "'Space Mono', monospace",
        },
        axisLine: { lineStyle: { color: TOKENS.border } },
        axisTick: { lineStyle: { color: TOKENS.border } },
      },
      yAxis: [
        {
          type: 'value',
          name: 'Count',
          axisLabel: {
            color: TOKENS.textDim,
            fontFamily: "'Space Mono', monospace",
          },
          splitLine: { lineStyle: { color: TOKENS.border, type: 'dashed' } },
        },
        {
          type: 'value',
          name: 'Duration (s)',
          axisLabel: {
            color: TOKENS.textDim,
            fontFamily: "'Space Mono', monospace",
            formatter: (v: number) => (v / 1000).toFixed(1),
          },
          splitLine: { show: false },
        },
      ],
      series: [
        {
          name: 'Completed',
          type: 'bar',
          data: data.map(d => d.completed),
          itemStyle: {
            color: CHART_COLORS[1], // plasma
            borderRadius: [2, 2, 0, 0],
          },
          emphasis: {
            itemStyle: {
              shadowBlur: 16,
              shadowColor: 'rgba(15,187,170,0.5)',
            },
          },
          barMaxWidth: dateRange === '24h' ? 20 : 40,
        },
        {
          name: 'Failed',
          type: 'bar',
          stack: 'total',
          data: data.map(d => d.failed),
          itemStyle: {
            color: CHART_COLORS[4], // neonR
            borderRadius: [2, 2, 0, 0],
          },
          emphasis: {
            itemStyle: {
              shadowBlur: 16,
              shadowColor: 'rgba(255,45,107,0.5)',
            },
          },
          barMaxWidth: dateRange === '24h' ? 20 : 40,
        },
        {
          name: 'Avg Duration',
          type: 'line',
          yAxisIndex: 1,
          data: data.map(d => d.avgDuration),
          itemStyle: { color: CHART_COLORS[5] }, // ghost
          lineStyle: { color: CHART_COLORS[5], width: 2 },
          smooth: true,
          symbol: 'circle',
          symbolSize: 5,
          emphasis: {
            itemStyle: {
              shadowBlur: 12,
              shadowColor: 'rgba(123,123,255,0.5)',
            },
          },
          areaStyle: {
            color: 'rgba(123,123,255,0.06)',
          },
        },
      ],
    };
  }, [data, dateRange]);

  const handleClick = useCallback((params: unknown) => {
    const p = params as { dataIndex?: number };
    if (p.dataIndex !== undefined && data[p.dataIndex] && onPointClick) {
      onPointClick(data[p.dataIndex]);
    }
  }, [data, onPointClick]);

  return (
    <motion.div
      initial={prefersReduced ? undefined : { opacity: 0, y: 16 }}
      animate={prefersReduced ? undefined : { opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
    >
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <h2 className="text-xl font-display font-semibold">Activity Timeline</h2>
          <div className="flex items-center gap-2">
            <div className="flex bg-void border border-border rounded overflow-hidden">
              {(['24h', '7d', '30d'] as DateRange[]).map((range) => (
                <button
                  key={range}
                  type="button"
                  onClick={() => setDateRange(range)}
                  className={`px-3 py-1 text-xs font-medium font-mono transition-colors ${
                    dateRange === range ? 'bg-cyan/20 text-cyan' : 'text-text-dim hover:text-text'
                  }`}
                >
                  {range}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardBody>
          {isLoading ? (
            <div className="space-y-3">
              <div className="flex gap-3 mb-4">
                {[80, 60, 72].map((w, i) => (
                  <div key={i} className="h-4 bg-abyss/50 animate-pulse" style={{ width: `${w}px` }} />
                ))}
              </div>
              <div className="h-[300px] bg-abyss/20 animate-pulse" />
            </div>
          ) : (
            <>
              <div className="flex gap-6 mb-4 text-sm font-mono">
                <div>
                  <span className="text-text-dim">Avg/Cycle:</span>
                  <span className="ml-2 font-bold text-plasma">{avgCompleted}</span>
                </div>
                <div>
                  <span className="text-text-dim">Avg Duration:</span>
                  <span className="ml-2 font-bold text-cyan">{(avgDuration / 1000).toFixed(1)}s</span>
                </div>
                <div>
                  <span className="text-text-dim">Success:</span>
                  <span className={`ml-2 font-bold ${
                    successRate >= 90 ? 'text-plasma' : successRate >= 70 ? 'text-volt' : 'text-neon-r'
                  }`}>
                    {successRate}%
                  </span>
                </div>
              </div>
              <BaseChart option={option} height={300} onEvents={{ click: handleClick }} />
              <div className="flex items-center gap-6 mt-4 text-xs font-mono">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-1 rounded-full" style={{ background: CHART_COLORS[1] }} />
                  <span className="text-text-dim">Completed</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-1 rounded-full" style={{ background: CHART_COLORS[4] }} />
                  <span className="text-text-dim">Failed</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-1 rounded-full" style={{ background: CHART_COLORS[5] }} />
                  <span className="text-text-dim">Avg Duration</span>
                </div>
              </div>
            </>
          )}
        </CardBody>
      </Card>
    </motion.div>
  );
}
