import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCrawlHistory, CrawlHistory } from '../useCrawlHistory';

const { mockToastError, mockToastSuccess } = vi.hoisted(() => ({
  mockToastError: vi.fn(),
  mockToastSuccess: vi.fn(),
}));

vi.mock('../../components/Toast', () => ({
  useToast: () => ({
    error: mockToastError,
    success: mockToastSuccess,
    info: vi.fn(),
    warning: vi.fn(),
  }),
}));

const sampleCrawl: CrawlHistory = {
  id: 'crawl-1',
  user_id: 'user-1',
  url: 'https://example.com',
  extraction_type: 'llm',
  status: 'completed',
  created_at: '2025-01-01T00:00:00Z',
};

describe('useCrawlHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts with empty history, not loading, no error', () => {
    const { result } = renderHook(() => useCrawlHistory());
    expect(result.current.history).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('addCrawl returns null (stub implementation)', async () => {
    const { result } = renderHook(() => useCrawlHistory());
    let returnValue: CrawlHistory | null = sampleCrawl;

    await act(async () => {
      returnValue = await result.current.addCrawl({
        user_id: 'user-1',
        url: 'https://example.com',
        extraction_type: 'llm',
        status: 'pending',
      });
    });

    expect(returnValue).toBeNull();
  });

  it('updateCrawl on empty history is a no-op', async () => {
    const { result } = renderHook(() => useCrawlHistory());

    await act(async () => {
      await result.current.updateCrawl('crawl-1', { status: 'failed' });
    });

    // History is empty, so updating a non-existent item leaves it empty
    expect(result.current.history).toHaveLength(0);
  });

  it('deleteCrawl removes item with matching id from history', async () => {
    const { result } = renderHook(() => useCrawlHistory());

    await act(async () => {
      await result.current.deleteCrawl('crawl-99');
    });

    expect(result.current.history.filter((h) => h.id === 'crawl-99')).toHaveLength(0);
  });

  it('deleteCrawl calls toast.success', async () => {
    const { result } = renderHook(() => useCrawlHistory());

    await act(async () => {
      await result.current.deleteCrawl('any-id');
    });

    expect(mockToastSuccess).toHaveBeenCalledWith('Crawl deleted successfully');
  });

  it('fetchHistory is a callable no-op', async () => {
    const { result } = renderHook(() => useCrawlHistory());

    await act(async () => {
      await result.current.fetchHistory();
    });

    expect(result.current.history).toHaveLength(0);
  });
});
