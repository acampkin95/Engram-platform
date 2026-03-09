import useSWR from "swr";
import { BASE_URL as API_URL, swrFetcher } from "@/lib/api-client";
import type {
  ActivityDay,
  KnowledgeGraphStats,
  MemoryGrowthPoint,
  SearchStats,
  SystemMetrics,
} from "@/types";

export function useMemoryGrowth(
  tenantId?: string,
  period: "daily" | "weekly" | "monthly" = "daily"
) {
  const params = new URLSearchParams({ period });
  if (tenantId) params.set("tenant_id", tenantId);
  return useSWR<MemoryGrowthPoint[]>(`${API_URL}/analytics/memory-growth?${params}`, swrFetcher);
}

export function useActivityTimeline(tenantId?: string, year?: number) {
  const params = new URLSearchParams();
  if (tenantId) params.set("tenant_id", tenantId);
  if (year) params.set("year", String(year));
  return useSWR<ActivityDay[]>(`${API_URL}/analytics/activity-timeline?${params}`, swrFetcher);
}

export function useSearchStats(tenantId?: string) {
  const params = new URLSearchParams();
  if (tenantId) params.set("tenant_id", tenantId);
  const query = params.toString() ? `?${params}` : "";
  return useSWR<SearchStats>(`${API_URL}/analytics/search-stats${query}`, swrFetcher);
}

export function useSystemMetrics() {
  return useSWR<SystemMetrics>(`${API_URL}/analytics/system-metrics`, swrFetcher, {
    refreshInterval: 10_000,
  });
}

export function useKnowledgeGraphStats(tenantId?: string) {
  const params = new URLSearchParams();
  if (tenantId) params.set("tenant_id", tenantId);
  const query = params.toString() ? `?${params}` : "";
  return useSWR<KnowledgeGraphStats>(
    `${API_URL}/analytics/knowledge-graph-stats${query}`,
    swrFetcher
  );
}
