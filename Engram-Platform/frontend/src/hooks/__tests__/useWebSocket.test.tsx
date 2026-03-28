import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useWebSocket } from '@/src/hooks/useWebSocket';

// Mock the uiStore so Zustand's persist middleware (which needs localStorage)
// never runs. We only care that setWsConnected is called correctly.
const mockSetWsConnected = vi.fn();
vi.mock('@/src/stores/uiStore', () => ({
  useUIStore: (selector: (s: { setWsConnected: typeof mockSetWsConnected }) => unknown) =>
    selector({ setWsConnected: mockSetWsConnected }),
}));

// ─── Mock WebSocket ───────────────────────────────────────────────────────────
class MockWebSocket {
  static OPEN = 1;
  static CLOSED = 3;
  readyState = MockWebSocket.OPEN;
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  send = vi.fn();
  close = vi.fn();
  constructor(public url: string) {}
}

let latestSocket: MockWebSocket;

beforeEach(() => {
  vi.clearAllMocks();
  // Wrap constructor to capture the latest instance
  const CapturingMockWebSocket = class extends MockWebSocket {
    constructor(url: string) {
      super(url);
      latestSocket = this;
    }
  };
  // Copy statics so WebSocket.OPEN resolves correctly inside the hook
  Object.assign(CapturingMockWebSocket, { OPEN: 1, CLOSED: 3 });
  vi.stubGlobal('WebSocket', CapturingMockWebSocket);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useWebSocket', () => {
  it('sets connected to true and calls onConnect when socket opens', () => {
    const onConnect = vi.fn();
    const { result } = renderHook(() => useWebSocket({ url: 'ws://test', onConnect }));

    expect(result.current.connected).toBe(false);

    act(() => {
      latestSocket.onopen?.();
    });

    expect(result.current.connected).toBe(true);
    expect(onConnect).toHaveBeenCalledOnce();
    expect(mockSetWsConnected).toHaveBeenCalledWith(true);
  });

  it('sets connected to false and calls onDisconnect when socket closes', () => {
    const onDisconnect = vi.fn();
    const { result } = renderHook(() =>
      useWebSocket({ url: 'ws://test', onDisconnect, maxReconnectAttempts: 0 }),
    );

    // Open first
    act(() => {
      latestSocket.onopen?.();
    });
    expect(result.current.connected).toBe(true);

    // Then close
    act(() => {
      latestSocket.onclose?.();
    });

    expect(result.current.connected).toBe(false);
    expect(onDisconnect).toHaveBeenCalledOnce();
    expect(mockSetWsConnected).toHaveBeenCalledWith(false);
  });

  it('send() JSON-stringifies data and calls socket.send when OPEN', () => {
    const { result } = renderHook(() => useWebSocket({ url: 'ws://test' }));

    // Simulate open so readyState is OPEN
    act(() => {
      latestSocket.onopen?.();
    });

    act(() => {
      result.current.send({ type: 'ping', value: 42 });
    });

    expect(latestSocket.send).toHaveBeenCalledWith(JSON.stringify({ type: 'ping', value: 42 }));
  });

  it('disconnect() closes the socket and prevents reconnect', () => {
    const { result } = renderHook(() =>
      useWebSocket({ url: 'ws://test', maxReconnectAttempts: 5 }),
    );

    act(() => {
      latestSocket.onopen?.();
    });
    expect(result.current.connected).toBe(true);

    act(() => {
      result.current.disconnect();
    });

    expect(result.current.connected).toBe(false);
    expect(latestSocket.close).toHaveBeenCalled();
    expect(mockSetWsConnected).toHaveBeenCalledWith(false);
  });

  it('send() silently no-ops when socket is not OPEN', () => {
    const { result } = renderHook(() => useWebSocket({ url: 'ws://test' }));
    // Do NOT fire onopen — readyState stays OPEN in mock by default,
    // but we override it to CLOSED to simulate a closed socket
    latestSocket.readyState = MockWebSocket.CLOSED;

    act(() => {
      result.current.send({ type: 'test' });
    });

    expect(latestSocket.send).not.toHaveBeenCalled();
  });

  it('calls onMessage with parsed JSON when a message is received', () => {
    const onMessage = vi.fn();
    renderHook(() => useWebSocket({ url: 'ws://test', onMessage }));

    act(() => {
      latestSocket.onopen?.();
      latestSocket.onmessage?.({ data: JSON.stringify({ event: 'ping' }) });
    });

    expect(onMessage).toHaveBeenCalledWith({ event: 'ping' });
  });

  it('calls onMessage with raw string when message is not valid JSON', () => {
    const onMessage = vi.fn();
    renderHook(() => useWebSocket({ url: 'ws://test', onMessage }));

    act(() => {
      latestSocket.onopen?.();
      latestSocket.onmessage?.({ data: 'raw non-json message' });
    });

    expect(onMessage).toHaveBeenCalledWith('raw non-json message');
  });

  it('handles URL with query params when appending token', () => {
    const { result } = renderHook(() =>
      useWebSocket({ url: 'ws://test?existing=param', token: 'mytoken' }),
    );

    expect(result.current).toBeDefined();
    // Socket URL should include both existing param and token
    expect(latestSocket.url).toContain('token=mytoken');
  });

  it('implements exponential backoff reconnect delay', async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() =>
      useWebSocket({ url: 'ws://test', reconnectDelay: 100, maxReconnectAttempts: 3 }),
    );

    // Open and close to trigger reconnect
    act(() => {
      latestSocket.onopen?.();
    });
    expect(result.current.connected).toBe(true);

    act(() => {
      latestSocket.onclose?.();
    });

    expect(result.current.reconnecting).toBe(true);
    expect(result.current.reconnectAttempt).toBe(1);

    // Fast-forward first reconnect delay (100ms)
    act(() => {
      vi.advanceTimersByTime(100);
    });

    // Mock the reconnect socket and trigger its close
    const firstReconnectSocket = latestSocket;
    act(() => {
      firstReconnectSocket.onclose?.();
    });

    expect(result.current.reconnectAttempt).toBe(2);

    // Second delay should be 200ms (100 * 2^1)
    act(() => {
      vi.advanceTimersByTime(200);
    });

    vi.useRealTimers();
  });

  it('buffers messages while reconnecting and flushes on reconnect', async () => {
    const { result } = renderHook(() =>
      useWebSocket({ url: 'ws://test', maxReconnectAttempts: 2 }),
    );

    // Open first
    act(() => {
      latestSocket.onopen?.();
    });

    // Close to trigger reconnect
    act(() => {
      latestSocket.onclose?.();
    });

    expect(result.current.reconnecting).toBe(true);

    // Try to send while reconnecting
    act(() => {
      result.current.send({ buffered: true });
    });

    // Message should be buffered, not sent (socket is not open)
    // Now simulate reconnect with new socket
    const reconnectSocket = latestSocket;
    act(() => {
      reconnectSocket.onopen?.();
    });

    // Messages should have been flushed
    expect(reconnectSocket.send).toHaveBeenCalled();
  });

  it('stops reconnecting after max attempts reached', async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() =>
      useWebSocket({ url: 'ws://test', reconnectDelay: 10, maxReconnectAttempts: 1 }),
    );

    act(() => {
      latestSocket.onopen?.();
    });

    act(() => {
      latestSocket.onclose?.();
    });

    expect(result.current.reconnecting).toBe(true);

    // Fast-forward past the first reconnect delay
    act(() => {
      vi.advanceTimersByTime(20);
    });

    // New socket gets created and closes without reconnecting
    const reconnectSocket = latestSocket;
    act(() => {
      reconnectSocket.onclose?.();
    });

    // Should stop reconnecting after max attempts
    expect(result.current.reconnecting).toBe(false);
    expect(result.current.reconnectAttempt).toBe(0);

    vi.useRealTimers();
  });

  it('sends string data as-is without JSON stringification', () => {
    const { result } = renderHook(() => useWebSocket({ url: 'ws://test' }));

    act(() => {
      latestSocket.onopen?.();
    });

    act(() => {
      result.current.send('raw string message');
    });

    expect(latestSocket.send).toHaveBeenCalledWith('raw string message');
  });

  it('clears reconnect timer and sets connected to false on disconnect', () => {
    const { result } = renderHook(() =>
      useWebSocket({ url: 'ws://test', maxReconnectAttempts: 5 }),
    );

    act(() => {
      latestSocket.onopen?.();
    });

    expect(result.current.connected).toBe(true);

    // Disconnect should set connected to false
    act(() => {
      result.current.disconnect();
    });

    expect(result.current.connected).toBe(false);
    expect(mockSetWsConnected).toHaveBeenCalledWith(false);
  });

  it('ignores onmessage callback if not mounted', () => {
    const onMessage = vi.fn();
    const { unmount } = renderHook(() => useWebSocket({ url: 'ws://test', onMessage }));

    act(() => {
      latestSocket.onopen?.();
    });

    unmount();

    // Simulate message after unmount
    act(() => {
      latestSocket.onmessage?.({ data: JSON.stringify({ ignored: true }) });
    });

    expect(onMessage).not.toHaveBeenCalled();
  });
});
