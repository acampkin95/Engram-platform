// Canonical types for the AI Memory dashboard.
// All pages and components import from here — never re-define these locally.

export type MemoryTier = 1 | 2 | 3;

export interface Memory {
  memory_id: string;
  content: string;
  summary: string | null;
  tier: MemoryTier;
  memory_type: string;
  source: string;
  project_id: string | null;
  user_id: string | null;
  tenant_id: string;
  importance: number;
  confidence: number;
  tags: string[];
  created_at: string; // ISO-8601
  score: number;
  distance: number | null;
}

export interface Stats {
  total_memories: number;
  tier1_count: number;
  tier2_count: number;
  tier3_count: number;
  by_type: Record<string, number>;
  oldest_memory: string | null;
  newest_memory: string | null;
  avg_importance: number;
  importance_distribution?: { low: number; medium: number; high: number };
}

export interface HealthStatus {
  status: string;
  weaviate: boolean;
  redis: boolean;
  initialized: boolean;
}

export interface TenantProjectContext {
  tenantId: string;
  projectId: string;
}

// Analytics endpoint response types

export interface MemoryGrowthPoint {
  date: string; // "YYYY-MM-DD"
  total: number;
  tier1: number;
  tier2: number;
  tier3: number;
}

export interface ActivityDay {
  date: string; // "YYYY-MM-DD"
  count: number;
}

export interface SearchStats {
  total_searches: number;
  avg_score: number;
  top_queries: Array<{ query: string; count: number; avg_score: number }>;
  score_distribution: Array<{ bucket: string; count: number }>;
}

export interface SystemMetrics {
  weaviate_latency_ms: number;
  redis_latency_ms: number;
  api_uptime_seconds: number;
  requests_per_minute: number;
  error_rate: number;
}

export interface KnowledgeGraphStats {
  entities_by_type: Record<string, number>;
  total_entities: number;
  total_relations: number;
}
