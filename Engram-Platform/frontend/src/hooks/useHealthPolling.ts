'use client';

import { useCallback, useEffect, useRef } from 'react';
import { crawlerClient } from '@/src/lib/crawler-client';
import { memoryClient } from '@/src/lib/memory-client';
import { useUIStore } from '@/src/stores/uiStore';

/**
 * Health check polling hook
 * Polls Memory and Crawler API health endpoints every 30 seconds
 * and updates UIStore with service status
 */
export function useHealthPolling(pollIntervalMs = 30000) {
  const { setServiceStatus } = useUIStore();
  const mountedRef = useRef(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkHealth = useCallback(async () => {
    if (!mountedRef.current) return;

    // Check Memory API
    try {
      const memoryHealth = await memoryClient.getHealth();
      if (mountedRef.current) {
        setServiceStatus({
          memory: memoryHealth.error ? 'offline' : 'online',
        });
      }
    } catch {
      if (mountedRef.current) {
        setServiceStatus({ memory: 'offline' });
      }
    }

    // Check Crawler API
    try {
      const crawlerHealth = await crawlerClient.getHealth();
      if (mountedRef.current) {
        setServiceStatus({
          crawler: crawlerHealth.error ? 'offline' : 'online',
        });
      }
    } catch {
      if (mountedRef.current) {
        setServiceStatus({ crawler: 'offline' });
      }
    }
  }, [setServiceStatus]);

  useEffect(() => {
    mountedRef.current = true;
    void checkHealth(); // Initial check

    if (pollIntervalMs > 0) {
      intervalRef.current = setInterval(() => {
        void checkHealth();
      }, pollIntervalMs);
    }

    return () => {
      mountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [checkHealth, pollIntervalMs]);

  return { checkHealth };
}
