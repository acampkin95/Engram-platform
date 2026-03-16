"use client";

import { clsx } from "clsx";
import { formatDistanceToNow } from "date-fns";
import { Activity, ArrowUpDown, Brain, Clock, Search, Trash2, TrendingDown } from "lucide-react";
import { useActivityStore } from "@/lib/activity-store";

const activityConfig = {
  memory_added: {
    icon: Brain,
    color: "text-green-400",
    bgColor: "bg-green-500/10",
    borderColor: "border-green-500/20",
  },
  memory_deleted: {
    icon: Trash2,
    color: "text-red-400",
    bgColor: "bg-red-500/10",
    borderColor: "border-red-500/20",
  },
  memory_searched: {
    icon: Search,
    color: "text-blue-400",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/20",
  },
  consolidation_run: {
    icon: ArrowUpDown,
    color: "text-violet-400",
    bgColor: "bg-violet-500/10",
    borderColor: "border-violet-500/20",
  },
  decay_run: {
    icon: TrendingDown,
    color: "text-amber-400",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/20",
  },
  system_health: {
    icon: Activity,
    color: "text-cyan-400",
    bgColor: "bg-cyan-500/10",
    borderColor: "border-cyan-500/20",
  },
  tier_change: {
    icon: ArrowUpDown,
    color: "text-orange-400",
    bgColor: "bg-orange-500/10",
    borderColor: "border-orange-500/20",
  },
};

const tierLabels = {
  1: "Tier 1",
  2: "Tier 2",
  3: "Tier 3",
};

export function ActivityFeed({
  maxItems = 10,
  className,
}: {
  maxItems?: number;
  className?: string;
}) {
  const activities = useActivityStore((state) => state.activities.slice(0, maxItems));

  if (activities.length === 0) {
    return (
      <div
        className={clsx("flex flex-col items-center justify-center py-8 text-center", className)}
      >
        <Clock className="w-8 h-8 text-slate-600 mb-2" />
        <p className="text-sm text-slate-500">No recent activity</p>
        <p className="text-xs text-slate-600 mt-1">
          Activities will appear here as you use the system
        </p>
      </div>
    );
  }

  return (
    <div className={clsx("space-y-2", className)}>
      {activities.map((activity) => {
        const config = activityConfig[activity.type];
        const Icon = config.icon;

        return (
          <div
            key={activity.id}
            className={clsx(
              "flex items-start gap-3 p-3 rounded-lg border transition-colors",
              config.bgColor,
              config.borderColor
            )}
          >
            <Icon className={clsx("w-4 h-4 mt-0.5 shrink-0", config.color)} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className={clsx("text-sm font-medium", config.color)}>{activity.title}</span>
                {activity.tier && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-white/5 text-slate-400">
                    {tierLabels[activity.tier as keyof typeof tierLabels]}
                  </span>
                )}
              </div>
              {activity.description && (
                <p className="text-xs text-slate-400 mt-0.5 truncate">{activity.description}</p>
              )}
            </div>
            <span className="text-xs text-slate-500 shrink-0">
              {formatDistanceToNow(activity.timestamp, { addSuffix: true })}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// Compact version for sidebar or header
export function ActivityIndicator({ className }: { className?: string }) {
  const count = useActivityStore((state) => state.activities.length);

  if (count === 0) return null;

  return (
    <div
      className={clsx(
        "flex items-center gap-1.5 px-2 py-1 rounded-full bg-green-500/10 border border-green-500/20",
        className
      )}
    >
      <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
      <span className="text-xs text-green-400 font-medium">{count} recent</span>
    </div>
  );
}
