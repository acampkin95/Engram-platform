import { HTMLAttributes, forwardRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

const cardVariants = cva(
  'rounded-2xl border transition-all duration-300',
  {
    variants: {
      variant: {
        default: 'bg-[var(--surface-1)] border-[var(--border)] hover:border-[var(--border-violet)] hover:bg-[var(--engram-violet-glow)]',
        amber: 'bg-[var(--engram-amber-glow)] border-[var(--border-amber)] hover:border-[var(--engram-amber-bright)]',
        violet: 'bg-[var(--engram-violet-glow)] border-[var(--border-violet)] hover:border-[var(--engram-violet-bright)]',
        teal: 'bg-[var(--engram-teal-glow)] border-[var(--engram-teal)]/25 hover:border-[var(--engram-teal)]',
        glass: 'bg-[var(--surface-2)]/50 backdrop-blur-xl border-[var(--border)]/50 hover:bg-[var(--surface-3)]/50',
      },
      padding: {
        none: 'p-0',
        sm: 'p-4',
        md: 'p-6',
        lg: 'p-8',
        xl: 'p-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      padding: 'lg',
    },
  }
);

export interface CardProps
  extends HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, padding, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cardVariants({ variant, padding, className })}
        {...props}
      />
    );
  }
);

Card.displayName = 'Card';

export { Card, cardVariants };
