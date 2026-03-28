'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { GripVertical, Maximize2, Minimize2, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/src/lib/utils';
import { type CanvasPanel, useCanvasStore } from '@/src/stores/canvasStore';

interface CanvasProps {
  panelContent: Record<CanvasPanel['type'], React.ReactNode>;
  className?: string;
}

const defaultPanels: Omit<CanvasPanel, 'id'>[] = [
  { type: 'graph', x: 0, y: 0, width: 8, height: 6, minWidth: 4, minHeight: 3 },
  { type: 'stream', x: 8, y: 0, width: 4, height: 6, minWidth: 3, minHeight: 3 },
  { type: 'inspector', x: 0, y: 6, width: 4, height: 4, minWidth: 3, minHeight: 2 },
  { type: 'agent-console', x: 4, y: 6, width: 8, height: 4, minWidth: 4, minHeight: 2 },
];

export function Canvas({ panelContent, className }: CanvasProps) {
  const { panels, addPanel, removePanel, movePanel, resetLayout } = useCanvasStore();
  const [expandedPanelId, setExpandedPanelId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const dragStartRef = useRef<{
    x: number;
    y: number;
    panelX: number;
    panelY: number;
  } | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && panels.length === 0) {
      for (const panel of defaultPanels) {
        addPanel(panel);
      }
    }
  }, [mounted, panels.length, addPanel]);

  const handleToggleExpand = useCallback((panelId: string) => {
    setExpandedPanelId((current) => (current === panelId ? null : panelId));
  }, []);

  const handleRemovePanel = useCallback(
    (panelId: string) => {
      removePanel(panelId);
      if (expandedPanelId === panelId) {
        setExpandedPanelId(null);
      }
    },
    [removePanel, expandedPanelId],
  );

  const handleDragStart = useCallback(
    (panelId: string, e: React.MouseEvent) => {
      const panel = panels.find((p) => p.id === panelId);
      if (!panel) return;
      e.preventDefault();
      setDraggingId(panelId);
      dragStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        panelX: panel.x,
        panelY: panel.y,
      };
    },
    [panels],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!draggingId || !dragStartRef.current) return;
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      const gridCellX = Math.round(dx / 80);
      const gridCellY = Math.round(dy / 60);
      const newX = Math.max(0, Math.min(12 - 1, dragStartRef.current.panelX + gridCellX));
      const newY = Math.max(0, Math.min(10 - 1, dragStartRef.current.panelY + gridCellY));
      if (newX !== dragStartRef.current.panelX || newY !== dragStartRef.current.panelY) {
        movePanel(draggingId, newX, newY);
        dragStartRef.current.panelX = newX;
        dragStartRef.current.panelY = newY;
      }
    },
    [draggingId, movePanel],
  );

  const handleMouseUp = useCallback(() => {
    setDraggingId(null);
    dragStartRef.current = null;
  }, []);

  if (!mounted) {
    return (
      <div className={cn('flex items-center justify-center h-full', className)}>
        <div className="text-[var(--color-neutral)] text-sm font-mono animate-pulse">
          Initializing workspace...
        </div>
      </div>
    );
  }

  const expandedPanel = expandedPanelId ? panels.find((p) => p.id === expandedPanelId) : null;

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: container captures mouse events for panel drag
    <div
      className={cn('relative h-full w-full overflow-hidden', className)}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <AnimatePresence>
        {expandedPanel && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
            onClick={() => setExpandedPanelId(null)}
          />
        )}
      </AnimatePresence>

      <div className="grid grid-cols-12 grid-rows-10 gap-1 h-full p-1">
        {panels.map((panel) => (
          <CanvasPanelComponent
            key={panel.id}
            panel={panel}
            isExpanded={expandedPanelId === panel.id}
            isDragging={draggingId === panel.id}
            onToggleExpand={() => handleToggleExpand(panel.id)}
            onRemove={() => handleRemovePanel(panel.id)}
            onDragStart={(e) => handleDragStart(panel.id, e)}
            content={panelContent[panel.type]}
          />
        ))}
      </div>

      <AnimatePresence>
        {expandedPanel && (
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-4 z-50"
          >
            <CanvasPanelComponent
              panel={expandedPanel}
              isExpanded={true}
              isDragging={false}
              onToggleExpand={() => setExpandedPanelId(null)}
              onRemove={() => handleRemovePanel(expandedPanel.id)}
              onDragStart={() => {}}
              content={panelContent[expandedPanel.type]}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="absolute bottom-4 right-4 flex gap-2">
        <button
          type="button"
          onClick={resetLayout}
          className={cn(
            'px-3 py-1.5 text-xs font-mono rounded',
            'bg-[var(--color-panel)] border border-white/10',
            'text-[var(--color-neutral)]',
            'hover:border-[var(--color-intelligence)]/30 hover:text-[var(--color-intelligence)]',
            'transition-colors',
          )}
        >
          Reset Layout
        </button>
      </div>
    </div>
  );
}

interface CanvasPanelComponentProps {
  panel: CanvasPanel;
  isExpanded: boolean;
  isDragging: boolean;
  onToggleExpand: () => void;
  onRemove: () => void;
  onDragStart: (e: React.MouseEvent) => void;
  content: React.ReactNode;
}

const panelTypeColors: Record<CanvasPanel['type'], string> = {
  graph: 'var(--color-intelligence)',
  stream: 'var(--color-active)',
  timeline: 'var(--color-anomaly)',
  inspector: 'var(--color-success)',
  'agent-console': 'var(--color-anomaly)',
  custom: 'var(--color-neutral)',
};

const panelTypeLabels: Record<CanvasPanel['type'], string> = {
  graph: 'ENTITY GRAPH',
  stream: 'CRAWL STREAM',
  timeline: 'TIMELINE',
  inspector: 'INSPECTOR',
  'agent-console': 'AGENTS',
  custom: 'CUSTOM',
};

function CanvasPanelComponent({
  panel,
  isExpanded,
  isDragging,
  onToggleExpand,
  onRemove,
  onDragStart,
  content,
}: CanvasPanelComponentProps) {
  const accentColor = panelTypeColors[panel.type];
  const label = panelTypeLabels[panel.type];

  const gridStyle = isExpanded
    ? {}
    : {
        gridColumn: `${panel.x + 1} / span ${panel.width}`,
        gridRow: `${panel.y + 1} / span ${panel.height}`,
      };

  return (
    <motion.div
      layout
      className={cn(
        'flex flex-col rounded-lg overflow-hidden',
        'bg-[var(--color-void)] border',
        'transition-all duration-200',
        isExpanded ? 'h-full w-full' : 'min-h-0',
        isDragging && 'opacity-50',
      )}
      style={{
        borderColor: isExpanded
          ? `color-mix(in srgb, ${accentColor} 60%, transparent)`
          : `color-mix(in srgb, ${accentColor} 20%, transparent)`,
        boxShadow: isExpanded
          ? `0 0 40px color-mix(in srgb, ${accentColor} 15%, transparent), 0 0 80px color-mix(in srgb, ${accentColor} 5%, transparent)`
          : 'none',
        ...gridStyle,
      }}
    >
      <div
        className={cn(
          'flex items-center gap-2 px-3 py-2 shrink-0',
          'bg-[color-mix(in_srgb,_var(--color-panel)_80%,_transparent)]',
          'border-b',
        )}
        style={{
          borderColor: `color-mix(in srgb, ${accentColor} 15%, transparent)`,
        }}
      >
        <button
          type="button"
          className="shrink-0 cursor-grab active:cursor-grabbing p-0 border-0 bg-transparent"
          onMouseDown={onDragStart}
          aria-label="Drag panel"
        >
          <GripVertical className="w-3 h-3 text-[var(--color-neutral)]" />
        </button>
        <div
          className="text-[10px] font-mono font-semibold tracking-widest uppercase"
          style={{ color: accentColor }}
        >
          {label}
        </div>

        <div className="flex-1" />

        <button
          type="button"
          onClick={onToggleExpand}
          className="p-1 text-[var(--color-neutral)] hover:text-[var(--color-text-primary)] transition-colors"
          aria-label={isExpanded ? 'Minimize' : 'Maximize'}
        >
          {isExpanded ? (
            <Minimize2 className="w-3.5 h-3.5" />
          ) : (
            <Maximize2 className="w-3.5 h-3.5" />
          )}
        </button>

        <button
          type="button"
          onClick={onRemove}
          className="p-1 text-[var(--color-neutral)] hover:text-[var(--color-critical)] transition-colors"
          aria-label="Close panel"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-auto min-h-0">{content}</div>
    </motion.div>
  );
}
