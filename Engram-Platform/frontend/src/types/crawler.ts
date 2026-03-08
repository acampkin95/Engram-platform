/**
 * Crawler TypeScript types — based on AiCrawler FastAPI models.
 * All crawler pages and components import from here.
 *
 * IMPORTANT: This file uses discriminated unions for type-safe status handling.
 * Always use type guards or switch statements on the status field.
 */

// ============================================================================
// Status Types (Discriminated Unions)
// ============================================================================

/** Discriminated union for crawl job statuses */
export type CrawlJobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

/** Investigation status */
export type InvestigationStatus = 'active' | 'archived';

// ============================================================================
// Base Types
// ============================================================================

export interface CrawlerStats {
  total_jobs: number;
  completed_jobs: number;
  failed_jobs: number;
  running_jobs: number;
}

export interface KnowledgeGraphNode {
  id: string;
  label: string;
  type: string;
  properties?: Record<string, unknown>;
}

export interface KnowledgeGraphEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  properties?: Record<string, unknown>;
}

export interface KnowledgeGraph {
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
}

// ============================================================================
// CrawlJob Discriminated Union
// ============================================================================

/** Base crawl job - common properties */
interface BaseCrawlJob {
  id: string;
  url: string;
  created_at: string;
  updated_at: string;
}

/** Pending crawl job */
export interface CrawlJobPending extends BaseCrawlJob {
  status: 'pending';
  result?: never;
  error?: never;
}

/** Running crawl job */
export interface CrawlJobRunning extends BaseCrawlJob {
  status: 'running';
  result?: never;
  error?: never;
}

/** Completed crawl job - has result */
export interface CrawlJobCompleted extends BaseCrawlJob {
  status: 'completed';
  result: CrawlResult;
  error?: never;
}

/** Failed crawl job - has error */
export interface CrawlJobFailed extends BaseCrawlJob {
  status: 'failed';
  result?: never;
  error: string;
}

/** Cancelled crawl job */
export interface CrawlJobCancelled extends BaseCrawlJob {
  status: 'cancelled';
  result?: never;
  error?: string;
}

/** Complete discriminated union for CrawlJob */
export type CrawlJob =
  | CrawlJobPending
  | CrawlJobRunning
  | CrawlJobCompleted
  | CrawlJobFailed
  | CrawlJobCancelled;

// ============================================================================
// Type Guards
// ============================================================================

/** Type guard for pending status */
export function isCrawlJobPending(job: CrawlJob): job is CrawlJobPending {
  return job.status === 'pending';
}

/** Type guard for running status */
export function isCrawlJobRunning(job: CrawlJob): job is CrawlJobRunning {
  return job.status === 'running';
}

/** Type guard for completed status */
export function isCrawlJobCompleted(job: CrawlJob): job is CrawlJobCompleted {
  return job.status === 'completed';
}

/** Type guard for failed status */
export function isCrawlJobFailed(job: CrawlJob): job is CrawlJobFailed {
  return job.status === 'failed';
}

/** Type guard for cancelled status */
export function isCrawlJobCancelled(job: CrawlJob): job is CrawlJobCancelled {
  return job.status === 'cancelled';
}

/** Type guard for terminal states (completed, failed, cancelled) */
export function isCrawlJobTerminal(job: CrawlJob): boolean {
  return job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled';
}

/** Type guard for active states (pending, running) */
export function isCrawlJobActive(job: CrawlJob): boolean {
  return job.status === 'pending' || job.status === 'running';
}

/** Type guard for successful completion */
export function isCrawlJobSuccessful(job: CrawlJob): job is CrawlJobCompleted {
  return job.status === 'completed';
}

// ============================================================================
// Result Type
// ============================================================================

export interface CrawlResult {
  id: string;
  job_id: string;
  url: string;
  title?: string;
  content: string;
  extracted_data?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  created_at: string;
}

// ============================================================================
// Investigation Types
// ============================================================================

/** Discriminated union for Investigation */
export type Investigation = InvestigationActive | InvestigationArchived;

export interface InvestigationActive {
  id: string;
  title: string;
  description?: string;
  status: 'active';
  job_ids: string[];
  created_at: string;
  updated_at: string;
}

export interface InvestigationArchived {
  id: string;
  title: string;
  description?: string;
  status: 'archived';
  job_ids: string[];
  created_at: string;
  updated_at: string;
}

/** Type guard for active investigation */
export function isInvestigationActive(inv: Investigation): inv is InvestigationActive {
  return inv.status === 'active';
}

/** Type guard for archived investigation */
export function isInvestigationArchived(inv: Investigation): inv is InvestigationArchived {
  return inv.status === 'archived';
}

// ============================================================================
// Deprecated: Legacy types (for backward compatibility)
// ============================================================================

/**
 * @deprecated Use discriminated union types above instead.
 * This type loses type safety when accessing status-dependent fields.
 */
export interface LegacyCrawlJob {
  id: string;
  url: string;
  status: CrawlJobStatus;
  created_at: string;
  updated_at: string;
  result?: CrawlResult;
  error?: string;
}
