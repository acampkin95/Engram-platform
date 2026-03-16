"use client";

import { clsx } from "clsx";
import { motion } from "framer-motion";
import { AlertCircle, AlertTriangle, Info, Search, X } from "lucide-react";
import { useMemo, useState } from "react";

export type LogLevel = "info" | "warn" | "error" | "debug";

export interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  source: string;
  message: string;
  details?: string;
}

interface LogTableProps {
  logs: LogEntry[];
  maxHeight?: string;
}

const levelConfig: Record<
  LogLevel,
  { icon: typeof Info; color: string; bg: string; label: string }
> = {
  info: { icon: Info, color: "text-teal-400", bg: "bg-teal-500/10", label: "INFO" },
  warn: {
    icon: AlertTriangle,
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    label: "WARN",
  },
  error: {
    icon: AlertCircle,
    color: "text-rose-400",
    bg: "bg-rose-500/10",
    label: "ERROR",
  },
  debug: { icon: Info, color: "text-[#5C5878]", bg: "bg-white/[0.04]", label: "DEBUG" },
};

export function LogTable({ logs, maxHeight = "400px" }: LogTableProps) {
  const [filter, setFilter] = useState("");
  const [levelFilter, setLevelFilter] = useState<LogLevel | "all">("all");
  const [sourceFilter, setSourceFilter] = useState<string | "all">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const sources = useMemo(() => {
    const unique = new Set(logs.map((l) => l.source));
    return Array.from(unique).sort();
  }, [logs]);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const matchesSearch =
        filter === "" ||
        log.message.toLowerCase().includes(filter.toLowerCase()) ||
        log.source.toLowerCase().includes(filter.toLowerCase());
      const matchesLevel = levelFilter === "all" || log.level === levelFilter;
      const matchesSource = sourceFilter === "all" || log.source === sourceFilter;
      return matchesSearch && matchesLevel && matchesSource;
    });
  }, [logs, filter, levelFilter, sourceFilter]);

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search logs..."
            className="w-full pl-9 pr-8 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-[#A09BB8] placeholder-[#5C5878] focus:outline-none focus:border-amber-500/40"
          />
          {filter && (
            <button
              type="button"
              onClick={() => setFilter("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-white/[0.06]"
            >
              <X className="w-3.5 h-3.5 text-slate-500" />
            </button>
          )}
        </div>

        {/* Level Filter */}
        <select
          value={levelFilter}
          onChange={(e) => setLevelFilter(e.target.value as LogLevel | "all")}
          className="px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-[#A09BB8] focus:outline-none focus:border-amber-500/40"
        >
          <option value="all">All Levels</option>
          <option value="info">Info</option>
          <option value="warn">Warning</option>
          <option value="error">Error</option>
          <option value="debug">Debug</option>
        </select>

        {/* Source Filter */}
        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          className="px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-[#A09BB8] focus:outline-none focus:border-amber-500/40"
        >
          <option value="all">All Sources</option>
          {sources.map((source) => (
            <option key={source} value={source}>
              {source}
            </option>
          ))}
        </select>

        {/* Result count */}
        <span className="text-xs text-slate-500">
          {filteredLogs.length} / {logs.length} entries
        </span>
      </div>

      {/* Log Table */}
      <div
        className="bg-white/[0.02] border border-white/[0.08] rounded-xl overflow-hidden"
        style={{ maxHeight }}
      >
        {filteredLogs.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            <Info className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No logs found</p>
          </div>
        ) : (
          <div className="overflow-auto" style={{ maxHeight }}>
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-[#0d1117]">
                <tr className="border-b border-white/[0.06] text-left">
                  <th className="px-4 py-2.5 text-xs text-slate-500 font-medium uppercase tracking-wider w-10">
                    Level
                  </th>
                  <th className="px-4 py-2.5 text-xs text-slate-500 font-medium uppercase tracking-wider w-36">
                    Timestamp
                  </th>
                  <th className="px-4 py-2.5 text-xs text-slate-500 font-medium uppercase tracking-wider w-28">
                    Source
                  </th>
                  <th className="px-4 py-2.5 text-xs text-slate-500 font-medium uppercase tracking-wider">
                    Message
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {filteredLogs.map((log) => {
                  const config = levelConfig[log.level];
                  const Icon = config.icon;
                  const isExpanded = expandedId === log.id;

                  return (
                    <motion.tr
                      key={log.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="px-4 py-2.5">
                        <span
                          className={clsx(
                            "inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium",
                            config.bg,
                            config.color
                          )}
                        >
                          <Icon className="w-3 h-3" />
                          {config.label}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-400 font-mono text-xs">
                        {log.timestamp}
                      </td>
                      <td className="px-4 py-2.5 text-slate-400">{log.source}</td>
                      <td className="px-4 py-2.5">
                        <button
                          type="button"
                          className={clsx(
                            "w-full text-left cursor-pointer hover:text-slate-200 transition-colors bg-transparent border-0 p-0",
                            isExpanded ? "text-slate-200" : "text-slate-400"
                          )}
                          onClick={() => setExpandedId(isExpanded ? null : log.id)}
                        >
                          {isExpanded ? log.message : log.message.slice(0, 80)}
                          {log.message.length > 80 && !isExpanded && "..."}
                        </button>
                        {isExpanded && log.details && (
                          <div className="mt-2 p-2 bg-black/20 rounded text-xs font-mono text-slate-500 overflow-x-auto">
                            {log.details}
                          </div>
                        )}
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
