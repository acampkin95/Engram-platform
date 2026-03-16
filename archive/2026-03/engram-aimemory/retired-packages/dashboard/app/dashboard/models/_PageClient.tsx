"use client";

import { clsx } from "clsx";
import { AlertCircle, CheckCircle, Cpu, XCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ServiceInfo {
  status: string;
  memory_mb?: number;
  model?: string;
  models_loaded?: string[];
}

interface DetailedHealth {
  status: string;
  services: Record<string, ServiceInfo>;
  maintenance_queue: {
    scheduler_running: boolean;
    last_run: Record<string, string>;
  };
  resource_usage: {
    total_model_ram_mb: number;
    budget_mb: number;
    headroom_mb: number;
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BUDGET_MB = 3072;

const SERVICE_META: Record<string, { label: string; description: string }> = {
  ollama: {
    label: "Ollama",
    description: "Local LLM inference server",
  },
  embedding_model: {
    label: "Embedding Model",
    description: "Text embedding service",
  },
  reranker: {
    label: "Reranker",
    description: "Cross-encoder reranking model",
  },
};

const KNOWN_SERVICES = ["ollama", "embedding_model", "reranker"];

type StatusVariant = "up" | "down" | "not_configured" | "loaded" | "unknown";

function getStatusVariant(status: string): StatusVariant {
  if (status === "up") return "up";
  if (status === "down") return "down";
  if (status === "not_configured") return "not_configured";
  if (status === "loaded") return "loaded";
  return "unknown";
}

function StatusBadge({ status }: { status: string }) {
  const variant = getStatusVariant(status);

  const styles: Record<StatusVariant, { bg: string; text: string; dot: string; label: string }> = {
    up: {
      bg: "bg-emerald-500/15",
      text: "text-emerald-400",
      dot: "bg-emerald-400",
      label: "Up",
    },
    down: {
      bg: "bg-red-500/15",
      text: "text-red-400",
      dot: "bg-red-400",
      label: "Down",
    },
    not_configured: {
      bg: "bg-slate-500/15",
      text: "text-slate-400",
      dot: "bg-slate-500",
      label: "Not Configured",
    },
    loaded: {
      bg: "bg-indigo-500/15",
      text: "text-indigo-400",
      dot: "bg-indigo-400",
      label: "Loaded",
    },
    unknown: {
      bg: "bg-slate-500/15",
      text: "text-slate-400",
      dot: "bg-slate-500",
      label: status,
    },
  };

  const s = styles[variant];

  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
        s.bg,
        s.text
      )}
    >
      <span className={clsx("w-1.5 h-1.5 rounded-full flex-shrink-0", s.dot)} />
      {s.label}
    </span>
  );
}

function StatusIcon({ status }: { status: string }) {
  const variant = getStatusVariant(status);
  if (variant === "up" || variant === "loaded") {
    return <CheckCircle className="w-5 h-5 text-emerald-400" />;
  }
  if (variant === "down") {
    return <XCircle className="w-5 h-5 text-red-400" />;
  }
  return <AlertCircle className="w-5 h-5 text-slate-500" />;
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function ServiceCardSkeleton() {
  return (
    <div className="bg-white/[0.03] rounded-xl border border-white/[0.08] p-5 space-y-4 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-5 w-32 bg-white/[0.06] rounded" />
        <div className="h-6 w-20 bg-white/[0.06] rounded-full" />
      </div>
      <div className="h-3 w-48 bg-white/[0.04] rounded" />
      <div className="space-y-2">
        <div className="h-3 w-24 bg-white/[0.04] rounded" />
        <div className="h-3 w-36 bg-white/[0.04] rounded" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Service Card
// ---------------------------------------------------------------------------

function ServiceCard({ name, info }: { name: string; info: ServiceInfo }) {
  const meta = SERVICE_META[name] ?? { label: name, description: "" };

  return (
    <div className="bg-white/[0.03] rounded-xl border border-white/[0.08] p-5 space-y-4 hover:border-white/[0.12] transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-indigo-500/10 flex items-center justify-center flex-shrink-0">
            <StatusIcon status={info.status} />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-200">{meta.label}</p>
            <p className="text-xs text-slate-500 mt-0.5">{meta.description}</p>
          </div>
        </div>
        <StatusBadge status={info.status} />
      </div>

      <div className="space-y-2 pt-1 border-t border-white/[0.05]">
        {info.model && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500">Model</span>
            <span className="text-slate-300 font-mono truncate max-w-[160px]">{info.model}</span>
          </div>
        )}
        {info.models_loaded && info.models_loaded.length > 0 && (
          <div className="flex items-start justify-between text-xs gap-2">
            <span className="text-slate-500 flex-shrink-0">Loaded</span>
            <div className="flex flex-wrap gap-1 justify-end">
              {info.models_loaded.map((m) => (
                <span
                  key={m}
                  className="px-1.5 py-0.5 bg-indigo-500/10 text-indigo-300 rounded text-[10px] font-mono"
                >
                  {m}
                </span>
              ))}
            </div>
          </div>
        )}
        {info.memory_mb !== undefined ? (
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500">Memory</span>
            <span className="text-slate-300 font-mono">{info.memory_mb.toFixed(0)} MB</span>
          </div>
        ) : (
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500">Memory</span>
            <span className="text-slate-600">—</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Resource Usage Bar
// ---------------------------------------------------------------------------

function ResourceUsageBar({
  totalMb,
  budgetMb,
  headroomMb,
}: {
  totalMb: number;
  budgetMb: number;
  headroomMb: number;
}) {
  const pct = Math.min((totalMb / budgetMb) * 100, 100);
  const isWarning = pct > 75;
  const isCritical = pct > 90;

  return (
    <div className="bg-white/[0.03] rounded-xl border border-white/[0.08] p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-200">Model RAM Usage</p>
          <p className="text-xs text-slate-500 mt-0.5">Total across all loaded models</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-slate-100 font-mono">
            {totalMb.toFixed(0)}{" "}
            <span className="text-sm font-normal text-slate-500">/ {budgetMb} MB</span>
          </p>
          <p className="text-xs text-slate-500">{headroomMb.toFixed(0)} MB headroom</p>
        </div>
      </div>

      {/* Bar */}
      <div className="relative h-3 bg-white/[0.06] rounded-full overflow-hidden">
        <div
          className={clsx(
            "absolute inset-y-0 left-0 rounded-full transition-all duration-700",
            isCritical
              ? "bg-red-500"
              : isWarning
                ? "bg-amber-500"
                : "bg-gradient-to-r from-indigo-500 to-violet-500"
          )}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>0 MB</span>
        <span
          className={clsx(
            "font-medium",
            isCritical ? "text-red-400" : isWarning ? "text-amber-400" : "text-indigo-400"
          )}
        >
          {pct.toFixed(1)}% used
        </span>
        <span>{budgetMb} MB</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ModelsPage() {
  const [data, setData] = useState<DetailedHealth | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchHealth = useCallback(async () => {
    try {
      const json = await apiClient.get<DetailedHealth>("/health/detailed");
      setData(json);
      setError(null);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch health data");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchHealth();
    const interval = setInterval(() => void fetchHealth(), 10_000);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  const services = data?.services ?? {};
  const resourceUsage = data?.resource_usage ?? {
    total_model_ram_mb: 0,
    budget_mb: BUDGET_MB,
    headroom_mb: BUDGET_MB,
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
              <Cpu className="w-4 h-4 text-indigo-400" />
            </div>
            <h1 className="text-2xl font-bold text-slate-100">AI Model Services</h1>
          </div>
          <p className="text-slate-400 text-sm">Local Ollama model serving status</p>
        </div>

        <div className="flex items-center gap-3">
          {lastUpdated && (
            <p className="text-xs text-slate-600">Updated {lastUpdated.toLocaleTimeString()}</p>
          )}
          <button
            type="button"
            onClick={() => void fetchHealth()}
            disabled={isLoading}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/[0.04] text-slate-400 hover:bg-white/[0.08] border border-white/[0.06] transition-colors disabled:opacity-50"
          >
            {isLoading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>
            {error.includes("Failed to fetch") || error.includes("NetworkError")
              ? `API offline — cannot reach ${API_URL}`
              : error}
          </span>
        </div>
      )}

      {/* Overall Status Banner */}
      {data && (
        <div
          className={clsx(
            "rounded-xl border px-5 py-3 flex items-center gap-3",
            data.status === "healthy"
              ? "border-emerald-500/20 bg-emerald-500/5"
              : data.status === "degraded"
                ? "border-amber-500/20 bg-amber-500/5"
                : "border-red-500/20 bg-red-500/5"
          )}
        >
          <div
            className={clsx(
              "w-2 h-2 rounded-full flex-shrink-0",
              data.status === "healthy"
                ? "bg-emerald-400"
                : data.status === "degraded"
                  ? "bg-amber-400"
                  : "bg-red-400"
            )}
          />
          <p
            className={clsx(
              "text-sm font-medium capitalize",
              data.status === "healthy"
                ? "text-emerald-400"
                : data.status === "degraded"
                  ? "text-amber-400"
                  : "text-red-400"
            )}
          >
            System {data.status}
          </p>
          <p className="text-xs text-slate-500 ml-auto">Auto-refreshes every 10 seconds</p>
        </div>
      )}

      {/* Service Cards Grid */}
      <div>
        <p className="text-xs text-slate-600 uppercase tracking-widest font-semibold mb-3">
          Services
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {isLoading && !data
            ? KNOWN_SERVICES.map((s) => <ServiceCardSkeleton key={s} />)
            : KNOWN_SERVICES.map((key) => {
                const info = services[key] ?? { status: "not_configured" };
                return <ServiceCard key={key} name={key} info={info} />;
              })}
        </div>
      </div>

      {/* Resource Usage */}
      <div>
        <p className="text-xs text-slate-600 uppercase tracking-widest font-semibold mb-3">
          Resource Usage
        </p>
        {isLoading && !data ? (
          <div className="bg-white/[0.03] rounded-xl border border-white/[0.08] p-5 animate-pulse space-y-4">
            <div className="flex justify-between">
              <div className="h-5 w-40 bg-white/[0.06] rounded" />
              <div className="h-5 w-32 bg-white/[0.06] rounded" />
            </div>
            <div className="h-3 bg-white/[0.06] rounded-full" />
          </div>
        ) : (
          <ResourceUsageBar
            totalMb={resourceUsage.total_model_ram_mb}
            budgetMb={resourceUsage.budget_mb || BUDGET_MB}
            headroomMb={resourceUsage.headroom_mb}
          />
        )}
      </div>
    </div>
  );
}
