import { HTMLAttributes, forwardRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

const badgeVariants = cva(
  'inline-flex items-center gap-2 rounded-full font-[var(--font-mono)] text-xs font-semibold uppercase tracking-wider transition-all duration-300',
  {
    variants: {
      variant: {
        default: 'bg-[var(--surface-2)] text-[var(--text-secondary)] border border-[var(--border)]',
        amber: 'bg-[var(--engram-amber-glow)] text-[var(--engram-amber)] border border-[var(--border-amber)]',
        violet: 'bg-[var(--engram-violet-glow)] text-[var(--engram-violet)] border border-[var(--border-violet)]',
        teal: 'bg-[var(--engram-teal-glow)] text-[var(--engram-teal)] border border-[var(--engram-teal)]/30',
        rose: 'bg-[var(--engram-rose)]/15 text-[var(--engram-rose)] border border-[var(--engram-rose)]/30',
        outline: 'bg-transparent text-[var(--text-secondary)] border border-[var(--border)]',
      },
      size: {
        sm: 'px-2.5 py-1',
        md: 'px-3 py-1.5',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
);

export interface BadgeProps
  extends HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

const Badge = forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={badgeVariants({ variant, size, className })}
        {...props}
      />
    );
  }
);

Badge.displayName = 'Badge';

export { Badge, badgeVariants };
