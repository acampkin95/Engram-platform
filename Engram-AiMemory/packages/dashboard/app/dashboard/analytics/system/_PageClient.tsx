"use client";

import { clsx } from "clsx";
import { CheckCircle, Clock, Power, PowerOff, RefreshCw, RotateCcw, XCircle } from "lucide-react";
import { useState } from "react";
import { SystemGaugeChart } from "@/components/charts";
import { Card, CardContent, CardHeader } from "@/components/ui";
import { LogTable } from "@/components/ui/LogTable";
import { RestartOverlay } from "@/components/ui/RestartOverlay";
import { useSystemMetrics } from "@/hooks/useAnalytics";
import { useHealth } from "@/hooks/useHealth";
import { useSystemLogs } from "@/hooks/useSystemLogs";

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      {ok ? (
        <CheckCircle className="w-4 h-4 text-emerald-400" />
      ) : (
        <XCircle className="w-4 h-4 text-rose-400" />
      )}
      <span className={clsx("text-sm", ok ? "text-emerald-400" : "text-rose-400")}>{label}</span>
    </div>
  );
}

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

// System control button
function SystemControlButton({
  icon: Icon,
  label,
  description,
  variant = "default",
  onClick,
  disabled,
}: {
  icon: typeof RefreshCw;
  label: string;
  description: string;
  variant?: "default" | "warning" | "danger";
  onClick: () => void;
  disabled?: boolean;
}) {
  const variantStyles = {
    default: "bg-white/[0.04] hover:bg-white/[0.08] border-white/[0.08] text-slate-300",
    warning: "bg-amber-500/10 hover:bg-amber-500/15 border-amber-500/20 text-amber-400",
    danger: "bg-rose-500/10 hover:bg-rose-500/15 border-rose-500/20 text-rose-400",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        "flex items-center gap-3 p-4 rounded-xl border transition-all text-left",
        variantStyles[variant],
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      <div
        className={clsx(
          "w-10 h-10 rounded-lg flex items-center justify-center",
          variant === "default" && "bg-indigo-500/10",
          variant === "warning" && "bg-amber-500/10",
          variant === "danger" && "bg-rose-500/10"
        )}
      >
        <Icon
          className={clsx(
            "w-5 h-5",
            variant === "default" && "text-indigo-400",
            variant === "warning" && "text-amber-400",
            variant === "danger" && "text-rose-400"
          )}
        />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-slate-500 truncate">{description}</p>
      </div>
    </button>
  );
}

export default function SystemAnalyticsPage() {
  const { data: metrics, isLoading } = useSystemMetrics();
  const { data: health } = useHealth();
  const { data: logs } = useSystemLogs(50);

  // System control state
  const [restartOverlay, setRestartOverlay] = useState<{
    open: boolean;
    action: "restart" | "stop" | "reboot" | "shutdown";
  }>({ open: false, action: "restart" });

  const handleRestartServices = () => {
    setRestartOverlay({ open: true, action: "restart" });
  };

  const handleStopServices = () => {
    setRestartOverlay({ open: true, action: "stop" });
  };

  const handleRestartServer = () => {
    setRestartOverlay({ open: true, action: "reboot" });
  };

  const handleShutdown = () => {
    setRestartOverlay({ open: true, action: "shutdown" });
  };

  const getOverlayConfig = () => {
    switch (restartOverlay.action) {
      case "restart":
        return {
          title: "Restarting Services",
          description: "Please wait while we restart the memory services...",
          duration: 60,
        };
      case "stop":
        return {
          title: "Stopping Services",
          description: "Please wait while we stop the memory services...",
          duration: 30,
        };
      case "reboot":
        return {
          title: "Restarting Server",
          description: "The server will reboot. This may take a few minutes...",
          duration: 60,
        };
      case "shutdown":
        return {
          title: "Shutting Down",
          description: "The server is being shut down. This cannot be undone.",
          duration: 30,
        };
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-200">System Health</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Real-time infrastructure metrics and connection status
        </p>
      </div>

      {/* Connection Status */}
      <Card>
        <CardHeader title="Service Status" />
        <CardContent>
          <div className="grid grid-cols-3 gap-6">
            <StatusBadge ok={health?.weaviate ?? false} label="Weaviate Vector DB" />
            <StatusBadge ok={health?.redis ?? false} label="Redis Cache" />
            <StatusBadge ok={health?.initialized ?? false} label="Memory System" />
          </div>
        </CardContent>
      </Card>

      {/* System Controls */}
      <Card>
        <CardHeader title="System Controls" subtitle="Manage services and server" />
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <SystemControlButton
              icon={RefreshCw}
              label="Restart Services"
              description="Restart API, MCP, and dashboard"
              onClick={handleRestartServices}
            />
            <SystemControlButton
              icon={PowerOff}
              label="Stop Services"
              description="Stop all running services"
              variant="warning"
              onClick={handleStopServices}
            />
            <SystemControlButton
              icon={RotateCcw}
              label="Restart Server"
              description="Reboot the entire server"
              onClick={handleRestartServer}
            />
            <SystemControlButton
              icon={Power}
              label="Shutdown Server"
              description="Power off the server"
              variant="danger"
              onClick={handleShutdown}
            />
          </div>
        </CardContent>
      </Card>

      {/* Gauge Row */}
      <div className="grid grid-cols-3 gap-6">
        <Card>
          <CardHeader title="Weaviate Latency" subtitle="Query response time" />
          <CardContent>
            <SystemGaugeChart
              value={metrics?.weaviate_latency_ms ?? 0}
              label="Latency"
              unit="ms"
              max={500}
              loading={isLoading}
              warnThreshold={100}
              criticalThreshold={300}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Redis Latency" subtitle="Cache response time" />
          <CardContent>
            <SystemGaugeChart
              value={metrics?.redis_latency_ms ?? 0}
              label="Latency"
              unit="ms"
              max={50}
              loading={isLoading}
              warnThreshold={10}
              criticalThreshold={30}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="API Uptime" subtitle="Time since last restart" />
          <CardContent className="flex items-center justify-center h-[200px]">
            <div className="text-center">
              <Clock className="w-8 h-8 text-indigo-400 mx-auto mb-2" />
              <p className="text-2xl font-bold text-slate-100">
                {metrics ? formatUptime(metrics.api_uptime_seconds) : "—"}
              </p>
              <p className="text-xs text-slate-500 mt-1">Uptime</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Logs */}
      <Card>
        <CardHeader title="System Logs" subtitle="Recent log entries" />
        <CardContent>
          <LogTable logs={logs ?? []} maxHeight="350px" />
        </CardContent>
      </Card>

      {/* Metrics Table */}
      <Card>
        <CardHeader title="Raw Metrics" />
        <CardContent>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-white/[0.06]">
              {[
                ["Weaviate Latency", `${metrics?.weaviate_latency_ms ?? "—"} ms`],
                ["Redis Latency", `${metrics?.redis_latency_ms ?? "—"} ms`],
                ["API Uptime", metrics ? formatUptime(metrics.api_uptime_seconds) : "—"],
                ["Requests/min", metrics?.requests_per_minute ?? "—"],
                ["Error Rate", metrics ? `${(metrics.error_rate * 100).toFixed(1)}%` : "—"],
              ].map(([label, value]) => (
                <tr key={String(label)}>
                  <td className="py-2.5 text-slate-400">{label}</td>
                  <td className="py-2.5 text-right text-slate-200 font-mono">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Restart Overlay */}
      <RestartOverlay
        isOpen={restartOverlay.open}
        title={getOverlayConfig().title}
        description={getOverlayConfig().description}
        duration={getOverlayConfig().duration}
        action={restartOverlay.action}
        onComplete={() => setRestartOverlay({ open: false, action: "restart" })}
        onCancel={() => setRestartOverlay({ open: false, action: "restart" })}
      />
    </div>
  );
}
