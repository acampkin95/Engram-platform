import React, { forwardRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  size?: ModalSize;
  children?: React.ReactNode;
  className?: string;
}

const sizeStyles: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
};

export function Modal({
  open,
  onClose,
  title,
  description,
  size = 'md',
  children,
  className,
}: ModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Overlay */}
          <motion.div
            key="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 bg-void/80 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Panel */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              key="modal-panel"
              role="dialog"
              aria-modal="true"
              aria-labelledby={title ? 'modal-title' : undefined}
              aria-describedby={description ? 'modal-description' : undefined}
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className={cn(
                'relative w-full pointer-events-auto',
                'bg-surface border border-border shadow-lg overflow-hidden',
                sizeStyles[size],
                className,
              )}
            >
              {/* Top accent line (matches Card.tsx) */}
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-cyan to-transparent" />

              {/* Header */}
              {(title || description) && (
                <ModalHeader>
                  <div className="flex-1 min-w-0">
                    {title && (
                      <h2
                        id="modal-title"
                        className="text-[13px] font-mono uppercase tracking-widest text-text"
                      >
                        {title}
                      </h2>
                    )}
                    {description && (
                      <p id="modal-description" className="text-[12px] font-sans text-text-dim mt-1">
                        {description}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    aria-label="Close"
                    onClick={onClose}
                    className="ml-4 flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity"
                  >
                    <X className="w-4 h-4 text-text-dim" />
                  </button>
                </ModalHeader>
              )}

              {/* Body */}
              {children}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface ModalHeaderProps extends React.HTMLAttributes<HTMLDivElement> {}

export const ModalHeader = forwardRef<HTMLDivElement, ModalHeaderProps>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'flex items-start justify-between p-6 border-b border-border',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  ),
);

ModalHeader.displayName = 'ModalHeader';

interface ModalBodyProps extends React.HTMLAttributes<HTMLDivElement> {}

export const ModalBody = forwardRef<HTMLDivElement, ModalBodyProps>(
  ({ className, children, ...props }, ref) => (
    <div ref={ref} className={cn('p-6', className)} {...props}>
      {children}
    </div>
  ),
);

ModalBody.displayName = 'ModalBody';

interface ModalFooterProps extends React.HTMLAttributes<HTMLDivElement> {}

export const ModalFooter = forwardRef<HTMLDivElement, ModalFooterProps>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'flex items-center justify-end gap-3 px-6 py-4 border-t border-border',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  ),
);

ModalFooter.displayName = 'ModalFooter';

export type { ModalProps, ModalSize, ModalHeaderProps, ModalBodyProps, ModalFooterProps };
