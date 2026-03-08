'use client';

import { GripVertical, Maximize2, Minimize2, X } from 'lucide-react';
import * as React from 'react';
import { cn } from '@/src/lib/utils';

interface WidgetToolbarProps {
  title?: string;
  icon?: React.ReactNode;
  onToggleExpand?: () => void;
  isExpanded?: boolean;
  onRemove?: () => void;
  className?: string;
}

export function WidgetToolbar({
  title,
  icon,
  onToggleExpand,
  isExpanded = false,
  onRemove,
  className,
}: Readonly<WidgetToolbarProps>) {
  return (
    <div
      className={cn(
        'drag-handle flex items-center gap-2 px-4 py-2.5 shrink-0',
        'bg-[#0c0b1c] border-b border-white/6',
        'cursor-grab active:cursor-grabbing',
        className,
      )}
    >
      <GripVertical className="w-3.5 h-3.5 text-[#3a3850] shrink-0" />
      {icon && <span className="text-[#5c5878] shrink-0">{icon}</span>}
      {title && (
        <span className="text-xs font-semibold text-[#a09bb8] tracking-wide truncate flex-1 font-display">
          {title}
        </span>
      )}
      <div className="ml-auto flex items-center gap-1">
        {onToggleExpand && (
          <button
            type="button"
            onMouseDown={(e) => {
              e.stopPropagation();
            }}
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand();
            }}
            className="p-1 text-[#3a3850] hover:text-[#5c5878] transition-colors rounded hover:bg-white/4"
            aria-label={isExpanded ? 'Minimize' : 'Maximize'}
          >
            {isExpanded ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
          </button>
        )}
        {onRemove && (
          <button
            type="button"
            onMouseDown={(e) => {
              e.stopPropagation();
            }}
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="p-1 text-[#3a3850] hover:text-rose-400 transition-colors rounded hover:bg-white/4"
            aria-label="Remove widget"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
}

// Hook for managing widget visibility state in localStorage
export function useWidgetState(storageKey: string) {
  const [visibleWidgets, setVisibleWidgets] = React.useState<string[]>([]);
  const [expandedWidget, setExpandedWidget] = React.useState<string | null>(null);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    if (globalThis.window !== undefined) {
      try {
        const saved = localStorage.getItem(`${storageKey}-widgets`);
        if (saved) {
          setVisibleWidgets(JSON.parse(saved));
        }
      } catch {
        // ignore corrupt storage
      }
    }
  }, [storageKey]);

  const toggleWidget = React.useCallback(
    (widgetId: string) => {
      setVisibleWidgets((prev) => {
        const next = prev.includes(widgetId)
          ? prev.filter((id) => id !== widgetId)
          : [...prev, widgetId];
        if (globalThis.window !== undefined) {
          localStorage.setItem(`${storageKey}-widgets`, JSON.stringify(next));
        }
        return next;
      });
    },
    [storageKey],
  );

  const toggleExpand = React.useCallback((widgetId: string) => {
    setExpandedWidget((prev) => (prev === widgetId ? null : widgetId));
  }, []);

  return {
    visibleWidgets,
    expandedWidget,
    toggleWidget,
    toggleExpand,
    mounted,
  };
}
