'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useUIStore } from '@/src/stores/uiStore';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WebSocketOptions {
  url: string;
  onMessage?: (data: unknown) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  reconnectDelay?: number;
  maxReconnectAttempts?: number;
}

export interface UseWebSocketReturn {
  connected: boolean;
  /** True when disconnected but still attempting to reconnect. */
  reconnecting: boolean;
  /** Current reconnect attempt (0 when connected or not reconnecting). */
  reconnectAttempt: number;
  send: (data: unknown) => void;
  disconnect: () => void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useWebSocket({
  url,
  onMessage,
  onConnect,
  onDisconnect,
  reconnectDelay = 1000,
  maxReconnectAttempts = 5,
}: WebSocketOptions): UseWebSocketReturn {
  const [connected, setConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);
  const attemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sendBufferRef = useRef<unknown[]>([]);
  // Keep stable refs to callbacks so they don't re-trigger the effect
  const onMessageRef = useRef(onMessage);
  const onConnectRef = useRef(onConnect);
  const onDisconnectRef = useRef(onDisconnect);
  const isMountedRef = useRef(true);

  // Update callback refs when they change
  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);
  useEffect(() => {
    onConnectRef.current = onConnect;
  }, [onConnect]);
  useEffect(() => {
    onDisconnectRef.current = onDisconnect;
  }, [onDisconnect]);

  const setWsConnected = useUIStore((s) => s.setWsConnected);

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current !== null) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    // Guard against SSR
    if (typeof window === 'undefined') return;
    if (!isMountedRef.current) return;

    // Close any existing socket
    if (wsRef.current) {
      wsRef.current.onclose = null; // prevent re-trigger
      wsRef.current.close();
      wsRef.current = null;
    }

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!isMountedRef.current) return;
      attemptRef.current = 0;
      setConnected(true);
      setReconnecting(false);
      setReconnectAttempt(0);
      setWsConnected(true);
      onConnectRef.current?.();

      // Flush buffered messages
      const buffer = sendBufferRef.current;
      sendBufferRef.current = [];
      for (const msg of buffer) {
        ws.send(typeof msg === 'string' ? msg : JSON.stringify(msg));
      }
    };

    ws.onmessage = (event) => {
      if (!isMountedRef.current) return;
      try {
        const parsed: unknown = JSON.parse(event.data as string);
        onMessageRef.current?.(parsed);
      } catch {
        // Non-JSON message — pass raw string
        onMessageRef.current?.(event.data);
      }
    };

    ws.onerror = () => {
      // onerror is always followed by onclose — let onclose handle reconnect
    };

    ws.onclose = () => {
      if (!isMountedRef.current) return;
      setConnected(false);
      setWsConnected(false);
      onDisconnectRef.current?.();

      // Exponential backoff reconnect
      if (attemptRef.current < maxReconnectAttempts) {
        const delay = reconnectDelay * 2 ** attemptRef.current;
        attemptRef.current += 1;
        setReconnecting(true);
        setReconnectAttempt(attemptRef.current);
        reconnectTimerRef.current = setTimeout(() => {
          if (isMountedRef.current) connect();
        }, delay);
      } else {
        setReconnecting(false);
        setReconnectAttempt(0);
      }
    };
  }, [url, reconnectDelay, maxReconnectAttempts, setWsConnected]);

  // Connect on mount, disconnect on unmount
  useEffect(() => {
    isMountedRef.current = true;
    connect();

    return () => {
      isMountedRef.current = false;
      clearReconnectTimer();
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
      setWsConnected(false);
    };
    // connect is stable (useCallback with stable deps); only re-run if url changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearReconnectTimer, connect, setWsConnected]);

  const send = useCallback(
    (data: unknown) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(typeof data === 'string' ? data : JSON.stringify(data));
      } else if (reconnecting) {
        // Buffer messages while reconnecting so they're sent on reconnect
        sendBufferRef.current.push(data);
      }
    },
    [reconnecting],
  );

  const disconnect = useCallback(() => {
    clearReconnectTimer();
    // Set max attempts so it won't reconnect after explicit disconnect
    attemptRef.current = maxReconnectAttempts;
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
      wsRef.current = null;
    }
    setConnected(false);
    setWsConnected(false);
  }, [clearReconnectTimer, maxReconnectAttempts, setWsConnected]);

  return { connected, reconnecting, reconnectAttempt, send, disconnect };
}
