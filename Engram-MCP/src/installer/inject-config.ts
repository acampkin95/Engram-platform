import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import type { MCPClient } from "./detect-client.js";

export interface InjectOptions {
	client: MCPClient;
	settingsPath: string;
	transport: "stdio" | "http";
	apiUrl: string;
	serverPort: number;
	authToken?: string;
}

interface StdioServerEntry {
	command: string;
	args: string[];
	env: Record<string, string>;
}

interface HttpServerEntry {
	url: string;
	env: Record<string, string>;
}

type ServerEntry = StdioServerEntry | HttpServerEntry;

function buildServerEntry(options: InjectOptions): ServerEntry {
	const { client, transport, apiUrl, serverPort } = options;

	// HTTP transport: use streamable HTTP URL format
	if (transport === "http") {
		return {
			url: `http://localhost:${serverPort}/mcp`,
			env: {
				MEMORY_API_URL: apiUrl,
			},
		};
	}

	// stdio — Cursor uses different args
	if (client === "cursor") {
		return {
			command: "npx",
			args: ["-y", "@engram/mcp", "--transport", "stdio"],
			env: {
				MEMORY_API_URL: apiUrl,
			},
		};
	}

	// Claude Code and Claude Desktop (and unknown fallback)
	return {
		command: "npx",
		args: ["-y", "@engram/mcp"],
		env: {
			MCP_TRANSPORT: "stdio",
			MEMORY_API_URL: apiUrl,
		},
	};
}

export async function injectMCPConfig(options: InjectOptions): Promise<void> {
	const { settingsPath } = options;

	// Ensure the parent directory exists
	await mkdir(dirname(settingsPath), { recursive: true });

	// Read existing config (or start with empty object)
	let existingConfig: Record<string, unknown> = {};
	try {
		const raw = await readFile(settingsPath, "utf-8");
		const parsed: unknown = JSON.parse(raw);
		if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
			existingConfig = parsed as Record<string, unknown>;
		}
	} catch (err: unknown) {
		if (
			typeof err === "object" &&
			err !== null &&
			"code" in err &&
			(err as NodeJS.ErrnoException).code === "ENOENT"
		) {
			// File does not exist yet - start with empty config (normal first-run)
		} else {
			// File exists but is malformed JSON - warn and start fresh
			process.stderr.write(
				`[engram-installer] Warning: ${settingsPath} contains invalid JSON - overwriting.\n`,
			);
		}
	}

	// Merge existing mcpServers with our entry
	const existingMcpServers: Record<string, unknown> =
		typeof existingConfig.mcpServers === "object" &&
		existingConfig.mcpServers !== null &&
		!Array.isArray(existingConfig.mcpServers)
			? (existingConfig.mcpServers as Record<string, unknown>)
			: {};

	const serverEntry = buildServerEntry(options);

	const newConfig = {
		...existingConfig,
		mcpServers: {
			...existingMcpServers,
			"engram-memory": serverEntry,
		},
	};

	await writeFile(settingsPath, `${JSON.stringify(newConfig, null, 2)}\n`, "utf-8");
}
