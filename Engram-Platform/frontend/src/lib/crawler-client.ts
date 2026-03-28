// Health response from crawler API
export interface HealthResponse {
  status: string;
  state?: string;
  timestamp?: string;
  version?: string;
  redis?: Record<string, unknown>;
  database?: Record<string, unknown>;
  cache?: Record<string, unknown>;
}

// Stats response from crawler API (/api/stats/dashboard)
export interface StatsResponse {
  total_jobs?: number;
  total_crawls?: number;
  active_crawls?: number;
  total?: number;
  active?: number;
  completed?: number;
  failed?: number;
  cancelled?: number;
  data_sets?: { total: number; total_size_bytes: number; total_files: number };
  storage?: { collections: number; total_documents: number };
  cache_hit_rate?: number | null;
  average_crawl_time_ms?: number | null;
}

// Job metadata and response type
export interface JobMetadata {
  url?: string;
  title?: string;
  word_count?: number;
}

// Individual job in the job queue
export interface JobResponse {
  job_id: string;
  crawl_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | string;
  created_at: string;
  updated_at?: string;
  job_type?: string;
  metadata?: JobMetadata;
  error?: string;
  result?: unknown;
  url: string;
  markdown?: string;
}

// Jobs list response (/api/performance/jobs)
export interface JobsListResponse {
  jobs: JobResponse[];
  count: number;
  offset: number;
}

// Investigation summary
export interface Investigation {
  investigation_id: string;
  title: string;
  status: string;
  priority?: string;
  created_at: string;
  updated_at: string;
  tags?: string[];
  description?: string;
  crawls?: string[];
  scans?: string[];
}

// Investigations list response
export interface InvestigationsListResponse {
  investigations: Investigation[];
  count?: number;
}

// Node in knowledge graph
export interface KnowledgeGraphNode {
  id: string;
  name: string;
  label?: string;
  type: string;
  properties?: Record<string, unknown>;
}

// Edge in knowledge graph
export interface KnowledgeGraphEdge {
  source: string;
  target: string;
  label?: string;
  type?: string;
}

// Knowledge graph response
export interface KnowledgeGraphResponse {
  nodes?: KnowledgeGraphNode[];
  edges?: KnowledgeGraphEdge[];
  entities: KnowledgeGraphNode[];
  relationships: KnowledgeGraphEdge[];
}

// Search result item
export interface SearchResult {
  id: string;
  title?: string;
  content?: string;
  relevance?: number;
  url?: string;
  snippet?: string;
  relevance_score?: number;
  crawl_id: string;
  tags: string[];
}

type Result<T> = { data: T | null; error: string | null };

const CRAWLER_BASE = process.env.NEXT_PUBLIC_CRAWLER_API_URL || '/api/crawler';

async function request<T>(path: string, init?: RequestInit): Promise<Result<T>> {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((init?.headers as Record<string, string>) ?? {}),
    };
    const response = await fetch(`${CRAWLER_BASE}${path}`, { ...init, headers });
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

export const crawlerClient = {
  getHealth() {
    return request<HealthResponse>('/health');
  },
  getStats() {
    return request<StatsResponse>('/api/stats/dashboard');
  },
  getJobs(params?: Record<string, unknown>) {
    return request<JobsListResponse>(`/api/performance/jobs${toQueryString(params)}`);
  },
  cancelJob(jobId: string) {
    return request<{ ok: boolean }>(`/api/crawl/cancel/${encodeURIComponent(jobId)}`, {
      method: 'POST',
    });
  },
  startCrawl(payload: Record<string, unknown>) {
    return request<JobResponse>('/api/crawl/start', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  getKnowledgeGraph() {
    return request<KnowledgeGraphResponse>('/api/knowledge-graph/build', {
      method: 'POST',
      body: JSON.stringify({}),
    });
  },
  getInvestigations(params?: Record<string, unknown>) {
    return request<InvestigationsListResponse>(`/api/investigations/${toQueryString(params)}`);
  },
  createInvestigation(payload: Record<string, unknown>) {
    return request<Investigation>('/api/investigations/', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  sendToMemory(payload: Record<string, unknown>) {
    return request<{ ok: boolean }>('/api/crawl/deep', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  searchResults(query: string) {
    return request<{ results: SearchResult[]; total: number }>('/api/knowledge-graph/search', {
      method: 'POST',
      body: JSON.stringify({ query }),
    });
  },
};
