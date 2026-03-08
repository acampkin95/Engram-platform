import ReactECharts from 'echarts-for-react';
import { useMemo } from 'react';
import { DARK_THEME } from '../../lib/chartTheme';

interface BaseChartProps {
  option: Record<string, unknown>;
  height?: number;
  onEvents?: Record<string, (params: unknown) => void>;
}

export function BaseChart({ option, height = 200, onEvents }: BaseChartProps) {
  const mergedOption = useMemo(() => ({
    ...DARK_THEME,
    ...option,
  }), [option]);

  return (
    <ReactECharts
      option={mergedOption}
      style={{ height: `${height}px`, width: '100%' }}
      notMerge
      lazyUpdate
      theme="dark"
      onEvents={onEvents}
    />
  );
}
