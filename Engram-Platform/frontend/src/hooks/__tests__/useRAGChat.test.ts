import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRAGChat } from '../useRAGChat';

// Mock memoryClient to prevent real API calls
vi.mock('@/src/lib/memory-client', () => ({
  memoryClient: {
    searchMemories: vi.fn().mockResolvedValue({ data: { results: [] }, error: null }),
  },
}));

describe('useRAGChat', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
    mockFetch.mockReset();
    // Default: connectivity check succeeds
    mockFetch.mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('initializes with empty messages and not connected', () => {
    const { result } = renderHook(() => useRAGChat());

    expect(result.current.messages).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe(null);
    expect(result.current.lmStudioConnected).toBe(false);
  });

  it('clears messages and error', () => {
    const { result } = renderHook(() => useRAGChat());

    act(() => {
      result.current.clearMessages();
    });

    expect(result.current.messages).toEqual([]);
    expect(result.current.error).toBe(null);
  });

  it('checks LM Studio connectivity on mount', async () => {
    const { result } = renderHook(() => useRAGChat());

    await waitFor(() => {
      expect(result.current.lmStudioConnected).toBe(true);
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:1234/v1/models',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('sets lmStudioConnected to false when connectivity check fails', async () => {
    mockFetch.mockRejectedValue(new Error('Connection refused'));

    const { result } = renderHook(() => useRAGChat());

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    expect(result.current.lmStudioConnected).toBe(false);
  });

  it('sends message and processes streaming response', async () => {
    const { result } = renderHook(() => useRAGChat());

    await waitFor(() => {
      expect(result.current.lmStudioConnected).toBe(true);
    });

    // Setup streaming response for the chat completions call
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            'data: {"choices":[{"delta":{"content":"Hello"},"finish_reason":null}]}\n\n',
          ),
        );
        controller.enqueue(
          encoder.encode(
            'data: {"choices":[{"delta":{"content":" world"},"finish_reason":null}]}\n\n',
          ),
        );
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      },
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      body: stream,
    });

    await act(async () => {
      await result.current.sendMessage('Hello, test message');
    });

    expect(result.current.messages.length).toBeGreaterThanOrEqual(2);
    expect(result.current.messages[0].role).toBe('user');
    expect(result.current.messages[0].content).toBe('Hello, test message');
    expect(result.current.messages[1].role).toBe('assistant');
    expect(result.current.messages[1].content).toBe('Hello world');
    expect(result.current.isLoading).toBe(false);
  });

  it('does not send empty messages', async () => {
    const { result } = renderHook(() => useRAGChat());

    await waitFor(() => {
      expect(result.current.lmStudioConnected).toBe(true);
    });

    const fetchCallsBefore = mockFetch.mock.calls.length;

    await act(async () => {
      await result.current.sendMessage('   ');
    });

    // No additional fetch calls beyond connectivity check
    expect(mockFetch.mock.calls.length).toBe(fetchCallsBefore);
    expect(result.current.messages).toEqual([]);
  });

  it('handles streaming error gracefully', async () => {
    const { result } = renderHook(() => useRAGChat());

    await waitFor(() => {
      expect(result.current.lmStudioConnected).toBe(true);
    });

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: () => Promise.resolve('Internal Server Error'),
    });

    await act(async () => {
      await result.current.sendMessage('Hello');
    });

    expect(result.current.error).toBeTruthy();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.lmStudioConnected).toBe(false);
  });
});
