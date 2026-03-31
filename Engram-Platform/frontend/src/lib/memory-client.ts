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

type Result<T> = { data: T | null; error: string | null };

const MEMORY_BASE = process.env.NEXT_PUBLIC_MEMORY_API_URL || '/api/memory';

async function request<T>(path: string, init?: RequestInit): Promise<Result<T>> {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((init?.headers as Record<string, string>) ?? {}),
    };
    const response = await fetch(`${MEMORY_BASE}${path}`, { ...init, headers });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      return {
        data: null,
        error: (data as { error?: string } | null)?.error ?? `Request failed (${response.status})`,
      };
    }
    return { data: data as T, error: null };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error.message : 'Network error' };
  }
}

function toQueryString(params?: Record<string, unknown>): string {
  if (!params) return '';
  const entries = Object.entries(params).filter(([, v]) => v != null);
  if (entries.length === 0) return '';
  return `?${new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString()}`;
}

export const memoryClient = {
  getHealth() {
    return request<HealthResponse>('/health');
  },
  getAnalytics() {
    return request<AnalyticsResponse>('/analytics');
  },
  getMemories(params?: Record<string, unknown>) {
    return request<ListMemoriesResponse>(`/memories${toQueryString(params)}`);
  },
  searchMemories(query: string, params?: Record<string, unknown>) {
    return request<SearchResponse>('/memories/search', {
      method: 'POST',
      body: JSON.stringify({ query, ...params }),
    });
  },
  getMatters() {
    return request<MatterListResponse>('/graph/query', {
      method: 'POST',
      body: JSON.stringify({ query_type: 'matters' }),
    });
  },
  getKnowledgeGraph(matterId?: string) {
    const body: Record<string, unknown> = { query_type: 'full_graph' };
    if (matterId) body.matter_id = matterId;
    return request<KnowledgeGraphResponse>('/graph/query', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
  createMemory(payload: AddMemoryRequest) {
    return request<Record<string, unknown>>('/memories', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  updateMemory(memoryId: string, payload: Partial<AddMemoryRequest>) {
    return request<Record<string, unknown>>(`/memories/${encodeURIComponent(memoryId)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },
  deleteMemory(memoryId: string) {
    return request<Record<string, unknown>>(`/memories/${encodeURIComponent(memoryId)}`, {
      method: 'DELETE',
    });
  },
  runDecay() {
    return request<Record<string, unknown>>('/memories/decay', { method: 'POST' });
  },
  consolidateMemories() {
    return request<Record<string, unknown>>('/memories/consolidate', { method: 'POST' });
  },
  cleanupExpired() {
    return request<Record<string, unknown>>('/memories/cleanup', { method: 'POST' });
  },
  createMatter(payload: Record<string, unknown>) {
    return request<Record<string, unknown>>('/graph/entities', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  updateMatter(matterId: string, payload: Record<string, unknown>) {
    return request<Record<string, unknown>>(`/graph/entities/${encodeURIComponent(matterId)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },
  deleteMatter(matterId: string) {
    return request<Record<string, unknown>>(`/graph/entities/${encodeURIComponent(matterId)}`, {
      method: 'DELETE',
    });
  },
};
