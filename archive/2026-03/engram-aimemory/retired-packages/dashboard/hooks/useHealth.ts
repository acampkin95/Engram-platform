import useSWR from "swr";
import { BASE_URL as API_URL, swrFetcher } from "@/lib/api-client";
import type { HealthStatus } from "@/types";

export function useHealth() {
  return useSWR<HealthStatus>(`${API_URL}/health`, swrFetcher, { refreshInterval: 15_000 });
}
