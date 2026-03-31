'use client';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { type ButtonHTMLAttributes, forwardRef, memo } from 'react';
import { cn } from '@/src/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-offset-[#03020a] disabled:opacity-50 disabled:cursor-not-allowed',
  {
    variants: {
      variant: {
        primary:
          'bg-[#F2A93B]/10 border border-[#F2A93B]/20 text-[#F2A93B] hover:bg-[#F2A93B]/20 focus:ring-[#F2A93B]',
        secondary:
          'bg-[#141428] border border-[#2a2a50] text-[#a09bb8] hover:border-[#F2A93B]/50 hover:text-[#f0eef8] focus:ring-[#F2A93B]/50',
        ghost: 'text-[#8580a0] hover:text-[#f0eef8] hover:bg-[#141428] focus:ring-[#2a2a50]',
        danger:
          'bg-[#ff2d6b]/10 border border-[#ff2d6b]/20 text-[#ff2d6b] hover:bg-[#ff2d6b]/20 focus:ring-[#ff2d6b]',
        icon: 'bg-transparent text-[#8580a0] hover:text-[#f0eef8] hover:bg-[#141428] focus:ring-[#2a2a50]',
      },
      size: {
        sm: 'px-3 py-1.5 text-xs',
        md: 'px-4 py-2 text-sm',
        lg: 'px-5 py-2.5 text-base',
        icon: 'p-2',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
}

export const Button = memo(
  forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant, size, loading = false, disabled, children, ...props }, ref) => {
      return (
        <button
          ref={ref}
          className={cn(buttonVariants({ variant, size, className }))}
          disabled={disabled || loading}
          {...props}
        >
          {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {children}
        </button>
      );
    },
  ),
);
Button.displayName = 'Button';
