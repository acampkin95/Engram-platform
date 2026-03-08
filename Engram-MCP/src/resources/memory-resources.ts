import type { MemoryAPIClient } from "../client.js";
import { config } from "../config.js";
import { STATIC_RESOURCES, TIER_DOCUMENTATION, parseResourceUri } from "./enhanced-resources.js";

export { STATIC_RESOURCES as MEMORY_RESOURCES };

export async function handleResourceRequest(
	uri: string,
	client: MemoryAPIClient,
): Promise<{ contents: Array<{ uri: string; mimeType: string; text: string }> }> {
	const parsed = parseResourceUri(uri);

	if (parsed.type === "static") {
		switch (parsed.resource) {
			case "stats": {
				const stats = await client.getStats();
				return {
					contents: [
						{
							uri,
							mimeType: "application/json",
							text: JSON.stringify(stats, null, 2),
						},
					],
				};
			}

			case "health": {
				const health = await client.healthCheck();
				return {
					contents: [
						{
							uri,
							mimeType: "application/json",
							text: JSON.stringify(health, null, 2),
						},
					],
				};
			}

			case "tiers": {
				return {
					contents: [
						{
							uri,
							mimeType: "application/json",
							text: JSON.stringify(TIER_DOCUMENTATION, null, 2),
						},
					],
				};
			}

			case "config": {
				const safeConfig = {
					serverName: config.serverName,
					serverVersion: config.serverVersion,
					retry: config.retry,
					circuitBreaker: config.circuitBreaker,
					timeout: config.timeout,
				};
				return {
					contents: [
						{
							uri,
							mimeType: "application/json",
							text: JSON.stringify(safeConfig, null, 2),
						},
					],
				};
			}

			default:
				return {
					contents: [
						{
							uri,
							mimeType: "application/json",
							text: JSON.stringify({ error: "Unknown resource" }, null, 2),
						},
					],
				};
		}
	}

	const params = parsed.params ?? {};

	switch (parsed.resource) {
		case "recent": {
			const limit = Number.parseInt(params.limit ?? "10", 10);
			const result = await client.searchMemories({
				query: "recent",
				limit,
			});
			return {
				contents: [
					{
						uri,
						mimeType: "application/json",
						text: JSON.stringify(result, null, 2),
					},
				],
			};
		}

		case "project":
		case "projectRecent": {
			const limit = Number.parseInt(params.limit ?? "20", 10);
			const result = await client.searchMemories({
				query: "project",
				project_id: params.projectId,
				limit,
			});
			return {
				contents: [
					{
						uri,
						mimeType: "application/json",
						text: JSON.stringify(result, null, 2),
					},
				],
			};
		}

		case "user": {
			const result = await client.searchMemories({
				query: "user",
				user_id: params.userId,
				limit: 20,
			});
			return {
				contents: [
					{
						uri,
						mimeType: "application/json",
						text: JSON.stringify(result, null, 2),
					},
				],
			};
		}

		case "tier": {
			const tier = Number.parseInt(params.tier ?? "1", 10);
			const result = await client.searchMemories({
				query: "tier",
				tier,
				limit: 50,
			});
			return {
				contents: [
					{
						uri,
						mimeType: "application/json",
						text: JSON.stringify(result, null, 2),
					},
				],
			};
		}

		case "type": {
			const result = await client.searchMemories({
				query: params.memoryType ?? "fact",
				limit: 50,
			});
			return {
				contents: [
					{
						uri,
						mimeType: "application/json",
						text: JSON.stringify(result, null, 2),
					},
				],
			};
		}

		case "search": {
			const result = await client.searchMemories({
				query: params.query ?? "",
				limit: 20,
			});
			return {
				contents: [
					{
						uri,
						mimeType: "application/json",
						text: JSON.stringify(result, null, 2),
					},
				],
			};
		}

		case "entity": {
			const entity = await client.findEntityByName(params.entityName ?? "", "default");
			return {
				contents: [
					{
						uri,
						mimeType: "application/json",
						text: JSON.stringify(entity ?? { error: "Entity not found" }, null, 2),
					},
				],
			};
		}

		case "graph": {
			const depth = Number.parseInt(params.depth ?? "1", 10);
			const entity = await client.findEntityByName(params.entityName ?? "", "default");
			if (!entity) {
				return {
					contents: [
						{
							uri,
							mimeType: "application/json",
							text: JSON.stringify({ error: "Entity not found" }, null, 2),
						},
					],
				};
			}

			const graph = await client.queryGraph({
				entity_id: entity.entity_id,
				depth,
				tenant_id: "default",
			});

			return {
				contents: [
					{
						uri,
						mimeType: "application/json",
						text: JSON.stringify(graph, null, 2),
					},
				],
			};
		}

		default:
			return {
				contents: [
					{
						uri,
						mimeType: "application/json",
						text: JSON.stringify({ error: "Unknown resource" }, null, 2),
					},
				],
			};
	}
}
