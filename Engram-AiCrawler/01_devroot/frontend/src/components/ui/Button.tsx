import React, { forwardRef } from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'link';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: 'bg-cyan text-void hover:bg-acid hover:shadow-glow-acid',
  secondary: 'bg-surface text-text border border-border hover:bg-raised hover:border-border-hi',
  ghost: 'bg-transparent text-cyan border border-cyan hover:bg-cyan/[0.08] hover:shadow-glow-cyan',
  danger: 'bg-transparent text-neon-r border border-neon-r/40 hover:bg-neon-r/[0.08] hover:border-neon-r',
  link: 'bg-transparent text-cyan underline-offset-4 hover:underline hover:text-cyan-dim',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-[10px]',
  md: 'px-5 py-2.5 text-[11px]',
  lg: 'px-7 py-3 text-[12px]',
};

const hoverAnim: Record<ButtonVariant, { scale?: number }> = {
  primary: { scale: 1.02 },
  ghost: { scale: 1.02 },
  secondary: { scale: 1.01 },
  danger: { scale: 1.01 },
  link: {},
};

const tapAnim: Record<ButtonVariant, { scale?: number }> = {
  primary: { scale: 0.97 },
  ghost: { scale: 0.97 },
  secondary: { scale: 0.98 },
  danger: { scale: 0.98 },
  link: { scale: 0.99 },
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      leftIcon,
      rightIcon,
      className,
      disabled,
      children,
      type = 'button',
      ...props
    },
    ref
  ) => {
    return (
      <motion.button
        ref={ref}
        type={type}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        whileHover={disabled || loading ? undefined : hoverAnim[variant]}
        whileTap={disabled || loading ? undefined : tapAnim[variant]}
        transition={{ type: 'spring', stiffness: 400, damping: 20 }}
        className={cn(
          'inline-flex items-center justify-center gap-2',
          'font-mono uppercase tracking-widest',
          'transition-all duration-150',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan',
          'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none',
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        {...(props as any)}
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          leftIcon
        )}
        {children}
        {!loading && rightIcon}
      </motion.button>
    );
  }
);

Button.displayName = 'Button';

export type { ButtonProps, ButtonVariant, ButtonSize };
