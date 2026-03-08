import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { ShieldAlert } from 'lucide-react';
import { Card, CardHeader, CardBody } from '../ui';
import { useReducedMotion } from '../../lib/motion';
import { BaseChart } from './BaseChart';
import { TOKENS } from '../../lib/chartTheme';

interface BreachEvent {
  name: string;
  date: string;
  pwn_count: number;
  data_classes?: string[];
}

interface BreachTimelineChartProps {
  breaches?: BreachEvent[];
  className?: string;
}

export function BreachTimelineChart({ breaches = [], className = '' }: BreachTimelineChartProps) {
  const prefersReduced = useReducedMotion();

  const sorted = useMemo(
    () => [...breaches].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [breaches]
  );

  const option = useMemo(() => {
    if (sorted.length === 0) return null;

    const dates = sorted.map((b) => b.date);
    const counts = sorted.map((b) => b.pwn_count);
    const maxCount = Math.max(...counts, 1);

    return {
      tooltip: {
        trigger: 'axis',
        backgroundColor: TOKENS.surface,
        borderColor: TOKENS.border,
        textStyle: {
          color: TOKENS.text,
          fontSize: 11,
          fontFamily: "'Space Mono', monospace",
        },
        extraCssText: 'box-shadow: 0 0 16px rgba(80,255,255,0.15);',
        formatter: (params: { dataIndex: number }[]) => {
          const idx = params[0]?.dataIndex;
          if (idx === undefined) return '';
          const b = sorted[idx];
          return `<div style="font-family:'Space Mono',monospace;font-size:11px;line-height:1.8">
            <span style="color:${TOKENS.cyan};font-weight:bold">${b.name}</span><br/>
            <span style="color:${TOKENS.textDim}">Date: </span><span style="color:${TOKENS.text}">${b.date}</span><br/>
            <span style="color:${TOKENS.textDim}">Records: </span><span style="color:${TOKENS.neonR};font-weight:bold">${b.pwn_count.toLocaleString()}</span>${
              b.data_classes ? `<br/><span style="color:${TOKENS.textDim}">Data: </span><span style="color:${TOKENS.textDim}">${b.data_classes.slice(0, 3).join(', ')}</span>` : ''
            }
          </div>`;
        },
      },
      grid: { top: 20, right: 20, bottom: 40, left: 60 },
      xAxis: {
        type: 'category',
        data: dates,
        axisLabel: {
          color: TOKENS.textDim,
          fontSize: 10,
          rotate: 30,
          fontFamily: "'Space Mono', monospace",
        },
        axisLine: { lineStyle: { color: TOKENS.border } },
        axisTick: { lineStyle: { color: TOKENS.border } },
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          color: TOKENS.textDim,
          fontSize: 10,
          fontFamily: "'Space Mono', monospace",
          formatter: (v: number) => {
            if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
            if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
            return v.toString();
          },
        },
        splitLine: { lineStyle: { color: TOKENS.border, type: 'dashed' } },
        axisLine: { show: false },
      },
      series: [
        {
          type: 'bar',
          data: counts.map((c) => ({
            value: c,
            itemStyle: {
              color: c >= maxCount * 0.75 ? TOKENS.neonR :
                     c >= maxCount * 0.5  ? TOKENS.fuchsia :
                     c >= maxCount * 0.25 ? TOKENS.volt   : TOKENS.plasma,
              borderRadius: [2, 2, 0, 0],
            },
            emphasis: {
              itemStyle: {
                shadowBlur: 20,
                shadowColor: 'rgba(80,255,255,0.4)',
              },
            },
          })),
          barMaxWidth: 40,
          animationDuration: 800,
          animationEasing: 'cubicOut',
        },
        {
          type: 'line',
          data: counts,
          smooth: true,
          symbol: 'circle',
          symbolSize: 6,
          lineStyle: { color: TOKENS.fuchsia, width: 2 },
          itemStyle: { color: TOKENS.fuchsia },
          emphasis: {
            itemStyle: {
              shadowBlur: 20,
              shadowColor: 'rgba(243,128,245,0.5)',
              borderWidth: 2,
              borderColor: TOKENS.fuchsia,
            },
          },
          z: 10,
        },
      ],
    };
  }, [sorted]);

  if (breaches.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <h2 className="text-lg font-display font-semibold flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-neon-r" />
            Breach Timeline
          </h2>
        </CardHeader>
        <CardBody>
          <div className="py-8 text-center text-sm text-text-mute font-mono">
            No breach data available
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <motion.div
      initial={prefersReduced ? undefined : { opacity: 0, y: 6 }}
      animate={prefersReduced ? undefined : { opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={className}
    >
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-display font-semibold flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-neon-r" />
              Breach Timeline
            </h2>
            <span className="text-xs text-text-mute bg-abyss px-2 py-1 font-mono">
              {breaches.length} breach{breaches.length !== 1 ? 'es' : ''}
            </span>
          </div>
        </CardHeader>
        <CardBody>
          {option && <BaseChart option={option} height={260} />}
        </CardBody>
      </Card>
    </motion.div>
  );
}
