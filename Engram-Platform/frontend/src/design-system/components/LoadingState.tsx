import { memo } from 'react';
import { cn } from '@/src/lib/utils';
import { Spinner } from './Spinner';

interface LoadingStateProps {
  variant?: 'spinner' | 'skeleton';
  rows?: number;
  className?: string;
  label?: string;
}

type SkeletonRowProps = Readonly<{
  widthClass?: 'w-full' | 'w-3/4' | 'w-1/2';
}>;

function getSkeletonWidthClass(rowIndex: number): 'w-full' | 'w-3/4' | 'w-1/2' {
  const widthVariant = rowIndex % 3;

  if (widthVariant === 0) {
    return 'w-full';
  }

  if (widthVariant === 1) {
    return 'w-3/4';
  }

  return 'w-1/2';
}

function SkeletonRow({ widthClass = 'w-full' }: SkeletonRowProps) {
  return <div className={cn('h-4 bg-white/[0.04] rounded animate-pulse', widthClass)} />;
}

export const LoadingState = memo(function LoadingState({
  variant = 'spinner',
  rows = 3,
  className,
  label,
}: Readonly<LoadingStateProps>) {
  if (variant === 'skeleton') {
    const skeletonRows = Array.from({ length: rows }, (_, rowIndex) => ({
      id: `skeleton-row-${rowIndex + 1}`,
      widthClass: getSkeletonWidthClass(rowIndex),
    }));

    return (
      <div className={cn('space-y-3 p-4', className)}>
        {skeletonRows.map((row) => (
          <SkeletonRow key={row.id} widthClass={row.widthClass} />
        ))}
      </div>
    );
  }
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-16 gap-4 animate-fade-in',
        className,
      )}
    >
      <div className="relative">
        <div className="absolute inset-0 bg-[#2EC4C4]/20 blur-xl rounded-full" />
        <Spinner size="lg" className="relative z-10 text-[#2EC4C4]" />
      </div>
      {label && (
        <p className="text-xs text-[#a09bb8] font-mono uppercase tracking-widest">{label}</p>
      )}
    </div>
  );
});
