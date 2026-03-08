'use client';

import { Calendar, Clock } from 'lucide-react';
import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { FilterBar, type FilterValues } from '@/src/components/FilterBar';
import { Slider } from '@/src/design-system/components/Slider';
import { Skeleton } from '@/src/components/ui/skeleton';
import { Badge } from '@/src/design-system/components/Badge';
import { Button } from '@/src/design-system/components/Button';
import { Card } from '@/src/design-system/components/Card';
import { EmptyState } from '@/src/design-system/components/EmptyState';
import { SectionHeader } from '@/src/design-system/components/SectionHeader';
import { memoryClient } from '@/src/lib/memory-client';
import { swrKeys } from '@/src/lib/swr-keys';

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(d);
  } catch (_e) {
    return dateStr;
  }
}

export default function TimelineContent() {
  const [filters, setFilters] = useState<FilterValues>({});
  const [timeRange, setTimeRange] = useState([0, 100]); // 0 to 100% of the loaded events timespan

  // SWR key for timeline search
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
      limit: 100,
      ...(filters.dateFrom && { start_date: filters.dateFrom.toISOString() }),
      ...(filters.dateTo && { end_date: filters.dateTo.toISOString() }),
    }),
  );

  const { data: mattersRes } = useSWR(swrKeys.memory.matters(), () => memoryClient.getMatters());

  const matters = mattersRes?.data?.matters ?? [];
  const matterStatusOptions = useMemo(
    () => matters.map((m) => ({ value: m.matter_id, label: m.title })),
    [matters],
  );

  const events = memoriesRes?.data?.results ?? [];

  // Sort events chronologically (newest first for now)
  const sortedEvents = useMemo(() => {
    return [...events].sort((a, b) => {
      // In a real implementation we'd parse temporal_bounds.start_time
      // But for fallback we'll use created_at
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      return dateB - dateA;
    });
  }, [events]);

  return (
    <div className="flex flex-col h-full">
      <SectionHeader title="Timeline" />

      {/* Filter Bar */}
      <div className="mb-4">
        <FilterBar
          showSearch
          showDateRange
          showStatus
          statusOptions={matterStatusOptions}
          onFiltersChange={setFilters}
        />
      </div>

      {/* Time Range Slider */}
      {events.length > 0 && (
        <div className="mb-4 px-1">
          <Slider
            value={timeRange}
            onValueChange={setTimeRange}
            min={0}
            max={100}
            step={1}
          />
          <p className="text-xs text-[#5c5878] mt-1">
            Viewing {timeRange[0]}% to {timeRange[1]}% of events
          </p>
        </div>
      )}

      {/* Events List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : error ? (
          <EmptyState title="Error loading timeline" description={error} icon={<Clock className="w-6 h-6" />} />
        ) : events.length === 0 ? (
          <EmptyState title="No events found" description="Try adjusting your filters." icon={<Calendar className="w-6 h-6" />} />
        ) : (
          <div className="space-y-3">
            {sortedEvents.map((event) => (
              <Card key={event.memory_id} variant="elevated" className="p-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-[rgba(46,196,196,0.1)] rounded-lg">
                    <Clock className="w-4 h-4 text-[#2EC4C4]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <h4 className="text-sm font-semibold text-[#f0eef8] truncate">{event.content}</h4>
                      <span className="text-xs text-[#5c5878] font-mono whitespace-nowrap">
                        {formatDate(event.created_at)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      {event.tags && event.tags.length > 0 && (
                        <div className="flex gap-1">
                          {event.tags.slice(0, 3).map((tag) => (
                            <Badge key={tag} variant="memory">
                              {tag}
                            </Badge>
                          ))}
                          {event.tags.length > 3 && (
                            <span className="text-xs text-[#5c5878]">+{event.tags.length - 3}</span>
                          )}
                        </div>
                      )}
                      <span className="text-xs text-[#5c5878] font-mono ml-auto">
                        Importance: {event.importance.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
