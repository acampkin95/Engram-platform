'use client';
import { cva, type VariantProps } from 'class-variance-authority';
import { m } from 'framer-motion';
import { memo } from 'react';
import { cn } from '@/src/lib/utils';

const statusDotVariants = cva('relative w-2 h-2 rounded-full z-10', {
  variants: {
    variant: {
      online: 'bg-[#2EC4C4] text-[#2EC4C4] shadow-[0_0_8px_currentColor]',
      degraded: 'bg-[#F2A93B] text-[#F2A93B] shadow-[0_0_8px_currentColor]',
      offline: 'bg-[#5c5878] text-[#5c5878] shadow-[0_0_8px_currentColor]',
      loading: 'bg-[#9B7DE0] text-[#9B7DE0] shadow-[0_0_8px_currentColor]',
    },
  },
  defaultVariants: {
    variant: 'offline',
  },
});

const statusTextVariants = cva('text-xs font-medium tracking-wide', {
  variants: {
    variant: {
      online: 'text-[#2EC4C4]',
      degraded: 'text-[#F2A93B]',
      offline: 'text-[#5c5878]',
      loading: 'text-[#9B7DE0]',
    },
  },
  defaultVariants: {
    variant: 'offline',
  },
});

export interface StatusDotProps extends VariantProps<typeof statusDotVariants> {
  label?: string;
  className?: string;
}

const pulseColors = {
  online: '#2EC4C4',
  degraded: '#F2A93B',
  offline: '#5c5878',
  loading: '#9B7DE0',
};

export const StatusDot = memo(function StatusDot({
  variant,
  label,
  className,
}: Readonly<StatusDotProps>) {
  const currentVariant = variant || 'offline';
  const shouldPulse = currentVariant === 'online' || currentVariant === 'loading';
  const pulseColor = pulseColors[currentVariant];

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="relative flex h-2 w-2 shrink-0 items-center justify-center">
        {shouldPulse && (
          <m.div
            className="absolute h-4 w-4 rounded-full opacity-40"
            style={{ backgroundColor: pulseColor }}
            animate={{ scale: [1, 1.8, 1], opacity: [0.4, 0, 0.4] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}
        <div className={cn(statusDotVariants({ variant }))} />
      </div>
      {label && <span className={cn(statusTextVariants({ variant }))}>{label}</span>}
    </div>
  );
});
