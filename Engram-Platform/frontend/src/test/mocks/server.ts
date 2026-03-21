import { delay, HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';

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

// ─── Crawler API Handlers ───────────────────────────────────────────────────

const crawlerHealthResponse = {
  status: 'unknown',
};

const crawlerStatsResponse = {
  total_crawls: 42,
  active_crawls: 2,
};

let jobCounter = 0;
function generateJobResponse() {
  jobCounter++;
  return {
    job_id: `job_${jobCounter}`,
    crawl_id: `crawl_${jobCounter}`,
    status: 'pending',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    url: 'https://example.com',
  };
}

const crawlerJobsListResponse = {
  jobs: [],
  count: 0,
  offset: 0,
};

const crawlerInvestigationsResponse = {
  investigations: [],
  count: 0,
};

// ─── Handlers ────────────────────────────────────────────────────────────────

export const server = setupServer(
  // Crawler health endpoint
  http.get('/api/crawler/health', async () => {
    await delay(50);
    return HttpResponse.json(crawlerHealthResponse);
  }),

  // Crawler stats endpoint
  http.get('/api/crawler/api/stats/dashboard', async () => {
    await delay(50);
    return HttpResponse.json(crawlerStatsResponse);
  }),

  // Crawler jobs endpoint
  http.get('/api/crawler/api/performance/jobs', async () => {
    await delay(50);
    return HttpResponse.json(crawlerJobsListResponse);
  }),

  // Crawler cancel job endpoint
  http.post('/api/crawler/api/crawl/cancel/:jobId', async () => {
    await delay(50);
    return HttpResponse.json({ ok: true });
  }),

  // Crawler start crawl endpoint
  http.post('/api/crawler/api/crawl/start', async () => {
    await delay(50);
    return HttpResponse.json(generateJobResponse());
  }),

  // Crawler knowledge graph endpoint
  http.post('/api/crawler/api/knowledge-graph/build', async () => {
    await delay(50);
    return HttpResponse.json({ entities: [], relationships: [] });
  }),

  // Crawler investigations endpoint
  http.get('/api/crawler/api/investigations/', async () => {
    await delay(50);
    return HttpResponse.json(crawlerInvestigationsResponse);
  }),

  // Crawler create investigation endpoint
  http.post('/api/crawler/api/investigations/', async () => {
    await delay(50);
    return HttpResponse.json({
      investigation_id: `inv_${Date.now()}`,
      title: '',
      status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }),

  // Crawler send to memory endpoint
  http.post('/api/crawler/api/crawl/deep', async () => {
    await delay(50);
    return HttpResponse.json({ ok: true });
  }),

  // Crawler search results endpoint
  http.post('/api/crawler/api/knowledge-graph/search', async () => {
    await delay(50);
    return HttpResponse.json({ results: [], total: 0 });
  }),

  // Memory health endpoint
  http.get('/api/memory/health', async () => {
    await delay(50);
    return HttpResponse.json({ status: 'healthy', version: '1.0.0' });
  }),

  // Memory analytics endpoint
  http.get('/api/memory/analytics', async () => {
    await delay(100);
    return HttpResponse.json(memoryAnalyticsResponse);
  }),

  // Memory memories endpoint (GET)
  http.get('/api/memory/memories', async () => {
    await delay(100);
    return HttpResponse.json({ memories: [], total: 0 });
  }),

  // Memory search endpoint
  http.post('/api/memory/memories/search', async () => {
    await delay(100);
    return HttpResponse.json(memorySearchResults);
  }),

  // Memory search endpoint (legacy)
  http.post('/api/memory/search', async () => {
    await delay(100);
    return HttpResponse.json(memorySearchResults);
  }),

  // Memory matters endpoint (POST)
  http.post('/api/memory/graph/query', async () => {
    await delay(100);
    return HttpResponse.json({ matters: [], total: 0 });
  }),

  // Memory create endpoint (POST)
  http.post('/api/memory/memories', async () => {
    await delay(100);
    return HttpResponse.json({ memory_id: 'mem_new', created_at: new Date().toISOString() });
  }),

  // Memory update endpoint (PUT)
  http.put('/api/memory/memories/:memoryId', async () => {
    await delay(100);
    return HttpResponse.json({ ok: true });
  }),

  // Memory delete endpoint (DELETE)
  http.delete('/api/memory/memories/:memoryId', async () => {
    await delay(100);
    return HttpResponse.json({ ok: true });
  }),

  // Memory decay endpoint (POST)
  http.post('/api/memory/memories/decay', async () => {
    await delay(100);
    return HttpResponse.json({ ok: true });
  }),

  // Memory consolidate endpoint (POST)
  http.post('/api/memory/memories/consolidate', async () => {
    await delay(100);
    return HttpResponse.json({ ok: true });
  }),

  // Memory cleanup endpoint (POST)
  http.post('/api/memory/memories/cleanup', async () => {
    await delay(100);
    return HttpResponse.json({ ok: true });
  }),

  // Matter create endpoint (POST)
  http.post('/api/memory/graph/entities', async () => {
    await delay(100);
    return HttpResponse.json({ matter_id: 'matter_new', created_at: new Date().toISOString() });
  }),

  // Matter update endpoint (PUT)
  http.put('/api/memory/graph/entities/:matterId', async () => {
    await delay(100);
    return HttpResponse.json({ ok: true });
  }),

  // Matter delete endpoint (DELETE)
  http.delete('/api/memory/graph/entities/:matterId', async () => {
    await delay(100);
    return HttpResponse.json({ ok: true });
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
