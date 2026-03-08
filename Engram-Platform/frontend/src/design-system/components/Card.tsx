import { cva, type VariantProps } from 'class-variance-authority';
import { forwardRef, type HTMLAttributes, memo, type ReactNode } from 'react';
import { cn } from '@/src/lib/utils';

const cardVariants = cva('rounded-xl overflow-hidden transition-all duration-300', {
  variants: {
    variant: {
      default: 'bg-[#0d0d1a] border border-[#1e1e3a]',
      elevated: 'bg-[#141428] border border-[#2a2a50] shadow-lg',
      flat: 'bg-transparent border border-[#1e1e3a]/50',
    },
    hoverable: {
      true: 'hover:border-[#2EC4C4]/30 hover:shadow-[0_0_15px_rgba(46,196,196,0.1)] hover:-translate-y-0.5 cursor-pointer',
    },
    clickable: {
      true: 'focus:outline-none focus:ring-2 focus:ring-[#2EC4C4]/50',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

export interface CardProps
  extends HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {
  header?: ReactNode;
  footer?: ReactNode;
  hoverable?: boolean;
}

export const Card = memo(
  forwardRef<HTMLDivElement, CardProps>(
    ({ className, variant, header, footer, children, hoverable, onClick, ...props }, ref) => {
      if (onClick) {
        return (
          <button
            type="button"
            ref={ref as React.ForwardedRef<HTMLButtonElement>}
            onClick={onClick as unknown as React.MouseEventHandler<HTMLButtonElement>}
            className={cn(
              cardVariants({ variant, hoverable, clickable: true, className }),
              'w-full text-left',
            )}
            {...(props as React.ButtonHTMLAttributes<HTMLButtonElement>)}
          >
            {header && (
              <div className="px-5 py-4 border-b border-[#1e1e3a] bg-black/10">{header}</div>
            )}
            <div className="p-5">{children}</div>
            {footer && (
              <div className="px-5 py-4 border-t border-[#1e1e3a] bg-black/10">{footer}</div>
            )}
          </button>
        );
      }

      return (
        <div
          ref={ref}
          className={cn(cardVariants({ variant, hoverable, clickable: false, className }))}
          {...props}
        >
          {header && (
            <div className="px-5 py-4 border-b border-[#1e1e3a] bg-black/10">{header}</div>
          )}
          <div className="p-5">{children}</div>
          {footer && (
            <div className="px-5 py-4 border-t border-[#1e1e3a] bg-black/10">{footer}</div>
          )}
        </div>
      );
    },
  ),
);
Card.displayName = 'Card';
