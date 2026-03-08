import { useEffect, useRef, useCallback } from 'react';
import { AlertTriangle, Info, Loader2, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useReducedMotion, scaleInVariants, easeDefault } from '../lib/motion';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const VARIANT_CONFIG = {
  danger: {
    icon: Trash2,
    iconBg: 'bg-neon-r/20',
    iconColor: 'text-neon-r',
    confirmBtn:
      'bg-neon-r hover:bg-neon-r focus-visible:ring-neon-r text-text',
  },
  warning: {
    icon: AlertTriangle,
    iconBg: 'bg-volt/20',
    iconColor: 'text-volt',
    confirmBtn:
      'bg-volt hover:bg-volt focus-visible:ring-volt text-text',
  },
  info: {
    icon: Info,
    iconBg: 'bg-cyan/20',
    iconColor: 'text-cyan',
    confirmBtn:
      'bg-cyan hover:bg-cyan-dim focus-visible:ring-cyan text-text',
  },
};

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const prefersReduced = useReducedMotion();
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelBtnRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<Element | null>(null);

  useEffect(() => {
    if (open) {
      previousFocusRef.current = document.activeElement;
      requestAnimationFrame(() => cancelBtnRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      if (previousFocusRef.current instanceof HTMLElement) {
        previousFocusRef.current.focus();
      }
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) {
        e.stopPropagation();
        onCancel();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, loading, onCancel]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key !== 'Tab' || !dialogRef.current) return;

      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    },
    [],
  );

  const cfg = VARIANT_CONFIG[variant];
  const Icon = cfg.icon;

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-dialog-title"
          aria-describedby="confirm-dialog-message"
          ref={dialogRef}
          onKeyDown={handleKeyDown}
        >
          <motion.div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={loading ? undefined : onCancel}
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: prefersReduced ? 0 : 0.15 }}
          />

          <motion.div
            className="relative z-10 w-full max-w-sm bg-surface ring-1 ring-black/5"
            variants={prefersReduced ? undefined : scaleInVariants}
            initial={prefersReduced ? undefined : 'hidden'}
            animate={prefersReduced ? undefined : 'visible'}
            exit={prefersReduced ? undefined : 'exit'}
            transition={prefersReduced ? { duration: 0 } : easeDefault}
          >
            <div className="p-6">
              <div className="flex items-start gap-4">
                <div className={`flex-shrink-0 rounded-full p-2 ${cfg.iconBg}`}>
                  <Icon className={`w-5 h-5 ${cfg.iconColor}`} aria-hidden="true" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3
                    id="confirm-dialog-title"
                    className="text-base font-semibold text-text"
                  >
                    {title}
                  </h3>
                  <p
                    id="confirm-dialog-message"
                    className="mt-1 text-sm text-text-dim"
                  >
                    {message}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-3 justify-end px-6 pb-6">
              <button
                ref={cancelBtnRef}
                type="button"
                onClick={onCancel}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-text bg-abyss hover:bg-border disabled:opacity-50 transition-colors"
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={loading}
                className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 transition-colors ${cfg.confirmBtn}`}
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
