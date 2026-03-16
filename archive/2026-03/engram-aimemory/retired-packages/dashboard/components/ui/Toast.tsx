"use client";

import { clsx } from "clsx";
import { AlertCircle, AlertTriangle, CheckCircle, Info, X } from "lucide-react";
import { createContext, useContext, useEffect, useState } from "react";

// Toast types configuration
const toastConfig = {
  success: {
    icon: CheckCircle,
    className: "border-green-500/50 bg-green-500/10 text-green-400",
    iconClassName: "text-green-400",
  },
  error: {
    icon: AlertCircle,
    className: "border-red-500/50 bg-red-500/10 text-red-400",
    iconClassName: "text-red-400",
  },
  warning: {
    icon: AlertTriangle,
    className: "border-yellow-500/50 bg-yellow-500/10 text-yellow-400",
    iconClassName: "text-yellow-400",
  },
  info: {
    icon: Info,
    className: "border-blue-500/50 bg-blue-500/10 text-blue-400",
    iconClassName: "text-blue-400",
  },
};

export type ToastType = "success" | "error" | "warning" | "info";

interface ToastData {
  id: string;
  title?: string;
  description?: string;
  type: ToastType;
}

interface ToastContextType {
  addToast: (toast: Omit<ToastData, "id">) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function useToastContext() {
  const context = useContext(ToastContext);
  if (!context) {
    // Return no-op functions if not in provider
    return {
      addToast: () => {
        /* no-op: not in provider */
      },
      removeToast: () => {
        /* no-op: not in provider */
      },
    };
  }
  return context;
}

// Toast item component
function ToastItem({ toast, onClose }: { toast: ToastData; onClose: () => void }) {
  const config = toastConfig[toast.type];
  const Icon = config.icon;

  // Auto-dismiss after 5 seconds
  useEffect(() => {
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div
      className={clsx(
        "relative flex items-start gap-3 rounded-lg border p-4 shadow-lg backdrop-blur-sm animate-in slide-in-from-right",
        config.className
      )}
      role="alert"
    >
      <Icon className={clsx("h-5 w-5 mt-0.5 shrink-0", config.iconClassName)} />
      <div className="flex-1 min-w-0">
        {toast.title && <p className="font-medium text-sm text-white">{toast.title}</p>}
        {toast.description && <p className="mt-1 text-sm text-white/70">{toast.description}</p>}
      </div>
      <button
        type="button"
        onClick={onClose}
        className="text-white/50 hover:text-white transition-colors"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

// Toast container component
export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  useEffect(() => {
    // Listen for toast events
    const handleShow = (e: CustomEvent<Omit<ToastData, "id">>) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setToasts((prev) => [...prev, { ...e.detail, id }]);
    };

    const handleHide = (e: CustomEvent<{ id: string }>) => {
      setToasts((prev) => prev.filter((t) => t.id !== e.detail.id));
    };

    window.addEventListener("show-toast" as keyof WindowEventMap, handleShow as EventListener);
    window.addEventListener("hide-toast" as keyof WindowEventMap, handleHide as EventListener);

    return () => {
      window.removeEventListener("show-toast" as keyof WindowEventMap, handleShow as EventListener);
      window.removeEventListener("hide-toast" as keyof WindowEventMap, handleHide as EventListener);
    };
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <ToastItem toast={toast} onClose={() => removeToast(toast.id)} />
        </div>
      ))}
    </div>
  );
}

// Hook for triggering toasts
export function useToast() {
  const showToast = (type: ToastType, title: string, description?: string) => {
    const event = new CustomEvent("show-toast", {
      detail: { title, description, type },
    });
    window.dispatchEvent(event);
  };

  return {
    success: (title: string, description?: string) => showToast("success", title, description),
    error: (title: string, description?: string) => showToast("error", title, description),
    warning: (title: string, description?: string) => showToast("warning", title, description),
    info: (title: string, description?: string) => showToast("info", title, description),
    toast: showToast,
  };
}
