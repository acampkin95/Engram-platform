import { useState, useEffect, useCallback, useRef } from 'react';
import {
  checkSystemHealth,
  SystemHealth,
  getHealthStatusMessage,
} from '../lib/healthCheck';

export interface UseSystemHealthReturn {
  health: SystemHealth | null;
  loading: boolean;
  error: Error | null;
  message: string;
  refresh: () => void;
}

export function useSystemHealth(
  options?: {
    autoRefresh?: boolean;
    refreshInterval?: number;
  }
): UseSystemHealthReturn {
  const { autoRefresh = false, refreshInterval = 30000 } = options ?? {};

  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const mountedRef = useRef(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const check = useCallback(async () => {
    if (!mountedRef.current) return;

    setLoading(true);
    setError(null);

    try {
      const result = await checkSystemHealth();
      if (mountedRef.current) {
        setHealth(result);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  const refresh = useCallback(() => {
    void check();
  }, [check]);

  useEffect(() => {
    mountedRef.current = true;
    void check();

    if (autoRefresh && refreshInterval > 0) {
      intervalRef.current = setInterval(() => {
        void check();
      }, refreshInterval);
    }

    return () => {
      mountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [check, autoRefresh, refreshInterval]);

  const message = health ? getHealthStatusMessage(health) : '';

  return {
    health,
    loading,
    error,
    message,
    refresh,
  };
}
