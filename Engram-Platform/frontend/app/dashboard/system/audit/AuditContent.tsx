'use client';

import { Activity, AlertTriangle, ChevronDown, Filter, Search, Zap } from 'lucide-react';
import { useCallback, useState } from 'react';
import useSWR from 'swr';
import { Badge } from '@/src/design-system/components/Badge';
import type { AuditLogEntry, AuditLogResponse, AuditSummary } from '@/src/lib/system-client';
import { systemClient } from '@/src/lib/system-client';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString('en-AU', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function statusVariant(code: number): 'success' | 'warning' | 'error' | 'info' {
  if (code < 300) return 'success';
  if (code < 400) return 'info';
  if (code < 500) return 'warning';
  return 'error';
}

function methodColor(method: string): string {
  const colors: Record<string, string> = {
    GET: 'bg-[#2EC4C4]/10 text-[#2EC4C4] border-[#2EC4C4]/20',
    POST: 'bg-[#F2A93B]/10 text-[#F2A93B] border-[#F2A93B]/20',
    PATCH: 'bg-[#9B7DE0]/10 text-[#9B7DE0] border-[#9B7DE0]/20',
    PUT: 'bg-[#9B7DE0]/10 text-[#9B7DE0] border-[#9B7DE0]/20',
    DELETE: 'bg-[#FF6B6B]/10 text-[#FF6B6B] border-[#FF6B6B]/20',
  };
  return colors[method.toUpperCase()] ?? 'bg-white/5 text-[#a09bb8] border-white/10';
}

const PAGE_SIZE = 50;

async function fetchLog(params: {
  key_id?: string;
  path?: string;
  method?: string;
  offset: number;
}) {
  const result = await systemClient.getAuditLog({ ...params, limit: PAGE_SIZE });
  if (result.error) throw new Error(result.error);
  return result.data ?? ({ entries: [], total: 0, has_more: false } as AuditLogResponse);
}

async function fetchSummary() {
  const result = await systemClient.getAuditSummary(24);
  if (result.error) throw new Error(result.error);
  return (
    result.data ??
    ({
      total_requests: 0,
      error_count: 0,
      error_rate: 0,
      top_endpoints: [],
      top_keys: [],
    } satisfies AuditSummary)
  );
}

// ── Summary Cards ─────────────────────────────────────────────────────────────

function SummaryCards({ summary }: Readonly<{ summary: AuditSummary | undefined }>) {
  if (!summary) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="rounded-xl border border-white/[0.06] bg-[#0d0d1a] p-4 animate-pulse"
          >
            <div className="h-4 w-24 bg-white/5 rounded mb-2" />
            <div className="h-8 w-16 bg-white/5 rounded" />
          </div>
        ))}
      </div>
    );
  }

  const cards = [
    {
      label: 'Total Requests (24h)',
      value: summary.total_requests.toLocaleString(),
      icon: Activity,
      accent: '#2EC4C4',
    },
    {
      label: 'Error Rate',
      value: `${(summary.error_rate * 100).toFixed(1)}%`,
      icon: AlertTriangle,
      accent: summary.error_rate > 0.05 ? '#FF6B6B' : '#2EC4C4',
    },
    {
      label: 'Top Endpoint',
      value: summary.top_endpoints?.[0]?.path ?? '--',
      icon: Zap,
      accent: '#F2A93B',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {cards.map((card) => (
        <div key={card.label} className="rounded-xl border border-white/[0.06] bg-[#0d0d1a] p-4">
          <div className="flex items-center gap-2 mb-2">
            <card.icon className="w-4 h-4" style={{ color: card.accent }} />
            <span className="text-[10px] font-mono text-[#5c5878] uppercase tracking-widest">
              {card.label}
            </span>
          </div>
          <p className="text-lg font-semibold font-display truncate" style={{ color: card.accent }}>
            {card.value}
          </p>
        </div>
      ))}
    </div>
  );
}

// ── Filter Bar ────────────────────────────────────────────────────────────────

const METHODS = ['', 'GET', 'POST', 'PATCH', 'PUT', 'DELETE'];

function FilterBar({
  filters,
  onChange,
}: Readonly<{
  filters: { method: string; path: string };
  onChange: (f: { method: string; path: string }) => void;
}>) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-1.5 text-[#5c5878]">
        <Filter className="w-4 h-4" />
        <span className="text-[10px] font-mono uppercase tracking-widest">Filters</span>
      </div>

      {/* Method filter */}
      <div className="relative">
        <select
          value={filters.method}
          onChange={(e) => onChange({ ...filters, method: e.target.value })}
          className="appearance-none pl-3 pr-8 py-1.5 rounded-lg bg-black/30 border border-white/10 text-xs text-[#f0eef8] focus:outline-none focus:ring-1 focus:ring-[#F2A93B]/50 cursor-pointer"
        >
          <option value="">All Methods</option>
          {METHODS.filter(Boolean).map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[#5c5878] pointer-events-none" />
      </div>

      {/* Path search */}
      <div className="relative flex-1 min-w-[200px] max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#5c5878]" />
        <input
          type="text"
          value={filters.path}
          onChange={(e) => onChange({ ...filters, path: e.target.value })}
          placeholder="Filter by path..."
          className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-black/30 border border-white/10 text-xs text-[#f0eef8] placeholder-[#5c5878] focus:outline-none focus:ring-1 focus:ring-[#F2A93B]/50"
        />
      </div>
    </div>
  );
}

// ── Main Content ──────────────────────────────────────────────────────────────

export default function AuditContent() {
  const [filters, setFilters] = useState({ method: '', path: '' });
  const [offset, setOffset] = useState(0);

  const swrKey = `audit-log-${filters.method}-${filters.path}-${offset}`;
  const {
    data: logData,
    error: logError,
    isLoading: logLoading,
  } = useSWR<AuditLogResponse>(
    swrKey,
    () =>
      fetchLog({
        method: filters.method || undefined,
        path: filters.path || undefined,
        offset,
      }),
    { refreshInterval: 15000 },
  );

  const { data: summary } = useSWR('audit-summary', fetchSummary, {
    refreshInterval: 30000,
  });

  const handleFilterChange = useCallback((f: { method: string; path: string }) => {
    setFilters(f);
    setOffset(0);
  }, []);

  const entries = logData?.entries ?? [];
  const total = logData?.total ?? 0;
  const hasMore = logData?.has_more ?? false;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-[#9B7DE0]/10 border border-[#9B7DE0]/20">
          <Activity className="w-5 h-5 text-[#9B7DE0]" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-[#f0eef8] font-display">Audit Log</h1>
          <p className="text-xs text-[#5c5878]">API request history and analytics</p>
        </div>
      </div>

      {/* Summary */}
      <SummaryCards summary={summary} />

      {/* Filters */}
      <FilterBar filters={filters} onChange={handleFilterChange} />

      {/* Table */}
      <div className="rounded-xl border border-white/[0.06] bg-[#0d0d1a] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/[0.06]">
                {['Timestamp', 'Key', 'Method', 'Path', 'Status', 'Latency', 'IP'].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-[10px] font-mono font-medium text-[#5c5878] uppercase tracking-widest"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {logLoading && entries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm text-[#5c5878]">
                    Loading audit log...
                  </td>
                </tr>
              ) : logError ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm text-[#FF6B6B]">
                    {logError.message || 'Failed to load audit log'}
                  </td>
                </tr>
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm text-[#5c5878]">
                    No audit entries found.
                  </td>
                </tr>
              ) : (
                entries.map((entry: AuditLogEntry) => (
                  <tr
                    key={`${entry.timestamp}-${entry.method}-${entry.path}-${entry.ip}`}
                    className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="px-4 py-2.5 text-xs text-[#a09bb8] font-mono whitespace-nowrap">
                      {formatTimestamp(entry.timestamp)}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-[#f0eef8]">{entry.key_name}</td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded text-[10px] font-mono font-medium border ${methodColor(entry.method)}`}
                      >
                        {entry.method}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-[#a09bb8] font-mono max-w-[240px] truncate">
                      {entry.path}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge variant={statusVariant(entry.status_code)}>{entry.status_code}</Badge>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-[#a09bb8] font-mono">
                      {entry.latency_ms}ms
                    </td>
                    <td className="px-4 py-2.5 text-xs text-[#5c5878] font-mono">{entry.ip}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {(total > PAGE_SIZE || offset > 0) && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-white/[0.06]">
            <span className="text-xs text-[#5c5878]">
              Showing {offset + 1}–{Math.min(offset + entries.length, total)} of{' '}
              {total.toLocaleString()}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                className="px-3 py-1 rounded-lg text-xs text-[#a09bb8] hover:text-[#f0eef8] bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={!hasMore}
                onClick={() => setOffset(offset + PAGE_SIZE)}
                className="px-3 py-1 rounded-lg text-xs text-[#a09bb8] hover:text-[#f0eef8] bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
