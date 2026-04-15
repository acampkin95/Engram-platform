'use client';

import { GripVertical, Maximize2, Minimize2 } from 'lucide-react';
import type * as React from 'react';
import { useCallback, useEffect, useState } from 'react';
import type { ResponsiveLayouts } from 'react-grid-layout';

import {
  type Layout,
  type LayoutItem,
  ResponsiveGridLayout,
  useContainerWidth,
} from 'react-grid-layout';
import { cn } from '@/src/lib/utils';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GridItem {
  id: string;
  title?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  defaultLayout?: {
    x: number;
    y: number;
    w: number;
    h: number;
    minW?: number;
    minH?: number;
    maxW?: number;
    maxH?: number;
  };
}

interface DraggableGridProps {
  items: GridItem[];
  storageKey?: string;
  cols?: { lg: number; md: number; sm: number; xs: number; xxs: number };
  rowHeight?: number;
  isDraggable?: boolean;
  isResizable?: boolean;
  onLayoutChange?: (layout: Layout, layouts: ResponsiveLayouts) => void;
  className?: string;
}

// ─── Default layouts ──────────────────────────────────────────────────────────

function buildDefaultLayouts(
  items: GridItem[],
  cols: { lg: number; md: number; sm: number; xs: number; xxs: number },
): ResponsiveLayouts {
  const makeLayout = (colCount: number): Layout =>
    items.map((item, i) => {
      const d = item.defaultLayout ?? { x: 0, y: i * 4, w: 6, h: 4 };
      return {
        i: item.id,
        x: Math.min(d.x, colCount - (d.w ?? 6)),
        y: d.y,
        w: Math.min(d.w ?? 6, colCount),
        h: d.h ?? 4,
        minW: d.minW ?? 2,
        minH: d.minH ?? 2,
        maxW: d.maxW,
        maxH: d.maxH,
      } satisfies LayoutItem;
    });

  return {
    lg: makeLayout(cols.lg),
    md: makeLayout(cols.md),
    sm: makeLayout(cols.sm),
    xs: makeLayout(cols.xs),
    xxs: makeLayout(cols.xxs),
  };
}

// ─── useGridLayout hook ───────────────────────────────────────────────────────

export function useGridLayout(storageKey: string) {
  const resetLayout = useCallback(() => {
    if (globalThis.window !== undefined) {
      localStorage.removeItem(storageKey);
      globalThis.window.location.reload();
    }
  }, [storageKey]);

  return { resetLayout };
}

// ─── DraggableGrid ────────────────────────────────────────────────────────────

export function DraggableGrid({
  items,
  storageKey = 'engram-grid-layout',
  cols = { lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 },
  rowHeight = 60,
  isDraggable = true,
  isResizable = true,
  onLayoutChange,
  className,
}: Readonly<DraggableGridProps>) {
  const { width, containerRef } = useContainerWidth();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const defaultLayouts = buildDefaultLayouts(items, cols);
  const [layouts, setLayouts] = useState<ResponsiveLayouts>(defaultLayouts);
  const [mounted, setMounted] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const hasExpandedWidget = expandedIds.size > 0;

  // Load persisted layout on client
  useEffect(() => {
    setMounted(true);
    if (globalThis.window !== undefined) {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          const parsed = JSON.parse(saved) as ResponsiveLayouts;
          setLayouts(parsed);
        }
      } catch {
        // ignore corrupt storage
      }
    }
  }, [storageKey]);

  const handleLayoutChange = useCallback(
    (layout: Layout, allLayouts: ResponsiveLayouts) => {
      setLayouts(allLayouts);
      if (globalThis.window !== undefined) {
        try {
          localStorage.setItem(storageKey, JSON.stringify(allLayouts));
        } catch {
          // ignore storage errors
        }
      }
      onLayoutChange?.(layout, allLayouts);
    },
    [storageKey, onLayoutChange],
  );

  // Toggle expand/collapse
  const toggleExpand = useCallback((itemId: string) => {
    setExpandedIds((prev) => {
      if (prev.has(itemId)) {
        return new Set();
      }

      return new Set([itemId]);
    });
  }, []);

  if (!mounted) {
    // SSR / first paint: render static grid
    return (
      <div className={cn('grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4', className)}>
        {items.map((item) => (
          <GridCard key={item.id} item={item} isDragging={false} />
        ))}
      </div>
    );
  }

  return (
    <div ref={containerRef} className={cn('w-full', className)}>
      <ResponsiveGridLayout
        className="layout"
        width={width}
        layouts={layouts}
        cols={cols}
        rowHeight={rowHeight}
        dragConfig={{
          enabled: isDraggable && !hasExpandedWidget,
          handle: '.drag-handle',
        }}
        resizeConfig={{
          enabled: isResizable && !hasExpandedWidget,
        }}
        onLayoutChange={handleLayoutChange}
        onDragStart={(_layout, _oldItem, newItem) => setDraggingId(newItem?.i ?? null)}
        onDragStop={() => setDraggingId(null)}
        margin={[12, 12] as const}
        containerPadding={[0, 0] as const}
      >
        {items.map((item) => (
          <div key={item.id}>
            <GridCard
              item={item}
              isDragging={draggingId === item.id}
              isExpanded={expandedIds.has(item.id)}
              onToggleExpand={() => toggleExpand(item.id)}
            />
          </div>
        ))}
      </ResponsiveGridLayout>
    </div>
  );
}

// ─── GridCard ─────────────────────────────────────────────────────────────────

interface GridCardProps {
  item: GridItem;
  isDragging: boolean;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

function GridCard({
  item,
  isDragging,
  isExpanded = false,
  onToggleExpand,
}: Readonly<GridCardProps>) {
  // Use controlled expand state from parent if provided
  const [localExpanded, setLocalExpanded] = useState(false);
  const expanded = onToggleExpand ? isExpanded : localExpanded;
  const setExpanded = onToggleExpand ? () => {} : setLocalExpanded;

  return (
    <>
      {expanded && (
        <button
          type="button"
          aria-label="Close expanded widget"
          className="fixed inset-0 z-50 bg-black/65 backdrop-blur-[1px]"
          onClick={() => (onToggleExpand ? onToggleExpand() : setExpanded(false))}
        />
      )}

      <div
        className={cn(
          'flex flex-col rounded-xl overflow-hidden',
          'bg-[#090818] border border-white/6',
          'transition-all duration-150',
          expanded
            ? 'fixed inset-3 md:inset-8 z-60 shadow-2xl shadow-black/60 border-[rgba(46,196,196,0.25)]'
            : 'h-full',
          isDragging &&
            'opacity-80 shadow-xl shadow-[rgba(242,169,59,0.08)] border-[rgba(242,169,59,0.15)]',
        )}
      >
        {/* Drag handle header */}
        {(item.title ?? item.icon) && (
          <div
            className={cn(
              'drag-handle flex items-center gap-2 px-4 py-2.5 shrink-0',
              'bg-[#0c0b1c] border-b border-white/6',
              expanded ? 'cursor-default' : 'cursor-grab active:cursor-grabbing',
            )}
          >
            <GripVertical className="w-3.5 h-3.5 text-[#3a3850] shrink-0" />
            {item.icon && <span className="text-[#8580a0] shrink-0">{item.icon}</span>}
            {item.title && (
              <span className="text-xs font-semibold text-[#a09bb8] tracking-wide truncate flex-1 font-display">
                {item.title}
              </span>
            )}
            <button
              type="button"
              onMouseDown={(event) => {
                event.stopPropagation();
              }}
              onClick={(event) => {
                event.stopPropagation();
                if (onToggleExpand) {
                  onToggleExpand();
                  return;
                }

                setExpanded((value) => !value);
              }}
              className="ml-auto text-[#3a3850] hover:text-[#8580a0] transition-colors shrink-0"
              aria-label={expanded ? 'Minimize' : 'Maximize'}
            >
              {expanded ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 min-h-0">{item.children}</div>
      </div>
    </>
  );
}
