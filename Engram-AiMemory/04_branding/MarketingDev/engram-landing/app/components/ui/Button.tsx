import { type ButtonHTMLAttributes, forwardRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-full font-[var(--font-display)] font-semibold transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[var(--void)] disabled:opacity-50 disabled:pointer-events-none',
  {
    variants: {
      variant: {
        primary: 'bg-[var(--engram-amber)] text-[var(--void)] hover:bg-[var(--engram-amber-bright)] focus:ring-[var(--engram-amber)]',
        secondary: 'border border-[var(--border)] hover:bg-[var(--surface-2)] focus:ring-[var(--engram-violet)]',
        ghost: 'hover:bg-[var(--surface-1)] focus:ring-[var(--engram-violet)]',
        violet: 'bg-[var(--engram-violet)] text-[var(--void)] hover:bg-[var(--engram-violet-bright)] focus:ring-[var(--engram-violet)]',
        teal: 'bg-[var(--engram-teal)] text-[var(--void)] hover:bg-[var(--engram-teal-glow)] focus:ring-[var(--engram-teal)]',
      },
      size: {
        sm: 'px-4 py-2 text-sm',
        md: 'px-6 py-3 text-base',
        lg: 'px-8 py-4 text-lg',
        xl: 'px-10 py-5 text-xl',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={buttonVariants({ variant, size, className })}
        ref={ref}
        {...props}
      />
    );
  }
);

Button.displayName = 'Button';

export { Button, buttonVariants };
