import { describe, expect, it } from 'vitest';
import { swrKeys } from '@/src/lib/swr-keys';

describe('swrKeys', () => {
  it('returns crawler keys', () => {
    expect(swrKeys.crawler.knowledgeGraph()).toBe('/crawler/kg');
    expect(swrKeys.crawler.investigations()).toBe('/crawler/investigations');
    expect(swrKeys.crawler.stats()).toBe('/crawler/stats');
    expect(swrKeys.crawler.jobs()).toBe('/crawler/jobs');
  });

  it('returns memory graph keys for optional matter id', () => {
    expect(swrKeys.memory.knowledgeGraph()).toBe('/memory/graph');
    expect(swrKeys.memory.knowledgeGraph('matter-123')).toEqual(['/memory/graph', 'matter-123']);
  });

  it('returns memory list key with and without params', () => {
    expect(swrKeys.memory.memories()).toBe('/memory/memories');
    expect(swrKeys.memory.memories({ search: 'fraud' })).toEqual(['/memory/memories', 'fraud', '']);
    expect(swrKeys.memory.memories({ matterId: 'matter-1' })).toEqual([
      '/memory/memories',
      '',
      'matter-1',
    ]);
    expect(swrKeys.memory.memories({ search: 'fraud', matterId: 'matter-1' })).toEqual([
      '/memory/memories',
      'fraud',
      'matter-1',
    ]);
  });

  it('returns memory analytics and matters keys', () => {
    expect(swrKeys.memory.analytics()).toBe('/memory/analytics');
    expect(swrKeys.memory.matters()).toBe('/memory/matters');
  });
});
