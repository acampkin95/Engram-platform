// Canonical type re-exports for the Engram Platform frontend.
// Import all types from here — never re-define locally.

export type {
  CrawlerStats,
  CrawlJob,
  CrawlResult,
  Investigation,
  KnowledgeGraph,
  KnowledgeGraphEdge,
  KnowledgeGraphNode,
} from './crawler';

export type {
  Matter,
  Memory,
  MemoryAnalytics,
  MemoryEntity,
  MemoryKnowledgeGraph,
  MemoryRelation,
  MemorySearchResult,
} from './memory';
