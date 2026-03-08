import React, { forwardRef } from 'react';
import { motion } from 'framer-motion';
import { Info, CheckCircle, AlertTriangle, AlertCircle, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type AlertVariant = 'info' | 'success' | 'warning' | 'danger';

interface AlertProps {
  variant?: AlertVariant;
  title?: string;
  icon?: React.ReactNode;
  onDismiss?: () => void;
  children?: React.ReactNode;
  className?: string;
  id?: string;
  style?: React.CSSProperties;
}

const variantStyles: Record<AlertVariant, string> = {
  info:    'bg-cyan/5 border border-cyan/20 text-cyan',
  success: 'bg-acid/5 border border-acid/20 text-acid',
  warning: 'bg-volt/5 border border-volt/20 text-volt',
  danger:  'bg-neon-r/5 border border-neon-r/20 text-neon-r',
};

const defaultIcons: Record<AlertVariant, React.ReactNode> = {
  info:    <Info className="w-4 h-4" />,
  success: <CheckCircle className="w-4 h-4" />,
  warning: <AlertTriangle className="w-4 h-4" />,
  danger:  <AlertCircle className="w-4 h-4" />,
};

export const Alert = forwardRef<HTMLDivElement, AlertProps>(
  ({ variant = 'info', title, icon, onDismiss, className, children, id, style }, ref) => {
    const resolvedIcon = icon ?? defaultIcons[variant];

    return (
      <motion.div
        ref={ref}
        role="alert"
        id={id}
        style={style}
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className={cn(
          'flex items-start gap-3 p-4 rounded-sm',
          variantStyles[variant],
          className,
        )}
      >
        {/* Icon */}
        <span className="flex-shrink-0 mt-0.5">{resolvedIcon}</span>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {title && (
            <p className="text-[11px] font-mono uppercase tracking-widest mb-1">{title}</p>
          )}
          {children && (
            <div className="text-[12px] font-sans text-text-dim">{children}</div>
          )}
        </div>

        {/* Dismiss */}
        {onDismiss && (
          <button
            type="button"
            aria-label="Dismiss"
            onClick={onDismiss}
            className="ml-auto flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </motion.div>
    );
  },
);

Alert.displayName = 'Alert';

export type { AlertProps, AlertVariant };
