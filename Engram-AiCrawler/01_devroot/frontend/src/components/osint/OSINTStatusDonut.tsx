import { useMemo } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { Card, CardHeader, CardBody } from '../ui';
import { PieChart as PieIcon } from 'lucide-react';

interface ScanStatusCounts {
  completed: number;
  running: number;
  failed: number;
  pending: number;
}

interface OSINTStatusDonutProps {
  counts: ScanStatusCounts;
  title?: string;
}

const STATUS_CONFIG: Record<
  keyof ScanStatusCounts,
  { label: string; color: string }
> = {
  completed: { label: 'Completed', color: '#0fbbaa' },
  running:   { label: 'Running',   color: '#4fc3f7' },
  failed:    { label: 'Failed',    color: '#ff2d6b' },
  pending:   { label: 'Pending',   color: '#7a7a9a' },
};

interface ChartEntry {
  name: string;
  value: number;
  color: string;
}

function DonutSkeleton() {
  return (
    <div className="flex items-center justify-center h-[180px] animate-pulse">
      <div className="w-32 h-32 rounded-full border-8 border-abyss/50" />
    </div>
  );
}

export function OSINTStatusDonut({
  counts,
  title = 'Scan Status',
}: OSINTStatusDonutProps) {
  const data: ChartEntry[] = useMemo(
    () =>
      (Object.keys(STATUS_CONFIG) as (keyof ScanStatusCounts)[])
        .map((key) => ({
          name: STATUS_CONFIG[key].label,
          value: counts[key],
          color: STATUS_CONFIG[key].color,
        }))
        .filter((d) => d.value > 0),
    [counts],
  );

  const total = data.reduce((sum, d) => sum + d.value, 0);

  if (total === 0) {
    return (
      <Card>
        <CardHeader>
          <h2 className="text-base font-display font-semibold flex items-center gap-2">
            <PieIcon className="w-4 h-4 text-fuchsia" />
            {title}
          </h2>
        </CardHeader>
        <CardBody>
          <DonutSkeleton />
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <h2 className="text-base font-display font-semibold flex items-center gap-2">
          <PieIcon className="w-4 h-4 text-fuchsia" />
          {title}
        </h2>
      </CardHeader>
      <CardBody>
        <div className="relative">
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={52}
                outerRadius={76}
                paddingAngle={3}
                dataKey="value"
                strokeWidth={0}
              >
                {data.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: '#0d0d1a',
                  border: '1px solid #1e1e3a',
                  borderRadius: 0,
                  fontSize: 12,
                }}
                labelStyle={{ color: '#e0e2f0' }}
                itemStyle={{ color: '#7a7a9a' }}
                formatter={(value: number, name: string) => [
                  `${value} (${Math.round((value / total) * 100)}%)`,
                  name,
                ]}
              />
              <Legend
                iconType="circle"
                iconSize={8}
                formatter={(value) => (
                  <span className="text-xs text-text-dim">{value}</span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>


          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center" style={{ marginTop: -24 }}>
              <p className="text-2xl font-bold font-display text-text">{total}</p>
              <p className="text-[10px] text-text-mute uppercase tracking-widest">scans</p>
            </div>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
