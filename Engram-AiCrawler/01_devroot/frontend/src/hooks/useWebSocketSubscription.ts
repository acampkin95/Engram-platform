import { useState, useEffect, useCallback, useRef } from 'react';
import { wsClient, type ConnectionState } from '../lib/websocket';

export interface UseWebSocketSubscriptionReturn<T> {
  data: T | null;
  isConnected: boolean;
  error: Error | null;
  subscribe: () => void;
  unsubscribe: () => void;
}

export function useWebSocketSubscription<T = unknown>(
  topic: string
): UseWebSocketSubscriptionReturn<T> {
  const [data, setData] = useState<T | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(wsClient.isConnected());
  const [error, setError] = useState<Error | null>(null);
  const subscribedRef = useRef(false);

  const subscribe = useCallback(() => {
    if (subscribedRef.current) return;

    try {
      wsClient.on<T>(topic, (incoming: T) => {
        setData(incoming);
        setError(null);
      });

      subscribedRef.current = true;
      setIsConnected(wsClient.isConnected());
    } catch (err) {
      const wrapped = err instanceof Error ? err : new Error(String(err));
      setError(wrapped);
    }
  }, [topic]);

  const unsubscribe = useCallback(() => {
    if (!subscribedRef.current) return;
    wsClient.off(topic);
    subscribedRef.current = false;
  }, [topic]);

  useEffect(() => {
    subscribedRef.current = false;
    subscribe();

    const handleStateChange = (state: ConnectionState) => {
      setIsConnected(state === 'connected');
    };
    wsClient.addStateListener(handleStateChange);

    return () => {
      wsClient.off(topic);
      subscribedRef.current = false;
      wsClient.removeStateListener(handleStateChange);
    };
  }, [topic, subscribe]);

  return { data, isConnected, error, subscribe, unsubscribe };
}
