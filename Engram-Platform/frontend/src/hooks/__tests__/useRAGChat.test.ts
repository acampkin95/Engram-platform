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

  it('processes multiple SSE chunks in streaming response', async () => {
    const { result } = renderHook(() => useRAGChat());

    await waitFor(() => {
      expect(result.current.lmStudioConnected).toBe(true);
    });

    // Create a stream that sends multiple deltas
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            'data: {"choices":[{"delta":{"content":"chunk1"},"finish_reason":null}]}\n\n',
          ),
        );
        controller.enqueue(
          encoder.encode(
            'data: {"choices":[{"delta":{"content":"chunk2"},"finish_reason":null}]}\n\n',
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
      await result.current.sendMessage('Test chunks');
    });

    // After completion, message should have accumulated content
    expect(result.current.messages[1].content).toContain('chunk1');
    expect(result.current.messages[1].content).toContain('chunk2');
    expect(result.current.messages[1].isStreaming).toBe(false);
  });

  it('handles stream error and sets error state', async () => {
    const { result } = renderHook(() => useRAGChat());

    await waitFor(() => {
      expect(result.current.lmStudioConnected).toBe(true);
    });

    // Mock stream that will error
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            'data: {"choices":[{"delta":{"content":"partial"},"finish_reason":null}]}\n\n',
          ),
        );
        controller.close();
      },
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      body: stream,
    });

    await act(async () => {
      await result.current.sendMessage('First message');
    });

    // Send another message with error response
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: () => Promise.resolve('Server error'),
    });

    await act(async () => {
      await result.current.sendMessage('Second message');
    });

    // Should have error set
    expect(result.current.error).toBeTruthy();
    expect(result.current.isLoading).toBe(false);
  });

  it('flushes final content on SSE completion', async () => {
    const { result } = renderHook(() => useRAGChat());

    await waitFor(() => {
      expect(result.current.lmStudioConnected).toBe(true);
    });

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            'data: {"choices":[{"delta":{"content":"final"},"finish_reason":"stop"}]}\n\n',
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
      await result.current.sendMessage('Test');
    });

    // Final message should have content
    const lastMsg = result.current.messages[result.current.messages.length - 1];
    expect(lastMsg.content).toBe('final');
    expect(lastMsg.isStreaming).toBe(false);
  });

  it('skips malformed SSE lines and processes valid ones', async () => {
    const { result } = renderHook(() => useRAGChat());

    await waitFor(() => {
      expect(result.current.lmStudioConnected).toBe(true);
    });

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        // Valid SSE line
        controller.enqueue(
          encoder.encode(
            'data: {"choices":[{"delta":{"content":"valid"},"finish_reason":null}]}\n\n',
          ),
        );
        // Malformed JSON in SSE
        controller.enqueue(encoder.encode('data: {invalid json}\n\n'));
        // Another valid line
        controller.enqueue(
          encoder.encode(
            'data: {"choices":[{"delta":{"content":"more"},"finish_reason":null}]}\n\n',
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
      await result.current.sendMessage('Test malformed');
    });

    // Should skip malformed line and process valid ones
    expect(result.current.messages[1].content).toContain('valid');
    expect(result.current.messages[1].content).toContain('more');
  });

  it('updates conversation history after successful response', async () => {
    const { result } = renderHook(() => useRAGChat());

    await waitFor(() => {
      expect(result.current.lmStudioConnected).toBe(true);
    });

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            'data: {"choices":[{"delta":{"content":"Response"},"finish_reason":"stop"}]}\n\n',
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
      await result.current.sendMessage('First turn');
    });

    // Send second message to verify history is used
    const secondStream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            'data: {"choices":[{"delta":{"content":"Second response"},"finish_reason":"stop"}]}\n\n',
          ),
        );
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      },
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      body: secondStream,
    });

    await act(async () => {
      await result.current.sendMessage('Second turn');
    });

    // Should have 4 messages: user1, assistant1, user2, assistant2
    expect(result.current.messages.length).toBe(4);
    expect(result.current.messages[0].content).toBe('First turn');
    expect(result.current.messages[2].content).toBe('Second turn');
  });

  it('includes context memory IDs in assistant message', async () => {
    const { memoryClient } = await import('@/src/lib/memory-client');
    vi.mocked(memoryClient.searchMemories).mockResolvedValue({
      data: {
        results: [
          { id: 'mem1', content: 'Memory 1', crawl_id: 'c1', tags: [], memory_id: 'mem1' },
          { id: 'mem2', content: 'Memory 2', crawl_id: 'c2', tags: [], memory_id: 'mem2' },
        ],
        total: 2,
      },
      error: null,
    });

    const { result } = renderHook(() => useRAGChat());

    await waitFor(() => {
      expect(result.current.lmStudioConnected).toBe(true);
    });

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            'data: {"choices":[{"delta":{"content":"Response"},"finish_reason":"stop"}]}\n\n',
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
      await result.current.sendMessage('Query with context');
    });

    // Assistant message should include context memory IDs
    const assistantMsg = result.current.messages[1];
    expect(assistantMsg.contextUsed).toContain('mem1');
    expect(assistantMsg.contextUsed).toContain('mem2');
  });
});
