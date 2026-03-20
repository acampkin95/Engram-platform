/**
 * Enhanced MCP resources with dynamic capabilities
 */

import type {
	Resource,
	ResourceTemplate,
} from "@modelcontextprotocol/sdk/types.js";

/**
 * Static resources - always available
 */
export const STATIC_RESOURCES: Resource[] = [
	{
		uri: "memory://stats",
		name: "Memory Statistics",
		description: "Overview of memory storage across all tiers",
		mimeType: "application/json",
	},
	{
		uri: "memory://health",
		name: "System Health",
		description: "Health status of the memory system components",
		mimeType: "application/json",
	},
	{
		uri: "memory://tiers",
		name: "Memory Tiers Overview",
		description: "Documentation of the 3-tier memory architecture",
		mimeType: "application/json",
	},
	{
		uri: "memory://config",
		name: "Server Configuration",
		description: "Current server configuration (non-sensitive)",
		mimeType: "application/json",
	},
];

/**
 * Resource templates for dynamic resources
 * These define URI patterns that can be expanded with parameters
 */
export const RESOURCE_TEMPLATES: ResourceTemplate[] = [
	{
		uriTemplate: "memory://recent/{limit}",
		name: "Recent Memories",
		description: "Most recently added memories",
		mimeType: "application/json",
	},
	{
		uriTemplate: "memory://project/{projectId}",
		name: "Project Memories",
		description: "Memories for a specific project",
		mimeType: "application/json",
	},
	{
		uriTemplate: "memory://project/{projectId}/recent/{limit}",
		name: "Recent Project Memories",
		description: "Recent memories for a specific project",
		mimeType: "application/json",
	},
	{
		uriTemplate: "memory://user/{userId}",
		name: "User Memories",
		description: "Memories for a specific user",
		mimeType: "application/json",
	},
	{
		uriTemplate: "memory://tier/{tier}",
		name: "Tier Memories",
		description: "Memories in a specific tier (1, 2, or 3)",
		mimeType: "application/json",
	},
	{
		uriTemplate: "memory://type/{memoryType}",
		name: "Memories by Type",
		description: "Memories filtered by type (fact, insight, code, etc.)",
		mimeType: "application/json",
	},
	{
		uriTemplate: "memory://search/{query}",
		name: "Search Results",
		description: "Memories matching a search query",
		mimeType: "application/json",
	},
	{
		uriTemplate: "memory://entity/{entityName}",
		name: "Entity Details",
		description: "Details of a specific entity in the knowledge graph",
		mimeType: "application/json",
	},
	{
		uriTemplate: "memory://graph/{entityName}/{depth}",
		name: "Entity Graph",
		description: "Knowledge graph starting from an entity",
		mimeType: "application/json",
	},
];

/**
 * Parse a resource URI to extract parameters
 */
export function parseResourceUri(uri: string): {
	type: "static" | "dynamic";
	resource?: string;
	params?: Record<string, string>;
} {
	// Static resources
	const staticMatch = uri.match(/^memory:\/\/(\w+)$/);
	if (staticMatch) {
		return { type: "static", resource: staticMatch[1] };
	}

	// Dynamic resources
	const patterns: Array<[RegExp, string, string[]]> = [
		[/^memory:\/\/recent\/(\d+)$/, "recent", ["limit"]],
		[/^memory:\/\/project\/([^/]+)$/, "project", ["projectId"]],
		[
			/^memory:\/\/project\/([^/]+)\/recent\/(\d+)$/,
			"projectRecent",
			["projectId", "limit"],
		],
		[/^memory:\/\/user\/([^/]+)$/, "user", ["userId"]],
		[/^memory:\/\/tier\/([123])$/, "tier", ["tier"]],
		[/^memory:\/\/type\/(\w+)$/, "type", ["memoryType"]],
		[/^memory:\/\/search\/(.+)$/, "search", ["query"]],
		[/^memory:\/\/entity\/([^/]+)$/, "entity", ["entityName"]],
		[/^memory:\/\/graph\/([^/]+)\/(\d+)$/, "graph", ["entityName", "depth"]],
	];

	for (const [pattern, resource, paramNames] of patterns) {
		const match = uri.match(pattern);
		if (match) {
			const params: Record<string, string> = {};
			paramNames.forEach((name, i) => {
				params[name] = decodeURIComponent(match[i + 1]);
			});
			return { type: "dynamic", resource, params };
		}
	}

	return { type: "static" }; // Unknown, treat as static
}

/**
 * Build a resource URI from template and parameters
 */
export function buildResourceUri(
	template: string,
	params: Record<string, string | number>,
): string {
	let uri = template;
	for (const [key, value] of Object.entries(params)) {
		uri = uri.replace(`{${key}}`, encodeURIComponent(String(value)));
	}
	return uri;
}

/**
 * Resource handler interface
 */
export type ResourceHandler = (
	params: Record<string, string> | undefined,
	client: unknown,
) => Promise<{
	contents: Array<{ uri: string; mimeType: string; text: string }>;
}>;

/**
 * Tier documentation
 */
export const TIER_DOCUMENTATION = {
	tiers: [
		{
			id: 1,
			name: "Project",
			description:
				"Project-scoped memory, isolated per project. Best for project-specific knowledge, code patterns, and configurations.",
			isolation: "Full - memories only accessible within the same project",
			useCases: [
				"Project-specific code patterns",
				"Project configurations",
				"Feature decisions",
				"Project notes",
			],
			examples: {
				addMemory: {
					content: "Using React Query for data fetching in this project",
					tier: 1,
					project_id: "my-app",
					memory_type: "code",
				},
			},
		},
		{
			id: 2,
			name: "General",
			description:
				"User-specific memory shared across projects. Best for personal preferences, learned patterns, and cross-project knowledge.",
			isolation: "User-level - memories accessible across all user's projects",
			useCases: [
				"Coding preferences",
				"Learned patterns",
				"Personal workflow optimizations",
				"Cross-project insights",
			],
			examples: {
				addMemory: {
					content: "I prefer functional components over class components",
					tier: 2,
					memory_type: "preference",
				},
			},
		},
		{
			id: 3,
			name: "Global",
			description:
				"Shared knowledge available to all users. Best for common patterns, best practices, and general knowledge.",
			isolation: "None - shared across all users and tenants",
			useCases: [
				"Best practices",
				"Common patterns",
				"Documentation",
				"General knowledge",
			],
			examples: {
				addMemory: {
					content: "Always use semantic HTML for accessibility",
					tier: 3,
					memory_type: "fact",
				},
			},
		},
	],
};
