#!/usr/bin/env node
import { homedir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import { createInterface } from "node:readline";

import { createHookifyRules } from "./create-hookify-rules.js";
import { type MCPClient, detectClient } from "./detect-client.js";
import { injectClaudeMd } from "./inject-claude-md.js";
import { injectMCPConfig } from "./inject-config.js";
import { validateInstall } from "./validate.js";

// ── ANSI colour helpers ────────────────────────────────────────────────────
const green = (s: string): string => `\x1b[32m${s}\x1b[0m`;
const red = (s: string): string => `\x1b[31m${s}\x1b[0m`;
const cyan = (s: string): string => `\x1b[36m${s}\x1b[0m`;
const bold = (s: string): string => `\x1b[1m${s}\x1b[0m`;
const dim = (s: string): string => `\x1b[2m${s}\x1b[0m`;

// ── Readline instance (one per session) ───────────────────────────────────
const rl = createInterface({
	input: process.stdin,
	output: process.stdout,
});

rl.on("SIGINT", () => {
	console.log("\n\nInstallation cancelled.");
	rl.close();
	process.exit(130);
});

/** Prompt the user for input, returning the default if they press Enter */
function prompt(question: string, defaultValue?: string): Promise<string> {
	return new Promise((resolve) => {
		const suffix =
			defaultValue !== undefined ? ` ${dim(`[${defaultValue}]`)}: ` : ": ";
		rl.question(question + suffix, (answer) => {
			resolve(answer.trim() || defaultValue || "");
		});
	});
}

/** Return the canonical settings path for a given client, even if it doesn't exist yet */
function defaultSettingsPath(client: MCPClient): string {
	const home = homedir();
	switch (client) {
		case "claude-code":
			return join(home, ".claude", "settings.json");
		case "claude-desktop":
			return process.platform === "linux"
				? join(home, ".config", "Claude", "claude_desktop_config.json")
				: join(
						home,
						"Library",
						"Application Support",
						"Claude",
						"claude_desktop_config.json",
					);
		case "cursor":
			return join(home, ".cursor", "mcp.json");
		default:
			// unknown → fall back to Claude Code
			return join(home, ".claude", "settings.json");
	}
}

const CLIENT_LABELS: Record<string, string> = {
	"claude-code": "Claude Code",
	"claude-desktop": "Claude Desktop",
	cursor: "Cursor",
};

// ── Main flow ──────────────────────────────────────────────────────────────
async function main(): Promise<void> {
	console.log("");
	console.log(bold("Welcome to Engram MCP Installer"));
	console.log("");

	// ── Step 1: Detect MCP client ────────────────────────────────────────────
	console.log("Detecting MCP client...");
	const detected = await detectClient();

	let client = detected.client;
	let settingsPath = detected.settingsPath;

	if (client === "unknown" || !settingsPath) {
		console.log(
			dim("  No MCP client settings file detected. Defaulting to Claude Code."),
		);
		client = "claude-code";
		settingsPath = defaultSettingsPath("claude-code");
	}

	const clientLabel = CLIENT_LABELS[client] ?? client;
	console.log(`${green("✓")} Detected: ${clientLabel} (${settingsPath})`);
	console.log("");

	// ── Step 2: Transport preference ─────────────────────────────────────────
	console.log("Transport preference:");
	console.log("  1) stdio (recommended for local use)");
	console.log("  2) HTTP streaming (for remote/multi-client use)");
	const transportChoice = await prompt("Choice", "1");
	const transport: "stdio" | "http" =
		transportChoice === "2" ? "http" : "stdio";

	// ── Step 3: Memory API URL ───────────────────────────────────────────────
	const apiUrl = await prompt("Memory API URL", "http://localhost:8000");

	// ── Step 4: Server port (HTTP only) ──────────────────────────────────────
	let serverPort = 3000;
	if (transport === "http") {
		const portStr = await prompt("Server port (HTTP only)", "3000");
		serverPort = Number.parseInt(portStr, 10) || 3000;
	}

	console.log("");
	console.log("Installing...");
	let hadErrors = false;

	// ── Step 5: Inject MCP config ────────────────────────────────────────────
	try {
		await injectMCPConfig({
			client,
			settingsPath,
			transport,
			apiUrl,
			serverPort,
		});
		console.log(`${green("✓")} MCP config injected into ${settingsPath}`);
	} catch (err) {
		hadErrors = true;
		console.log(
			`${red("\u2717")} Failed to inject MCP config: ${err instanceof Error ? err.message : String(err)}`,
		);
	}

	// ── Step 6: Copy hookify rules ───────────────────────────────────────────
	const claudeDir = join(process.cwd(), ".claude");
	try {
		const copied = await createHookifyRules(claudeDir);
		console.log(
			`${green("✓")} Hookify rules copied to .claude/ (${copied.length} files)`,
		);
	} catch (err) {
		hadErrors = true;
		console.log(
			`${red("\u2717")} Failed to copy hookify rules: ${err instanceof Error ? err.message : String(err)}`,
		);
	}

	// ── Step 7: Inject CLAUDE.md ─────────────────────────────────────────────
	try {
		const result = await injectClaudeMd(process.cwd());
		const resultMessages: Record<string, string> = {
			created: "CLAUDE.md created",
			updated: "CLAUDE.md updated",
			skipped: "CLAUDE.md already has memory instructions (skipped)",
		};
		console.log(
			`${green("✓")} ${resultMessages[result] ?? "CLAUDE.md processed"}`,
		);
	} catch (err) {
		hadErrors = true;
		console.log(
			`${red("\u2717")} Failed to update CLAUDE.md: ${err instanceof Error ? err.message : String(err)}`,
		);
	}

	// ── Step 8: Validation ───────────────────────────────────────────────────
	console.log("");
	console.log("Running validation...");
	const validation = await validateInstall({
		transport,
		serverPort,
		apiUrl,
		settingsPath,
	});

	for (const check of validation.checks) {
		const icon = check.passed ? green("✓") : red("✗");
		console.log(`${icon} ${check.message}`);
	}

	if (!validation.success) {
		hadErrors = true;
		console.log(
			dim(
				"\n  Some checks failed - see above. Start all services and re-run to verify.",
			),
		);
	}

	// -- Step 9: Next steps ---------------------------------------------------
	console.log("");
	if (hadErrors) {
		console.log(bold("Installation completed with errors."));
		console.log(dim("  Review the failures above before using Engram MCP."));
	} else {
		console.log(bold("Installation complete!"));
	}
	console.log("Next steps:");
	console.log(`  1. Start the memory backend ${dim("(see README)")}`);
	const serverCmd =
		transport === "http"
			? "npx @engram/mcp --transport http"
			: "npx @engram/mcp --transport stdio";
	console.log(`  2. Start the MCP server: ${cyan(serverCmd)}`);
	console.log("  3. Restart your MCP client");
	console.log("");

	rl.close();
}

main().catch((err: unknown) => {
	console.error(
		red("Fatal error:"),
		err instanceof Error ? err.message : String(err),
	);
	rl.close();
	process.exit(1);
});
