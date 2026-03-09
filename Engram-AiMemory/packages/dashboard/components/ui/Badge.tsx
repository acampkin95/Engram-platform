import { clsx } from "clsx";
import type { MemoryTier } from "@/types";

const TIER_CONFIG: Record<MemoryTier, { label: string; color: string; bg: string }> = {
  1: { label: "Project", color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" },
  2: { label: "General", color: "text-violet-400", bg: "bg-violet-500/10 border-violet-500/20" },
  3: { label: "Global", color: "text-teal-400", bg: "bg-teal-500/10 border-teal-500/20" },
};

interface BadgeProps {
  tier: MemoryTier;
  className?: string;
}

export function Badge({ tier, className }: BadgeProps) {
  const config = TIER_CONFIG[tier];
  return (
    <span
      className={clsx(
        "inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border",
        config.color,
        config.bg,
        className
      )}
    >
      {config.label}
    </span>
  );
}
