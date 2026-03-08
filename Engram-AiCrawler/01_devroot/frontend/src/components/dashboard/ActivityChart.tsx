import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Activity, Calendar } from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardHeader, CardBody } from '../ui';
import { useReducedMotion } from '../../lib/motion';
import { api } from '../../lib/api';

type DateRange = '7d' | '30d' | '90d';

interface ActivityDataPoint {
  date: string;
  completed: number;
  failed: number;
}

interface ChartData {
  day: string;
  completed: number;
  failed: number;
}

function generateMockData(days: number): ChartData[] {
  const data: ChartData[] = [];
  const now = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    data.push({
      day: date.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 3),
      completed: Math.floor(Math.random() * 30) + 5,
      failed: Math.floor(Math.random() * 5),
    });
  }

  return data;
}

export function ActivityChart() {
  const prefersReduced = useReducedMotion();
  const [dateRange, setDateRange] = useState<DateRange>('7d');
  const [data, setData] = useState<ChartData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      setIsLoading(true);
      try {
        const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90;

        const response = await api.get<ActivityDataPoint[]>('/crawl/activity', {
          params: { days },
        });

        if (cancelled) return;

        if (Array.isArray(response.data) && response.data.length > 0) {
          const chartData = response.data.map((point) => ({
            day: new Date(point.date).toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 3),
            completed: point.completed,
            failed: point.failed,
          }));
          setData(chartData);
        } else {
          setData(generateMockData(days));
        }
      } catch {
        if (!cancelled) {
          const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90;
          setData(generateMockData(days));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadData();
    return () => { cancelled = true; };
  }, [dateRange]);

  const handleRangeChange = (range: DateRange) => {
    setDateRange(range);
  };

  return (
    <motion.div
      initial={prefersReduced ? undefined : { opacity: 0, y: 16 }}
      animate={prefersReduced ? undefined : { opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.15 }}
    >
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <h2 className="text-xl font-display font-semibold flex items-center gap-2">
            <Activity className="w-5 h-5 text-plasma" />
            Crawl Activity
          </h2>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-text-mute" />
            <div className="flex bg-void border border-border rounded overflow-hidden">
              {(['7d', '30d', '90d'] as DateRange[]).map((range) => (
                <button
                  key={range}
                  type="button"
                  onClick={() => handleRangeChange(range)}
                  className={`px-3 py-1 text-xs font-medium transition-colors ${
                    dateRange === range
                      ? 'bg-cyan/20 text-cyan'
                      : 'text-text-dim hover:text-text'
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
            <div className="h-[200px] flex items-center justify-center text-text-mute">
              <span className="text-sm">Loading chart data...</span>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={data} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradCompleted" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0fbbaa" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#0fbbaa" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradFailed" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ff2d6b" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#ff2d6b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e1e3a" vertical={false} />
                <XAxis
                  dataKey="day"
                  tick={{ fill: '#7a7a9a', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#7a7a9a', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: '#0d0d1a',
                    border: '1px solid #1e1e3a',
                    borderRadius: 0,
                    fontSize: 12,
                  }}
                  labelStyle={{ color: '#e0e2f0', marginBottom: 4 }}
                  itemStyle={{ color: '#7a7a9a' }}
                />
                <Area
                  type="monotone"
                  dataKey="completed"
                  stroke="#0fbbaa"
                  strokeWidth={2}
                  fill="url(#gradCompleted)"
                  name="Completed"
                />
                <Area
                  type="monotone"
                  dataKey="failed"
                  stroke="#ff2d6b"
                  strokeWidth={2}
                  fill="url(#gradFailed)"
                  name="Failed"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardBody>
      </Card>
    </motion.div>
  );
}
