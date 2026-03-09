/**
 * Embedding Agent API Client
 * TypeScript client for communicating with the Python embedding agent
 */

import { z } from 'zod';

// ============== Schemas ==============

export const EmbedTextResponseSchema = z.object({
  embedding: z.array(z.number()),
  dimensions: z.number(),
  model: z.string(),
});

export const EmbedBatchResponseSchema = z.object({
  embeddings: z.array(z.array(z.number())),
  dimensions: z.number(),
  model: z.string(),
  count: z.number(),
});

export const ProcessFileResponseSchema = z.object({
  file_path: z.string(),
  success: z.boolean(),
  chunks_processed: z.number(),
  chunks_synced: z.number(),
  error: z.string().nullable(),
});

export const ProcessDirectoryResponseSchema = z.object({
  directory: z.string(),
  files_processed: z.number(),
  total_chunks: z.number(),
  errors: z.array(z.string()),
});

export const SearchResultSchema = z.object({
  content: z.string(),
  file_path: z.string(),
  file_name: z.string(),
  file_type: z.string(),
  chunk_index: z.number(),
  distance: z.number().nullable(),
});

export const SearchResponseSchema = z.object({
  results: z.array(SearchResultSchema),
  query: z.string(),
});

export const StatsResponseSchema = z.object({
  total_files: z.number(),
  synced_files: z.number(),
  unsynced_files: z.number(),
  total_chunks: z.number(),
  weaviate_chunks: z.number(),
});

export const HealthResponseSchema = z.object({
  status: z.string(),
  lm_studio: z.boolean(),
  weaviate: z.boolean(),
});

// ============== Types ==============

export type EmbedTextResponse = z.infer<typeof EmbedTextResponseSchema>;
export type EmbedBatchResponse = z.infer<typeof EmbedBatchResponseSchema>;
export type ProcessFileResponse = z.infer<typeof ProcessFileResponseSchema>;
export type ProcessDirectoryResponse = z.infer<typeof ProcessDirectoryResponseSchema>;
export type SearchResult = z.infer<typeof SearchResultSchema>;
export type SearchResponse = z.infer<typeof SearchResponseSchema>;
export type StatsResponse = z.infer<typeof StatsResponseSchema>;
export type HealthResponse = z.infer<typeof HealthResponseSchema>;

// ============== Client ==============

export interface AgentClientConfig {
  baseUrl: string;
  timeout?: number;
}

export class AgentClient {
  private baseUrl: string;
  private timeout: number;

  constructor(config: AgentClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.timeout = config.timeout ?? 30000;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    schema: z.ZodSchema<T>
  ): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`API error (${response.status}): ${error}`);
      }

      const data = await response.json();
      return schema.parse(data);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // Health check
  async health(): Promise<HealthResponse> {
    return this.request('/health', {}, HealthResponseSchema);
  }

  // Get statistics
  async stats(): Promise<StatsResponse> {
    return this.request('/stats', {}, StatsResponseSchema);
  }

  // Embed single text
  async embedText(text: string): Promise<EmbedTextResponse> {
    return this.request(
      '/embed/text',
      {
        method: 'POST',
        body: JSON.stringify({ text }),
      },
      EmbedTextResponseSchema
    );
  }

  // Embed multiple texts
  async embedBatch(texts: string[]): Promise<EmbedBatchResponse> {
    return this.request(
      '/embed/batch',
      {
        method: 'POST',
        body: JSON.stringify({ texts }),
      },
      EmbedBatchResponseSchema
    );
  }

  // Process single file
  async processFile(filePath: string): Promise<ProcessFileResponse> {
    return this.request(
      '/process/file',
      {
        method: 'POST',
        body: JSON.stringify({ file_path: filePath }),
      },
      ProcessFileResponseSchema
    );
  }

  // Process directory
  async processDirectory(
    directory: string,
    recursive = true
  ): Promise<ProcessDirectoryResponse> {
    return this.request(
      '/process/directory',
      {
        method: 'POST',
        body: JSON.stringify({ directory, recursive }),
      },
      ProcessDirectoryResponseSchema
    );
  }

  // Search
  async search(query: string, limit = 10): Promise<SearchResponse> {
    return this.request(
      '/search',
      {
        method: 'POST',
        body: JSON.stringify({ query, limit }),
      },
      SearchResponseSchema
    );
  }

  // Delete file from index
  async deleteFile(filePath: string): Promise<void> {
    const encodedPath = encodeURIComponent(filePath);
    await fetch(`${this.baseUrl}/file/${encodedPath}`, {
      method: 'DELETE',
    });
  }

  // Clear all indexed data
  async clearAll(): Promise<void> {
    await fetch(`${this.baseUrl}/clear`, {
      method: 'POST',
    });
  }
}

// Factory function
export function createAgentClient(baseUrl = 'http://127.0.0.1:8765'): AgentClient {
  return new AgentClient({ baseUrl });
}
