"use client";

import { clsx } from "clsx";
import { formatDistanceToNow } from "date-fns";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import {
  defaultTenantProjectContext,
  type TenantProjectContext,
  TenantProjectSelector,
} from "@/components/tenant-project-selector";
import { authHeaders } from "@/lib/auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SearchResult {
  memory_id: string;
  content: string;
  tier: number;
  memory_type: string;
  importance: number;
  tags: string[];
  project_id?: string;
  created_at?: string;
  score?: number;
}

interface SearchResponse {
  results: SearchResult[];
  total: number;
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

// ---------------------------------------------------------------------------
// Inner content (uses useSearchParams — must be inside Suspense)
// ---------------------------------------------------------------------------

function SearchPageContent() {
  const searchParams = useSearchParams();
  const [ctx, setCtx] = useState<TenantProjectContext>(defaultTenantProjectContext());
  const [query, setQuery] = useState("");
  const [tierFilter, setTierFilter] = useState<number | null>(null);
  const [limit, setLimit] = useState(20);

  const [results, setResults] = useState<SearchResult[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  // Handle URL query param
  useEffect(() => {
    const q = searchParams.get("q");
    if (q && !hasSearched) {
      setQuery(q);
    }
  }, [searchParams, hasSearched]);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const body: Record<string, unknown> = {
        query: query.trim(),
        tenant_id: ctx.tenantId,
        project_id: ctx.projectId,
        limit,
      };
      if (tierFilter !== null) body.tier = tierFilter;

      const res = await fetch(`${API_URL}/memories/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error(`Search failed (${res.status})`);

      const data: SearchResponse = await res.json();
      setResults(data.results);
      setTotal(data.total);
      setHasSearched(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, [query, tierFilter, limit, ctx]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Search Memories</h1>
          <p className="text-slate-400">Semantic search across all memory tiers</p>
        </div>

        {/* Tenant / Project Selector */}
        <TenantProjectSelector apiUrl={API_URL} value={ctx} onChange={setCtx} />
      </div>

      {/* Search Controls */}
      <div className="bg-white/[0.03] rounded-xl p-6 border border-white/[0.08]">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSearch();
          }}
          className="space-y-4"
        >
          {/* Query Input */}
          <div>
            <label htmlFor="search-query" className="block text-sm text-slate-400 mb-1">
              Query
            </label>
            <input
              id="search-query"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Describe what you're looking for…"
              className="w-full px-4 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-[#F0EEF8] placeholder-[#5C5878] focus:outline-none focus:border-amber-500/40 transition-colors"
            />
          </div>

          {/* Filters Row */}
          <div className="flex items-end gap-4">
            {/* Tier Filter */}
            <div className="w-48">
              <label htmlFor="tier-filter" className="block text-sm text-slate-400 mb-1">
                Tier
              </label>
              <select
                id="tier-filter"
                value={tierFilter ?? ""}
                onChange={(e) => setTierFilter(e.target.value ? Number(e.target.value) : null)}
                className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-[#A09BB8] focus:outline-none focus:border-amber-500/40"
              >
                <option value="">All Tiers</option>
                <option value="1">Tier 1 – Project</option>
                <option value="2">Tier 2 – General</option>
                <option value="3">Tier 3 – Global</option>
              </select>
            </div>

            {/* Limit */}
            <div className="w-32">
              <label htmlFor="result-limit" className="block text-sm text-slate-400 mb-1">
                Limit
              </label>
              <select
                id="result-limit"
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-[#A09BB8] focus:outline-none focus:border-amber-500/40"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading || !query.trim()}
              className={clsx(
                "px-6 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isLoading || !query.trim()
                  ? "bg-white/[0.05] text-[#5C5878] cursor-not-allowed"
                  : "bg-amber-500 hover:bg-amber-400 text-[#03020A] font-semibold"
              )}
            >
              {isLoading ? "Searching…" : "Search"}
            </button>
          </div>
        </form>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-900/30 border border-red-700 text-red-300 rounded-xl p-4 text-sm">
          {error}
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full" />
        </div>
      )}

      {/* Results */}
      {!isLoading && hasSearched && (
        <div className="space-y-4">
          <p className="text-sm text-slate-400">
            {total} result{total !== 1 && "s"} found
          </p>

          {results.length === 0 && !error ? (
            <div className="text-center py-12 text-slate-500">
              <p className="text-3xl mb-3">🔍</p>
              <p className="text-slate-400">No memories found for this query</p>
            </div>
          ) : (
            <div className="space-y-3">
              {results.map((item) => (
                <div
                  key={item.memory_id}
                  className="bg-white/[0.03] rounded-xl p-4 border border-white/[0.08] hover:border-amber-500/20 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-200 whitespace-pre-wrap break-words">
                        {item.content}
                      </p>

                      {/* Meta */}
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <TierBadge tier={item.tier} />

                        {item.memory_type && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-white/[0.06] text-[#A09BB8]">
                            {item.memory_type}
                          </span>
                        )}

                        {item.tags?.map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-white/[0.04] text-[#5C5878]"
                          >
                            #{tag}
                          </span>
                        ))}

                        {typeof item.score === "number" && (
                          <span className="text-xs text-slate-500">
                            score: {item.score.toFixed(3)}
                          </span>
                        )}

                        {item.created_at && (
                          <span className="text-xs text-slate-500">
                            {formatDistanceToNow(new Date(item.created_at), {
                              addSuffix: true,
                            })}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Importance Indicator */}
                    <div className="flex flex-col items-center gap-0.5 shrink-0">
                      <span className="text-xs text-slate-500">Imp</span>
                      <span className="text-sm font-semibold text-amber-400">
                        {(item.importance * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !hasSearched && (
        <div className="bg-white/[0.03] rounded-xl p-12 border border-white/[0.08] text-center">
          <span className="text-4xl mb-4 block">🔍</span>
          <p className="text-slate-400">Enter a query above to search across all memory tiers.</p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page export — wraps content in Suspense for useSearchParams
// ---------------------------------------------------------------------------

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-24">
          <div className="animate-spin w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full" />
        </div>
      }
    >
      <SearchPageContent />
    </Suspense>
  );
}
