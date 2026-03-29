'use client';

import { useVirtualizer } from '@tanstack/react-virtual';
import { Calendar, ChevronDown, ChevronUp, Clock } from 'lucide-react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Badge } from '@/src/design-system/components/Badge';
import { Card } from '@/src/design-system/components/Card';
import { cn } from '@/src/lib/utils';

// ─────────────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────────────

export interface TimelineEvent {
  id: string;
  content: string;
  created_at?: string;
  tags?: string[];
  importance?: number;
  metadata?: Record<string, unknown>;
}

export interface TimelineGroup {
  label: string;
  date: string;
  events: TimelineEvent[];
}

export interface TimelineProps {
  events: TimelineEvent[];
  className?: string;
  onEventClick?: (event: TimelineEvent) => void;
  selectedEventId?: string;
  emptyMessage?: string;
  groupByDay?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────────────

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
  } catch {
    return dateStr;
  }
}

function formatDateHeader(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (d.toDateString() === today.toDateString()) return 'Today';
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';

    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: d.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
    }).format(d);
  } catch {
    return dateStr;
  }
}

function groupEventsByDay(events: TimelineEvent[]): TimelineGroup[] {
  const groups = new Map<string, TimelineEvent[]>();

  for (const event of events) {
    const dateKey = event.created_at ? new Date(event.created_at).toDateString() : 'Unknown Date';

    if (!groups.has(dateKey)) {
      groups.set(dateKey, []);
    }
    groups.get(dateKey)?.push(event);
  }

  return Array.from(groups.entries()).map(([dateKey, groupEvents]) => ({
    label:
      dateKey === 'Unknown Date'
        ? 'Unknown Date'
        : formatDateHeader(groupEvents[0].created_at ?? ''),
    date: dateKey,
    events: groupEvents,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────────────

interface TimelineEventCardProps {
  event: TimelineEvent;
  isSelected: boolean;
  onClick?: () => void;
}

function TimelineEventCard({ event, isSelected, onClick }: TimelineEventCardProps) {
  return (
    <Card
      variant="elevated"
      className={cn(
        'p-4 cursor-pointer transition-all duration-150',
        isSelected
          ? 'border-[var(--color-intelligence)]/60 shadow-[0_0_20px_rgba(0,212,255,0.15)]'
          : 'hover:border-white/20',
      )}
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        <div className="p-2 bg-[rgba(46,196,196,0.1)] rounded-lg shrink-0">
          <Clock className="w-4 h-4 text-[#2EC4C4]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <h4 className="text-sm font-semibold text-foreground truncate">{event.content}</h4>
            <span className="text-xs text-muted font-mono whitespace-nowrap">
              {event.created_at ? formatDate(event.created_at) : '—'}
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
                  <span className="text-xs text-muted">+{event.tags.length - 3}</span>
                )}
              </div>
            )}
            <span className="text-xs text-muted font-mono ml-auto">
              Importance: {typeof event.importance === 'number' ? event.importance.toFixed(2) : '—'}
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}

interface DayGroupHeaderProps {
  label: string;
  count: number;
  isExpanded: boolean;
  onToggle: () => void;
}

function DayGroupHeader({ label, count, isExpanded, onToggle }: DayGroupHeaderProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        'flex items-center gap-2 w-full px-3 py-2 rounded-lg',
        'bg-white/[0.03] hover:bg-white/[0.06] transition-colors',
        'text-left group',
      )}
    >
      <Calendar className="w-3.5 h-3.5 text-[var(--color-intelligence)] shrink-0" />
      <span className="text-xs font-semibold text-[var(--color-text-primary)]">{label}</span>
      <span className="text-[10px] font-mono text-[var(--color-neutral)]">({count})</span>
      <div className="flex-1" />
      {isExpanded ? (
        <ChevronUp className="w-3.5 h-3.5 text-[var(--color-neutral)] group-hover:text-[var(--color-text-primary)] transition-colors" />
      ) : (
        <ChevronDown className="w-3.5 h-3.5 text-[var(--color-neutral)] group-hover:text-[var(--color-text-primary)] transition-colors" />
      )}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────────────
// Flat virtualized list (no grouping)
// ─────────────────────────────────────────────────────────────────────────────────────

interface VirtualizedEventListProps {
  events: TimelineEvent[];
  selectedEventId?: string;
  onEventClick?: (event: TimelineEvent) => void;
  parentRef: React.RefObject<HTMLDivElement | null>;
}

function VirtualizedEventList({
  events,
  selectedEventId,
  onEventClick,
  parentRef,
}: VirtualizedEventListProps) {
  const virtualizer = useVirtualizer({
    count: events.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 100,
    overscan: 5,
  });

  return (
    <div className="relative w-full" style={{ height: `${virtualizer.getTotalSize()}px` }}>
      {virtualizer.getVirtualItems().map((virtualRow) => {
        const event = events[virtualRow.index];
        return (
          <div
            key={event.id}
            className="absolute top-0 left-0 w-full px-1 pb-3"
            style={{
              height: `${virtualRow.size}px`,
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            <TimelineEventCard
              event={event}
              isSelected={selectedEventId === event.id}
              onClick={() => onEventClick?.(event)}
            />
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────────────
// Grouped virtualized list (by day)
// ─────────────────────────────────────────────────────────────────────────────────────

interface VirtualizedGroupedListProps {
  groups: TimelineGroup[];
  selectedEventId?: string;
  onEventClick?: (event: TimelineEvent) => void;
  parentRef: React.RefObject<HTMLDivElement | null>;
}

function VirtualizedGroupedList({
  groups,
  selectedEventId,
  onEventClick,
  parentRef,
}: VirtualizedGroupedListProps) {
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const toggleGroup = useCallback((date: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(date)) {
        next.delete(date);
      } else {
        next.add(date);
      }
      return next;
    });
  }, []);

  const flatItems = useMemo(() => {
    const items: Array<
      | { type: 'header'; group: TimelineGroup }
      | { type: 'event'; event: TimelineGroup['events'][0]; groupDate: string }
    > = [];

    for (const group of groups) {
      items.push({ type: 'header', group });
      if (!collapsedGroups.has(group.date)) {
        for (const event of group.events) {
          items.push({ type: 'event', event, groupDate: group.date });
        }
      }
    }

    return items;
  }, [groups, collapsedGroups]);

  const virtualizer = useVirtualizer({
    count: flatItems.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => {
      const item = flatItems[index];
      return item.type === 'header' ? 44 : 100;
    },
    overscan: 5,
  });

  return (
    <div className="relative w-full" style={{ height: `${virtualizer.getTotalSize()}px` }}>
      {virtualizer.getVirtualItems().map((virtualRow) => {
        const item = flatItems[virtualRow.index];

        if (item.type === 'header') {
          return (
            <div
              key={`header-${item.group.date}`}
              className="absolute top-0 left-0 w-full px-1 pb-2"
              style={{
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <DayGroupHeader
                label={item.group.label}
                count={item.group.events.length}
                isExpanded={!collapsedGroups.has(item.group.date)}
                onToggle={() => toggleGroup(item.group.date)}
              />
            </div>
          );
        }

        return (
          <div
            key={item.event.id}
            className="absolute top-0 left-0 w-full px-1 pb-3"
            style={{
              height: `${virtualRow.size}px`,
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            <TimelineEventCard
              event={item.event}
              isSelected={selectedEventId === item.event.id}
              onClick={() => onEventClick?.(item.event)}
            />
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────────────
// Main Timeline Component
// ─────────────────────────────────────────────────────────────────────────────────────

export function Timeline({
  events,
  className,
  onEventClick,
  selectedEventId,
  emptyMessage = 'No events to display.',
  groupByDay = true,
}: TimelineProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const sortedEvents = useMemo(() => {
    return [...events].sort((a, b) => {
      const dateA = new Date(a.created_at ?? 0).getTime();
      const dateB = new Date(b.created_at ?? 0).getTime();
      return dateB - dateA;
    });
  }, [events]);

  const groups = useMemo(() => {
    if (!groupByDay) return [];
    return groupEventsByDay(sortedEvents);
  }, [sortedEvents, groupByDay]);

  if (sortedEvents.length === 0) {
    return (
      <div className={cn('flex flex-col items-center justify-center py-16', className)}>
        <Calendar className="w-8 h-8 text-[var(--color-neutral)] mb-3" />
        <p className="text-sm text-[var(--color-neutral)]">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div
      ref={parentRef}
      className={cn('h-full overflow-y-auto', className)}
      role="feed"
      aria-label="Timeline events"
    >
      {groupByDay ? (
        <VirtualizedGroupedList
          groups={groups}
          selectedEventId={selectedEventId}
          onEventClick={onEventClick}
          parentRef={parentRef}
        />
      ) : (
        <VirtualizedEventList
          events={sortedEvents}
          selectedEventId={selectedEventId}
          onEventClick={onEventClick}
          parentRef={parentRef}
        />
      )}
    </div>
  );
}
