import React, { forwardRef } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { glowHover } from '@/lib/motion';

type CardVariant = 'default' | 'bordered' | 'elevated' | 'interactive';
type CardGlow = 'cyan' | 'acid' | 'volt' | 'fuchsia' | 'ghost' | 'error' | false;

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  glow?: CardGlow;
  /** Disable the whileHover scale animation (e.g. for list containers) */
  noHoverAnim?: boolean;
}

const variantStyles: Record<CardVariant, string> = {
  default: 'bg-surface border border-border',
  bordered: 'bg-surface border border-border-hi',
  elevated: 'bg-surface border border-border shadow-lg',
  interactive: 'bg-surface border border-border hover:border-cyan/30 hover:shadow-cyan/5 cursor-pointer transition-all duration-200',
};

const glowStyles: Record<Exclude<CardGlow, false>, string> = {
  cyan: 'shadow-glow-cyan border-cyan/30',
  acid: 'shadow-glow-acid border-acid/30',
  volt: 'shadow-glow-volt border-volt/30',
  fuchsia: 'shadow-glow-fuchsia border-fuchsia/30',
  ghost: 'shadow-glow-ghost border-ghost/30',
  error: 'shadow-glow-error border-neon-r/30',
};

const CardContext = React.createContext<{ variant: CardVariant }>({ variant: 'default' });

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ variant = 'default', glow = false, noHoverAnim = false, className, children, ...props }, ref) => {
    return (
      <CardContext.Provider value={{ variant }}>
        <motion.div
          ref={ref}
          whileHover={noHoverAnim ? undefined : glowHover}
          className={cn(
            'relative overflow-hidden',
            variantStyles[variant],
            glow && glowStyles[glow],
            className
          )}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          {...(props as any)}
        >
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-cyan to-transparent" />
          {children}
        </motion.div>
      </CardContext.Provider>
    );
  }
);

Card.displayName = 'Card';

type CardHeaderProps = React.HTMLAttributes<HTMLDivElement>;

export const CardHeader = forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'px-6 py-4 border-b border-border',
          'flex items-center justify-between',
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

CardHeader.displayName = 'CardHeader';

type CardBodyProps = React.HTMLAttributes<HTMLDivElement>;

export const CardBody = forwardRef<HTMLDivElement, CardBodyProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('px-6 py-4', className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);

CardBody.displayName = 'CardBody';

type CardFooterProps = React.HTMLAttributes<HTMLDivElement>;

export const CardFooter = forwardRef<HTMLDivElement, CardFooterProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'px-6 py-4 border-t border-border',
          'flex items-center justify-end gap-3',
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

CardFooter.displayName = 'CardFooter';

export type { CardProps, CardVariant, CardGlow, CardHeaderProps, CardBodyProps, CardFooterProps };
