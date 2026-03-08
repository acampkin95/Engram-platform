import { memo } from 'react';
import { cn } from '@/src/lib/utils';

interface SpinnerProps {
  size?: 'xs' | 'sm' | 'md' | 'lg';
  color?: string;
  className?: string;
}

export const Spinner = memo(function Spinner({
  size = 'md',
  color = 'var(--color-accent-amber)',
  className,
}: SpinnerProps) {
  const sizes = { xs: 'w-3 h-3', sm: 'w-4 h-4', md: 'w-5 h-5', lg: 'w-8 h-8' };
  return (
    <div
      className={cn(
        'animate-spin rounded-full border-2 border-transparent',
        sizes[size],
        className,
      )}
      style={{ borderTopColor: color, borderRightColor: color }}
      role="progressbar"
      aria-label="Loading"
    />
  );
});
