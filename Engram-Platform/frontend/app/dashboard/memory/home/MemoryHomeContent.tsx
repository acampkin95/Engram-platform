'use client';

import { BarChart2, Brain, FileText, Settings2 } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import useSWR from 'swr';
import type { GridItem } from '@/src/components/DraggableGrid';
import { DraggableGrid, useGridLayout } from '@/src/components/DraggableGrid';
import { Badge } from '@/src/design-system/components/Badge';
import { Button } from '@/src/design-system/components/Button';
import { Card } from '@/src/design-system/components/Card';
import { ErrorState } from '@/src/design-system/components/ErrorState';
import { LoadingState } from '@/src/design-system/components/LoadingState';
import { SectionHeader } from '@/src/design-system/components/SectionHeader';
import { StatCard } from '@/src/design-system/components/StatCard';
import { addToast } from '@/src/design-system/components/Toast';
import type {
  AnalyticsResponse,
  ListMemoriesResponse,
  MatterListResponse,
  SearchResult,
} from '@/src/lib/memory-client';
import { memoryClient } from '@/src/lib/memory-client';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-AU', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}…`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function RecentMemoryCard({ memory }: Readonly<{ memory: SearchResult }>) {
  const content = memory.content ?? memory.snippet ?? '';
  return (
    <Card className="hover:border-[rgba(46,196,196,0.2)] transition-colors">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-[#a09bb8] leading-relaxed flex-1">{truncate(content, 100)}</p>
        {memory.project_id && (
          <Badge variant="memory" className="flex-shrink-0">
            {memory.project_id}
          </Badge>
        )}
      </div>
      <p className="text-xs text-[#5c5878] font-mono mt-3">{formatDate(memory.created_at ?? '')}</p>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MemoryHomeContent() {
  const { resetLayout } = useGridLayout('engram-memory-grid');
  const [decaying, setDecaying] = useState(false);
  const [consolidating, setConsolidating] = useState(false);
  const [cleaning, setCleaning] = useState(false);

  const {
    data: analyticsRes,
    error: analyticsError,
    isLoading: analyticsLoading,
    mutate: mutateAnalytics,
  } = useSWR<{ data: AnalyticsResponse | null; error: string | null }>('memory-analytics', () =>
    memoryClient.getAnalytics(),
  );

  const { data: memoriesRes } = useSWR<{
    data: ListMemoriesResponse | null;
    error: string | null;
  }>('memory-recent', () => memoryClient.getMemories({ limit: 5 }));

  const { data: mattersRes } = useSWR<{
    data: MatterListResponse | null;
    error: string | null;
  }>('memory-matters', () => memoryClient.getMatters());

  const analytics = analyticsRes?.data;
  const recentMemories = memoriesRes?.data?.memories ?? [];
  const matters = mattersRes?.data?.matters ?? [];

  let activeMattersValue: number | string = '—';
  if (matters.length > 0) {
    activeMattersValue = matters.length;
  } else if (analytics) {
    activeMattersValue = '0';
  }

  const handleRunDecay = useCallback(async () => {
    setDecaying(true);
    try {
      await memoryClient.runDecay();
      addToast({ type: 'success', message: 'Decay process completed' });
    } catch (_e) {
      addToast({ type: 'error', message: 'Failed to run decay' });
    } finally {
      setDecaying(false);
    }
  }, []);

  const handleConsolidate = useCallback(async () => {
    setConsolidating(true);
    try {
      await memoryClient.consolidateMemories();
      addToast({ type: 'success', message: 'Memories consolidated' });
    } catch (_e) {
      addToast({ type: 'error', message: 'Failed to consolidate memories' });
    } finally {
      setConsolidating(false);
    }
  }, []);

  const handleCleanup = useCallback(async () => {
    setCleaning(true);
    try {
      await memoryClient.cleanupExpired();
      addToast({ type: 'success', message: 'Expired memories cleaned up' });
    } catch (_e) {
      addToast({ type: 'error', message: 'Failed to clean up expired memories' });
    } finally {
      setCleaning(false);
    }
  }, []);

  // Build grid items
  const gridItems: GridItem[] = useMemo(
    () => [
      {
        id: 'stats',
        title: 'Key Metrics',
        icon: <BarChart2 className="w-3.5 h-3.5" />,
        children: (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard
              label="Total Memories"
              value={analytics?.total_memories ?? '—'}
              accent="teal"
            />
            <StatCard label="Active Matters" value={activeMattersValue} accent="teal" />
            <StatCard
              label="Total Entities"
              value={analytics?.total_entities ?? '—'}
              accent="teal"
            />
          </div>
        ),
        defaultLayout: { x: 0, y: 0, w: 12, h: 3, minW: 3, minH: 3 },
      },
      {
        id: 'recent-memories',
        title: 'Recent Memories',
        icon: <Brain className="w-3.5 h-3.5" />,
        children:
          recentMemories.length === 0 ? (
            <div className="rounded-xl border border-white/[0.06] bg-[#090818] py-12 flex flex-col items-center gap-3">
              <Brain className="w-8 h-8 text-[#5c5878]" />
              <p className="text-sm text-[#5c5878] font-mono">No memories stored yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentMemories.map((memory) => (
                <RecentMemoryCard key={memory.memory_id} memory={memory} />
              ))}
            </div>
          ),
        defaultLayout: { x: 0, y: 3, w: 6, h: 6, minW: 3, minH: 4 },
      },
      ...(matters.length > 0
        ? [
            {
              id: 'matters',
              title: 'Matters Overview',
              icon: <FileText className="w-3.5 h-3.5" />,
              children: (
                <div className="rounded-xl border border-white/[0.06] overflow-hidden">
                  {matters.map((matter, idx) => (
                    <div
                      key={matter.matter_id}
                      className={`flex items-center justify-between px-5 py-4 ${
                        idx < matters.length - 1 ? 'border-b border-white/[0.04]' : ''
                      } hover:bg-white/[0.02] transition-colors`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-[#2EC4C4] opacity-60" />
                        <div>
                          <p className="text-sm font-medium text-[#f0eef8]">{matter.title}</p>
                          {matter.description && (
                            <p className="text-xs text-[#5c5878] mt-0.5">
                              {truncate(matter.description, 60)}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant="memory">{matter.status}</Badge>
                        <span className="text-xs text-[#5c5878] font-mono">
                          {matter.created_at ? formatDate(matter.created_at) : '—'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ),
              defaultLayout: { x: 6, y: 3, w: 6, h: 6, minW: 3, minH: 4 },
            },
          ]
        : []),

      {
        id: 'maintenance',
        title: 'System Maintenance',
        icon: <Settings2 className="w-3.5 h-3.5" />,
        children: (
          <div className="flex flex-col gap-3">
            <Button
              variant="secondary"
              className="w-full justify-between"
              loading={decaying}
              onClick={handleRunDecay}
            >
              <span>Run Decay Process</span>
            </Button>
            <Button
              variant="secondary"
              className="w-full justify-between"
              loading={consolidating}
              onClick={handleConsolidate}
            >
              <span>Consolidate Memories</span>
            </Button>
            <Button
              variant="secondary"
              className="w-full justify-between"
              loading={cleaning}
              onClick={handleCleanup}
            >
              <span>Cleanup Expired</span>
            </Button>
          </div>
        ),
        defaultLayout: {
          x: matters.length > 0 ? 0 : 6,
          y: matters.length > 0 ? 9 : 3,
          w: 6,
          h: 5,
          minW: 4,
          minH: 5,
        },
      },
    ],
    [
      analytics,
      recentMemories,
      matters,
      activeMattersValue,
      decaying,
      consolidating,
      cleaning,
      handleRunDecay,
      handleConsolidate,
      handleCleanup,
    ],
  );

  if (analyticsLoading) {
    return <LoadingState label="Loading memory overview..." />;
  }

  if (analyticsError) {
    return (
      <ErrorState
        message="Failed to load memory analytics"
        onRetry={() => void mutateAnalytics()}
      />
    );
  }

  return (
    <div className="space-y-8 animate-page-enter">
      <div className="flex items-end justify-between">
        <SectionHeader title="Memory" breadcrumb={['MEMORY', 'OVERVIEW']} />
        <Button type="button" onClick={resetLayout} variant="ghost" size="sm">
          Reset layout
        </Button>
      </div>
      <DraggableGrid items={gridItems} storageKey="engram-memory-grid" rowHeight={50} />
    </div>
  );
}
