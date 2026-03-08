'use client';

import { Brain, Clock, Database, Network, Tag } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';
import type { FilterValues } from '@/src/components/FilterBar';
import { FilterBar } from '@/src/components/FilterBar';
import { SkeletonAnalytics } from '@/src/components/Skeletons';
import { Card } from '@/src/design-system/components/Card';
import { SectionHeader } from '@/src/design-system/components/SectionHeader';
import { StatCard } from '@/src/design-system/components/StatCard';
import { useMounted } from '@/src/hooks/useMounted';
import type {
  AnalyticsResponse,
  ListMemoriesResponse,
  MatterListResponse,
} from '@/src/lib/memory-client';
import { memoryClient } from '@/src/lib/memory-client';
import { swrKeys } from '@/src/lib/swr-keys';

// ─── ECharts SSR-safe wrapper ──────────────────────────────────────────────────

interface EChartProps {
  options: unknown;
  className?: string;
}

function EChart({ options, className }: Readonly<EChartProps>) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<unknown>(null);
  const mounted = useMounted();

  useEffect(() => {
    if (!mounted || !ref.current) return;

    let disposed = false;

    import('echarts').then((echarts) => {
      if (disposed || !ref.current) return;
      const chart = echarts.init(ref.current, 'dark');
      chartRef.current = chart;
      (chart as { setOption: (o: unknown) => void }).setOption(options);
    });

    return () => {
      disposed = true;
      if (chartRef.current) {
        (chartRef.current as { dispose: () => void }).dispose();
        chartRef.current = null;
      }
    };
  }, [mounted, options]);

  if (!mounted) {
    return (
      <div className={`flex items-center justify-center bg-teal/[0.04] ${className ?? ''}`}>
        <div className="h-1 w-16 rounded-full bg-[#2EC4C4]/20 animate-pulse" />
      </div>
    );
  }

  return <div ref={ref} className={className} />;
}

// ─── Chart option builders ─────────────────────────────────────────────────────

type MemoryItem = ListMemoriesResponse['memories'][number];

function buildMemoryGrowthOptions(memories: MemoryItem[]) {
  const grouped: Record<string, number> = {};
  const sorted = [...memories].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
  let cumulative = 0;
  for (const m of sorted) {
    const date = m.created_at.slice(0, 10);
    cumulative += 1;
    grouped[date] = cumulative;
  }

  const seriesData = Object.entries(grouped).map(([date, count]) => [date, count]);

  return {
    backgroundColor: 'transparent',
    textStyle: { color: '#5c5878', fontFamily: 'IBM Plex Mono' },
    grid: { top: 40, right: 20, bottom: 40, left: 50 },
    xAxis: {
      type: 'time',
      axisLine: { lineStyle: { color: '#1a1830' } },
      axisLabel: { color: '#5c5878' },
    },
    yAxis: {
      type: 'value',
      axisLine: { lineStyle: { color: '#1a1830' } },
      splitLine: { lineStyle: { color: '#1a1830' } },
      axisLabel: { color: '#5c5878' },
    },
    series: [
      {
        type: 'line',
        smooth: true,
        lineStyle: { color: '#2EC4C4', width: 2 },
        areaStyle: { color: 'rgba(46,196,196,0.08)' },
        itemStyle: { color: '#2EC4C4' },
        data: seriesData.length > 0 ? seriesData : [['2025-01-01', 0]],
      },
    ],
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#090818',
      borderColor: '#2EC4C4',
      textStyle: { color: '#f0eef8' },
    },
  };
}

function buildMatterDistributionOptions(
  memories: MemoryItem[],
  matters: MatterListResponse | null | undefined,
) {
  const matterCounts: Record<string, number> = {};

  if (matters?.matters) {
    for (const matter of matters.matters) {
      matterCounts[matter.title] = 0;
    }
  }

  for (const memory of memories) {
    const matterId = memory.project_id;
    if (matterId && matters?.matters) {
      const matter = matters.matters.find((m) => m.matter_id === matterId);
      if (matter) {
        matterCounts[matter.title] = (matterCounts[matter.title] ?? 0) + 1;
      }
    }
  }

  const entries = Object.entries(matterCounts).slice(0, 10);
  const categories = entries.map(([title]) => title);
  const values = entries.map(([, count]) => count);

  return {
    backgroundColor: 'transparent',
    textStyle: { color: '#5c5878' },
    grid: { top: 40, right: 20, bottom: 60, left: 50 },
    xAxis: {
      type: 'category',
      axisLabel: { color: '#5c5878', rotate: 30 },
      data: categories.length > 0 ? categories : ['No matters'],
    },
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: '#1a1830' } },
      axisLabel: { color: '#5c5878' },
    },
    series: [
      {
        type: 'bar',
        barMaxWidth: 40,
        itemStyle: { color: '#2EC4C4', borderRadius: [4, 4, 0, 0] },
        data: values.length > 0 ? values : [0],
      },
    ],
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#090818',
      borderColor: '#2EC4C4',
      textStyle: { color: '#f0eef8' },
    },
  };
}

function buildEntityTypeOptions(analytics: AnalyticsResponse | null | undefined) {
  const dist = analytics?.memory_distribution ?? {};
  const entries = Object.entries(dist);

  const entityColors = ['#F2A93B', '#9B7DE0', '#2EC4C4', '#FF6B6B', '#5BC4A0', '#7BA7E0'];

  const pieData = entries.map(([name, value], i) => ({
    name,
    value,
    itemStyle: { color: entityColors[i % entityColors.length] },
  }));

  return {
    backgroundColor: 'transparent',
    textStyle: { color: '#5c5878' },
    legend: {
      orient: 'vertical',
      right: 10,
      top: 'center',
      textStyle: { color: '#a09bb8', fontSize: 11 },
    },
    series: [
      {
        type: 'pie',
        radius: ['50%', '75%'],
        center: ['40%', '50%'],
        avoidLabelOverlap: false,
        label: { show: false },
        labelLine: { show: false },
        emphasis: {
          label: { show: true, fontSize: 12, fontWeight: 'bold', color: '#f0eef8' },
        },
        data:
          pieData.length > 0
            ? pieData
            : [{ name: 'No data', value: 1, itemStyle: { color: '#1a1830' } }],
      },
    ],
    tooltip: {
      trigger: 'item',
      backgroundColor: '#090818',
      borderColor: '#2EC4C4',
      textStyle: { color: '#f0eef8' },
      formatter: '{b}: {c} ({d}%)',
    },
  };
}

// ─── Activity feed ─────────────────────────────────────────────────────────────

type ActivityType = 'Created' | 'Updated' | 'Linked' | 'Searched';

interface ActivityItem {
  id: string;
  type: ActivityType;
  content: string;
  timestamp: string;
}

const activityBadgeStyle: Record<ActivityType, { bg: string; text: string }> = {
  Created: { bg: 'rgba(46,196,196,0.12)', text: '#2EC4C4' },
  Updated: { bg: 'rgba(242,169,59,0.12)', text: '#F2A93B' },
  Linked: { bg: 'rgba(155,125,224,0.12)', text: '#9B7DE0' },
  Searched: { bg: 'rgba(255,107,107,0.12)', text: '#FF6B6B' },
};

function ActivityFeed({ memories }: Readonly<{ memories: MemoryItem[] }>) {
  const items: ActivityItem[] = memories.slice(0, 10).map((m) => ({
    id: m.memory_id,
    type: 'Created' as ActivityType,
    content: m.content.slice(0, 80) + (m.content.length > 80 ? '…' : ''),
    timestamp: m.created_at,
  }));

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-40 text-[#5c5878] text-xs font-mono">
        No recent activity
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const style = activityBadgeStyle[item.type];
        const date = new Date(item.timestamp);
        const timeAgo = formatTimeAgo(date);

        return (
          <div key={item.id} className="flex gap-3 items-start">
            <span
              className="shrink-0 text-[10px] font-mono px-1.5 py-0.5 rounded mt-0.5"
              style={{ background: style.bg, color: style.text }}
            >
              {item.type}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-[#a09bb8] truncate leading-relaxed">{item.content}</p>
              <p className="text-[10px] text-[#5c5878] font-mono mt-0.5">{timeAgo}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function formatTimeAgo(date: Date): string {
  const now = Date.now();
  const diff = now - date.getTime();
  const minutes = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'just now';
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function AnalyticsContent() {
  const [filters, setFilters] = useState<FilterValues>({});

  const { data: analyticsRes, isLoading: analyticsLoading } = useSWR(
    swrKeys.memory.analytics(),
    () => memoryClient.getAnalytics(),
    { revalidateOnFocus: false },
  );

  const { data: mattersRes, isLoading: mattersLoading } = useSWR(
    swrKeys.memory.matters(),
    () => memoryClient.getMatters(),
    { revalidateOnFocus: false },
  );

  const { data: memoriesRes, isLoading: memoriesLoading } = useSWR(
    swrKeys.memory.memories(),
    () => memoryClient.getMemories({ limit: 200 }),
    { revalidateOnFocus: false },
  );

  const isLoading = analyticsLoading || mattersLoading || memoriesLoading;

  const analytics = analyticsRes?.data;
  const matters = mattersRes?.data;
  const allMemories = memoriesRes?.data?.memories ?? [];

  // ── Apply filters to memories ──
  const filteredMemories = useMemo(() => {
    let result = allMemories;

    if (filters.search) {
      const q = filters.search.toLowerCase();
      result = result.filter((m) => m.content.toLowerCase().includes(q));
    }

    if (filters.status) {
      result = result.filter((m) => m.project_id === filters.status);
    }

    if (filters.dateFrom) {
      const from = filters.dateFrom.getTime();
      result = result.filter((m) => new Date(m.created_at).getTime() >= from);
    }

    if (filters.dateTo) {
      const to = filters.dateTo.getTime();
      result = result.filter((m) => new Date(m.created_at).getTime() <= to);
    }

    if (filters.scoreRange) {
      const [min, max] = filters.scoreRange;
      result = result.filter((m) => {
        const score = (m.importance ?? 0) * 100;
        return score >= min && score <= max;
      });
    }

    return result;
  }, [allMemories, filters]);

  const totalMemories = analytics?.total_memories ?? '—';
  const totalEntities = analytics?.total_entities ?? '—';
  const activeMatters = matters?.matters.filter((m) => m.status === 'active').length ?? '—';

  // Build matter options for filter status dropdown
  const matterOptions = (matters?.matters ?? []).map((m) => ({
    value: m.matter_id,
    label: m.title,
  }));

  const memoryGrowthOptions = useMemo(
    () => buildMemoryGrowthOptions(filteredMemories),
    [filteredMemories],
  );
  const matterDistOptions = useMemo(
    () => buildMatterDistributionOptions(filteredMemories, matters),
    [filteredMemories, matters],
  );
  const entityTypeOptions = useMemo(() => buildEntityTypeOptions(analytics), [analytics]);

  if (isLoading) {
    return <SkeletonAnalytics />;
  }

  return (
    <div className="space-y-6 animate-page-enter">
      {/* Header */}
      <SectionHeader title="Analytics" breadcrumb={['MEMORY', 'ANALYTICS']} />

      {/* Filter Bar */}
      <FilterBar
        showSearch
        showStatus={matterOptions.length > 0}
        showDateRange
        showScoreRange
        statusOptions={matterOptions}
        placeholder="Search memories…"
        onFiltersChange={setFilters}
      />

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Total Memories"
          value={filteredMemories.length > 0 ? filteredMemories.length : totalMemories}
          accent="teal"
        />
        <StatCard label="Active Matters" value={activeMatters} accent="teal" />
        <StatCard label="Total Entities" value={totalEntities} accent="teal" />
      </div>

      {/* Main charts row */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Memory Growth Over Time */}
        <Card
          header={
            <div className="flex items-center gap-2">
              <Brain className="w-4 h-4 text-[#2EC4C4]" />
              <span className="text-sm font-semibold text-[#f0eef8]">Memory Growth Over Time</span>
            </div>
          }
        >
          <EChart options={memoryGrowthOptions} className="w-full h-[280px]" />
        </Card>

        {/* Memories by Matter */}
        <Card
          header={
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-[#2EC4C4]" />
              <span className="text-sm font-semibold text-[#f0eef8]">Memories by Matter</span>
            </div>
          }
        >
          <EChart options={matterDistOptions} className="w-full h-[280px]" />
        </Card>
      </div>

      {/* Secondary row — entity types + activity feed */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Entity Type Distribution */}
        <Card
          header={
            <div className="flex items-center gap-2">
              <Network className="w-4 h-4 text-[#F2A93B]" />
              <span className="text-sm font-semibold text-[#f0eef8]">Entity Type Distribution</span>
            </div>
          }
        >
          <EChart options={entityTypeOptions} className="w-full h-[220px]" />
        </Card>

        {/* Recent Activity */}
        <Card
          header={
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#9B7DE0]" />
                <span className="text-sm font-semibold text-[#f0eef8]">Recent Activity</span>
              </div>
              <span className="text-[10px] font-mono text-[#5c5878]">
                {filteredMemories.length > 0 ? `${filteredMemories.length} shown` : ''}
              </span>
            </div>
          }
        >
          <ActivityFeed memories={filteredMemories} />
        </Card>
      </div>

      {/* Tier distribution */}
      {analytics?.tier_distribution && Object.keys(analytics.tier_distribution).length > 0 && (
        <Card
          header={
            <div className="flex items-center gap-2">
              <Tag className="w-4 h-4 text-[#9B7DE0]" />
              <span className="text-sm font-semibold text-[#f0eef8]">Memory Tier Distribution</span>
            </div>
          }
        >
          <div className="flex flex-wrap gap-4">
            {Object.entries(analytics.tier_distribution).map(([tier, count]) => (
              <div
                key={tier}
                className="flex flex-col items-center gap-1 px-5 py-3 rounded-lg bg-[rgba(155,125,224,0.06)] border border-[rgba(155,125,224,0.15)]"
              >
                <span className="text-lg font-bold text-[#9B7DE0]">{count}</span>
                <span className="text-[10px] font-mono text-[#5c5878] uppercase">Tier {tier}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
