/**
 * Zod schemas for runtime validation
 * Provides compile-time and runtime type safety for API responses
 */

import { z } from 'zod';

// ============================================================================
// Memory Types
// ============================================================================

export const MemorySchema = z.object({
  id: z.string().uuid(),
  content: z.string().min(1),
  matter_id: z.string().uuid().optional(),
  metadata: z.record(z.unknown()).optional(),
  tags: z.array(z.string()).optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type Memory = z.infer<typeof MemorySchema>;

export const MatterSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().optional(),
  memory_count: z.number().int().min(0),
  created_at: z.string().datetime(),
});

export type Matter = z.infer<typeof MatterSchema>;

export const MemoryEntitySchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  type: z.string().min(1),
  properties: z.record(z.unknown()).optional(),
});

export type MemoryEntity = z.infer<typeof MemoryEntitySchema>;

export const MemoryRelationSchema = z.object({
  id: z.string().uuid(),
  source_id: z.string().uuid(),
  target_id: z.string().uuid(),
  relation_type: z.string().min(1),
  properties: z.record(z.unknown()).optional(),
});

export type MemoryRelation = z.infer<typeof MemoryRelationSchema>;

export const MemoryKnowledgeGraphSchema = z.object({
  nodes: z.array(MemoryEntitySchema),
  edges: z.array(MemoryRelationSchema),
});

export type MemoryKnowledgeGraph = z.infer<typeof MemoryKnowledgeGraphSchema>;

export const MemoryAnalyticsSchema = z.object({
  total_memories: z.number().int().min(0),
  total_matters: z.number().int().min(0),
  total_entities: z.number().int().min(0),
});

export type MemoryAnalytics = z.infer<typeof MemoryAnalyticsSchema>;

export const MemorySearchResultSchema = z.object({
  memory: MemorySchema,
  score: z.number().min(0).max(1),
  highlights: z.array(z.string()).optional(),
});

export type MemorySearchResult = z.infer<typeof MemorySearchResultSchema>;

// ============================================================================
// Crawler Types
// ============================================================================

export const CrawlJobStatusSchema = z.enum([
  'pending',
  'running',
  'completed',
  'failed',
  'cancelled',
]);

export type CrawlJobStatus = z.infer<typeof CrawlJobStatusSchema>;

export const CrawlJobSchema = z.object({
  id: z.string().uuid(),
  url: z.string().url(),
  status: CrawlJobStatusSchema,
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  result: z.lazy(() => CrawlResultSchema).optional(),
  error: z.string().optional(),
});

export type CrawlJob = z.infer<typeof CrawlJobSchema>;

export const CrawlResultSchema = z.object({
  id: z.string().uuid(),
  job_id: z.string().uuid(),
  url: z.string().url(),
  title: z.string().optional(),
  content: z.string().min(1),
  extracted_data: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
  created_at: z.string().datetime(),
});

export type CrawlResult = z.infer<typeof CrawlResultSchema>;

export const InvestigationStatusSchema = z.enum(['active', 'archived']);

export type InvestigationStatus = z.infer<typeof InvestigationStatusSchema>;

export const InvestigationSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().optional(),
  status: InvestigationStatusSchema,
  job_ids: z.array(z.string().uuid()),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type Investigation = z.infer<typeof InvestigationSchema>;

export const CrawlerStatsSchema = z.object({
  total_jobs: z.number().int().min(0),
  completed_jobs: z.number().int().min(0),
  failed_jobs: z.number().int().min(0),
  running_jobs: z.number().int().min(0),
});

export type CrawlerStats = z.infer<typeof CrawlerStatsSchema>;

// ============================================================================
// Knowledge Graph Types
// ============================================================================

export const KnowledgeGraphNodeSchema = z.object({
  id: z.string().uuid(),
  label: z.string().min(1),
  type: z.string().min(1),
  properties: z.record(z.unknown()).optional(),
});

export type KnowledgeGraphNode = z.infer<typeof KnowledgeGraphNodeSchema>;

export const KnowledgeGraphEdgeSchema = z.object({
  id: z.string().uuid(),
  source: z.string().uuid(),
  target: z.string().uuid(),
  label: z.string().min(1),
  properties: z.record(z.unknown()).optional(),
});

export type KnowledgeGraphEdge = z.infer<typeof KnowledgeGraphEdgeSchema>;

export const KnowledgeGraphSchema = z.object({
  nodes: z.array(KnowledgeGraphNodeSchema),
  edges: z.array(KnowledgeGraphEdgeSchema),
});

export type KnowledgeGraph = z.infer<typeof KnowledgeGraphSchema>;

// ============================================================================
// API Response Wrappers
// ============================================================================

export const ApiResponseSchema = <T extends z.ZodSchema>(dataSchema: T) =>
  z.object({
    data: dataSchema,
    error: z.string().optional(),
  });

export const PaginatedResponseSchema = <T extends z.ZodSchema>(itemSchema: T) =>
  z.object({
    items: z.array(itemSchema),
    total: z.number().int().min(0),
    page: z.number().int().min(1),
    page_size: z.number().int().min(1),
    has_more: z.boolean(),
  });

// ============================================================================
// Type Guards
// ============================================================================

export function isMemory(data: unknown): data is Memory {
  return MemorySchema.safeParse(data).success;
}

export function isCrawlJob(data: unknown): data is CrawlJob {
  return CrawlJobSchema.safeParse(data).success;
}

export function isKnowledgeGraph(data: unknown): data is KnowledgeGraph {
  return KnowledgeGraphSchema.safeParse(data).success;
}

// ============================================================================
// Parse Helpers
// ============================================================================

export function parseMemory(data: unknown): Memory {
  return MemorySchema.parse(data);
}

export function parseCrawlJob(data: unknown): CrawlJob {
  return CrawlJobSchema.parse(data);
}

export function parseKnowledgeGraph(data: unknown): KnowledgeGraph {
  return KnowledgeGraphSchema.parse(data);
}

export function safeParseMemory(data: unknown): Memory | null {
  return MemorySchema.safeParse(data).success ? (data as Memory) : null;
}

export function safeParseCrawlJob(data: unknown): CrawlJob | null {
  return CrawlJobSchema.safeParse(data).success ? (data as CrawlJob) : null;
}
