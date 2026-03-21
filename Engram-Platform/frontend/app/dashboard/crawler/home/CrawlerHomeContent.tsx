'use client';

import { Activity, AlertCircle, BarChart2, Globe, List } from 'lucide-react';
import useSWR from 'swr';
import type { GridItem } from '@/src/components/DraggableGrid';
import { DraggableGrid, useGridLayout } from '@/src/components/DraggableGrid';
import type { Column } from '@/src/design-system/components';
import {
  Badge,
  Button,
  DataTable,
  EmptyState,
  ErrorState,
  LoadingState,
  SectionHeader,
  StatCard,
} from '@/src/design-system/components';
import { addToast } from '@/src/design-system/components/Toast';
import type { JobResponse } from '@/src/lib/crawler-client';
import { crawlerClient } from '@/src/lib/crawler-client';
import { swrKeys } from '@/src/lib/swr-keys';

// ─── Status badge helper ───────────────────────────────────────────────────────

function statusVariant(status: string) {
  switch (status) {
    case 'completed':
      return 'success' as const;
    case 'failed':
      return 'error' as const;
    case 'running':
      return 'warning' as const;
    default:
      return 'neutral' as const;
  }
}

// ─── Table row type ────────────────────────────────────────────────────────────

type JobRow = Record<string, unknown> & {
  job_id: string;
  url_display: string;
  status: string;
  created_at: string;
};

// ─── Columns ──────────────────────────────────────────────────────────────────

const columns: Column<JobRow>[] = [
  {
    key: 'url_display',
    header: 'URL',
    render: (row) => (
      <span
        className="font-mono text-xs text-[#a09bb8] truncate max-w-[240px] block"
        title={String(row.url_display)}
      >
        {String(row.url_display)}
      </span>
    ),
  },
  {
    key: 'status',
    header: 'Status',
    render: (row) => (
      <Badge variant={statusVariant(String(row.status))} dot>
        {String(row.status)}
      </Badge>
    ),
  },
  {
    key: 'created_at',
    header: 'Created',
    render: (row) => (
      <span className="text-xs text-[#5c5878] font-mono">
        {new Date(String(row.created_at)).toLocaleString()}
      </span>
    ),
  },
  {
    key: 'actions',
    header: 'Actions',
    render: (row) => (
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            globalThis.location.href = `/dashboard/crawler/jobs/${String(row.job_id)}`;
          }}
        >
          View
        </Button>
        {row.status === 'running' && (
          <Button
            variant="danger"
            size="sm"
            onClick={async () => {
              try {
                await crawlerClient.cancelJob(row.job_id);
                addToast({ type: 'success', message: 'Job cancellation requested' });
              } catch (_err) {
                addToast({ type: 'error', message: 'Failed to cancel job' });
              }
            }}
          >
            Cancel
          </Button>
        )}
      </div>
    ),
  },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CrawlerHomeContent() {
  const { resetLayout } = useGridLayout('engram-crawler-grid');

  const {
    data: statsRes,
    error: statsError,
    isLoading: statsLoading,
  } = useSWR(swrKeys.crawler.stats(), () => crawlerClient.getStats(), { refreshInterval: 5_000 });

  const {
    data: jobsRes,
    error: jobsError,
    isLoading: jobsLoading,
  } = useSWR(swrKeys.crawler.jobs(), () => crawlerClient.getJobs({ limit: 20 }), {
    refreshInterval: 5_000,
  });

  const isLoading = statsLoading || jobsLoading;
  const hasError = statsError || jobsError;

  if (isLoading) {
    return <LoadingState label="Loading crawler overview…" />;
  }

  if (hasError) {
    const msg = statsError?.message ?? jobsError?.message ?? 'Failed to load crawler data';
    return <ErrorState message={msg} />;
  }

  const stats = statsRes?.data;
  const jobs = jobsRes?.data?.jobs ?? [];

  // Map jobs → table rows
  const rows: JobRow[] = jobs.map((job: JobResponse) => ({
    ...job,
    url_display: (job.metadata?.url as string | undefined) ?? job.job_id,
  }));

  // Build grid items
  const gridItems: GridItem[] = [
    {
      id: 'stats',
      title: 'Key Metrics',
      icon: <BarChart2 className="w-3.5 h-3.5" />,
      children: (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            icon={<List className="w-4 h-4" />}
            label="Total Jobs"
            value={stats?.total_jobs ?? '—'}
            accent="purple"
          />
          <StatCard
            icon={<Globe className="w-4 h-4" />}
            label="Completed"
            value={stats?.total_crawls ?? '—'}
            accent="teal"
          />
          <StatCard
            icon={<AlertCircle className="w-4 h-4" />}
            label="Failed"
            value="—"
            accent="rose"
          />
          <StatCard
            icon={<Activity className="w-4 h-4" />}
            label="Running"
            value={stats?.active_crawls ?? '—'}
            accent="amber"
          />
        </div>
      ),
      defaultLayout: { x: 0, y: 0, w: 12, h: 3, minW: 3, minH: 3 },
    },
    {
      id: 'recent-jobs',
      title: 'Recent Jobs',
      icon: <List className="w-3.5 h-3.5" />,
      children:
        rows.length === 0 ? (
          <EmptyState
            title="No crawl jobs yet"
            description="Submit your first crawl to see results here."
            context="crawler"
            action={
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  globalThis.location.href = '/dashboard/crawler/crawl';
                }}
              >
                Start Crawl
              </Button>
            }
          />
        ) : (
          <DataTable<JobRow>
            columns={columns}
            data={rows}
            pageSize={20}
            emptyMessage="No jobs found"
          />
        ),
      defaultLayout: { x: 0, y: 3, w: 12, h: 6, minW: 4, minH: 4 },
    },
  ];

  return (
    <div className="space-y-8 animate-page-enter">
      <div className="flex items-end justify-between">
        <SectionHeader
          title="Crawler"
          breadcrumb={['CRAWLER', 'OVERVIEW']}
          action={
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                globalThis.location.href = '/dashboard/crawler/crawl';
              }}
            >
              New Crawl
            </Button>
          }
        />
        <button
          type="button"
          onClick={resetLayout}
          className="text-xs text-[#5c5878] hover:text-[#a09bb8] font-mono"
        >
          Reset layout
        </button>
      </div>
      <DraggableGrid items={gridItems} storageKey="engram-crawler-grid" rowHeight={50} />
    </div>
  );
}
