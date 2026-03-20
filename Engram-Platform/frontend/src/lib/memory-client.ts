export interface SearchResult extends Record<string, unknown> {
  id: string;
  memory_id?: string;
  url?: string;
  snippet?: string;
  relevance_score?: number;
  crawl_id: string;
  tags: string[];
  title?: string;
  content?: string;
  created_at?: string;
  updated_at?: string;
  project_id?: string;
}

export interface Entity {
  id: string;
  entity_id: string;
  name: string;
  type: string;
  entity_type: string;
  [key: string]: unknown;
}

export interface Relation {
  id: string;
  relation_id: string;
  source: string;
  source_id: string;
  target: string;
  target_id: string;
  label?: string;
  type?: string;
  relation_type?: string;
  [key: string]: unknown;
}

export interface Matter {
  matter_id: string;
  title?: string;
  description?: string;
  status?: string;
  created_at?: string;
  lead_investigator?: string;
  tags?: string[];
  [key: string]: unknown;
}

export interface AnalyticsResponse {
  total_memories: number;
  total_entities: number;
  total_relations: number;
  cache_hit_rate: number | null;
  average_crawl_time_ms: number | null;
  memory_distribution?: Record<string, unknown>;
  tier_distribution?: Record<string, unknown>;
  activities?: Array<{
    id: string;
    type: string;
    content: string;
    timestamp: string;
  }>;
}

export interface HealthResponse {
  status: string;
  version?: string;
  redis?: Record<string, unknown>;
  database?: Record<string, unknown>;
  cache?: Record<string, unknown>;
}

export type ListMemoriesResponse = { memories: SearchResult[]; total: number };
export type MatterListResponse = { matters: Matter[]; total: number };

export interface KnowledgeGraphResponse {
  entities: Entity[];
  relationships?: Relation[];
  relations: Relation[];
}

export interface AddMemoryRequest {
  content: string;
  matter_id?: string;
  project_id?: string;
  tags?: string[];
  tier?: string;
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
}

const ok = <T>(data: T) => ({ data, error: null as string | null });

export const memoryClient = {
  async getHealth() {
    return ok<HealthResponse>({ status: 'unknown' });
  },
  async getAnalytics() {
    return ok<AnalyticsResponse>({
      total_memories: 0,
      total_entities: 0,
      total_relations: 0,
      cache_hit_rate: null,
      average_crawl_time_ms: null,
    });
  },
  async getMemories(_params?: Record<string, unknown>) {
    return ok<ListMemoriesResponse>({ memories: [], total: 0 });
  },
  async searchMemories(_query: string, _params?: Record<string, unknown>) {
    return ok<{ results: SearchResult[]; total: number }>({ results: [], total: 0 });
  },
  async getMatters() {
    return ok<MatterListResponse>({ matters: [], total: 0 });
  },
  async getKnowledgeGraph(_matterId?: string) {
    return ok<KnowledgeGraphResponse>({ entities: [], relationships: [], relations: [] });
  },
  async createMemory(_payload: AddMemoryRequest) {
    return ok<Record<string, unknown>>({});
  },
  async updateMemory(_memoryId: string, _payload: Partial<AddMemoryRequest>) {
    return ok<Record<string, unknown>>({});
  },
  async deleteMemory(_memoryId: string) {
    return ok<Record<string, unknown>>({});
  },
  async runDecay() {
    return ok<Record<string, unknown>>({});
  },
  async consolidateMemories() {
    return ok<Record<string, unknown>>({});
  },
  async cleanupExpired() {
    return ok<Record<string, unknown>>({});
  },
  async createMatter(_payload: Record<string, unknown>) {
    return ok<Record<string, unknown>>({});
  },
  async updateMatter(_matterId: string, _payload: Record<string, unknown>) {
    return ok<Record<string, unknown>>({});
  },
  async deleteMatter(_matterId: string) {
    return ok<Record<string, unknown>>({});
  },
};
