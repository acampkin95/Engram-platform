import useSWR from "swr";
import { BASE_URL as API_URL } from "@/lib/api-client";
import { authHeaders } from "@/lib/auth";

export interface LogEntry {
  id: string;
  timestamp: string;
  level: "info" | "warn" | "error" | "debug";
  source: string;
  message: string;
  details?: string;
}

interface LogsResponse {
  logs: LogEntry[];
  total: number;
}

/**
 * Fetch system logs from the API.
 * Falls back to empty array if endpoint is not available.
 */
export function useSystemLogs(limit = 50) {
  const fetcher = async (): Promise<LogEntry[]> => {
    try {
      const res = await fetch(`${API_URL}/analytics/logs?limit=${limit}`, {
        headers: authHeaders(),
      });
      if (!res.ok) {
        // Endpoint doesn't exist - return empty
        return [];
      }
      const data: LogsResponse = await res.json();
      return data.logs;
    } catch {
      // Network error or endpoint not available
      return [];
    }
  };

  return useSWR<LogEntry[]>(`${API_URL}/analytics/logs`, fetcher, {
    refreshInterval: 30_000, // Poll every 30s
    fallbackData: [],
  });
}
