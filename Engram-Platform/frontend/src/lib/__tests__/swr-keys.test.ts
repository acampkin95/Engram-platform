import { describe, expect, it } from 'vitest';
import { swrKeys } from '../swr-keys';

describe('swrKeys', () => {
  describe('crawler', () => {
    it('returns string keys for all crawler endpoints', () => {
      expect(swrKeys.crawler.knowledgeGraph()).toBe('/crawler/kg');
      expect(swrKeys.crawler.investigations()).toBe('/crawler/investigations');
      expect(swrKeys.crawler.stats()).toBe('/crawler/stats');
      expect(swrKeys.crawler.jobs()).toBe('/crawler/jobs');
    });
  });

  describe('memory', () => {
    it('returns string key for knowledgeGraph without matterId', () => {
      expect(swrKeys.memory.knowledgeGraph()).toBe('/memory/graph');
    });

    it('returns array key for knowledgeGraph with matterId', () => {
      expect(swrKeys.memory.knowledgeGraph('m1')).toEqual(['/memory/graph', 'm1']);
    });

    it('returns string key for memories without params', () => {
      expect(swrKeys.memory.memories()).toBe('/memory/memories');
    });

    it('returns array key for memories with params', () => {
      expect(swrKeys.memory.memories({ search: 'test', matterId: 'm1' })).toEqual([
        '/memory/memories',
        'test',
        'm1',
      ]);
    });

    it('returns array key for memories with partial params', () => {
      expect(swrKeys.memory.memories({ search: 'q' })).toEqual(['/memory/memories', 'q', '']);
    });

    it('returns string keys for analytics and matters', () => {
      expect(swrKeys.memory.analytics()).toBe('/memory/analytics');
      expect(swrKeys.memory.matters()).toBe('/memory/matters');
    });
  });
});
