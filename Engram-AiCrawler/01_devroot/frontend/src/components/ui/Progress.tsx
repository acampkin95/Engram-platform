import React, { forwardRef } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

type ProgressVariant = 'default' | 'cyan' | 'success' | 'acid' | 'warning' | 'volt' | 'danger';
type ProgressSize = 'sm' | 'md' | 'lg';

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number;
  max?: number;
  variant?: ProgressVariant;
  size?: ProgressSize;
  label?: string;
  showValue?: boolean;
  animated?: boolean;
}

const fillStyles: Record<ProgressVariant, string> = {
  default: 'bg-gradient-to-r from-cyan/60 to-cyan',
  cyan:    'bg-gradient-to-r from-cyan/60 to-cyan',
  success: 'bg-gradient-to-r from-acid/60 to-acid',
  acid:    'bg-gradient-to-r from-acid/60 to-acid',
  warning: 'bg-gradient-to-r from-volt/60 to-volt',
  volt:    'bg-gradient-to-r from-volt/60 to-volt',
  danger:  'bg-gradient-to-r from-neon-r/60 to-neon-r',
};

const sizeStyles: Record<ProgressSize, string> = {
  sm: 'h-1',
  md: 'h-1.5',
  lg: 'h-2',
};

export const Progress = forwardRef<HTMLDivElement, ProgressProps>(
  (
    {
      value,
      max = 100,
      variant = 'default',
      size = 'md',
      label,
      showValue = false,
      animated = false,
      className,
      ...props
    },
    ref,
  ) => {
    const clamped = Math.min(Math.max(0, value), max);
    const pct = (clamped / max) * 100;

    return (
      <div ref={ref} className={cn('w-full', className)} {...props}>
        {(label !== undefined || showValue) && (
          <div className="flex items-center justify-between mb-1">
            {label && (
              <span className="text-[10px] font-mono text-text-dim uppercase tracking-widest">
                {label}
              </span>
            )}
            {showValue && (
              <span className="text-[10px] font-mono text-text-dim ml-auto">
                {Math.round(pct)}%
              </span>
            )}
          </div>
        )}
        <div
          role="progressbar"
          aria-valuenow={clamped}
          aria-valuemin={0}
          aria-valuemax={max}
          className={cn('w-full bg-raised rounded-full overflow-hidden', sizeStyles[size])}
        >
          <motion.div
            className={cn(
              'h-full rounded-full',
              fillStyles[variant],
              animated && 'animate-shimmer',
            )}
            initial={{ width: '0%' }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>
      </div>
    );
  },
);

Progress.displayName = 'Progress';

export type { ProgressProps, ProgressVariant, ProgressSize };
