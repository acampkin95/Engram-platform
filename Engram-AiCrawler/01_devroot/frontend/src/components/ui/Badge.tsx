import React, { forwardRef } from 'react';
import { cn } from '@/lib/utils';

type BadgeVariant =
  | 'default'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'cyan'
  | 'acid'
  | 'volt'
  | 'fuchsia'
  | 'ghost';

type BadgeSize = 'sm' | 'md';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  dot?: boolean;
}

const variantStyles: Record<BadgeVariant, string> = {
  default:  'bg-surface border border-border text-text-dim',
  success:  'bg-acid/10 border border-acid/30 text-acid',
  warning:  'bg-volt/10 border border-volt/30 text-volt',
  danger:   'bg-neon-r/10 border border-neon-r/30 text-neon-r',
  info:     'bg-cyan/10 border border-cyan/30 text-cyan',
  cyan:     'bg-cyan/10 border border-cyan/30 text-cyan',
  acid:     'bg-acid/10 border border-acid/30 text-acid',
  volt:     'bg-volt/10 border border-volt/30 text-volt',
  fuchsia:  'bg-fuchsia/10 border border-fuchsia/30 text-fuchsia',
  ghost:    'bg-ghost/10 border border-ghost/30 text-ghost',
};

const dotStyles: Record<BadgeVariant, string> = {
  default:  'bg-text-dim',
  success:  'bg-acid',
  warning:  'bg-volt',
  danger:   'bg-neon-r',
  info:     'bg-cyan',
  cyan:     'bg-cyan',
  acid:     'bg-acid',
  volt:     'bg-volt',
  fuchsia:  'bg-fuchsia',
  ghost:    'bg-ghost',
};

const sizeStyles: Record<BadgeSize, string> = {
  sm: 'px-1.5 py-0.5 text-[9px]',
  md: 'px-2 py-0.5 text-[10px]',
};

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ variant = 'default', size = 'md', dot = false, className, children, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn(
          'inline-flex items-center gap-1.5',
          'font-mono uppercase tracking-widest',
          'rounded-sm',
          variantStyles[variant],
          sizeStyles[size],
          className,
        )}
        {...props}
      >
        {dot && (
          <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', dotStyles[variant])} />
        )}
        {children}
      </span>
    );
  },
);

Badge.displayName = 'Badge';

export type { BadgeProps, BadgeVariant, BadgeSize };
