import useSWR from "swr";
import { BASE_URL as API_URL, swrFetcher } from "@/lib/api-client";
import type { Stats } from "@/types";

export function useStats(tenantId?: string) {
  const url = tenantId ? `${API_URL}/stats?tenant_id=${tenantId}` : `${API_URL}/stats`;
  return useSWR<Stats>(url, swrFetcher, { refreshInterval: 30_000 });
}
