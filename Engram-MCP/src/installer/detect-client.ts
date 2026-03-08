import { stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import process from "node:process";

export type MCPClient = "claude-code" | "claude-desktop" | "cursor" | "unknown";

export interface DetectedClient {
	client: MCPClient;
	settingsPath: string; // absolute path to settings file
	exists: boolean; // whether settings file already exists
}

async function fileExists(filePath: string): Promise<boolean> {
	try {
		await stat(filePath);
		return true;
	} catch {
		return false;
	}
}

export async function detectClient(): Promise<DetectedClient> {
	const home = homedir();

	// 1. Check Claude Code
	const claudeCodePath = join(home, ".claude", "settings.json");
	if (await fileExists(claudeCodePath)) {
		return { client: "claude-code", settingsPath: claudeCodePath, exists: true };
	}

	// 2. Check Claude Desktop
	let desktopPath: string;
	if (process.platform === "linux") {
		desktopPath = join(home, ".config", "Claude", "claude_desktop_config.json");
	} else if (process.platform === "win32") {
		const appData = process.env.APPDATA ?? join(home, "AppData", "Roaming");
		desktopPath = join(appData, "Claude", "claude_desktop_config.json");
	} else {
		// macOS and other Unix-like
		desktopPath = join(
			home,
			"Library",
			"Application Support",
			"Claude",
			"claude_desktop_config.json",
		);
	}

	if (await fileExists(desktopPath)) {
		return {
			client: "claude-desktop",
			settingsPath: desktopPath,
			exists: true,
		};
	}

	// 3. Check Cursor
	const cursorPath = join(home, ".cursor", "mcp.json");
	if (await fileExists(cursorPath)) {
		return { client: "cursor", settingsPath: cursorPath, exists: true };
	}

	return { client: "unknown", settingsPath: "", exists: false };
}
