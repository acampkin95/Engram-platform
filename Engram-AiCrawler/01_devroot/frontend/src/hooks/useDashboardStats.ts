import { useState, useCallback, useEffect, useRef } from 'react';
import { useWebSocketSubscription } from './useWebSocketSubscription';
import { DashboardStatsSchema } from '../lib/schemas';
import { createLogger } from '../lib/logger';

const log = createLogger('useDashboardStats');

// ---------------------------------------------------------------------------
// Types — re-export from schemas for convenience
// ---------------------------------------------------------------------------

import type { DashboardStats } from '../lib/schemas';
export type { DashboardStats };

export interface UseDashboardStatsReturn {
  stats: DashboardStats | null;
  loading: boolean;
  error: Error | null;
  refresh: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useDashboardStats(): UseDashboardStatsReturn {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const controllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  // Subscribe to events that signal the stats may be stale
  const { data: crawlUpdateEvent } =
    useWebSocketSubscription<unknown>('crawl:update');
  const { data: crawlCompleteEvent } =
    useWebSocketSubscription<unknown>('crawl:complete');
  const { data: crawlErrorEvent } =
    useWebSocketSubscription<unknown>('crawl:error');

  // ------------------------------------------------------------------
  // Fetch from the API
  // ------------------------------------------------------------------
  const fetchStats = useCallback(async (signal?: AbortSignal) => {
    if (!signal) {
      controllerRef.current?.abort('Superseded by a newer stats request');
      controllerRef.current = new AbortController();
    }
    const effectiveSignal = signal ?? controllerRef.current?.signal;

    if (!mountedRef.current) return;
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/stats/dashboard', { signal: effectiveSignal });

      if (!response.ok) {
        throw new Error(
          `Failed to fetch stats: ${response.status} ${response.statusText}`
        );
      }

      const raw = await response.json();
      // Validate response shape with Zod — falls back gracefully on unexpected fields
      const parseResult = DashboardStatsSchema.safeParse(raw);
      if (parseResult.success) {
        setStats(parseResult.data);
      } else {
        if (import.meta.env.DEV) {
          log.validationWarning(parseResult.error.issues);
        }

        // Still use the raw data as a best-effort fallback
        setStats(raw as DashboardStats);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      const wrapped = err instanceof Error ? err : new Error(String(err));
      if (mountedRef.current) setError(wrapped);
    } finally {
      if (mountedRef.current) setLoading(false);
      if (!signal) {
        controllerRef.current = null;
      }
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // ------------------------------------------------------------------
  // Refresh when WebSocket events arrive (debounced to avoid bursts)
  // ------------------------------------------------------------------
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const debouncedRefresh = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchStats(), 500);
  }, [fetchStats]);

  useEffect(() => {
    if (crawlUpdateEvent !== null) debouncedRefresh();
  }, [crawlUpdateEvent, debouncedRefresh]);

  useEffect(() => {
    if (crawlCompleteEvent !== null) debouncedRefresh();
  }, [crawlCompleteEvent, debouncedRefresh]);

  useEffect(() => {
    if (crawlErrorEvent !== null) debouncedRefresh();
  }, [crawlErrorEvent, debouncedRefresh]);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      const controller = controllerRef.current;
      controller?.abort('Component unmounted');
    };
  }, []);

  return { stats, loading, error, refresh: fetchStats };
}
