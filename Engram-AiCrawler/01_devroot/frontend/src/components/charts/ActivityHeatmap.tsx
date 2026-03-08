import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Card, CardHeader, CardBody } from '../ui';
import { useReducedMotion } from '../../lib/motion';
import { BaseChart } from './BaseChart';
import { TOKENS } from '../../lib/chartTheme';

interface HeatmapData {
  day: number;
  hour: number;
  value: number;
}

interface ActivityHeatmapProps {
  data?: HeatmapData[];
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function generateMockData(): HeatmapData[] {
  const data: HeatmapData[] = [];
  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      const isWorkHour = hour >= 9 && hour <= 17;
      const isWeekday = day >= 1 && day <= 5;
      let base = isWorkHour && isWeekday ? 70 : isWeekday ? 30 : 10;
      if (hour >= 22 || hour <= 5) base = 5;
      data.push({ day, hour, value: Math.floor(base + Math.random() * 30) });
    }
  }
  return data;
}

export function ActivityHeatmap({ data }: ActivityHeatmapProps) {
  const prefersReduced = useReducedMotion();
  const heatmapData = useMemo(() => data || generateMockData(), [data]);

  const hasData = heatmapData.some(d => d.value > 0);

  const option = useMemo(() => {
    const dataArray: [number, number, number][] = DAYS.flatMap((_, dayIndex) =>
      HOURS.map(hour => {
        const cell = heatmapData.find(d => d.day === dayIndex && d.hour === hour);
        return [hour, dayIndex, cell?.value ?? 0] as [number, number, number];
      })
    );
    const maxVal = Math.max(...dataArray.map(d => d[2]), 1);

    return {
      tooltip: {
        position: 'top' as const,
        formatter: (params: unknown) => {
          const p = params as { data: [number, number, number] };
          const hour = p.data[0];
          const day = DAYS[p.data[1]];
          const count = p.data[2];
          return `<div style="font-family:'Space Mono',monospace;font-size:11px;line-height:1.6">
            <span style="color:${TOKENS.textDim}">${day}</span>
            <span style="color:${TOKENS.text}"> ${String(hour).padStart(2,'0')}:00</span><br/>
            <span style="color:${TOKENS.cyan};font-weight:bold">${count}</span>
            <span style="color:${TOKENS.textDim}"> requests</span>
          </div>`;
        },
        backgroundColor: TOKENS.surface,
        borderColor: TOKENS.border,
        textStyle: { color: TOKENS.text, fontSize: 11 },
        extraCssText: 'box-shadow: 0 0 16px rgba(80,255,255,0.15);',
      },
      grid: { left: 44, right: 12, top: 8, bottom: 28 },
      xAxis: {
        type: 'category' as const,
        data: HOURS.map(h => String(h).padStart(2, '0')),
        axisLabel: {
          color: TOKENS.textDim,
          fontSize: 9,
          interval: 1,
          fontFamily: "'Space Mono', monospace",
        },
        axisLine: { show: false },
        axisTick: { show: false },
        splitArea: { show: false },
      },
      yAxis: {
        type: 'category' as const,
        data: DAYS,
        axisLabel: {
          color: TOKENS.textDim,
          fontSize: 10,
          fontFamily: "'Space Mono', monospace",
        },
        axisLine: { show: false },
        axisTick: { show: false },
        splitArea: { show: false },
      },
      visualMap: {
        min: 0,
        max: maxVal,
        calculable: false,
        show: false,
        // cyan → acid gradient
        inRange: { color: [TOKENS.abyss, TOKENS.plasma, TOKENS.cyan, TOKENS.acid] },
      },
      series: [{
        type: 'heatmap' as const,
        data: dataArray,
        label: { show: false },
        itemStyle: {
          borderColor: TOKENS.void,
          borderWidth: 2,
          borderRadius: 2,
        },
        emphasis: {
          itemStyle: {
            shadowBlur: 12,
            shadowColor: 'rgba(80,255,255,0.5)',
            borderColor: TOKENS.cyan,
            borderWidth: 1,
          },
        },
      }],
    };
  }, [heatmapData]);

  return (
    <motion.div
      initial={prefersReduced ? undefined : { opacity: 0, scale: 0.98 }}
      animate={prefersReduced ? undefined : { opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, delay: 0.1 }}
    >
      <Card>
        <CardHeader>
          <h2 className="text-lg font-display font-semibold">Activity Heatmap</h2>
          <div className="flex items-center gap-2 text-xs text-text-mute font-mono">
            <span>Low</span>
            <div className="flex gap-0.5">
              {[
                TOKENS.abyss,
                TOKENS.plasma,
                TOKENS.cyan,
                TOKENS.acid,
              ].map((color, i) => (
                <div
                  key={i}
                  className="w-3 h-3"
                  style={{ background: color, opacity: 0.8 + i * 0.05 }}
                />
              ))}
            </div>
            <span>High</span>
          </div>
        </CardHeader>
        <CardBody>
          {!hasData ? (
            <div className="flex flex-col items-center justify-center h-[180px] text-text-mute text-sm font-mono">
              <span className="text-2xl mb-2 opacity-30">▪▪▪</span>
              <span>No activity data</span>
            </div>
          ) : (
            <BaseChart option={option} height={180} />
          )}
        </CardBody>
      </Card>
    </motion.div>
  );
}
