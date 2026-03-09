"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle, XCircle } from "lucide-react";
import { useEffect, useState } from "react";

interface RestartOverlayProps {
  isOpen: boolean;
  title: string;
  description: string;
  onComplete: () => void;
  onCancel?: () => void;
  duration?: number; // in seconds
  action: "restart" | "stop" | "reboot" | "shutdown";
}

export function RestartOverlay({
  isOpen,
  title,
  description,
  onComplete,
  onCancel,
  duration = 60,
  action,
}: RestartOverlayProps) {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<"in_progress" | "success" | "error">("in_progress");

  useEffect(() => {
    if (!isOpen) {
      setProgress(0);
      setStatus("in_progress");
      return;
    }

    const interval = setInterval(() => {
      setProgress((prev) => {
        const next = prev + 100 / (duration * 10);
        if (next >= 100) {
          clearInterval(interval);
          setStatus("success");
          setTimeout(() => {
            onComplete();
          }, 1000);
          return 100;
        }
        return next;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [isOpen, duration, onComplete]);

  const getActionColor = () => {
    switch (action) {
      case "restart":
        return "from-amber-500 to-violet-500";
      case "stop":
        return "from-rose-500 to-amber-500";
      case "reboot":
        return "from-teal-500 to-violet-500";
      case "shutdown":
        return "from-rose-500 to-rose-700";
      default:
        return "from-amber-500 to-violet-500";
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-[#0d1117] border border-white/[0.08] rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl"
          >
            {/* Status Icon */}
            <div className="flex justify-center mb-6">
              {status === "in_progress" ? (
                <div className="relative">
                  <div className="w-20 h-20 rounded-full border-4 border-white/[0.08]" />
                  <div
                    className="absolute inset-0 rounded-full border-4 border-transparent border-t-current animate-spin"
                    style={{ color: "var(--color-amber, #F2A93B)" }}
                  />
                </div>
              ) : status === "success" ? (
                <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <CheckCircle className="w-10 h-10 text-emerald-400" />
                </div>
              ) : (
                <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center">
                  <XCircle className="w-10 h-10 text-red-400" />
                </div>
              )}
            </div>

            {/* Title */}
            <h2
              className="text-xl font-bold text-center mb-2"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {title}
            </h2>

            {/* Description */}
            <p className="text-sm text-slate-400 text-center mb-6">{description}</p>

            {/* Progress Bar */}
            {status === "in_progress" && (
              <div className="space-y-2">
                <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.1 }}
                    className={`h-full bg-gradient-to-r ${getActionColor()}`}
                  />
                </div>
                <div className="flex justify-between text-xs text-slate-500">
                  <span>Progress</span>
                  <span>{Math.round(progress)}%</span>
                </div>
              </div>
            )}

            {/* Cancel Button */}
            {status === "in_progress" && onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="mt-6 w-full py-2.5 rounded-xl text-sm font-medium bg-white/[0.04] text-slate-400 hover:bg-white/[0.08] border border-white/[0.06] transition-colors"
              >
                Cancel
              </button>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
