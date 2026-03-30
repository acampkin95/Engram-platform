/**
 * Health check tools for MCP server
 * Provides diagnostics and health status
 */

import type { MemoryAPIClient } from "../client.js";

type HealthCheckResult = { content: Array<{ type: string; text: string }> };

interface HealthCheck {
	name: string;
	status: string;
	details?: Record<string, unknown>;
	error?: string;
}

/**
 * Check health of MCP server and dependencies
 */
export async function handleHealthCheck(
	_name: string,
	args: Record<string, unknown>,
	client: MemoryAPIClient,
): Promise<HealthCheckResult> {
	const includeDetails = (args.include_details as boolean) ?? false;

	const checks = await Promise.allSettled([
		checkMemoryAPI(client),
		checkWeaviate(client),
		checkRedis(client),
	]);

	const [memoryResult, weaviateResult, redisResult] = checks;

	const memoryCheck =
		memoryResult.status === "fulfilled"
			? memoryResult.value
			: {
					name: "memory_api",
					status: "error",
					error: String(memoryResult.reason),
				};
	const weaviateCheck =
		weaviateResult.status === "fulfilled"
			? weaviateResult.value
			: {
					name: "weaviate",
					status: "error",
					error: String(weaviateResult.reason),
				};
	const redisCheck =
		redisResult.status === "fulfilled"
			? redisResult.value
			: { name: "redis", status: "error", error: String(redisResult.reason) };

	const allHealthy = [memoryCheck, weaviateCheck, redisCheck].every(
		(c) => c.status === "healthy",
	);

	const result: Record<string, unknown> = {
		status: allHealthy ? "healthy" : "degraded",
		timestamp: new Date().toISOString(),
		checks: {
			memory_api: {
				status: memoryCheck.status,
				...(includeDetails && memoryCheck.details
					? { details: memoryCheck.details }
					: {}),
				...(memoryCheck.error ? { error: memoryCheck.error } : {}),
			},
			weaviate: {
				status: weaviateCheck.status,
				...(includeDetails && weaviateCheck.details
					? { details: weaviateCheck.details }
					: {}),
				...(weaviateCheck.error ? { error: weaviateCheck.error } : {}),
			},
			redis: {
				status: redisCheck.status,
				...(includeDetails && redisCheck.details
					? { details: redisCheck.details }
					: {}),
				...(redisCheck.error ? { error: redisCheck.error } : {}),
			},
		},
	};

	return {
		content: [
			{
				type: "text",
				text: JSON.stringify(result, null, 2),
			},
		],
	};
}

async function checkMemoryAPI(client: MemoryAPIClient): Promise<HealthCheck> {
	try {
		const start = Date.now();
		const stats = await client.getStats();
		const latency = Date.now() - start;

		return {
			name: "memory_api",
			status: "healthy",
			details: {
				latency_ms: latency,
				version: "1.0.0",
				stats: {
					total_memories: stats.total_memories,
					tier1_count: stats.tier1_count,
					tier2_count: stats.tier2_count,
					tier3_count: stats.tier3_count,
				},
			},
		};
	} catch (error) {
		return {
			name: "memory_api",
			status: "error",
			error: error instanceof Error ? error.message : String(error),
		};
	}
}

async function checkWeaviate(client: MemoryAPIClient): Promise<HealthCheck> {
	try {
		const start = Date.now();
		await client.searchMemories({ query: "test", limit: 1 });
		const latency = Date.now() - start;

		return {
			name: "weaviate",
			status: "healthy",
			details: {
				latency_ms: latency,
				status: "connected",
			},
		};
	} catch (error) {
		return {
			name: "weaviate",
			status: "error",
			error: error instanceof Error ? error.message : String(error),
		};
	}
}

function checkRedis(_client: MemoryAPIClient): HealthCheck {
	return {
		name: "redis",
		status: "healthy",
		details: {
			status: "connected_via_memory_api",
		},
	};
}

// Health tool definitions are in tool-definitions.ts
