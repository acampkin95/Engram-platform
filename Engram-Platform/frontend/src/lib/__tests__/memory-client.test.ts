import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('memoryClient', () => {
  let memoryClient: typeof import('../memory-client')['memoryClient'];
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.resetModules();
    fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const mod = await import('../memory-client');
    memoryClient = mod.memoryClient;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getHealth', () => {
    it('calls /health and returns data', async () => {
      fetchSpy.mockResolvedValueOnce(jsonResponse({ status: 'healthy', version: '0.1.0' }));
      const result = await memoryClient.getHealth();
      expect(result.data).toEqual({ status: 'healthy', version: '0.1.0' });
      expect(result.error).toBeNull();
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/health'),
        expect.objectContaining({
          headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
        }),
      );
    });
  });

  describe('getAnalytics', () => {
    it('calls /analytics and returns data', async () => {
      const analytics = {
        total_memories: 42,
        total_entities: 10,
        total_relations: 5,
        cache_hit_rate: 0.8,
        average_crawl_time_ms: 120,
      };
      fetchSpy.mockResolvedValueOnce(jsonResponse(analytics));
      const result = await memoryClient.getAnalytics();
      expect(result.data).toEqual(analytics);
      expect(result.error).toBeNull();
    });
  });

  describe('getMemories', () => {
    it('calls /memories with query params', async () => {
      fetchSpy.mockResolvedValueOnce(jsonResponse({ memories: [], total: 0 }));
      const result = await memoryClient.getMemories({ tier: 1, limit: 10 });
      expect(result.data).toEqual({ memories: [], total: 0 });
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringMatching(/\/memories\?tier=1&limit=10$/),
        expect.any(Object),
      );
    });

    it('calls /memories without params', async () => {
      fetchSpy.mockResolvedValueOnce(jsonResponse({ memories: [], total: 0 }));
      await memoryClient.getMemories();
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringMatching(/\/memories$/),
        expect.any(Object),
      );
    });
  });

  describe('searchMemories', () => {
    it('posts to /memories/search with query and params', async () => {
      const mockResults = {
        results: [{ id: '1', content: 'test', crawl_id: 'c1', tags: [] }],
        total: 1,
      };
      fetchSpy.mockResolvedValueOnce(jsonResponse(mockResults));
      const result = await memoryClient.searchMemories('test query', { tier: 1 });
      expect(result.data).toEqual(mockResults);
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/memories/search'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ query: 'test query', tier: 1 }),
        }),
      );
    });
  });

  describe('createMemory', () => {
    it('posts to /memories', async () => {
      fetchSpy.mockResolvedValueOnce(
        jsonResponse({ memory_id: 'm1', tier: 1, created_at: '2026-01-01' }),
      );
      const result = await memoryClient.createMemory({ content: 'hello', tags: ['test'] });
      expect(result.data).toEqual({ memory_id: 'm1', tier: 1, created_at: '2026-01-01' });
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringMatching(/\/memories$/),
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });

  describe('deleteMemory', () => {
    it('sends DELETE to /memories/:id', async () => {
      fetchSpy.mockResolvedValueOnce(jsonResponse({ ok: true }));
      const result = await memoryClient.deleteMemory('m1');
      expect(result.error).toBeNull();
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/memories/m1'),
        expect.objectContaining({ method: 'DELETE' }),
      );
    });
  });

  describe('updateMemory', () => {
    it('sends PUT to /memories/:id', async () => {
      fetchSpy.mockResolvedValueOnce(jsonResponse({ ok: true }));
      const result = await memoryClient.updateMemory('m1', { content: 'updated' });
      expect(result.error).toBeNull();
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/memories/m1'),
        expect.objectContaining({ method: 'PUT' }),
      );
    });
  });

  describe('getKnowledgeGraph', () => {
    it('posts to /graph/query', async () => {
      fetchSpy.mockResolvedValueOnce(jsonResponse({ entities: [], relations: [] }));
      const result = await memoryClient.getKnowledgeGraph();
      expect(result.data).toEqual({ entities: [], relations: [] });
    });

    it('includes matterId when provided', async () => {
      fetchSpy.mockResolvedValueOnce(jsonResponse({ entities: [], relations: [] }));
      await memoryClient.getKnowledgeGraph('matter_123');
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('matter_123'),
        }),
      );
    });
  });

  describe('maintenance operations', () => {
    it('runDecay posts to /memories/decay', async () => {
      fetchSpy.mockResolvedValueOnce(jsonResponse({ ok: true }));
      const result = await memoryClient.runDecay();
      expect(result.error).toBeNull();
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/memories/decay'),
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('consolidateMemories posts to /memories/consolidate', async () => {
      fetchSpy.mockResolvedValueOnce(jsonResponse({ ok: true }));
      const result = await memoryClient.consolidateMemories();
      expect(result.error).toBeNull();
    });

    it('cleanupExpired posts to /memories/cleanup', async () => {
      fetchSpy.mockResolvedValueOnce(jsonResponse({ ok: true }));
      const result = await memoryClient.cleanupExpired();
      expect(result.error).toBeNull();
    });
  });

  describe('error handling', () => {
    it('returns error on non-ok response', async () => {
      fetchSpy.mockResolvedValueOnce(jsonResponse({ error: 'Unauthorized' }, 401));
      const result = await memoryClient.getHealth();
      expect(result.data).toBeNull();
      expect(result.error).toBe('Unauthorized');
    });

    it('returns error on network failure', async () => {
      fetchSpy.mockRejectedValueOnce(new Error('Connection refused'));
      const result = await memoryClient.getHealth();
      expect(result.data).toBeNull();
      expect(result.error).toBe('Connection refused');
    });

    it('returns generic error when response has no error field', async () => {
      fetchSpy.mockResolvedValueOnce(jsonResponse({}, 500));
      const result = await memoryClient.getHealth();
      expect(result.data).toBeNull();
      expect(result.error).toContain('Request failed');
    });
  });
});
