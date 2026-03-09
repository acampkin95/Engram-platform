import { clsx } from "clsx";
import { motion } from "framer-motion";
import type { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  glow?: boolean;
  interactive?: boolean;
  delay?: number;
}

export function Card({ children, className, glow, interactive = false, delay = 0 }: CardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay, ease: "easeOut" }}
      whileHover={interactive ? { y: -2, transition: { duration: 0.15 } } : undefined}
      className={clsx(
        "bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)] rounded-xl backdrop-blur-sm",
        "shadow-[0_1px_0_0_rgba(255,255,255,0.04)_inset]",
        "transition-all duration-200",
        glow && "shadow-[0_0_24px_rgba(242,169,59,0.12)]",
        interactive &&
          "hover:border-[rgba(242,169,59,0.15)] hover:shadow-[0_4px_16px_rgba(242,169,59,0.08)]",
        className
      )}
    >
      {children}
    </motion.div>
  );
}

interface CardHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
}

export function CardHeader({ title, subtitle, action, className }: CardHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25, delay: 0.1, ease: "easeOut" }}
      className={clsx("flex items-start justify-between px-5 pt-5 pb-3", className)}
    >
      <div>
        <h3
          className="text-sm font-semibold text-[#F0EEF8]"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {title}
        </h3>
        {subtitle && (
          <p className="text-xs text-[#5C5878] mt-0.5 font-mono tracking-wide">{subtitle}</p>
        )}
      </div>
      {action && <div className="ml-4">{action}</div>}
    </motion.div>
  );
}

interface CardContentProps {
  children: ReactNode;
  className?: string;
}

export function CardContent({ children, className }: CardContentProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2, delay: 0.15 }}
      className={clsx("px-5 pb-5", className)}
    >
      {children}
    </motion.div>
  );
}
