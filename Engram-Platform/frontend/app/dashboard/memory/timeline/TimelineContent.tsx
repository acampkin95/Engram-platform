'use client';

import { Clock } from 'lucide-react';
import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { FilterBar, type FilterValues } from '@/src/components/FilterBar';
import { Timeline, type TimelineEvent } from '@/src/components/Timeline';
import { Skeleton } from '@/src/components/ui/skeleton';
import { EmptyState } from '@/src/design-system/components/EmptyState';
import { SectionHeader } from '@/src/design-system/components/SectionHeader';
import { Slider } from '@/src/design-system/components/Slider';
import { memoryClient } from '@/src/lib/memory-client';
import { swrKeys } from '@/src/lib/swr-keys';

export default function TimelineContent() {
  const [filters, setFilters] = useState<FilterValues>({});
  const [timeRange, setTimeRange] = useState([0, 100]);
  const [selectedEventId, setSelectedEventId] = useState<string | undefined>();

  const swrKey = swrKeys.memory.memories({
    search: filters.search ?? '',
    matterId: filters.status ?? undefined,
  });

  const {
    data: memoriesRes,
    error,
    isLoading,
  } = useSWR(swrKey, () =>
    memoryClient.searchMemories(filters.search ?? '', {
      project_id: filters.status ?? undefined,
      limit: 500,
      ...(filters.dateFrom && { start_date: filters.dateFrom.toISOString() }),
      ...(filters.dateTo && { end_date: filters.dateTo.toISOString() }),
    }),
  );

  const { data: mattersRes } = useSWR(swrKeys.memory.matters(), () => memoryClient.getMatters());

  const matters = mattersRes?.data?.matters ?? [];
  const matterStatusOptions = useMemo(
    () => matters.map((m) => ({ value: m.matter_id, label: m.title ?? 'Untitled' })),
    [matters],
  );

  const events = memoriesRes?.data?.results ?? [];

  const timelineEvents: TimelineEvent[] = useMemo(
    () =>
      events.map((event) => ({
        id: event.memory_id ?? event.id,
        content: event.content ?? '',
        created_at: event.created_at ?? '',
        tags: event.tags,
        importance: event.importance as number | undefined,
        metadata: event.metadata as Record<string, unknown> | undefined,
      })),
    [events],
  );

  const filteredEvents = useMemo(() => {
    if (timelineEvents.length === 0) return [];
    const start = Math.floor((timeRange[0] / 100) * timelineEvents.length);
    const end = Math.ceil((timeRange[1] / 100) * timelineEvents.length);
    return timelineEvents.slice(start, end);
  }, [timelineEvents, timeRange]);

  return (
    <div className="flex flex-col h-full">
      <SectionHeader title="Timeline" />

      <div className="mb-4">
        <FilterBar
          showSearch
          showDateRange
          showStatus
          statusOptions={matterStatusOptions}
          onFiltersChange={setFilters}
        />
      </div>

      {timelineEvents.length > 0 && (
        <div className="mb-4 px-1">
          <Slider value={timeRange} onValueChange={setTimeRange} min={0} max={100} step={1} />
          <p className="text-xs text-muted mt-1">
            Viewing {timeRange[0]}% to {timeRange[1]}% of events ({filteredEvents.length} items)
          </p>
        </div>
      )}

      <div className="flex-1 min-h-0">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }, (_, index) => `timeline-skeleton-${index}`).map((key) => (
              <Skeleton key={key} className="h-20 w-full" />
            ))}
          </div>
        ) : error ? (
          <EmptyState
            title="Error loading timeline"
            description={error}
            icon={<Clock className="w-6 h-6" />}
          />
        ) : (
          <Timeline
            events={filteredEvents}
            selectedEventId={selectedEventId}
            onEventClick={(event) => setSelectedEventId(event.id)}
            emptyMessage="No events found. Try adjusting your filters."
            groupByDay
          />
        )}
      </div>
    </div>
  );
}
