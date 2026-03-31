import { cva, type VariantProps } from 'class-variance-authority';
import { memo, type ReactNode } from 'react';
import { cn } from '@/src/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border transition-colors',
  {
    variants: {
      variant: {
        success: 'bg-[#2EC4C4]/10 text-[#2EC4C4] border-[#2EC4C4]/20',
        warning: 'bg-[#F2A93B]/10 text-[#F2A93B] border-[#F2A93B]/20',
        error: 'bg-[#FF6B6B]/10 text-[#FF6B6B] border-[#FF6B6B]/20',
        info: 'bg-[#9B7DE0]/10 text-[#9B7DE0] border-[#9B7DE0]/20',
        neutral: 'bg-white/5 text-[#a09bb8] border-white/10',
        crawler: 'bg-[#9B7DE0]/10 text-[#9B7DE0] border-[#9B7DE0]/20',
        memory: 'bg-[#2EC4C4]/10 text-[#2EC4C4] border-[#2EC4C4]/20',
      },
    },
    defaultVariants: {
      variant: 'neutral',
    },
  },
);

const dotColors = {
  success: 'bg-[#2EC4C4]',
  warning: 'bg-[#F2A93B]',
  error: 'bg-[#FF6B6B]',
  info: 'bg-[#9B7DE0]',
  neutral: 'bg-[#8580a0]',
  crawler: 'bg-[#9B7DE0]',
  memory: 'bg-[#2EC4C4]',
};

const dotPingColors = {
  success: 'bg-[#2EC4C4]/50',
  warning: 'bg-[#F2A93B]/50',
  error: 'bg-[#FF6B6B]/50',
  info: 'bg-[#9B7DE0]/50',
  neutral: 'bg-[#8580a0]/50',
  crawler: 'bg-[#9B7DE0]/50',
  memory: 'bg-[#2EC4C4]/50',
};

export interface BadgeProps extends VariantProps<typeof badgeVariants> {
  dot?: boolean;
  children: ReactNode;
  className?: string;
}

export const Badge = memo(function Badge({
  variant = 'neutral',
  dot = false,
  children,
  className,
}: Readonly<BadgeProps>) {
  const currentVariant = variant ?? 'neutral';
  const shouldPulse =
    currentVariant === 'success' ||
    currentVariant === 'warning' ||
    currentVariant === 'crawler' ||
    currentVariant === 'memory';

  return (
    <span className={cn(badgeVariants({ variant: currentVariant, className }))}>
      {dot && (
        <span className="relative flex h-1.5 w-1.5 shrink-0">
          {shouldPulse && (
            <span
              data-testid="badge-dot-ping"
              className={cn(
                'absolute inline-flex h-full w-full animate-ping rounded-full',
                dotPingColors[currentVariant],
              )}
            />
          )}
          <span
            data-testid="badge-dot"
            className={cn(
              'relative inline-flex h-1.5 w-1.5 rounded-full',
              dotColors[currentVariant],
            )}
          />
        </span>
      )}
      {children}
    </span>
  );
});
