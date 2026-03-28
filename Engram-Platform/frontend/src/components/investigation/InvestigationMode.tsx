'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Eye, Focus, X } from 'lucide-react';
import { useCallback, useEffect, useRef } from 'react';
import { cn } from '@/src/lib/utils';
import { useIntelligenceStore } from '@/src/stores/canvasStore';

interface InvestigationModeProps {
  className?: string;
  onEnter?: () => void;
  onExit?: () => void;
}

export function InvestigationMode({ className, onEnter, onExit }: InvestigationModeProps) {
  const {
    investigationMode,
    toggleInvestigationMode,
    pinnedEntities,
    selectedEntities,
    clearSelection,
  } = useIntelligenceStore();

  const prevModeRef = useRef(investigationMode);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (investigationMode && !prevModeRef.current) {
      onEnter?.();
    } else if (!investigationMode && prevModeRef.current) {
      onExit?.();
    }
    prevModeRef.current = investigationMode;
  }, [investigationMode, onEnter, onExit]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && investigationMode) {
        toggleInvestigationMode();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [investigationMode, toggleInvestigationMode]);

  const handleClearAll = useCallback(() => {
    clearSelection();
  }, [clearSelection]);

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <motion.button
        type="button"
        onClick={toggleInvestigationMode}
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-lg transition-all',
          'border font-mono text-xs font-semibold',
          investigationMode
            ? 'bg-[var(--color-intelligence)]/20 border-[var(--color-intelligence)]/40 text-[var(--color-intelligence)]'
            : 'bg-[var(--color-void)] border-white/10 text-[var(--color-neutral)] hover:border-white/20',
        )}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        {investigationMode ? (
          <>
            <Focus className="w-3.5 h-3.5" />
            <span>INVESTIGATING</span>
          </>
        ) : (
          <>
            <Eye className="w-3.5 h-3.5" />
            <span>INVESTIGATE</span>
          </>
        )}
      </motion.button>

      <AnimatePresence>
        {investigationMode && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full mt-2 left-0 right-0 bg-[var(--color-void)] border border-[var(--color-intelligence)]/20 rounded-lg p-3 shadow-xl"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="text-[9px] font-mono font-semibold text-[var(--color-intelligence)] uppercase tracking-wider">
                Active Investigation
              </div>
              <button
                type="button"
                onClick={toggleInvestigationMode}
                className="p-1 text-[var(--color-neutral)] hover:text-[var(--color-text-primary)] transition-colors"
                aria-label="Exit investigation mode"
              >
                <X className="w-3 h-3" />
              </button>
            </div>

            <div className="space-y-2 mb-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--color-text-muted)]">Pinned entities</span>
                <span className="font-mono text-[var(--color-intelligence)]">
                  {pinnedEntities.size}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--color-text-muted)]">Selected entities</span>
                <span className="font-mono text-[var(--color-intelligence)]">
                  {selectedEntities.size}
                </span>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleClearAll}
                disabled={selectedEntities.size === 0}
                className={cn(
                  'flex-1 px-2 py-1.5 text-xs font-mono rounded',
                  'bg-white/5 border border-white/10',
                  'hover:bg-white/10 hover:border-white/20',
                  'disabled:opacity-40 disabled:cursor-not-allowed',
                  'transition-colors',
                )}
              >
                Clear Selection
              </button>
            </div>

            <div className="text-[8px] text-[var(--color-neutral)] mt-3 text-center">
              Press ESC to exit investigation mode
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {investigationMode && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 pointer-events-none z-40"
          >
            <div className="absolute inset-0 bg-[var(--color-intelligence)]/[0] blend-overlay" />
            <div className="absolute inset-0 border-2 border-[var(--color-intelligence)]/20 rounded-lg" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export type { InvestigationModeProps };
