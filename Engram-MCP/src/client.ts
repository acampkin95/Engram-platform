/**
 * HTTP client for the AI Memory System API
 *
 * Connection pooling: Node 18+ global fetch (backed by undici) pools connections
 * per-origin automatically. For additional keep-alive on legacy HTTP paths we
 * configure the global http/https agents at module load time.
 *
 * Resilience: All requests are wrapped with timeout, retry, and circuit breaker.
 */

import http from "node:http";
import https from "node:https";

import { apiCircuitBreaker } from "./circuit-breaker.js";
import { config } from "./config.js";
import { createErrorFromStatus, isRetryable } from "./errors.js";
import { logger } from "./logger.js";
import { withRetry } from "./retry.js";

// Enable TCP keep-alive on the default HTTP/HTTPS agents
http.globalAgent = new http.Agent({ keepAlive: true, maxSockets: 50 });
https.globalAgent = new https.Agent({ keepAlive: true, maxSockets: 50 });

// ---------------------------------------------------------------------------
// Fetch with timeout + retry + circuit breaker
// ---------------------------------------------------------------------------

/**
 * Wraps fetch with AbortController timeout, retry, and circuit breaker.
 * All client methods should use this instead of raw fetch.
 */
async function resilientFetch(url: string, options: RequestInit): Promise<Response> {
	const timeoutMs = config.timeout.requestMs;

	return apiCircuitBreaker.execute(async () => {
		return withRetry(
			async () => {
				const controller = new AbortController();
				const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

				try {
					const response = await fetch(url, {
						...options,
						signal: controller.signal,
					});
					return response;
				} finally {
					clearTimeout(timeoutId);
				}
			},
			{
				shouldRetry: (error) => {
					// Retry on retryable errors (network, 5xx)
					if (isRetryable(error)) return true;
					// Retry on abort/timeout
					if (error.name === "AbortError") return true;
					return false;
				},
				onRetry: (error, attempt, delayMs) => {
					logger.warn("Retrying API request", {
						url: url.slice(0, 100),
						attempt,
						delayMs,
						error: { message: error.message },
					});
				},
			},
		);
	});
}

export interface Memory {
	memory_id: string;
	content: string;
	summary?: string;
	tier: number;
	memory_type: string;
	source: string;
	project_id?: string;
	user_id?: string;
	tenant_id: string;
	importance: number;
	confidence: number;
	tags: string[];
	created_at: string;
	score?: number;
}

export interface SearchResult {
	results: Memory[];
	query: string;
	total: number;
}

export interface KnowledgeEntity {
	entity_id: string;
	name: string;
	entity_type: string;
	description?: string;
	project_id?: string;
	tenant_id: string;
	aliases: string[];
	created_at: string;
}

export interface KnowledgeRelation {
	relation_id: string;
	source_entity_id: string;
	target_entity_id: string;
	relation_type: string;
	weight: number;
	project_id?: string;
	tenant_id: string;
	context?: string;
	created_at: string;
}

export interface GraphQueryResult {
	root_entity_id: string;
	entities: KnowledgeEntity[];
	relations: KnowledgeRelation[];
	depth: number;
}

export interface Stats {
	total_memories: number;
	tier1_count: number;
	tier2_count: number;
	tier3_count: number;
	by_type: Record<string, number>;
	avg_importance: number;
}

export class MemoryAPIClient {
	private baseUrl: string;
	private readonly apiKey: string | undefined;

	constructor(baseUrl: string) {
		this.baseUrl = baseUrl.replace(/\/$/, "");
		this.apiKey = process.env.AI_MEMORY_API_KEY;
	}

	private getHeaders(): Record<string, string> {
		const headers: Record<string, string> = {
			"Content-Type": "application/json",
		};
		if (this.apiKey) {
			headers["X-API-Key"] = this.apiKey;
		}
		return headers;
	}

	private async parseJSON<T>(response: Response): Promise<T> {
		return (await response.json()) as T;
	}

	async addMemory(data: {
		content: string;
		tier?: number;
		memory_type?: string;
		project_id?: string;
		user_id?: string;
		tenant_id?: string;
		importance?: number;
		tags?: string[];
	}): Promise<{ memory_id: string; tier: number }> {
		const response = await resilientFetch(`${this.baseUrl}/memories`, {
			method: "POST",
			headers: this.getHeaders(),
			body: JSON.stringify(data),
		});

		if (!response.ok) {
			throw createErrorFromStatus(response.status, response.statusText);
		}

		return this.parseJSON<{ memory_id: string; tier: number }>(response);
	}

	async searchMemories(params: {
		query: string;
		tier?: number;
		project_id?: string;
		user_id?: string;
		tenant_id?: string;
		limit?: number;
	}): Promise<SearchResult> {
		const response = await resilientFetch(`${this.baseUrl}/memories/search`, {
			method: "POST",
			headers: this.getHeaders(),
			body: JSON.stringify(params),
		});

		if (!response.ok) {
			throw createErrorFromStatus(response.status, response.statusText);
		}

		return this.parseJSON<SearchResult>(response);
	}

	async getMemory(memoryId: string, tier: number, tenantId?: string): Promise<Memory | null> {
		const url = new URL(`${this.baseUrl}/memories/${memoryId}`);
		url.searchParams.set("tier", String(tier));
		if (tenantId) {
			url.searchParams.set("tenant_id", tenantId);
		}

		const response = await resilientFetch(url.toString(), {
			headers: this.getHeaders(),
		});

		if (response.status === 404) {
			return null;
		}

		if (!response.ok) {
			throw createErrorFromStatus(response.status, response.statusText);
		}

		return this.parseJSON<Memory>(response);
	}

	async deleteMemory(memoryId: string, tier: number, tenantId?: string): Promise<boolean> {
		const url = new URL(`${this.baseUrl}/memories/${memoryId}`);
		url.searchParams.set("tier", String(tier));
		if (tenantId) {
			url.searchParams.set("tenant_id", tenantId);
		}

		const response = await resilientFetch(url.toString(), {
			method: "DELETE",
			headers: this.getHeaders(),
		});

		return response.ok;
	}

	async getStats(tenantId?: string): Promise<Stats> {
		const url = new URL(`${this.baseUrl}/stats`);
		if (tenantId) {
			url.searchParams.set("tenant_id", tenantId);
		}

		const response = await resilientFetch(url.toString(), {
			headers: this.getHeaders(),
		});

		if (!response.ok) {
			throw createErrorFromStatus(response.status, response.statusText);
		}

		return this.parseJSON<Stats>(response);
	}

	async healthCheck(): Promise<{
		status: string;
		weaviate: boolean;
		redis: boolean;
	}> {
		const response = await resilientFetch(`${this.baseUrl}/health`, {
			headers: this.getHeaders(),
		});
		if (!response.ok) {
			throw createErrorFromStatus(response.status, response.statusText);
		}
		return this.parseJSON<{ status: string; weaviate: boolean; redis: boolean }>(response);
	}

	async batchAddMemories(data: {
		memories: Array<{
			content: string;
			tier?: number;
			memory_type?: string;
			project_id?: string;
			user_id?: string;
			tenant_id?: string;
			importance?: number;
			tags?: string[];
		}>;
	}): Promise<{ memory_ids: string[]; failed: number; total: number }> {
		const response = await resilientFetch(`${this.baseUrl}/memories/batch`, {
			method: "POST",
			headers: this.getHeaders(),
			body: JSON.stringify(data),
		});

		if (!response.ok) {
			throw createErrorFromStatus(response.status, response.statusText);
		}

		return this.parseJSON<{ memory_ids: string[]; failed: number; total: number }>(response);
	}

	async buildContext(params: {
		query: string;
		tier?: number;
		project_id?: string;
		user_id?: string;
		session_id?: string;
		max_tokens?: number;
	}): Promise<{ query: string; context: string; token_estimate: number }> {
		const response = await resilientFetch(`${this.baseUrl}/memories/context`, {
			method: "POST",
			headers: this.getHeaders(),
			body: JSON.stringify(params),
		});

		if (!response.ok) {
			throw createErrorFromStatus(response.status, response.statusText);
		}

		return this.parseJSON<{ query: string; context: string; token_estimate: number }>(response);
	}

	async ragQuery(params: {
		query: string;
		tier?: number;
		project_id?: string;
		user_id?: string;
		session_id?: string;
	}): Promise<{
		query: string;
		mode: string;
		synthesis_prompt: string;
		source_count: number;
		context: Record<string, unknown>;
	}> {
		const response = await resilientFetch(`${this.baseUrl}/memories/rag`, {
			method: "POST",
			headers: this.getHeaders(),
			body: JSON.stringify(params),
		});

		if (!response.ok) {
			throw createErrorFromStatus(response.status, response.statusText);
		}

		return this.parseJSON<{
			query: string;
			mode: string;
			synthesis_prompt: string;
			source_count: number;
			context: Record<string, unknown>;
		}>(response);
	}

	async consolidateMemories(params: {
		project_id?: string;
		tenant_id?: string;
	}): Promise<{ processed: number }> {
		const response = await resilientFetch(`${this.baseUrl}/memories/consolidate`, {
			method: "POST",
			headers: this.getHeaders(),
			body: JSON.stringify(params),
		});

		if (!response.ok) {
			throw createErrorFromStatus(response.status, response.statusText);
		}

		return this.parseJSON<{ processed: number }>(response);
	}

	async cleanupExpired(params: { tenant_id?: string }): Promise<{ removed: number }> {
		const response = await resilientFetch(`${this.baseUrl}/memories/cleanup`, {
			method: "POST",
			headers: this.getHeaders(),
			body: JSON.stringify(params),
		});

		if (!response.ok) {
			throw createErrorFromStatus(response.status, response.statusText);
		}

		return this.parseJSON<{ removed: number }>(response);
	}

	async runDecay(params: { tenant_id?: string }): Promise<{ processed: number }> {
		const response = await resilientFetch(`${this.baseUrl}/memories/decay`, {
			method: "POST",
			headers: this.getHeaders(),
			body: JSON.stringify(params),
		});

		if (!response.ok) {
			throw createErrorFromStatus(response.status, response.statusText);
		}

		return this.parseJSON<{ processed: number }>(response);
	}


        async exportMemories(params: {
                tenant_id?: string;
                project_id?: string;
                tier?: number;
                format?: "json" | "csv" | "markdown";
        }): Promise<unknown> {
                const url = new URL(`${this.baseUrl}/memories/export`);
                if (params.tenant_id) url.searchParams.set("tenant_id", params.tenant_id);
                if (params.project_id) url.searchParams.set("project_id", params.project_id);
                if (params.tier) url.searchParams.set("tier", String(params.tier));
                if (params.format) url.searchParams.set("format", params.format);

                const response = await resilientFetch(url.toString(), {
                        headers: this.getHeaders(),
                });

                if (!response.ok) {
                        throw createErrorFromStatus(response.status, response.statusText);
                }

                return this.parseJSON<unknown>(response);
        }

        async bulkDeleteMemories(params: {
                memory_ids?: string[];
                project_id?: string;
                tenant_id?: string;
                tier?: number;
                before_date?: string;
        }): Promise<{ deleted_count: number }> {
                const response = await resilientFetch(`${this.baseUrl}/memories/bulk`, {
                        method: "DELETE",
                        headers: this.getHeaders(),
                        body: JSON.stringify(params),
                });

                if (!response.ok) {
                        throw createErrorFromStatus(response.status, response.statusText);
                }

                return this.parseJSON<{ deleted_count: number }>(response);
        }

        async triggerConfidenceMaintenance(params: { tenant_id?: string }): Promise<{ processed: number; contradictions_found: number }> {
                const url = new URL(`${this.baseUrl}/memories/confidence-maintenance`);
                if (params.tenant_id) {
                        url.searchParams.set("tenant_id", params.tenant_id);
                }
                const response = await resilientFetch(url.toString(), {
                        method: "POST",
                        headers: this.getHeaders(),
                });

                if (!response.ok) {
                        throw createErrorFromStatus(response.status, response.statusText);
                }

                return this.parseJSON<{ processed: number; contradictions_found: number }>(response);
        }


        async getMemoryGrowthAnalytics(tenantId?: string): Promise<unknown> {
                const url = new URL(`${this.baseUrl}/analytics/memory-growth`);
                if (tenantId) url.searchParams.set("tenant_id", tenantId);
                const response = await resilientFetch(url.toString(), { headers: this.getHeaders() });
                if (!response.ok) throw createErrorFromStatus(response.status, response.statusText);
                return this.parseJSON<unknown>(response);
        }

        async getActivityTimeline(tenantId?: string): Promise<unknown> {
                const url = new URL(`${this.baseUrl}/analytics/activity-timeline`);
                if (tenantId) url.searchParams.set("tenant_id", tenantId);
                const response = await resilientFetch(url.toString(), { headers: this.getHeaders() });
                if (!response.ok) throw createErrorFromStatus(response.status, response.statusText);
                return this.parseJSON<unknown>(response);
        }

        async getSearchStats(tenantId?: string): Promise<unknown> {
                const url = new URL(`${this.baseUrl}/analytics/search-stats`);
                if (tenantId) url.searchParams.set("tenant_id", tenantId);
                const response = await resilientFetch(url.toString(), { headers: this.getHeaders() });
                if (!response.ok) throw createErrorFromStatus(response.status, response.statusText);
                return this.parseJSON<unknown>(response);
        }

        async getKnowledgeGraphStats(tenantId?: string): Promise<unknown> {
                const url = new URL(`${this.baseUrl}/analytics/knowledge-graph-stats`);
                if (tenantId) url.searchParams.set("tenant_id", tenantId);
                const response = await resilientFetch(url.toString(), { headers: this.getHeaders() });
                if (!response.ok) throw createErrorFromStatus(response.status, response.statusText);
                return this.parseJSON<unknown>(response);
        }
async getAnalytics(tenantId?: string): Promise<unknown> {
                const url = new URL(`${this.baseUrl}/analytics`);
                if (tenantId) url.searchParams.set("tenant_id", tenantId);

                const response = await resilientFetch(url.toString(), {
                        headers: this.getHeaders(),
                });

                if (!response.ok) {
                        throw createErrorFromStatus(response.status, response.statusText);
                }

                return this.parseJSON<unknown>(response);
        }

        async getSystemMetrics(): Promise<unknown> {
                const response = await resilientFetch(`${this.baseUrl}/analytics/system-metrics`, {
                        headers: this.getHeaders(),
                });

                if (!response.ok) {
                        throw createErrorFromStatus(response.status, response.statusText);
                }

                return this.parseJSON<unknown>(response);
        }

        async createTenant(data: { tenant_id: string; name: string; config?: Record<string, unknown> }): Promise<{ tenant_id: string }> {
                const response = await resilientFetch(`${this.baseUrl}/tenants`, {
                        method: "POST",
                        headers: this.getHeaders(),
                        body: JSON.stringify(data),
                });

                if (!response.ok) {
                        throw createErrorFromStatus(response.status, response.statusText);
                }

                return this.parseJSON<{ tenant_id: string }>(response);
        }

        async listTenants(): Promise<{ tenants: unknown[] }> {
                const response = await resilientFetch(`${this.baseUrl}/tenants`, {
                        headers: this.getHeaders(),
                });

                if (!response.ok) {
                        throw createErrorFromStatus(response.status, response.statusText);
                }

                return this.parseJSON<{ tenants: unknown[] }>(response);
        }

        async deleteTenant(tenantId: string): Promise<{ success: boolean }> {
                const response = await resilientFetch(`${this.baseUrl}/tenants/${tenantId}`, {
                        method: "DELETE",
                        headers: this.getHeaders(),
                });

                if (!response.ok) {
                        throw createErrorFromStatus(response.status, response.statusText);
                }

                return this.parseJSON<{ success: boolean }>(response);
        }
async addEntity(data: {
		name: string;
		entity_type: string;
		description?: string;
		project_id?: string;
		tenant_id?: string;
		aliases?: string[];
	}): Promise<{ entity_id: string }> {
		const response = await resilientFetch(`${this.baseUrl}/graph/entities`, {
			method: "POST",
			headers: this.getHeaders(),
			body: JSON.stringify(data),
		});
		if (!response.ok) {
			throw createErrorFromStatus(response.status, response.statusText);
		}
		return this.parseJSON<{ entity_id: string }>(response);
	}

	async addRelation(data: {
		source_entity_id: string;
		target_entity_id: string;
		relation_type: string;
		weight?: number;
		project_id?: string;
		tenant_id?: string;
		context?: string;
	}): Promise<{ relation_id: string }> {
		const response = await resilientFetch(`${this.baseUrl}/graph/relations`, {
			method: "POST",
			headers: this.getHeaders(),
			body: JSON.stringify(data),
		});
		if (!response.ok) {
			throw createErrorFromStatus(response.status, response.statusText);
		}
		return this.parseJSON<{ relation_id: string }>(response);
	}

	async queryGraph(params: {
		entity_id: string;
		depth?: number;
		project_id?: string;
		tenant_id?: string;
	}): Promise<GraphQueryResult> {
		const response = await resilientFetch(`${this.baseUrl}/graph/query`, {
			method: "POST",
			headers: this.getHeaders(),
			body: JSON.stringify(params),
		});
		if (!response.ok) {
			throw createErrorFromStatus(response.status, response.statusText);
		}
		return this.parseJSON<GraphQueryResult>(response);
	}

	async getEntity(entityId: string, tenantId?: string): Promise<KnowledgeEntity | null> {
		const url = new URL(`${this.baseUrl}/graph/entities/${entityId}`);
		if (tenantId) {
			url.searchParams.set("tenant_id", tenantId);
		}
		const response = await resilientFetch(url.toString(), {
			headers: this.getHeaders(),
		});
		if (response.status === 404) {
			return null;
		}
		if (!response.ok) {
			throw createErrorFromStatus(response.status, response.statusText);
		}
		return this.parseJSON<KnowledgeEntity>(response);
	}

	async deleteEntity(entityId: string, tenantId?: string): Promise<boolean> {
		const url = new URL(`${this.baseUrl}/graph/entities/${entityId}`);
		if (tenantId) {
			url.searchParams.set("tenant_id", tenantId);
		}
		const response = await resilientFetch(url.toString(), {
			method: "DELETE",
			headers: this.getHeaders(),
		});
		return response.ok;
	}

	async findEntityByName(
		name: string,
		tenantId?: string,
		projectId?: string,
	): Promise<KnowledgeEntity | null> {
		const url = new URL(`${this.baseUrl}/graph/entities/by-name`);
		url.searchParams.set("name", name);
		if (tenantId) {
			url.searchParams.set("tenant_id", tenantId);
		}
		if (projectId) {
			url.searchParams.set("project_id", projectId);
		}
		const response = await resilientFetch(url.toString(), {
			headers: this.getHeaders(),
		});
		if (response.status === 404) {
			return null;
		}
		if (!response.ok) {
			throw createErrorFromStatus(response.status, response.statusText);
		}
		return this.parseJSON<KnowledgeEntity>(response);
	}
	async createMatter(data: {
		matter_id: string;
		title: string;
		description?: string;
		lead_investigator?: string;
		tags?: string[];
	}): Promise<Record<string, unknown>> {
		const response = await resilientFetch(`${this.baseUrl}/matters/`, {
			method: "POST",
			headers: this.getHeaders(),
			body: JSON.stringify(data),
		});
		if (!response.ok) {
			throw createErrorFromStatus(response.status, response.statusText);
		}
		return this.parseJSON<Record<string, unknown>>(response);
	}

	async ingestDocument(data: {
		matter_id: string;
		content: string;
		source_url: string;
		source_type?: string;
		metadata?: Record<string, unknown>;
	}): Promise<unknown[]> {
		const response = await resilientFetch(`${this.baseUrl}/matters/${data.matter_id}/evidence`, {
			method: "POST",
			headers: this.getHeaders(),
			body: JSON.stringify(data),
		});
		if (!response.ok) {
			throw createErrorFromStatus(response.status, response.statusText);
		}
		return this.parseJSON<unknown[]>(response);
	}

	async searchMatter(data: {
		matter_id: string;
		query: string;
		limit?: number;
	}): Promise<{ total: number; results: unknown[] }> {
		const response = await resilientFetch(
			`${this.baseUrl}/matters/${data.matter_id}/evidence/search`,
			{
				method: "POST",
				headers: this.getHeaders(),
				body: JSON.stringify({
					matter_id: data.matter_id,
					query: data.query,
					limit: data.limit ?? 10,
				}),
			},
		);
		if (!response.ok) {
			throw createErrorFromStatus(response.status, response.statusText);
		}
		return this.parseJSON<{ total: number; results: unknown[] }>(response);
	}
}
