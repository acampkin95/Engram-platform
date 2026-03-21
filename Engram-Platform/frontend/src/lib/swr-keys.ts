export const swrKeys = {
  crawler: {
    knowledgeGraph: () => '/crawler/kg',
    investigations: () => '/crawler/investigations',
    stats: () => '/crawler/stats',
    jobs: () => '/crawler/jobs',
  },
  memory: {
    knowledgeGraph: (matterId?: string) =>
      matterId ? ['/memory/graph', matterId] : '/memory/graph',
    memories: (params?: { search?: string; matterId?: string }) => {
      if (!params) return '/memory/memories';
      return ['/memory/memories', params.search ?? '', params.matterId ?? ''];
    },
    analytics: () => '/memory/analytics',
    matters: () => '/memory/matters',
  },
} as const;
