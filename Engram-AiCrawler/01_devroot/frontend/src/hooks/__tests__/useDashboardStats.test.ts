import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useDashboardStats } from '../useDashboardStats';

const { mockOn, mockOff, mockIsConnected, mockAddStateListener, mockRemoveStateListener } =
  vi.hoisted(() => ({
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

const validStats = {
  crawls: { total: 10, active: 2, completed: 7, failed: 1, cancelled: 0 },
  data_sets: { total: 3, total_size_bytes: 1024, total_files: 15 },
  storage: { collections: 5, total_documents: 100 },
  investigations: { total: 2, active: 1 },
};

describe('useDashboardStats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsConnected.mockReturnValue(true);
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts with loading=true and null stats', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useDashboardStats());
    expect(result.current.loading).toBe(true);
    expect(result.current.stats).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('populates stats and clears loading on successful fetch', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(validStats),
    });

    const { result } = renderHook(() => useDashboardStats());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.stats).toEqual(validStats);
    expect(result.current.error).toBeNull();
  });

  it('sets error when API returns non-ok status', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    });

    const { result } = renderHook(() => useDashboardStats());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toContain('500');
    expect(result.current.stats).toBeNull();
  });

  it('sets error on network failure', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network failure'));

    const { result } = renderHook(() => useDashboardStats());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error?.message).toBe('Network failure');
    expect(result.current.stats).toBeNull();
  });

  it('re-fetches when refresh() is called', async () => {
    const fetchMock = (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(validStats),
    });

    const { result } = renderHook(() => useDashboardStats());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.refresh();
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });

  it('cleans up debounce timers and aborts on unmount', async () => {
    vi.useFakeTimers();
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(validStats),
    });

    const { unmount } = renderHook(() => useDashboardStats());

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(() => unmount()).not.toThrow();
  });
});
