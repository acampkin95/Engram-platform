import { clsx } from "clsx";
import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { Card } from "./Card";

interface StatCardProps {
  label: string;
  value: number | string;
  delta?: string;
  deltaPositive?: boolean;
  icon?: ReactNode;
  className?: string;
  accentColor?: string;
  loading?: boolean;
  delay?: number;
}

export function StatCard({
  label,
  value,
  delta,
  deltaPositive,
  icon,
  className,
  accentColor = "#F2A93B",
  loading = false,
  delay = 0,
}: StatCardProps) {
  const showSkeleton = loading || value === "—";

  return (
    <Card
      className={clsx("p-5 relative overflow-hidden group", className)}
      interactive
      delay={delay}
    >
      {/* Animated left accent bar */}
      <motion.div
        className="absolute left-0 top-3 bottom-3 w-0.5 rounded-full origin-left"
        style={{ background: accentColor }}
        initial={{ scaleY: 0.8, opacity: 0.6 }}
        animate={{ scaleY: 1, opacity: 0.9 }}
        whileHover={{ scaleY: 1.15, opacity: 1 }}
        transition={{ duration: 0.2 }}
      />

      {/* Subtle glow on hover */}
      <motion.div
        className="absolute inset-0 rounded-xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{
          background: `radial-gradient(ellipse at top left, ${accentColor}08 0%, transparent 60%)`,
        }}
      />

      <div className="flex items-start justify-between pl-3 relative z-10">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-[#5C5878] uppercase tracking-wider font-mono">{label}</p>

          {showSkeleton ? (
            <div className="mt-2 space-y-2">
              <div className="skeleton h-8 w-20 rounded" />
              {delta && <div className="skeleton h-3 w-14 rounded" />}
            </div>
          ) : (
            <>
              <motion.p
                className="text-3xl font-bold text-[#F0EEF8] mt-1 tabular-nums"
                style={{ fontFamily: "var(--font-display)" }}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: delay + 0.1 }}
              >
                {value}
              </motion.p>
              {delta && (
                <motion.p
                  className={clsx(
                    "text-xs mt-1",
                    deltaPositive ? "text-emerald-400" : "text-rose-400"
                  )}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: delay + 0.15 }}
                >
                  {delta}
                </motion.p>
              )}
            </>
          )}
        </div>

        {icon && (
          <motion.div
            className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ml-3"
            style={{ background: `${accentColor}18`, color: accentColor }}
            whileHover={{ scale: 1.12, rotate: 5 }}
            transition={{ duration: 0.2 }}
          >
            {icon}
          </motion.div>
        )}
      </div>
    </Card>
  );
}
