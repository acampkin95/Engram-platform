'use client';

import { m } from 'framer-motion';
import { cn } from '@/src/lib/utils';

interface MetricsBarProps {
  label: string;
  value: number;
  max?: number;
  color?: string;
  showLabel?: boolean;
  className?: string;
}

export function MetricsBar({
  label,
  value,
  max = 100,
  color = 'var(--color-teal)',
  showLabel = true,
  className,
}: MetricsBarProps) {
  const percentage = Math.min((value / max) * 100, 100);

  return (
    <div className={cn('space-y-1', className)}>
      {showLabel && (
        <div className="flex justify-between text-xs">
          <span className="text-[var(--color-text-muted)] font-mono">{label}</span>
          <span style={{ color }}>{percentage.toFixed(0)}%</span>
        </div>
      )}
      <div className="h-1.5 bg-[#1e1e3a] rounded-full overflow-hidden">
        <m.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
        />
      </div>
    </div>
  );
}
