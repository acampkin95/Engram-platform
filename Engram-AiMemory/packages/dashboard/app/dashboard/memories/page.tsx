"use client";

import { clsx } from "clsx";
import { formatDistanceToNow } from "date-fns";
import { useCallback, useEffect, useState } from "react";
import useSWR, { mutate as globalMutate } from "swr";
import {
  defaultTenantProjectContext,
  type TenantProjectContext,
  TenantProjectSelector,
} from "@/components/tenant-project-selector";
import { authHeaders } from "@/lib/auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const fetcher = (url: string) => fetch(url, { headers: authHeaders() }).then((res) => res.json());

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Memory {
  memory_id: string;
  content: string;
  tier: number;
  memory_type: string;
  importance: number;
  tags: string[];
  project_id?: string;
  created_at?: string;
}

interface ListMemoriesResponse {
  memories: Memory[];
  total: number;
  limit: number;
  offset: number;
}

interface Stats {
  total_memories: number;
  tier1_count: number;
  tier2_count: number;
  tier3_count: number;
}

interface CreateResponse {
  memory_id: string;
  tier: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TIER_META: Record<number, { label: string; bg: string; text: string }> = {
  1: { label: "Tier 1", bg: "bg-memory-tier1", text: "text-white" },
  2: { label: "Tier 2", bg: "bg-memory-tier2", text: "text-white" },
  3: { label: "Tier 3", bg: "bg-memory-tier3", text: "text-white" },
};

function TierBadge({ tier }: { tier: number }) {
  const meta = TIER_META[tier] ?? TIER_META[1];
  return (
    <span
      className={clsx(
        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
        meta.bg,
        meta.text
      )}
    >
      {meta.label}
    </span>
  );
}

function TypeBadge({ type }: { type: string }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-700 text-slate-300 capitalize">
      {type}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Add Memory Form
// ---------------------------------------------------------------------------

function AddMemoryForm({ onCreated }: { onCreated: () => void }) {
  const [content, setContent] = useState("");
  const [tier, setTier] = useState<number>(1);
  const [memoryType, setMemoryType] = useState("general");
  const [importance, setImportance] = useState(0.5);
  const [tags, setTags] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!content.trim()) return;

      setIsSubmitting(true);
      setFormError(null);

      try {
        const body: Record<string, unknown> = {
          content: content.trim(),
          tier,
          memory_type: memoryType,
          importance,
        };

        const tagList = tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean);
        if (tagList.length > 0) body.tags = tagList;

        const res = await fetch(`${API_URL}/memories`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!res.ok) throw new Error(`Failed to create memory (${res.status})`);

        const _data: CreateResponse = await res.json();
        setContent("");
        setTags("");
        setIsOpen(false);
        onCreated();
        void globalMutate(`${API_URL}/stats`);
      } catch (err) {
        setFormError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setIsSubmitting(false);
      }
    },
    [content, tier, memoryType, importance, tags, onCreated]
  );

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-6 py-4 flex items-center justify-between text-left"
      >
        <span className="text-sm font-medium">Add New Memory</span>
        <span className={clsx("text-slate-400 transition-transform", isOpen && "rotate-180")}>
          ▼
        </span>
      </button>

      {isOpen && (
        <form onSubmit={handleSubmit} className="px-6 pb-6 space-y-4">
          {/* Content */}
          <div>
            <label htmlFor="memory-content" className="block text-sm text-slate-400 mb-1">
              Content
            </label>
            <textarea
              id="memory-content"
              rows={3}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Memory content…"
              className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-sm focus:outline-none focus:border-cyan-500/50 resize-y transition-colors"
            />
          </div>

          <div className="grid grid-cols-4 gap-4">
            {/* Tier */}
            <div>
              <label htmlFor="memory-tier" className="block text-sm text-slate-400 mb-1">
                Tier
              </label>
              <select
                id="memory-tier"
                value={tier}
                onChange={(e) => setTier(Number(e.target.value))}
                className="w-full px-3 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-sm focus:outline-none focus:border-cyan-500/50"
              >
                <option value={1}>Tier 1 – Project</option>
                <option value={2}>Tier 2 – General</option>
                <option value={3}>Tier 3 – Global</option>
              </select>
            </div>

            {/* Type */}
            <div>
              <label htmlFor="memory-type" className="block text-sm text-slate-400 mb-1">
                Type
              </label>
              <select
                id="memory-type"
                value={memoryType}
                onChange={(e) => setMemoryType(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-sm focus:outline-none focus:border-cyan-500/50"
              >
                <option value="general">General</option>
                <option value="code">Code</option>
                <option value="decision">Decision</option>
                <option value="error">Error</option>
                <option value="insight">Insight</option>
              </select>
            </div>

            {/* Importance */}
            <div>
              <label htmlFor="memory-importance" className="block text-sm text-slate-400 mb-1">
                Importance ({(importance * 100).toFixed(0)}%)
              </label>
              <input
                id="memory-importance"
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={importance}
                onChange={(e) => setImportance(Number(e.target.value))}
                className="w-full accent-cyan-500 mt-2"
              />
            </div>

            {/* Tags */}
            <div>
              <label htmlFor="memory-tags" className="block text-sm text-slate-400 mb-1">
                Tags
              </label>
              <input
                id="memory-tags"
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="tag1, tag2"
                className="w-full px-3 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-sm focus:outline-none focus:border-cyan-500/50"
              />
            </div>
          </div>

          {formError && <p className="text-sm text-red-400">{formError}</p>}

          <button
            type="submit"
            disabled={isSubmitting || !content.trim()}
            className={clsx(
              "px-6 py-2.5 rounded-lg text-sm font-medium transition-colors",
              isSubmitting || !content.trim()
                ? "bg-slate-600 text-slate-400 cursor-not-allowed"
                : "bg-cyan-600 hover:bg-cyan-700 text-white"
            )}
          >
            {isSubmitting ? "Saving…" : "Save Memory"}
          </button>
        </form>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const PAGE_SIZE = 20;

export default function MemoriesPage() {
  const { data: stats } = useSWR<Stats>(`${API_URL}/stats`, fetcher, {
    refreshInterval: 30000,
  });

  const [ctx, setCtx] = useState<TenantProjectContext>(defaultTenantProjectContext());
  const [memories, setMemories] = useState<Memory[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [tierFilter, setTierFilter] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [page, setPage] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const loadMemories = useCallback(
    async (pageIndex = 0) => {
      setIsLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          tenant_id: ctx.tenantId,
          project_id: ctx.projectId,
          limit: String(PAGE_SIZE),
          offset: String(pageIndex * PAGE_SIZE),
        });
        if (tierFilter !== null) params.set("tier", String(tierFilter));

        const res = await fetch(`${API_URL}/memories/list?${params}`);

        if (!res.ok) throw new Error(`Failed to load memories (${res.status})`);

        const data: ListMemoriesResponse = await res.json();
        setMemories(data.memories);
        setTotal(data.total);
        setLoaded(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setIsLoading(false);
      }
    },
    [tierFilter, ctx]
  );

  // Reset to page 0 and reload when filter or ctx changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: loadMemories is stable via useCallback; intentionally omitted to avoid infinite loop
  useEffect(() => {
    setPage(0);
    setExpandedId(null);
    void loadMemories(0);
  }, [tierFilter, ctx]);

  // Reload when page changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: loadMemories is stable via useCallback; intentionally omitted to avoid infinite loop
  useEffect(() => {
    void loadMemories(page);
  }, [page]);

  const handleDelete = useCallback(
    async (memoryId: string, tier: number) => {
      setDeletingId(memoryId);
      try {
        const res = await fetch(
          `${API_URL}/memories/${memoryId}?tier=${tier}&tenant_id=${ctx.tenantId}`,
          { method: "DELETE" }
        );

        if (!res.ok) throw new Error(`Delete failed (${res.status})`);

        // Reload current page after delete
        void loadMemories(page);
        void globalMutate(`${API_URL}/stats`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Delete failed");
      } finally {
        setDeletingId(null);
      }
    },
    [ctx.tenantId, page, loadMemories]
  );

  const startIndex = page * PAGE_SIZE + 1;
  const endIndex = Math.min((page + 1) * PAGE_SIZE, total);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Memories</h1>
          <p className="text-slate-400">Browse and manage stored memories</p>
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          {/* Tenant / Project Selector */}
          <TenantProjectSelector
            apiUrl={API_URL}
            value={ctx}
            onChange={(c) => {
              setCtx(c);
              setLoaded(false);
            }}
          />

          {/* Tier Stat Pills */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs">
              <div className="w-2.5 h-2.5 rounded bg-memory-tier1" />
              <span className="text-slate-400">T1: {stats?.tier1_count ?? "–"}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <div className="w-2.5 h-2.5 rounded bg-memory-tier2" />
              <span className="text-slate-400">T2: {stats?.tier2_count ?? "–"}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <div className="w-2.5 h-2.5 rounded bg-memory-tier3" />
              <span className="text-slate-400">T3: {stats?.tier3_count ?? "–"}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Add Form */}
      <AddMemoryForm
        onCreated={() => {
          setPage(0);
          void loadMemories(0);
        }}
      />

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-400">Filter:</span>
          {[null, 1, 2, 3].map((t) => (
            <button
              key={t ?? "all"}
              type="button"
              onClick={() => setTierFilter(t)}
              className={clsx(
                "px-3 py-1 rounded-lg text-xs font-medium transition-colors",
                tierFilter === t
                  ? "bg-cyan-600 text-white"
                  : "bg-slate-700 text-slate-400 hover:bg-slate-600"
              )}
            >
              {t === null ? "All" : `Tier ${t}`}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => void loadMemories(page)}
          disabled={isLoading}
          className="ml-auto px-4 py-1 rounded-lg text-xs font-medium bg-slate-700 text-slate-400 hover:bg-slate-600 transition-colors"
        >
          {isLoading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400 flex items-center gap-2">
          <span>⚠</span>
          <span>
            {error.includes("Failed to fetch") || error.includes("NetworkError")
              ? `API offline — cannot reach ${API_URL}`
              : error}
          </span>
        </div>
      )}

      {/* Empty State */}
      {loaded && !isLoading && memories.length === 0 && !error && (
        <div className="text-center py-16 text-slate-500">
          <p className="text-4xl mb-3">🧠</p>
          <p className="text-lg font-medium text-slate-400">No memories yet</p>
          <p className="text-sm mt-1">
            {tierFilter !== null
              ? `No Tier ${tierFilter} memories found. Try a different filter.`
              : "Add your first memory using the form above"}
          </p>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full" />
        </div>
      )}

      {/* Table */}
      {!isLoading && loaded && memories.length > 0 && (
        <>
          {/* Count + Pagination Header */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">
              {total > PAGE_SIZE
                ? `Showing ${startIndex}–${endIndex} of ${total} memories`
                : `${total} memor${total !== 1 ? "ies" : "y"}`}
            </p>
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="px-3 py-1 rounded-lg text-xs font-medium bg-slate-700 text-slate-400 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  ← Prev
                </button>
                <span className="text-xs text-slate-500">
                  {page + 1} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="px-3 py-1 rounded-lg text-xs font-medium bg-slate-700 text-slate-400 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Next →
                </button>
              </div>
            )}
          </div>

          <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-left">
                  <th className="px-4 py-3 text-slate-400 font-medium">Content</th>
                  <th className="px-4 py-3 text-slate-400 font-medium w-24">Tier</th>
                  <th className="px-4 py-3 text-slate-400 font-medium w-28">Type</th>
                  <th className="px-4 py-3 text-slate-400 font-medium w-20 text-right">Imp</th>
                  <th className="px-4 py-3 text-slate-400 font-medium w-32">Created</th>
                  <th className="px-4 py-3 w-16" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {memories.map((m) => (
                  <>
                    <tr
                      key={m.memory_id}
                      className={clsx(
                        "hover:bg-slate-700/30 transition-colors cursor-pointer",
                        expandedId === m.memory_id && "bg-slate-700/20"
                      )}
                      onClick={() => setExpandedId(expandedId === m.memory_id ? null : m.memory_id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          setExpandedId(expandedId === m.memory_id ? null : m.memory_id);
                        }
                      }}
                    >
                      <td className="px-4 py-3">
                        <p className="truncate max-w-md text-slate-200">{m.content}</p>
                        {m.tags?.length > 0 && (
                          <div className="flex gap-1 mt-1">
                            {m.tags.map((tag) => (
                              <span key={tag} className="text-xs text-slate-500">
                                #{tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <TierBadge tier={m.tier} />
                      </td>
                      <td className="px-4 py-3">
                        <TypeBadge type={m.memory_type} />
                      </td>
                      <td className="px-4 py-3 text-right text-amber-400">
                        {(m.importance * 100).toFixed(0)}%
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {m.created_at
                          ? formatDistanceToNow(new Date(m.created_at), {
                              addSuffix: true,
                            })
                          : "–"}
                      </td>
                      <td
                        className="px-4 py-3"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => handleDelete(m.memory_id, m.tier)}
                          disabled={deletingId === m.memory_id}
                          className="text-red-400 hover:text-red-300 text-xs transition-colors disabled:opacity-40"
                          title="Delete memory"
                        >
                          {deletingId === m.memory_id ? "…" : "Delete"}
                        </button>
                      </td>
                    </tr>
                    {/* Expanded detail row */}
                    {expandedId === m.memory_id && (
                      <tr key={`${m.memory_id}-detail`}>
                        <td
                          colSpan={6}
                          className="px-6 py-4 bg-slate-900/60 border-t border-slate-700/50"
                        >
                          <div className="space-y-3">
                            <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">
                              Full Content
                            </p>
                            <p className="text-sm text-slate-200 whitespace-pre-wrap break-words leading-relaxed">
                              {m.content}
                            </p>
                            <div className="flex flex-wrap gap-4 pt-2 border-t border-slate-700/50 text-xs text-slate-500">
                              <span>
                                ID: <span className="font-mono text-slate-400">{m.memory_id}</span>
                              </span>
                              {m.project_id && (
                                <span>
                                  Project:{" "}
                                  <span className="font-mono text-slate-400">{m.project_id}</span>
                                </span>
                              )}
                              <span>
                                Importance:{" "}
                                <span className="text-amber-400 font-semibold">
                                  {(m.importance * 100).toFixed(0)}%
                                </span>
                              </span>
                              {m.created_at && (
                                <span>
                                  Created:{" "}
                                  <span className="text-slate-400">
                                    {new Date(m.created_at).toLocaleString()}
                                  </span>
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setPage(0)}
                disabled={page === 0}
                className="px-3 py-1 rounded-lg text-xs font-medium bg-slate-700 text-slate-400 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                «
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-3 py-1 rounded-lg text-xs font-medium bg-slate-700 text-slate-400 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                ← Prev
              </button>
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                const pageNum =
                  totalPages <= 7 ? i : Math.max(0, Math.min(page - 3, totalPages - 7)) + i;
                return (
                  <button
                    key={pageNum}
                    type="button"
                    onClick={() => setPage(pageNum)}
                    className={clsx(
                      "px-3 py-1 rounded-lg text-xs font-medium transition-colors",
                      pageNum === page
                        ? "bg-cyan-600 text-white"
                        : "bg-slate-700 text-slate-400 hover:bg-slate-600"
                    )}
                  >
                    {pageNum + 1}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="px-3 py-1 rounded-lg text-xs font-medium bg-slate-700 text-slate-400 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next →
              </button>
              <button
                type="button"
                onClick={() => setPage(totalPages - 1)}
                disabled={page >= totalPages - 1}
                className="px-3 py-1 rounded-lg text-xs font-medium bg-slate-700 text-slate-400 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                »
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
