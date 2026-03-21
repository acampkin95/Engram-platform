import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('crawlerClient', () => {
  let crawlerClient: typeof import('../crawler-client')['crawlerClient'];
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.resetModules();
    fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const mod = await import('../crawler-client');
    crawlerClient = mod.crawlerClient;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getHealth', () => {
    it('calls /health and returns data', async () => {
      fetchSpy.mockResolvedValueOnce(jsonResponse({ status: 'healthy' }));
      const result = await crawlerClient.getHealth();
      expect(result.data).toEqual({ status: 'healthy' });
      expect(result.error).toBeNull();
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/health'),
        expect.any(Object),
      );
    });
  });

  describe('getStats', () => {
    it('calls /api/stats/dashboard', async () => {
      const stats = { total_crawls: 42, active_crawls: 2 };
      fetchSpy.mockResolvedValueOnce(jsonResponse(stats));
      const result = await crawlerClient.getStats();
      expect(result.data).toEqual(stats);
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/api/stats/dashboard'),
        expect.any(Object),
      );
    });
  });

  describe('getJobs', () => {
    it('calls /api/performance/jobs with params', async () => {
      fetchSpy.mockResolvedValueOnce(jsonResponse({ jobs: [], count: 0, offset: 0 }));
      const result = await crawlerClient.getJobs({ limit: 10 });
      expect(result.data).toEqual({ jobs: [], count: 0, offset: 0 });
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringMatching(/\/api\/performance\/jobs\?limit=10$/),
        expect.any(Object),
      );
    });
  });

  describe('startCrawl', () => {
    it('posts to /api/crawl/start', async () => {
      const job = {
        job_id: 'j1',
        crawl_id: 'c1',
        status: 'pending',
        created_at: '2026-01-01',
        url: 'https://example.com',
      };
      fetchSpy.mockResolvedValueOnce(jsonResponse(job));
      const result = await crawlerClient.startCrawl({ url: 'https://example.com' });
      expect(result.data).toEqual(job);
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/api/crawl/start'),
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });

  describe('cancelJob', () => {
    it('posts to /api/crawl/cancel/:id', async () => {
      fetchSpy.mockResolvedValueOnce(jsonResponse({ ok: true }));
      const result = await crawlerClient.cancelJob('c1');
      expect(result.error).toBeNull();
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/api/crawl/cancel/c1'),
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });

  describe('getInvestigations', () => {
    it('calls /api/investigations/', async () => {
      fetchSpy.mockResolvedValueOnce(jsonResponse({ investigations: [], count: 0 }));
      const result = await crawlerClient.getInvestigations();
      expect(result.data).toEqual({ investigations: [], count: 0 });
      expect(result.error).toBeNull();
    });
  });

  describe('createInvestigation', () => {
    it('posts to /api/investigations/', async () => {
      const inv = {
        investigation_id: 'inv_1',
        title: 'Test',
        status: 'pending',
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
      };
      fetchSpy.mockResolvedValueOnce(jsonResponse(inv));
      const result = await crawlerClient.createInvestigation({ title: 'Test' });
      expect(result.data).toEqual(inv);
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/api/investigations/'),
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });

  describe('getKnowledgeGraph', () => {
    it('posts to /api/knowledge-graph/build', async () => {
      fetchSpy.mockResolvedValueOnce(jsonResponse({ entities: [], relationships: [] }));
      const result = await crawlerClient.getKnowledgeGraph();
      expect(result.data).toEqual({ entities: [], relationships: [] });
    });
  });

  describe('searchResults', () => {
    it('posts to /api/knowledge-graph/search', async () => {
      fetchSpy.mockResolvedValueOnce(jsonResponse({ results: [], total: 0 }));
      const result = await crawlerClient.searchResults('test');
      expect(result.data).toEqual({ results: [], total: 0 });
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/api/knowledge-graph/search'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ query: 'test' }),
        }),
      );
    });
  });

  describe('error handling', () => {
    it('returns error on non-ok response', async () => {
      fetchSpy.mockResolvedValueOnce(jsonResponse({ error: 'Not Found' }, 404));
      const result = await crawlerClient.getHealth();
      expect(result.data).toBeNull();
      expect(result.error).toBe('Not Found');
    });

    it('returns error on network failure', async () => {
      fetchSpy.mockRejectedValueOnce(new Error('ECONNREFUSED'));
      const result = await crawlerClient.getHealth();
      expect(result.data).toBeNull();
      expect(result.error).toBe('ECONNREFUSED');
    });
  });
});
