import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus, Zap, Clock, AlertTriangle, CheckCircle, Activity } from 'lucide-react';
import { Card, CardHeader, CardBody } from '../ui';
import { useReducedMotion } from '../../lib/motion';
import { api } from '../../lib/api';

interface PerformanceData {
  avgResponseTime: number;
  p95ResponseTime: number;
  successRate: number;
  errorRate: number;
  throughput: number;
  cacheHitRate: number;
}

interface PerformanceMetricsCardProps {
  data?: PerformanceData;
}

const DEFAULT_DATA: PerformanceData = {
  avgResponseTime: 1250, p95ResponseTime: 3500, successRate: 94.2, errorRate: 5.8, throughput: 42, cacheHitRate: 78.5,
};

interface MetricRowProps {
  label: string; value: number; unit: string; trend?: 'up' | 'down' | 'stable'; trendValue?: string;
  icon: React.ReactNode; color: string;
}

function MetricRow({ label, value, unit, trend, trendValue, icon, color }: MetricRowProps) {
  const trendIcon = trend === 'up' ? <TrendingUp className="w-3 h-3" /> : trend === 'down' ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />;
  const trendColor = trend === 'up' ? 'text-plasma' : trend === 'down' ? 'text-neon-r' : 'text-text-dim';
  return (
    <div className="flex items-center justify-between p-3 bg-abyss/50">
      <div className="flex items-center gap-3">
        <div className={`p-2 ${color}/10`}>{icon}</div>
        <div className="text-left">
          <p className="text-xs text-text-dim">{label}</p>
          <div className="flex items-baseline gap-1">
            <span className="text-lg font-bold text-text">{typeof value === 'number' ? value.toLocaleString() : value}</span>
            <span className="text-xs text-text-mute">{unit}</span>
          </div>
        </div>
      </div>
      {trendValue && (
        <div className={`flex items-center gap-1 text-xs ${trendColor}`}>{trendIcon}<span>{trendValue}</span></div>
      )}
    </div>
  );
}

export function PerformanceMetricsCard({ data }: PerformanceMetricsCardProps) {
  const prefersReduced = useReducedMotion();
  const [metrics, setMetrics] = useState<PerformanceData>(DEFAULT_DATA);
  const [isLoading, setIsLoading] = useState(!data);

  useEffect(() => {
    if (data) { setMetrics(data); setIsLoading(false); return; }
    let cancelled = false;
    const fetchMetrics = async () => {
      try {
        const response = await api.get<PerformanceData>('/system/performance');
        if (!cancelled && response.data) setMetrics(response.data);
      } catch { /* use default */ } finally { if (!cancelled) setIsLoading(false); }
    };
    fetchMetrics();
    return () => { cancelled = true; };
  }, [data]);

  const getHealthStatus = () => {
    if (metrics.successRate >= 95 && metrics.avgResponseTime < 2000) return { label: 'Healthy', color: 'text-plasma', bg: 'bg-plasma/10' };
    if (metrics.successRate >= 85 && metrics.avgResponseTime < 5000) return { label: 'Degraded', color: 'text-volt', bg: 'bg-volt/10' };
    return { label: 'Critical', color: 'text-neon-r', bg: 'bg-neon-r/10' };
  };

  const health = getHealthStatus();

  return (
    <motion.div
      initial={prefersReduced ? undefined : { opacity: 0, scale: 0.98 }}
      animate={prefersReduced ? undefined : { opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, delay: 0.15 }}
    >
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <h2 className="text-lg font-display font-semibold flex items-center gap-2"><Zap className="w-5 h-5 text-volt" />Performance Metrics</h2>
          <div className={`px-3 py-1 text-xs font-medium ${health.bg} ${health.color}`}>{health.label}</div>
        </CardHeader>
        <CardBody>
          {isLoading ? (
            <div className="grid grid-cols-2 gap-4">{[1,2,3,4,5,6].map(i => <div key={i} className="h-16 bg-abyss/30 animate-pulse" />)}</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <MetricRow label="Avg Response" value={metrics.avgResponseTime} unit="ms" trend="down" trendValue="-12%" icon={<Clock className="w-4 h-4 text-cyan" />} color="bg-cyan" />
              <MetricRow label="P95 Latency" value={metrics.p95ResponseTime} unit="ms" trend="stable" trendValue="+2%" icon={<Activity className="w-4 h-4" style={{ color: '#a78bfa' }} />} color="bg-ghost" />
              <MetricRow label="Success Rate" value={metrics.successRate} unit="%" trend="up" trendValue="+1.2%" icon={<CheckCircle className="w-4 h-4 text-plasma" />} color="bg-plasma" />
              <MetricRow label="Error Rate" value={metrics.errorRate} unit="%" trend="down" trendValue="-0.8%" icon={<AlertTriangle className="w-4 h-4 text-neon-r" />} color="bg-neon-r" />
              <MetricRow label="Throughput" value={metrics.throughput} unit="req/s" trend="up" trendValue="+5%" icon={<Zap className="w-4 h-4 text-volt" />} color="bg-volt" />
              <MetricRow label="Cache Hit" value={metrics.cacheHitRate} unit="%" trend="up" trendValue="+3%" icon={<CheckCircle className="w-4 h-4 text-fuchsia" />} color="bg-fuchsia" />
            </div>
          )}
        </CardBody>
      </Card>
    </motion.div>
  );
}
