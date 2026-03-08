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
});
