import { readFile, stat } from "node:fs/promises";
import http from "node:http";
import https from "node:https";
import { join } from "node:path";
import process from "node:process";

import { detectClient } from "./detect-client.js";

export interface ValidationResult {
	success: boolean;
	checks: Array<{ name: string; passed: boolean; message: string }>;
}

interface ValidateOptions {
	transport: "stdio" | "http";
	serverPort: number;
	apiUrl: string;
	settingsPath?: string;
}

/**
 * Performs an HTTP GET and returns the status code.
 * Returns 0 on error, timeout, or connection refused.
 */
function httpGetStatus(urlString: string): Promise<number> {
	return new Promise((resolve) => {
		let parsedUrl: URL;
		try {
			parsedUrl = new URL(urlString);
		} catch {
			resolve(0);
			return;
		}

		const isHttps = parsedUrl.protocol === "https:";
		const port = parsedUrl.port ? Number.parseInt(parsedUrl.port, 10) : isHttps ? 443 : 80;

		const options = {
			hostname: parsedUrl.hostname,
			port,
			path: parsedUrl.pathname || "/",
			method: "GET",
		};

		const requester = isHttps ? https : http;
		const req = requester.request(options, (res) => {
			res.resume();
			resolve(res.statusCode ?? 0);
		});

		req.setTimeout(3000, () => {
			req.destroy();
			resolve(0);
		});

		req.on("error", () => {
			resolve(0);
		});

		req.end();
	});
}

export async function validateInstall(options: ValidateOptions): Promise<ValidationResult> {
	const checks: Array<{ name: string; passed: boolean; message: string }> = [];
	const { transport, serverPort, apiUrl } = options;

	// ── Check 1: Memory API reachable ──────────────────────────────────────────
	try {
		const status = await httpGetStatus(`${apiUrl}/health`);
		const passed = status === 200;
		checks.push({
			name: "API reachable",
			passed,
			message: passed
				? `${apiUrl} responded with 200`
				: `${apiUrl}/health returned ${status === 0 ? "no response" : String(status)}`,
		});
	} catch (err) {
		checks.push({
			name: "API reachable",
			passed: false,
			message: `Failed to reach ${apiUrl}: ${err instanceof Error ? err.message : String(err)}`,
		});
	}

	// ── Check 2: MCP server reachable (HTTP transport only) ───────────────────
	if (transport === "http") {
		try {
			const mcpUrl = `http://localhost:${serverPort}/health`;
			const status = await httpGetStatus(mcpUrl);
			const passed = status === 200;
			checks.push({
				name: "MCP server reachable",
				passed,
				message: passed
					? `MCP server at port ${serverPort} responded with 200`
					: `http://localhost:${serverPort}/health returned ${status === 0 ? "no response" : String(status)}`,
			});
		} catch (err) {
			checks.push({
				name: "MCP server reachable",
				passed: false,
				message: `Failed to reach MCP server: ${err instanceof Error ? err.message : String(err)}`,
			});
		}
	}

	// -- Check 3: Settings file is valid JSON -----------------------------------
	try {
		// Use provided settingsPath if given, otherwise auto-detect
		let resolvedPath: string | undefined = options.settingsPath;
		if (!resolvedPath) {
			const { settingsPath: detected, exists } = await detectClient();
			if (!exists || !detected) {
				checks.push({
					name: "Settings file valid",
					passed: false,
					message: "No MCP client settings file found",
				});
				resolvedPath = undefined;
			} else {
				resolvedPath = detected;
			}
		}
		if (resolvedPath) {
			const raw = await readFile(resolvedPath, "utf-8");
			JSON.parse(raw);
			checks.push({
				name: "Settings file valid",
				passed: true,
				message: `${resolvedPath} is valid JSON`,
			});
		}
	} catch (err) {
		checks.push({
			name: "Settings file valid",
			passed: false,
			message: `Settings file error: ${err instanceof Error ? err.message : String(err)}`,
		});
	}

	// ── Check 4: Hookify rules present ────────────────────────────────────────
	try {
		const hookifyRulePath = join(process.cwd(), ".claude", "hookify.memory-recall.local.md");
		await stat(hookifyRulePath);
		checks.push({
			name: "Hookify rules present",
			passed: true,
			message: ".claude/hookify.memory-recall.local.md found",
		});
	} catch {
		checks.push({
			name: "Hookify rules present",
			passed: false,
			message: ".claude/hookify.memory-recall.local.md not found — did hookify rules copy succeed?",
		});
	}

	const success = checks.every((c) => c.passed);
	return { success, checks };
}
