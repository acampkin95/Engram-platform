'use client';

import { Activity, BarChart2, Brain, FolderSearch, Globe, Server, Zap } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FadeIn, SlideIn } from '@/src/components/Animations';
import type { GridItem } from '@/src/components/DraggableGrid';
import { DraggableGrid, useGridLayout } from '@/src/components/DraggableGrid';
import { SkeletonDashboardHome } from '@/src/components/Skeletons';
import { Button } from '@/src/design-system/components/Button';
import { ErrorState } from '@/src/design-system/components/ErrorState';
import { StatCard } from '@/src/design-system/components/StatCard';
import { StatusDot } from '@/src/design-system/components/StatusDot';
import {
  type HealthResponse as CrawlerHealth,
  crawlerClient,
  type StatsResponse,
} from '@/src/lib/crawler-client';
import {
  type AnalyticsResponse,
  type HealthResponse as MemoryHealth,
  memoryClient,
} from '@/src/lib/memory-client';
import { useUIStore } from '@/src/stores/uiStore';

// ─── Types ─────────────────────────────────────────────────────────────────────────────────

interface DashboardData {
  crawlerStats: StatsResponse | null;
  crawlerHealth: CrawlerHealth | null;
  memoryAnalytics: AnalyticsResponse | null;
  memoryHealth: MemoryHealth | null;
}

type ServiceStatusVariant = 'online' | 'offline' | 'degraded';

function getServiceStatusVariant(isHealthy: boolean, hasData: boolean): ServiceStatusVariant {
  if (isHealthy) {
    return 'online';
  }

  if (hasData) {
    return 'degraded';
  }

  return 'offline';
}

function getServiceStatusLabel(status: ServiceStatusVariant): 'Online' | 'Degraded' | 'Offline' {
  if (status === 'online') {
    return 'Online';
  }

  if (status === 'degraded') {
    return 'Degraded';
  }

  return 'Offline';
}

// ─── Service health card content ───────────────────────────────────────────────────────

function CrawlerHealthCard({
  stats,
  health,
}: Readonly<{
  stats: StatsResponse | null;
  health: CrawlerHealth | null;
}>) {
  const online = health?.status === 'healthy';
  const serviceStatus = getServiceStatusVariant(online, Boolean(health));
  const rows = [
    { label: 'Version', value: health?.version ?? '—' },
    { label: 'Active crawls', value: stats?.active_crawls ?? '—' },
    {
      label: 'Cache hit rate',
      value:
        stats?.cache_hit_rate === undefined || stats?.cache_hit_rate === null
          ? '—'
          : `${(stats.cache_hit_rate * 100).toFixed(1)}%`,
    },
    {
      label: 'Avg crawl time',
      value:
        stats?.average_crawl_time_ms === undefined || stats?.average_crawl_time_ms === null
          ? '—'
          : `${stats.average_crawl_time_ms.toFixed(0)} ms`,
    },
    { label: 'Redis', value: health?.redis ?? '—' },
  ];
  return (
    <div className="h-full flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-[#9B7DE0]" />
          <span className="text-sm font-semibold text-[#f0eef8] font-display">Crawler</span>
        </div>
        <StatusDot variant={serviceStatus} label={getServiceStatusLabel(serviceStatus)} />
      </div>
      <dl className="space-y-2 flex-1">
        {rows.map(({ label, value }) => (
          <div key={label} className="flex justify-between text-xs">
            <dt className="text-[#5c5878] font-mono">{label}</dt>
            <dd className="text-[#a09bb8]">{String(value)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function MemoryHealthCard({
  analytics,
  health,
}: Readonly<{
  analytics: AnalyticsResponse | null;
  health: MemoryHealth | null;
}>) {
  const online = health?.status === 'healthy';
  const serviceStatus = getServiceStatusVariant(online, Boolean(health));
  const rows = [
    { label: 'Version', value: health?.version ?? '—' },
    { label: 'Database', value: health?.database ?? '—' },
    { label: 'Cache', value: health?.cache ?? '—' },
    { label: 'Total memories', value: analytics?.total_memories ?? '—' },
    { label: 'Total entities', value: analytics?.total_entities ?? '—' },
  ];
  return (
    <div className="h-full flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-[#2EC4C4]" />
          <span className="text-sm font-semibold text-[#f0eef8] font-display">Memory</span>
        </div>
        <StatusDot variant={serviceStatus} label={getServiceStatusLabel(serviceStatus)} />
      </div>
      <dl className="space-y-2 flex-1">
        {rows.map(({ label, value }) => (
          <div key={label} className="flex justify-between text-xs">
            <dt className="text-[#5c5878] font-mono">{label}</dt>
            <dd className="text-[#a09bb8]">{String(value)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

// ─── Quick links card ────────────────────────────────────────────────────────────────────────────────

const quickLinks = [
  {
    href: '/dashboard/crawler/crawl',
    icon: Globe,
    label: 'Start Crawl',
    accent: '#9B7DE0',
    dim: 'rgba(155,125,224,0.08)',
    border: 'rgba(155,125,224,0.15)',
  },
  {
    href: '/dashboard/memory/memories',
    icon: Brain,
    label: 'Browse Memories',
    accent: '#2EC4C4',
    dim: 'rgba(46,196,196,0.08)',
    border: 'rgba(46,196,196,0.15)',
  },
  {
    href: '/dashboard/intelligence/search',
    icon: Activity,
    label: 'Unified Search',
    accent: '#F2A93B',
    dim: 'rgba(242,169,59,0.08)',
    border: 'rgba(242,169,59,0.15)',
  },
  {
    href: '/dashboard/crawler/investigations',
    icon: FolderSearch,
    label: 'Investigations',
    accent: '#9B7DE0',
    dim: 'rgba(155,125,224,0.08)',
    border: 'rgba(155,125,224,0.15)',
  },
];

function QuickLinksCard() {
  return (
    <div className="grid grid-cols-2 gap-2 h-full content-start">
      {quickLinks.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="flex flex-col items-center gap-1.5 p-3 rounded-lg border transition-all hover:scale-[1.02] hover:shadow-lg focus-visible:ring-2 focus-visible:ring-[#F2A93B]/40 focus-visible:outline-none"
          style={{ background: item.dim, borderColor: item.border }}
        >
          <item.icon className="w-4 h-4" style={{ color: item.accent }} />
          <span className="text-[10px] font-mono text-[#a09bb8] text-center leading-tight">
            {item.label}
          </span>
        </Link>
      ))}
    </div>
  );
}

// ─── Stats summary card ──────────────────────────────────────────────────────────────────────────────

function StatsSummaryCard({ data }: Readonly<{ data: DashboardData | null }>) {
  const stats = [
    {
      label: 'Crawl Jobs',
      value: data?.crawlerStats?.total_jobs ?? '—',
      accent: 'purple' as const,
    },
    {
      label: 'Memories',
      value: data?.memoryAnalytics?.total_memories ?? '—',
      accent: 'teal' as const,
    },
    {
      label: 'Active Crawls',
      value: data?.crawlerStats?.active_crawls ?? '—',
      accent: 'amber' as const,
    },
    {
      label: 'Entities',
      value: data?.memoryAnalytics?.total_entities ?? '—',
      accent: 'purple' as const,
    },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 h-full content-start">
      {stats.map((s) => (
        <StatCard key={s.label} label={s.label} value={s.value} accent={s.accent} />
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────────────────

export default function HomeContent() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const setServiceStatus = useUIStore((s) => s.setServiceStatus);
  const { resetLayout } = useGridLayout('engram-home-grid');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [crawlerStatsRes, crawlerHealthRes, memoryAnalyticsRes, memoryHealthRes] =
        await Promise.allSettled([
          crawlerClient.getStats(),
          crawlerClient.getHealth(),
          memoryClient.getAnalytics(),
          memoryClient.getHealth(),
        ]);

      const crawlerStats =
        crawlerStatsRes.status === 'fulfilled' ? crawlerStatsRes.value.data : null;
      const crawlerHealth =
        crawlerHealthRes.status === 'fulfilled' ? crawlerHealthRes.value.data : null;
      const memoryAnalytics =
        memoryAnalyticsRes.status === 'fulfilled' ? memoryAnalyticsRes.value.data : null;
      const memoryHealth =
        memoryHealthRes.status === 'fulfilled' ? memoryHealthRes.value.data : null;

      const crawlerStatus = getServiceStatusVariant(
        crawlerHealth?.status === 'healthy',
        Boolean(crawlerHealth),
      );
      const memoryStatus = getServiceStatusVariant(
        memoryHealth?.status === 'healthy',
        Boolean(memoryHealth),
      );

      setServiceStatus({
        crawler: crawlerStatus,
        memory: memoryStatus,
      });
      setData({
        crawlerStats,
        crawlerHealth,
        memoryAnalytics,
        memoryHealth,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, [setServiceStatus]);

  const handleRefresh = useCallback(() => void fetchData(), [fetchData]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const gridItems: GridItem[] = useMemo(
    () => [
      {
        id: 'stats',
        title: 'Key Metrics',
        icon: <BarChart2 className="w-3.5 h-3.5" />,
        children: <StatsSummaryCard data={data} />,
        defaultLayout: { x: 0, y: 0, w: 6, h: 5, minW: 4, minH: 4 },
      },
      {
        id: 'quick-links',
        title: 'Quick Access',
        icon: <Zap className="w-3.5 h-3.5" />,
        children: <QuickLinksCard />,
        defaultLayout: { x: 6, y: 0, w: 6, h: 5, minW: 3, minH: 3 },
      },
      {
        id: 'crawler-health',
        title: 'Crawler Service',
        icon: <Globe className="w-3.5 h-3.5 text-[#9B7DE0]" />,
        children: (
          <CrawlerHealthCard
            stats={data?.crawlerStats ?? null}
            health={data?.crawlerHealth ?? null}
          />
        ),
        defaultLayout: { x: 0, y: 5, w: 6, h: 6, minW: 3, minH: 4 },
      },
      {
        id: 'memory-health',
        title: 'Memory Service',
        icon: <Brain className="w-3.5 h-3.5 text-[#2EC4C4]" />,
        children: (
          <MemoryHealthCard
            analytics={data?.memoryAnalytics ?? null}
            health={data?.memoryHealth ?? null}
          />
        ),
        defaultLayout: { x: 6, y: 5, w: 6, h: 6, minW: 3, minH: 4 },
      },
      {
        id: 'system',
        title: 'System',
        icon: <Server className="w-3.5 h-3.5 text-[#F2A93B]" />,
        children: (
          <div className="flex flex-col gap-3 h-full">
            <div className="space-y-2">
              {[
                {
                  label: 'Crawler',
                  icon: Globe,
                  color: '#9B7DE0',
                  bg: 'rgba(155,125,224,0.1)',
                  border: 'rgba(155,125,224,0.2)',
                  status: getServiceStatusVariant(
                    data?.crawlerHealth?.status === 'healthy',
                    Boolean(data?.crawlerHealth),
                  ),
                },
                {
                  label: 'Memory',
                  icon: Brain,
                  color: '#2EC4C4',
                  bg: 'rgba(46,196,196,0.1)',
                  border: 'rgba(46,196,196,0.2)',
                  status: getServiceStatusVariant(
                    data?.memoryHealth?.status === 'healthy',
                    Boolean(data?.memoryHealth),
                  ),
                },
              ].map((svc) => (
                <div
                  key={svc.label}
                  className="flex items-center justify-between p-2.5 rounded-lg border bg-[#0d0d1a]"
                  style={{ borderColor: svc.border }}
                >
                  <div className="flex items-center gap-2">
                    <svc.icon className="w-3.5 h-3.5" style={{ color: svc.color }} />
                    <span className="text-xs text-[#a09bb8]">{svc.label}</span>
                  </div>
                  <StatusDot variant={svc.status} />
                </div>
              ))}
            </div>
            <div className="mt-auto flex gap-3">
              <Button type="button" onClick={handleRefresh} variant="ghost" size="sm">
                Refresh
              </Button>
              <Button type="button" onClick={resetLayout} variant="ghost" size="sm">
                Reset layout
              </Button>
            </div>
          </div>
        ),
        defaultLayout: { x: 0, y: 11, w: 4, h: 5, minW: 3, minH: 4 },
      },
    ],
    [data, handleRefresh, resetLayout],
  );

  if (loading) return <SkeletonDashboardHome />;
  if (error) return <ErrorState message={error} onRetry={fetchData} />;

  return (
    <FadeIn className="space-y-6">
      <h1 className="sr-only">Dashboard Overview</h1>
      <SlideIn direction="down" delay={0.05}>
        <div className="flex items-end justify-between">
          <div>
            <h1
              className="font-bold text-[#f0eef8] tracking-wide font-display"
              style={{ fontSize: 'var(--text-2xl)' }}
            >
              Platform Overview
            </h1>
            <p
              className="font-mono mt-1 tracking-wider"
              style={{ fontSize: 'var(--text-xs)', color: '#5c5878' }}
            >
              Unified intelligence across Crawler · Memory · OSINT — drag widgets to rearrange
            </p>
          </div>
        </div>
      </SlideIn>
      <DraggableGrid
        items={gridItems}
        storageKey="engram-home-grid"
        rowHeight={50}
        cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
      />
    </FadeIn>
  );
}
