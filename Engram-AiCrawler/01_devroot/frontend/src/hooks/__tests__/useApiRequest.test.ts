import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useApiRequest } from '../useApiRequest';

const { mockApiRequest, MockApiError } = vi.hoisted(() => {
  class MockApiError extends Error {
    status?: number;
    data?: unknown;
    constructor(message: string, status?: number, data?: unknown) {
      super(message);
      this.name = 'ApiError';
      this.status = status;
      this.data = data;
    }
  }
  return {
    mockApiRequest: vi.fn(),
    MockApiError,
  };
});

vi.mock('../../lib/api', () => ({
  api: { request: mockApiRequest },
  ApiError: MockApiError,
}));

vi.mock('axios', () => ({
  default: {
    isCancel: vi.fn(() => false),
    isAxiosError: vi.fn(() => false),
  },
}));

describe('useApiRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts with null data, no error, not loading', () => {
    const { result } = renderHook(() => useApiRequest());
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('sets isLoading=true while request is in flight', async () => {
    let resolveRequest!: (v: unknown) => void;
    mockApiRequest.mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = resolve;
      })
    );

    const { result } = renderHook(() => useApiRequest<{ name: string }>());

    act(() => {
      result.current.execute({ url: '/test' });
    });

    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      resolveRequest({ data: { name: 'Alice' } });
    });
  });

  it('populates data and clears loading on successful request', async () => {
    mockApiRequest.mockResolvedValue({ data: { name: 'Alice' } });

    const { result } = renderHook(() => useApiRequest<{ name: string }>());

    await act(async () => {
      await result.current.execute({ url: '/test' });
    });

    expect(result.current.data).toEqual({ name: 'Alice' });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('sets error and clears loading when request throws', async () => {
    mockApiRequest.mockRejectedValue(new MockApiError('Bad request', 400));

    const { result } = renderHook(() => useApiRequest());

    await act(async () => {
      await result.current.execute({ url: '/fail' });
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).not.toBeNull();
    expect(result.current.data).toBeNull();
  });

  it('reset() clears data, error, and loading state', async () => {
    mockApiRequest.mockResolvedValue({ data: { val: 1 } });

    const { result } = renderHook(() => useApiRequest<{ val: number }>());

    await act(async () => {
      await result.current.execute({ url: '/test' });
    });

    expect(result.current.data).not.toBeNull();

    act(() => {
      result.current.reset();
    });

    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('cancel() does not throw when no request is in flight', () => {
    const { result } = renderHook(() => useApiRequest());
    expect(() => {
      act(() => {
        result.current.cancel('done');
      });
    }).not.toThrow();
  });

  it('execute() returns null and isLoading is false after error', async () => {
    mockApiRequest.mockRejectedValue(new Error('fail'));

    const { result } = renderHook(() => useApiRequest());

    let returnValue: unknown = 'not-null';
    await act(async () => {
      returnValue = await result.current.execute({ url: '/fail' });
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(returnValue).toBeNull();
  });
});
