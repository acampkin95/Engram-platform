import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useHealthPolling } from '@/src/hooks/useHealthPolling';

const mockSetServiceStatus = vi.fn();
const mockMemoryGetHealth = vi.fn();
const mockCrawlerGetHealth = vi.fn();

vi.mock('@/src/stores/uiStore', () => ({
  useUIStore: () => ({
    setServiceStatus: mockSetServiceStatus,
  }),
}));

vi.mock('@/src/lib/memory-client', () => ({
  memoryClient: {
    getHealth: (...args: unknown[]) => mockMemoryGetHealth(...args),
  },
}));

vi.mock('@/src/lib/crawler-client', () => ({
  crawlerClient: {
    getHealth: (...args: unknown[]) => mockCrawlerGetHealth(...args),
  },
}));

describe('useHealthPolling', () => {
  beforeEach(() => {
    vi.useRealTimers();
    mockSetServiceStatus.mockReset();
    mockMemoryGetHealth.mockReset();
    mockCrawlerGetHealth.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('runs initial health check and marks services online', async () => {
    mockMemoryGetHealth.mockResolvedValue({ error: null });
    mockCrawlerGetHealth.mockResolvedValue({ error: null });

    renderHook(() => useHealthPolling(0));

    await waitFor(() => {
      expect(mockMemoryGetHealth).toHaveBeenCalledTimes(1);
      expect(mockCrawlerGetHealth).toHaveBeenCalledTimes(1);
    });

    expect(mockSetServiceStatus).toHaveBeenCalledWith({ memory: 'online' });
    expect(mockSetServiceStatus).toHaveBeenCalledWith({ crawler: 'online' });
  });

  it('marks services offline when requests fail or return errors', async () => {
    mockMemoryGetHealth.mockRejectedValue(new Error('memory down'));
    mockCrawlerGetHealth.mockResolvedValue({ error: 'crawler unhealthy' });

    renderHook(() => useHealthPolling(0));

    await waitFor(() => {
      expect(mockSetServiceStatus).toHaveBeenCalledWith({ memory: 'offline' });
      expect(mockSetServiceStatus).toHaveBeenCalledWith({ crawler: 'offline' });
    });
  });

  it('polls repeatedly when poll interval is enabled', async () => {
    vi.useFakeTimers();
    mockMemoryGetHealth.mockResolvedValue({ error: null });
    mockCrawlerGetHealth.mockResolvedValue({ error: null });

    renderHook(() => useHealthPolling(1000));

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockMemoryGetHealth).toHaveBeenCalledTimes(1);
    expect(mockCrawlerGetHealth).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(2000);
      await Promise.resolve();
    });

    expect(mockMemoryGetHealth.mock.calls.length).toBeGreaterThanOrEqual(3);
    expect(mockCrawlerGetHealth.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it('stops polling after unmount', async () => {
    vi.useFakeTimers();
    mockMemoryGetHealth.mockResolvedValue({ error: null });
    mockCrawlerGetHealth.mockResolvedValue({ error: null });

    const { unmount } = renderHook(() => useHealthPolling(1000));

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockMemoryGetHealth).toHaveBeenCalledTimes(1);
    expect(mockCrawlerGetHealth).toHaveBeenCalledTimes(1);

    unmount();

    const memoryCallsAtUnmount = mockMemoryGetHealth.mock.calls.length;
    const crawlerCallsAtUnmount = mockCrawlerGetHealth.mock.calls.length;

    await act(async () => {
      vi.advanceTimersByTime(3000);
    });

    expect(mockMemoryGetHealth).toHaveBeenCalledTimes(memoryCallsAtUnmount);
    expect(mockCrawlerGetHealth).toHaveBeenCalledTimes(crawlerCallsAtUnmount);
  });
});
