// Memory TypeScript types — based on AiMemory API models.
// All memory pages and components import from here.
//
// NOTE: total_relations is intentionally OMITTED from MemoryAnalytics.
// The /analytics/knowledge-graph-stats endpoint always returns 0 for this field (known API bug).

export interface Memory {
  id: string;
  content: string;
  matter_id?: string;
  metadata?: Record<string, unknown>;
  tags?: string[];
  created_at: string;
  updated_at: string;
}

export interface Matter {
  id: string;
  name: string;
  description?: string;
  memory_count: number;
  created_at: string;
}

export interface MemoryEntity {
  id: string;
  name: string;
  type: string;
  properties?: Record<string, unknown>;
}

export interface MemoryRelation {
  id: string;
  source_id: string;
  target_id: string;
  relation_type: string;
  properties?: Record<string, unknown>;
}

export interface MemoryKnowledgeGraph {
  nodes: MemoryEntity[];
  edges: MemoryRelation[];
}

export interface MemoryAnalytics {
  total_memories: number;
  total_matters: number;
  total_entities: number;
  // NOTE: total_relations is intentionally OMITTED — known bug in API (always returns 0)
}

export interface MemorySearchResult {
  memory: Memory;
  score: number;
  highlights?: string[];
}
