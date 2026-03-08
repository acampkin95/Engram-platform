import { useState, useCallback, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  RefreshCw,
  Zap,
  Activity,
  Database,
  Clock,
  CheckCircle,
  XCircle,
  TrendingUp,
  Server,
  AlertCircle,
} from 'lucide-react';
import { Button, Card, CardBody, CardHeader } from '../components/ui';
import { PerformanceMetricsCard, TimelineActivityChart } from '../components/charts';
import { useDashboardStats } from '../hooks/useDashboardStats';
import { useReducedMotion, staggerContainer, staggerItem } from '../lib/motion';

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function formatBytes(bytes: number): string {
  if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(1)} GB`;
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  if (bytes >= 1_024) return `${(bytes / 1_024).toFixed(1)} KB`;
  return `${bytes} B`;
}

interface StatTileProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  color: string;
  bg: string;
  detail?: string;
}

function StatTile({ label, value, icon, color, bg, detail }: StatTileProps) {
  const prefersReduced = useReducedMotion();
  return (
    <motion.div
      variants={prefersReduced ? undefined : staggerItem}
      className="bg-surface border border-border p-5 flex items-start gap-4 hover:border-border-hi transition-colors duration-200"
    >
      <div className={`p-3 ${bg} flex-shrink-0`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-text-dim font-medium uppercase tracking-wider mb-1">{label}</p>
        <p className={`text-2xl font-display font-bold ${color}`}>{value}</p>
        {detail && <p className="text-xs text-text-mute mt-1">{detail}</p>}
      </div>
    </motion.div>
  );
}

function StatTileSkeleton() {
  return (
    <div className="bg-surface border border-border p-5 flex items-start gap-4 animate-pulse">
      <div className="w-11 h-11 bg-abyss/50 flex-shrink-0" />
      <div className="flex-1 space-y-2 pt-1">
        <div className="h-3 bg-abyss/50 w-20" />
        <div className="h-7 bg-abyss/50 w-24" />
        <div className="h-3 bg-abyss/30 w-16" />
      </div>
    </div>
  );
}

interface SystemHealthProps {
  successRate: number;
}

function SystemHealthBanner({ successRate }: SystemHealthProps) {
  const isHealthy = successRate >= 90;
  const isDegraded = successRate >= 70 && successRate < 90;

  const { label, color, bg, borderColor } = isHealthy
    ? { label: 'System Healthy', color: 'text-plasma', bg: 'bg-plasma/10', borderColor: 'border-plasma/30' }
    : isDegraded
    ? { label: 'Performance Degraded', color: 'text-volt', bg: 'bg-volt/10', borderColor: 'border-volt/30' }
    : { label: 'System Critical', color: 'text-neon-r', bg: 'bg-neon-r/10', borderColor: 'border-neon-r/30' };

  const Icon = isHealthy ? CheckCircle : isDegraded ? AlertCircle : XCircle;

  return (
    <div className={`flex items-center gap-3 px-4 py-3 ${bg} border ${borderColor}`}>
      <Icon className={`w-4 h-4 ${color} flex-shrink-0`} />
      <span className={`text-sm font-medium ${color}`}>{label}</span>
      <span className="text-xs text-text-dim ml-auto">
        {successRate.toFixed(1)}% crawl success rate
      </span>
    </div>
  );
}

interface CrawlBreakdownProps {
  total: number;
  completed: number;
  active: number;
  failed: number;
  cancelled: number;
}

function CrawlBreakdown({ total, completed, active, failed, cancelled }: CrawlBreakdownProps) {
  const bars = [
    { label: 'Completed', value: completed, color: 'bg-plasma', textColor: 'text-plasma' },
    { label: 'Active', value: active, color: 'bg-cyan', textColor: 'text-cyan' },
    { label: 'Failed', value: failed, color: 'bg-neon-r', textColor: 'text-neon-r' },
    { label: 'Cancelled', value: cancelled, color: 'bg-text-mute', textColor: 'text-text-mute' },
  ];

  return (
    <Card>
      <CardHeader>
        <h2 className="text-lg font-display font-semibold flex items-center gap-2">
          <Activity className="w-5 h-5 text-cyan" />
          Crawl Breakdown
        </h2>
        <span className="text-sm text-text-dim">{formatNumber(total)} total</span>
      </CardHeader>
      <CardBody>
        <div className="space-y-4">
          {/* Stacked bar */}
          {total > 0 && (
            <div className="h-2 flex overflow-hidden bg-abyss">
              {bars.map((b) => (
                <div
                  key={b.label}
                  className={`${b.color} transition-all duration-500`}
                  style={{ width: `${(b.value / total) * 100}%` }}
                />
              ))}
            </div>
          )}

          {/* Legend rows */}
          <div className="space-y-3">
            {bars.map((b) => (
              <div key={b.label} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 ${b.color}`} />
                  <span className="text-sm text-text-dim">{b.label}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-sm font-bold font-display ${b.textColor}`}>
                    {formatNumber(b.value)}
                  </span>
                  {total > 0 && (
                    <span className="text-xs text-text-mute w-10 text-right">
                      {((b.value / total) * 100).toFixed(0)}%
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

interface StorageStatsProps {
  collections: number;
  totalDocuments: number;
  dataSets: number;
  totalSizeBytes: number;
}

function StorageStats({ collections, totalDocuments, dataSets, totalSizeBytes }: StorageStatsProps) {
  const rows = [
    { label: 'Vector Collections', value: formatNumber(collections), icon: <Database className="w-4 h-4 text-cyan" />, color: 'text-cyan' },
    { label: 'Total Documents', value: formatNumber(totalDocuments), icon: <Server className="w-4 h-4 text-fuchsia" />, color: 'text-fuchsia' },
    { label: 'Data Sets', value: formatNumber(dataSets), icon: <Database className="w-4 h-4 text-volt" />, color: 'text-volt' },
    { label: 'Storage Used', value: formatBytes(totalSizeBytes), icon: <Database className="w-4 h-4 text-plasma" />, color: 'text-plasma' },
  ];

  return (
    <Card>
      <CardHeader>
        <h2 className="text-lg font-display font-semibold flex items-center gap-2">
          <Database className="w-5 h-5 text-fuchsia" />
          Storage Overview
        </h2>
      </CardHeader>
      <CardBody>
        <div className="space-y-1">
          {rows.map((row) => (
            <div
              key={row.label}
              className="flex items-center justify-between p-3 bg-abyss/40 hover:bg-abyss/70 transition-colors"
            >
              <div className="flex items-center gap-3">
                {row.icon}
                <span className="text-sm text-text-dim">{row.label}</span>
              </div>
              <span className={`text-sm font-bold font-display ${row.color}`}>{row.value}</span>
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}

function PageSkeleton() {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => <StatTileSkeleton key={i} />)}
      </div>
      <div className="h-10 bg-surface border border-border animate-pulse" />
      <div className="h-[280px] bg-surface border border-border animate-pulse" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-64 bg-surface border border-border animate-pulse" />
        <div className="h-64 bg-surface border border-border animate-pulse" />
      </div>
    </div>
  );
}

export default function PerformancePage() {
  const prefersReduced = useReducedMotion();
  const { stats, loading, error, refresh } = useDashboardStats();
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleRefresh = useCallback(() => {
    refresh();
    setLastRefreshed(new Date());
  }, [refresh]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    intervalRef.current = setInterval(handleRefresh, 30_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [handleRefresh]);

  const successRate = stats
    ? stats.crawls.total > 0
      ? (stats.crawls.completed / stats.crawls.total) * 100
      : 100
    : 0;

  const statTiles: StatTileProps[] = stats
    ? [
        {
          label: 'Success Rate',
          value: `${successRate.toFixed(1)}%`,
          icon: <CheckCircle className="w-5 h-5 text-plasma" />,
          color: 'text-plasma',
          bg: 'bg-plasma/10',
          detail: `${formatNumber(stats.crawls.completed)} completed`,
        },
        {
          label: 'Active Crawls',
          value: formatNumber(stats.crawls.active),
          icon: <Activity className="w-5 h-5 text-cyan" />,
          color: 'text-cyan',
          bg: 'bg-cyan/10',
          detail: `${formatNumber(stats.crawls.total)} total`,
        },
        {
          label: 'Storage Used',
          value: formatBytes(stats.data_sets.total_size_bytes),
          icon: <Database className="w-5 h-5 text-fuchsia" />,
          color: 'text-fuchsia',
          bg: 'bg-fuchsia/10',
          detail: `${formatNumber(stats.data_sets.total_files)} files`,
        },
        {
          label: 'Vector Docs',
          value: formatNumber(stats.storage.total_documents),
          icon: <Server className="w-5 h-5 text-volt" />,
          color: 'text-volt',
          bg: 'bg-volt/10',
          detail: `${formatNumber(stats.storage.collections)} collections`,
        },
      ]
    : [];

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-text flex items-center gap-3">
            <Zap className="w-6 h-6 text-volt" />
            Performance
          </h1>
          <p className="text-sm text-text-dim mt-1">
            System health, crawl throughput, and resource utilisation
          </p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <span className="hidden sm:block text-xs text-text-mute">
            Updated {lastRefreshed.toLocaleTimeString()}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={loading}
            leftIcon={<RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div
          role="alert"
          aria-live="assertive"
          className="flex items-center gap-3 p-4 bg-neon-r/10 border border-neon-r/30 text-neon-r"
        >
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="flex-1 text-sm">Could not load stats: {error.message}</p>
          <Button variant="danger" size="sm" onClick={handleRefresh}>
            Retry
          </Button>
        </div>
      )}

      {loading && !stats ? (
        <PageSkeleton />
      ) : (
        <>
          {/* Stat tiles */}
          <motion.div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
            variants={prefersReduced ? undefined : staggerContainer}
            initial={prefersReduced ? undefined : 'hidden'}
            animate={prefersReduced ? undefined : 'visible'}
          >
            {statTiles.map((tile) => (
              <StatTile key={tile.label} {...tile} />
            ))}
          </motion.div>

          {/* System health banner */}
          {stats && <SystemHealthBanner successRate={successRate} />}

          {/* Timeline chart */}
          <motion.div
            initial={prefersReduced ? undefined : { opacity: 0, y: 8 }}
            animate={prefersReduced ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            <TimelineActivityChart />
          </motion.div>

          {/* Performance metrics + crawl breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <PerformanceMetricsCard />
            {stats && (
              <motion.div
                initial={prefersReduced ? undefined : { opacity: 0, y: 8 }}
                animate={prefersReduced ? undefined : { opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.2 }}
              >
                <CrawlBreakdown
                  total={stats.crawls.total}
                  completed={stats.crawls.completed}
                  active={stats.crawls.active}
                  failed={stats.crawls.failed}
                  cancelled={stats.crawls.cancelled ?? 0}
                />
              </motion.div>
            )}
          </div>

          {/* Storage stats */}
          {stats && (
            <motion.div
              initial={prefersReduced ? undefined : { opacity: 0, y: 8 }}
              animate={prefersReduced ? undefined : { opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.25 }}
            >
              <StorageStats
                collections={stats.storage.collections}
                totalDocuments={stats.storage.total_documents}
                dataSets={stats.data_sets.total}
                totalSizeBytes={stats.data_sets.total_size_bytes}
              />
            </motion.div>
          )}

          {/* Quick links */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: 'View Active Crawls', href: '/crawl/active', icon: <Activity className="w-4 h-4" />, color: 'text-cyan', border: 'hover:border-cyan/30' },
              { label: 'Browse Storage', href: '/storage', icon: <Database className="w-4 h-4" />, color: 'text-fuchsia', border: 'hover:border-fuchsia/30' },
              { label: 'Crawl History', href: '/crawl/history', icon: <Clock className="w-4 h-4" />, color: 'text-plasma', border: 'hover:border-plasma/30' },
            ].map((link) => (
              <a
                key={link.label}
                href={link.href}
                className={`flex items-center gap-3 p-4 bg-surface border border-border ${link.border} transition-colors duration-150 group`}
              >
                <span className={`${link.color} group-hover:scale-110 transition-transform duration-150`}>
                  {link.icon}
                </span>
                <span className={`text-sm font-medium ${link.color}`}>{link.label}</span>
                <TrendingUp className="w-3.5 h-3.5 text-text-mute ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
              </a>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
