import { delay, HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';

export const server = setupServer();

// ─── Memory API Handlers ─────────────────────────────────────────────────────

const memorySearchResults = {
  results: [
    {
      memory_id: 'mem-001',
      content: 'Test memory content about project Alpha',
      project_id: 'alpha',
      created_at: '2024-01-15T10:00:00Z',
    },
    {
      memory_id: 'mem-002',
      content: 'Another test memory for testing',
      project_id: 'beta',
      created_at: '2024-01-16T10:00:00Z',
    },
  ],
  total: 2,
};

const memoryAnalyticsResponse = {
  total_memories: 42,
  total_entities: 15,
  memories_by_tier: { tier1: 10, tier2: 20, tier3: 12 },
};

// ─── Handlers ────────────────────────────────────────────────────────────────

server.use(
  // Memory search endpoint
  http.post('/api/memory/search', async () => {
    await delay(100);
    return HttpResponse.json(memorySearchResults);
  }),

  // Memory analytics endpoint
  http.get('/api/memory/analytics', async () => {
    await delay(100);
    return HttpResponse.json(memoryAnalyticsResponse);
  }),

  // LM Studio chat completions (mock streaming)
  http.post('http://localhost:1234/v1/chat/completions', async () => {
    await delay(50);
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
        controller.enqueue(
          encoder.encode('data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n'),
        );
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      },
    });
    return new Response(stream, {
      headers: { 'Content-Type': 'text/event-stream' },
    });
  }),

  // LM Studio models list (connectivity check)
  http.get('http://localhost:1234/v1/models', async () => {
    await delay(50);
    return HttpResponse.json({
      data: [{ id: 'local-model', object: 'model' }],
    });
  }),
);
