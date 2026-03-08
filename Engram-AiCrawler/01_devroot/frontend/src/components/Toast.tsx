import {
 createContext,
 useContext,
 useState,
 useCallback,
 useEffect,
 useRef,
 type ReactNode,
} from'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X, ExternalLink } from'lucide-react';

type ToastType ='success' |'error' |'warning' |'info';

export interface ToastAction {
 label: string;
 onClick: () => void;
}

interface Toast {
 id: string;
 type: ToastType;
 message: string;
 detail?: string;
 duration: number;
 action?: ToastAction;
}

interface ToastContextValue {
 showToast: (
 type: ToastType,
 message: string,
 options?: { duration?: number; detail?: string; action?: ToastAction }
 ) => string;
 success: (message: string, options?: { duration?: number; action?: ToastAction }) => string;
 error: (message: string, options?: { duration?: number; detail?: string }) => string;
 warning: (message: string, options?: { duration?: number }) => string;
 info: (message: string, options?: { duration?: number; action?: ToastAction }) => string;
 dismiss: (id: string) => void;
}

const DEFAULT_DURATIONS: Record<ToastType, number> = {
 success: 3000,
 error: 0,
 warning: 5000,
 info: 5000,
};

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function useToast(): ToastContextValue {
 const context = useContext(ToastContext);
 if (!context) {
 throw new Error('useToast must be used within ToastProvider');
 }
 return context;
}

interface ToastProviderProps {
 children: ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
 const [toasts, setToasts] = useState<Toast[]>([]);

 const dismiss = useCallback((id: string) => {
 setToasts((prev) => prev.filter((t) => t.id !== id));
 }, []);

 const showToast = useCallback(
 (
 type: ToastType,
 message: string,
 options?: { duration?: number; detail?: string; action?: ToastAction }
 ): string => {
 const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
 const duration =
 options?.duration !== undefined ? options.duration : DEFAULT_DURATIONS[type];

 const toast: Toast = {
 id,
 type,
 message,
 duration,
 detail: options?.detail,
 action: options?.action,
 };

 setToasts((prev) => [...prev, toast]);

 if (duration > 0) {
 setTimeout(() => dismiss(id), duration);
 }

 return id;
 },
 [dismiss]
 );

 const success = useCallback(
 (message: string, options?: { duration?: number; action?: ToastAction }) =>
 showToast('success', message, options),
 [showToast]
 );

 const error = useCallback(
 (message: string, options?: { duration?: number; detail?: string }) =>
 showToast('error', message, options),
 [showToast]
 );

 const warning = useCallback(
 (message: string, options?: { duration?: number }) =>
 showToast('warning', message, options),
 [showToast]
 );

 const info = useCallback(
 (message: string, options?: { duration?: number; action?: ToastAction }) =>
 showToast('info', message, options),
 [showToast]
 );

 const value: ToastContextValue = { showToast, success, error, warning, info, dismiss };

 return (
 <ToastContext.Provider value={value}>
 {children}
 <ToastContainer toasts={toasts} onDismiss={dismiss} />
 </ToastContext.Provider>
 );
}

interface ToastContainerProps {
 toasts: Toast[];
 onDismiss: (id: string) => void;
}

function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
 if (toasts.length === 0) return null;

 return (
 <div
 className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 w-full max-w-sm pointer-events-none"
 aria-live="polite"
 aria-atomic="false"
 >
 {toasts.map((toast) => (
 <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
 ))}
 </div>
 );
}

const ICON_MAP = {
 success: CheckCircle,
 error: XCircle,
 warning: AlertTriangle,
 info: Info,
};

const STYLE_MAP: Record<
 ToastType,
 { wrapper: string; icon: string; progress: string }
> = {
 success: {
 wrapper:'border-l-4 border-plasma bg-surface text-text',
 icon:'text-plasma',
 progress:'bg-plasma',
 },
 error: {
 wrapper:'border-l-4 border-neon-r bg-surface text-text',
 icon:'text-neon-r',
 progress:'bg-neon-r',
 },
 warning: {
 wrapper:'border-l-4 border-volt bg-surface text-text',
 icon:'text-volt',
 progress:'bg-volt',
 },
 info: {
 wrapper:'border-l-4 border-cyan bg-surface text-text',
 icon:'text-cyan',
 progress:'bg-cyan',
 },
};

interface ToastItemProps {
 toast: Toast;
 onDismiss: (id: string) => void;
}

function ToastItem({ toast, onDismiss }: ToastItemProps) {
 const styles = STYLE_MAP[toast.type];
 const Icon = ICON_MAP[toast.type];

 const [elapsed, setElapsed] = useState(0);
 const startRef = useRef(Date.now());
 const frameRef = useRef<number | null>(null);

 useEffect(() => {
 if (toast.duration <= 0) return;

 const tick = () => {
 setElapsed(Date.now() - startRef.current);
 frameRef.current = requestAnimationFrame(tick);
 };
 frameRef.current = requestAnimationFrame(tick);
 return () => {
 if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
 };
 }, [toast.duration]);

 const progressPct =
 toast.duration > 0 ? Math.min(100, (elapsed / toast.duration) * 100) : 0;

 return (
 <div
 className={`pointer-events-auto relative flex flex-col overflow-hidden animate-toast-in ${styles.wrapper}`}
 role="alert"
 >
 <div className="flex items-start gap-3 p-4 pr-10">
 <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${styles.icon}`} aria-hidden="true" />
 <div className="flex-1 min-w-0">
 <p className="text-sm font-medium leading-snug">{toast.message}</p>
 {toast.detail && (
 <p className="mt-1 text-xs text-text-dim line-clamp-2">
 {toast.detail}
 </p>
 )}
 {toast.action && (
 <button
 type="button"
 onClick={() => {
 toast.action?.onClick();
 onDismiss(toast.id);
 }}
 className={`mt-2 inline-flex items-center gap-1 text-xs font-semibold underline underline-offset-2 ${styles.icon} hover:opacity-75 transition-opacity`}
 >
 <ExternalLink className="w-3 h-3" />
 {toast.action.label}
 </button>
 )}
 </div>
 </div>

 <button
 type="button"
 onClick={() => onDismiss(toast.id)}
 className="absolute top-3 right-3 p-1 hover:bg-raised text-text-mute hover:text-text transition-colors"
 aria-label="Dismiss notification"
 >
 <X className="w-4 h-4" />
 </button>

 {toast.duration > 0 && (
 <div className="h-0.5 bg-raised">
 <div
 className={`h-full ${styles.progress}`}
 style={{ width: `${100 - progressPct}%`, transition:'none' }}
 />
 </div>
 )}
 </div>
 );
}
