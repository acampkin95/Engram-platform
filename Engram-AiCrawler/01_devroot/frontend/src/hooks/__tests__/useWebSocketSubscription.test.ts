import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWebSocketSubscription } from '../useWebSocketSubscription';

// ---------------------------------------------------------------------------
// Mock the shared WebSocket client.
// vi.hoisted() ensures the values exist before vi.mock() hoisting runs.
// ---------------------------------------------------------------------------
const { mockOn, mockOff, mockIsConnected, mockAddStateListener, mockRemoveStateListener } = vi.hoisted(() => ({
  mockOn: vi.fn(),
  mockOff: vi.fn(),
  mockIsConnected: vi.fn(() => true),
  mockAddStateListener: vi.fn(),
  mockRemoveStateListener: vi.fn(),
}));

vi.mock('../../lib/websocket', () => ({
  wsClient: {
    on: mockOn,
    off: mockOff,
    isConnected: mockIsConnected,
    addStateListener: mockAddStateListener,
    removeStateListener: mockRemoveStateListener,
  },
}));

describe('useWebSocketSubscription', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsConnected.mockReturnValue(true);
  });

  afterEach(() => {
    // Ensure fake timers are always restored after each test.
    vi.useRealTimers();
  });

  // -------------------------------------------------------------------------
  it('subscribes to the topic on mount', () => {
    renderHook(() => useWebSocketSubscription('crawl:update'));

    expect(mockOn).toHaveBeenCalledOnce();
    expect(mockOn).toHaveBeenCalledWith('crawl:update', expect.any(Function));
  });

  // -------------------------------------------------------------------------
  it('unsubscribes from the topic on unmount', () => {
    const { unmount } = renderHook(() =>
      useWebSocketSubscription('crawl:update')
    );

    unmount();

    expect(mockOff).toHaveBeenCalledWith('crawl:update');
  });

  // -------------------------------------------------------------------------
  it('parses incoming messages and updates data state', () => {
    const { result } = renderHook(() =>
      useWebSocketSubscription<{ id: string; value: number }>('stats:live')
    );

    // Grab the handler that was registered
    const handler = mockOn.mock.calls[0][1] as (d: unknown) => void;

    act(() => {
      handler({ id: 'abc', value: 42 });
    });

    expect(result.current.data).toEqual({ id: 'abc', value: 42 });
  });

  // -------------------------------------------------------------------------
  it('starts with null data', () => {
    const { result } = renderHook(() => useWebSocketSubscription('topic'));
    expect(result.current.data).toBeNull();
  });

  // -------------------------------------------------------------------------
  it('reflects connection state from wsClient', () => {
    mockIsConnected.mockReturnValue(true);
    const { result } = renderHook(() => useWebSocketSubscription('topic'));

    expect(result.current.isConnected).toBe(true);
  });

  // -------------------------------------------------------------------------
  it('updates isConnected via state listener', () => {
    mockIsConnected.mockReturnValue(false);

    const { result } = renderHook(() => useWebSocketSubscription('topic'));

    expect(result.current.isConnected).toBe(false);
    expect(mockAddStateListener).toHaveBeenCalledOnce();

    const stateHandler = mockAddStateListener.mock.calls[0][0] as (s: string) => void;

    act(() => {
      stateHandler('connected');
    });

    expect(result.current.isConnected).toBe(true);
  });

  // -------------------------------------------------------------------------
  it('does not double-subscribe when subscribe() is called manually', () => {
    const { result } = renderHook(() => useWebSocketSubscription('topic'));

    act(() => {
      result.current.subscribe();
      result.current.subscribe();
    });

    // Mount already registered once; manual calls should be no-ops.
    expect(mockOn).toHaveBeenCalledOnce();
  });

  // -------------------------------------------------------------------------
  it('removes state listener on unmount', () => {
    const { unmount } = renderHook(() => useWebSocketSubscription('topic'));
    unmount();

    expect(mockRemoveStateListener).toHaveBeenCalledOnce();
    expect(mockRemoveStateListener).toHaveBeenCalledWith(expect.any(Function));
  });

  // -------------------------------------------------------------------------
  it('re-subscribes when topic changes', () => {
    const { rerender } = renderHook(
      ({ topic }: { topic: string }) => useWebSocketSubscription(topic),
      { initialProps: { topic: 'topic-a' } }
    );

    expect(mockOn).toHaveBeenCalledWith('topic-a', expect.any(Function));

    rerender({ topic: 'topic-b' });

    // Old topic unsubscribed (effect cleanup), new topic subscribed.
    expect(mockOff).toHaveBeenCalledWith('topic-a');
    expect(mockOn).toHaveBeenCalledWith('topic-b', expect.any(Function));
  });
});
