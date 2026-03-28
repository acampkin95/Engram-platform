'use client';

import { useVirtualizer } from '@tanstack/react-virtual';
import { Building2, Clock, FileText, Globe, MapPin, Pause, Play, User, Zap } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { cn } from '@/src/lib/utils';
import {
  type EntityType,
  type StatusColor,
  type StreamItem,
  useStreamStore,
} from '@/src/stores/canvasStore';

const entityTypeIcons: Record<EntityType, React.ComponentType<{ className?: string }>> = {
  person: User,
  organization: Building2,
  location: MapPin,
  document: FileText,
  event: Zap,
  artifact: FileText,
  unknown: Globe,
};

const statusColors: Record<StatusColor, string> = {
  intelligence: 'bg-[var(--color-intelligence)]',
  anomaly: 'bg-[var(--color-anomaly)]',
  active: 'bg-[var(--color-active)]',
  success: 'bg-[var(--color-success)]',
  critical: 'bg-[var(--color-critical)]',
  neutral: 'bg-[var(--color-neutral)]',
};

const statusTextColors: Record<StatusColor, string> = {
  intelligence: 'text-[var(--color-intelligence)]',
  anomaly: 'text-[var(--color-anomaly)]',
  active: 'text-[var(--color-active)]',
  success: 'text-[var(--color-success)]',
  critical: 'text-[var(--color-critical)]',
  neutral: 'text-[var(--color-neutral)]',
};

const sourceLabels: Record<StreamItem['source'], string> = {
  crawler: 'CRAWL',
  osint: 'OSINT',
  api: 'API',
  agent: 'AGENT',
};

interface StreamItemCardProps {
  item: StreamItem;
  onClick?: () => void;
  style?: React.CSSProperties;
}

function StreamItemCard({ item, onClick, style }: StreamItemCardProps) {
  const Icon = entityTypeIcons[item.type];
  const statusColor = statusColors[item.status];
  const statusTextColor = statusTextColors[item.status];

  const timeAgo = useCallback((date: Date) => {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
    return `${Math.floor(seconds / 86400)}d`;
  }, []);

  return (
    <div style={style} className="px-1 pb-1.5">
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'w-full text-left p-3 rounded-lg',
          'bg-[var(--color-void)] border border-white/5',
          'hover:border-white/10 hover:bg-[color-mix(in_srgb,var(--color-panel)_50%,transparent)]',
          'transition-colors cursor-pointer',
        )}
      >
        <div className="flex items-start gap-3">
          <div className={cn('w-1.5 h-full min-h-[40px] rounded-full', statusColor)} />

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Icon className={cn('w-3 h-3 shrink-0', statusTextColor)} />
              <span
                className={cn(
                  'text-[9px] font-mono font-semibold tracking-widest',
                  statusTextColor,
                )}
              >
                {sourceLabels[item.source]}
              </span>
              <span className="text-[9px] font-mono text-[var(--color-neutral)]">•</span>
              <span className="text-[9px] font-mono text-[var(--color-neutral)]">
                {timeAgo(item.timestamp)}
              </span>
            </div>

            <div className="text-xs font-medium text-[var(--color-text-primary)] truncate mb-0.5">
              {item.title}
            </div>

            <div className="text-[10px] text-[var(--color-text-muted)] line-clamp-2 leading-relaxed">
              {item.summary}
            </div>

            {Object.keys(item.metadata).length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {Object.entries(item.metadata)
                  .slice(0, 3)
                  .map(([key, value]) => (
                    <span
                      key={key}
                      className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-white/5 text-[var(--color-neutral)]"
                    >
                      {key}: {value}
                    </span>
                  ))}
              </div>
            )}
          </div>
        </div>
      </button>
    </div>
  );
}

interface VirtualizedStreamListProps {
  items: StreamItem[];
  onItemClick?: (item: StreamItem) => void;
  scrollRef: React.RefObject<HTMLDivElement | null>;
}

function VirtualizedStreamList({ items, onItemClick, scrollRef }: VirtualizedStreamListProps) {
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 100,
    overscan: 5,
  });

  const _itemsWithRefs = useMemo(() => {
    return items.map((item) => ({ item, ref: null }));
  }, [items]);

  return (
    <div className="relative w-full" style={{ height: `${virtualizer.getTotalSize()}px` }}>
      {virtualizer.getVirtualItems().map((virtualRow) => {
        const item = items[virtualRow.index];
        return (
          <StreamItemCard
            key={item.id}
            item={item}
            onClick={() => onItemClick?.(item)}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${virtualRow.size}px`,
              transform: `translateY(${virtualRow.start}px)`,
            }}
          />
        );
      })}
    </div>
  );
}

interface CrawlStreamProps {
  className?: string;
  onItemClick?: (item: StreamItem) => void;
  autoScroll?: boolean;
}

export function CrawlStream({ className, onItemClick, autoScroll = true }: CrawlStreamProps) {
  const { items, paused, togglePaused, getFilteredItems } = useStreamStore();
  const filteredItems = getFilteredItems();
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastItemCountRef = useRef(0);

  useEffect(() => {
    if (autoScroll && !paused && scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
    lastItemCountRef.current = filteredItems.length;
  }, [autoScroll, paused, filteredItems.length]);

  const formatTime = useCallback((date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }, []);

  const _virtualizer = useVirtualizer({
    count: filteredItems.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 100,
    overscan: 5,
    enabled: filteredItems.length > 50,
  });

  const showVirtualList = filteredItems.length > 50;

  return (
    <div className={cn('flex flex-col h-full', className)}>
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/5 shrink-0">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              'w-2 h-2 rounded-full',
              paused ? 'bg-[var(--color-neutral)]' : 'bg-[var(--color-success)] animate-pulse',
            )}
          />
          <span className="text-[10px] font-mono font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
            {paused ? 'PAUSED' : 'LIVE'}
          </span>
          <span className="text-[10px] font-mono text-[var(--color-neutral)]">
            ({filteredItems.length})
          </span>
        </div>

        <div className="flex items-center gap-2">
          {showVirtualList && (
            <span className="text-[9px] font-mono text-[var(--color-active)]">VIRTUALIZED</span>
          )}
          <button
            type="button"
            onClick={togglePaused}
            className={cn(
              'p-1.5 rounded-md transition-colors',
              'bg-[var(--color-panel)] border border-white/5',
              'hover:border-white/10',
              paused && 'text-[var(--color-success)]',
              !paused && 'text-[var(--color-neutral)]',
            )}
            aria-label={paused ? 'Resume stream' : 'Pause stream'}
          >
            {paused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
          </button>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-2 min-h-0">
        {filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            <Clock className="w-8 h-8 text-[var(--color-neutral)] mb-3 opacity-50" />
            <div className="text-xs text-[var(--color-neutral)] font-mono">
              {paused ? 'Stream paused' : 'Waiting for data...'}
            </div>
          </div>
        ) : showVirtualList ? (
          <VirtualizedStreamList
            items={filteredItems}
            onItemClick={onItemClick}
            scrollRef={scrollRef}
          />
        ) : (
          <div className="space-y-1.5">
            {filteredItems.map((item) => (
              <StreamItemCard key={item.id} item={item} onClick={() => onItemClick?.(item)} />
            ))}
          </div>
        )}
      </div>

      {items.length > 0 && (
        <div className="px-3 py-2 border-t border-white/5 shrink-0">
          <div className="text-[9px] font-mono text-[var(--color-neutral)] flex items-center justify-between">
            <span>Last: {formatTime(items[0].timestamp)}</span>
            <span>{items.length} items in buffer</span>
          </div>
        </div>
      )}
    </div>
  );
}

export type { StreamItem };
