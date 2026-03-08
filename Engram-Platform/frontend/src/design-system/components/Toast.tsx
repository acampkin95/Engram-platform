'use client';
import * as ToastPrimitive from '@radix-ui/react-toast';
import { AlertCircle, CheckCircle, Info, X, XCircle } from 'lucide-react';
import { memo, useEffect, useRef, useState } from 'react';
import { cn } from '@/src/lib/utils';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastProps {
  toast: ToastItem;
  onDismiss: (id: string) => void;
}

const icons = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertCircle,
  info: Info,
};

const styles = {
  success: 'border-[#2EC4C4]/30 text-[#2EC4C4]',
  error: 'border-[#FF6B6B]/30 text-[#FF6B6B]',
  warning: 'border-[#F2A93B]/30 text-[#F2A93B]',
  info: 'border-[#9B7DE0]/30 text-[#9B7DE0]',
};

export const Toast = memo(function Toast({ toast, onDismiss }: Readonly<ToastProps>) {
  const Icon = icons[toast.type];

  return (
    <ToastPrimitive.Root
      open={true}
      onOpenChange={(open) => {
        if (!open) onDismiss(toast.id);
      }}
      duration={toast.duration ?? 4000}
      className={cn(
        'group pointer-events-auto relative flex w-full items-center justify-between space-x-4 overflow-hidden rounded-lg bg-[#0d0d1a] border p-4 pr-8 shadow-lg transition-all',
        'data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-top-full data-[state=open]:sm:slide-in-from-bottom-full',
        styles[toast.type],
      )}
    >
      <div className="flex w-full items-start gap-3">
        <Icon className="w-5 h-5 shrink-0 mt-0.5" />
        <div className="flex flex-col gap-1 w-full">
          <ToastPrimitive.Description className="text-sm font-medium text-[#f0eef8]">
            {toast.message}
          </ToastPrimitive.Description>
        </div>
      </div>
      <ToastPrimitive.Close className="absolute right-2 top-2 rounded-md p-1 text-[#5c5878] opacity-0 transition-opacity hover:text-[#f0eef8] focus:opacity-100 focus:outline-none focus:ring-2 group-hover:opacity-100">
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </ToastPrimitive.Close>
    </ToastPrimitive.Root>
  );
});

let toastListeners: Array<(toast: ToastItem) => void> = [];

export function addToast(toast: Omit<ToastItem, 'id'>) {
  const id = Math.random().toString(36).slice(2);
  toastListeners.forEach((fn) => {
    fn({ ...toast, id });
  });
}

export const ToastContainer = memo(function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timeoutIds = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  useEffect(() => {
    const listener = (toast: ToastItem) => {
      setToasts((prev) => [...prev, toast]);
      if (toast.duration !== 0) {
        const id = setTimeout(
          () => {
            setToasts((prev) => prev.filter((t) => t.id !== toast.id));
            timeoutIds.current.delete(id);
          },
          (toast.duration ?? 4000) + 1000,
        );
        timeoutIds.current.add(id);
      }
    };
    toastListeners.push(listener);
    return () => {
      toastListeners = toastListeners.filter((l) => l !== listener);
      for (const id of timeoutIds.current) {
        clearTimeout(id);
      }
      timeoutIds.current.clear();
    };
  }, []);

  const dismiss = (id: string) => setToasts((prev) => prev.filter((t) => t.id !== id));

  return (
    <ToastPrimitive.Provider swipeDirection="right">
      {toasts.map((t) => (
        <Toast key={t.id} toast={t} onDismiss={dismiss} />
      ))}
      <ToastPrimitive.Viewport className="fixed top-0 z-[100] flex max-h-screen w-full flex-col-reverse p-4 sm:bottom-0 sm:right-0 sm:top-auto sm:flex-col md:max-w-[420px] gap-2 outline-none" />
    </ToastPrimitive.Provider>
  );
});
