#!/usr/bin/env node

import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";

const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout,
});

const question = (query) =>
	new Promise((resolve) => rl.question(query, resolve));

// ANSI Color codes
const colors = {
	reset: "\x1b[0m",
	green: "\x1b[32m",
	yellow: "\x1b[33m",
	blue: "\x1b[34m",
	red: "\x1b[31m",
	cyan: "\x1b[36m",
};

const printHeader = (text) => {
	console.log(
		`\n${colors.cyan}==========================================${colors.reset}`,
	);
	console.log(`${colors.cyan}  ${text}${colors.reset}`);
	console.log(
		`${colors.cyan}==========================================${colors.reset}\n`,
	);
};

const printSuccess = (text) =>
	console.log(`${colors.green}✓ ${text}${colors.reset}`);
const printInfo = (text) =>
	console.log(`${colors.blue}ℹ ${text}${colors.reset}`);
const printWarning = (text) =>
	console.log(`${colors.yellow}⚠ ${text}${colors.reset}`);
const printError = (text) =>
	console.log(`${colors.red}✗ ${text}${colors.reset}`);

// OS Detection
const getOS = () => {
	const platform = os.platform();
	if (platform === "darwin") return "macOS";
	if (platform === "win32") return "Windows";
	if (platform === "linux") return "Linux";
	return "Unknown";
};

// Client paths mapping
const getClientPaths = () => {
	const osType = getOS();
	const home = os.homedir();

	if (osType === "macOS") {
		return {
			claude: path.join(
				home,
				"Library/Application Support/Claude/claude_desktop_config.json",
			),
			cursor: path.join(
				home,
				"Library/Application Support/Cursor/User/globalStorage/rooveterinaryinc.roo-cline/settings/cline_mcp_settings.json",
			),
			windsurf: path.join(home, ".codeium/windsurf/mcp_config.json"),
			vscode: path.join(
				home,
				"Library/Application Support/Code/User/globalStorage/rooveterinaryinc.roo-cline/settings/cline_mcp_settings.json",
			),
		};
	}

	if (osType === "Windows") {
		const appData =
			process.env.APPDATA || path.join(home, "AppData", "Roaming");
		return {
			claude: path.join(appData, "Claude", "claude_desktop_config.json"),
			cursor: path.join(
				appData,
				"Cursor",
				"User",
				"globalStorage",
				"rooveterinaryinc.roo-cline",
				"settings",
				"cline_mcp_settings.json",
			),
			windsurf: path.join(home, ".codeium", "windsurf", "mcp_config.json"),
			vscode: path.join(
				appData,
				"Code",
				"User",
				"globalStorage",
				"rooveterinaryinc.roo-cline",
				"settings",
				"cline_mcp_settings.json",
			),
		};
	}

	// Linux
	const config = process.env.XDG_CONFIG_HOME || path.join(home, ".config");
	return {
		claude: path.join(config, "Claude", "claude_desktop_config.json"),
		cursor: path.join(
			config,
			"Cursor",
			"User",
			"globalStorage",
			"rooveterinaryinc.roo-cline",
			"settings",
			"cline_mcp_settings.json",
		),
		windsurf: path.join(home, ".codeium", "windsurf", "mcp_config.json"),
		vscode: path.join(
			config,
			"Code",
			"User",
			"globalStorage",
			"rooveterinaryinc.roo-cline",
			"settings",
			"cline_mcp_settings.json",
		),
	};
};

// Detect installed clients
const detectClients = () => {
	const paths = getClientPaths();
	const detected = {};

	for (const [client, configPath] of Object.entries(paths)) {
		const dirPath = path.dirname(configPath);
		if (fs.existsSync(dirPath)) {
			detected[client] = configPath;
		}
	}

	return detected;
};

// Install MCP to a specific config file
const installMCPToConfig = (configPath, mcpName, command, args, env) => {
	try {
		let config = { mcpServers: {} };

		if (fs.existsSync(configPath)) {
			const content = fs.readFileSync(configPath, "utf8");
			try {
				config = JSON.parse(content);
			} catch (e) {
				printWarning(
					`Could not parse existing config at ${configPath}. Creating new.`,
				);
			}
		}

		if (!config.mcpServers) {
			config.mcpServers = {};
		}

		config.mcpServers[mcpName] = {
			command,
			args,
			env,
		};

		// Ensure directory exists
		fs.mkdirSync(path.dirname(configPath), { recursive: true });

		fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
		return true;
	} catch (err) {
		printError(`Failed to update ${configPath}: ${err.message}`);
		return false;
	}
};

async function main() {
	printHeader("Engram MCP Deployment Helper");

	const osType = getOS();
	printInfo(`Detected Operating System: ${osType}`);

	const currentDir = process.cwd();
	// Assume running from project root or Engram-MCP dir
	const isMcpRoot =
		fs.existsSync(path.join(currentDir, "package.json")) &&
		JSON.parse(fs.readFileSync(path.join(currentDir, "package.json"))).name ===
			"engram-mcp";
	const mcpDir = isMcpRoot ? currentDir : path.join(currentDir, "Engram-MCP");

	const indexTsPath = path.join(mcpDir, "src", "index.ts");

	if (!fs.existsSync(indexTsPath)) {
		printWarning(`Could not find MCP source at ${indexTsPath}`);
		const answer = await question("Continue anyway? (y/n): ");
		if (answer.toLowerCase() !== "y") {
			printError("Exiting...");
			rl.close();
			return;
		}
	} else {
		// 1. Build the MCP server
		printHeader("Step 1: Building MCP Server");
		try {
			printInfo("Running npm install && npm run build...");
			execSync(`cd ${mcpDir} && npm install && npm run build`, {
				stdio: "inherit",
			});
			printSuccess("Build completed successfully");
		} catch (err) {
			printError("Build failed. Continuing anyway...");
		}
	}

	// 2. Detect Clients
	printHeader("Step 2: Client Detection");
	const detectedClients = detectClients();
	const clientNames = Object.keys(detectedClients);

	if (clientNames.length === 0) {
		printWarning("No supported clients detected automatically.");
	} else {
		printSuccess(
			`Detected ${clientNames.length} clients: ${clientNames.join(", ")}`,
		);
	}

	// 3. Configure Server Details
	printHeader("Step 3: Server Configuration");

	const defaultCommand = "node";
	const buildPath = path.resolve(mcpDir, "dist", "index.js");
	const defaultArgs = [buildPath];

	const mcpName =
		(await question("Enter MCP server name (default: engram-memory): ")) ||
		"engram-memory";

	const weaviateUrl =
		(await question("Weaviate URL (default: http://localhost:8080): ")) ||
		"http://localhost:8080";
	const memoryApiUrl =
		(await question("Memory API URL (default: http://localhost:8000): ")) ||
		"http://localhost:8000";
	const authToken = await question("Auth Token (optional): ");

	const env = {
		WEAVIATE_URL: weaviateUrl,
		MEMORY_API_URL: memoryApiUrl,
	};

	if (authToken) {
		env.MCP_AUTH_TOKEN = authToken;
	}

	// 4. Install to Clients
	printHeader("Step 4: Installation");

	for (const [client, configPath] of Object.entries(detectedClients)) {
		const install = await question(
			`Install to ${client} at ${configPath}? (Y/n): `,
		);
		if (install.toLowerCase() !== "n") {
			if (
				installMCPToConfig(
					configPath,
					mcpName,
					defaultCommand,
					defaultArgs,
					env,
				)
			) {
				printSuccess(`Successfully installed to ${client}`);
			}
		}
	}

	// Option for manual installation path
	const manualInstall = await question(
		"\nDo you want to install to a custom config file path? (y/N): ",
	);
	if (manualInstall.toLowerCase() === "y") {
		const customPath = await question("Enter full path to config JSON: ");
		if (customPath) {
			if (
				installMCPToConfig(
					customPath,
					mcpName,
					defaultCommand,
					defaultArgs,
					env,
				)
			) {
				printSuccess("Successfully installed to custom path");
			}
		}
	}

	// 5. Configure Hooks
	printHeader("Step 5: Pre/Post Prompt Hooks Configuration");
	printInfo(
		"Configuring hooks for AI clients (Codex, OpenCode, Claude Code)...",
	);

	const setupHooks = await question(
		"Setup prompt hooks for supported CLI tools? (Y/n): ",
	);
	if (setupHooks.toLowerCase() !== "n") {
		const hooksDir = path.join(os.homedir(), ".engram", "hooks");
		try {
			fs.mkdirSync(hooksDir, { recursive: true });

			// Create hook scripts
			const preHookPath = path.join(hooksDir, "pre-prompt.sh");
			const postHookPath = path.join(hooksDir, "post-prompt.sh");

			const preHookContent = `#!/bin/bash
# Engram Pre-prompt hook
# Inject context from MCP into prompt
echo "Running Engram pre-prompt context injection..."
# Call MCP tool to retrieve context based on prompt text
# Example placeholder:
# mcp call build_context '{"query": "$1"}' > .engram_context
`;

			const postHookContent = `#!/bin/bash
# Engram Post-prompt hook
# Record outcome to MCP memory
echo "Running Engram post-prompt hook..."
# Call MCP tool to save memory
# Example placeholder:
# mcp call add_memory '{"content": "Session completed", "tier": "tier1"}'
`;

			fs.writeFileSync(preHookPath, preHookContent);
			fs.writeFileSync(postHookPath, postHookContent);

			fs.chmodSync(preHookPath, "755");
			fs.chmodSync(postHookPath, "755");

			printSuccess(`Created hook scripts in ${hooksDir}`);

			// Update shell profiles
			const shellProfiles = [
				path.join(os.homedir(), ".bashrc"),
				path.join(os.homedir(), ".zshrc"),
				path.join(os.homedir(), ".profile"),
			];

			const hookEnvVars = `
# Engram Prompt Hooks
export CLAUDE_PRE_PROMPT="${preHookPath}"
export CLAUDE_POST_PROMPT="${postHookPath}"
export CODEX_PRE_PROMPT="${preHookPath}"
export CODEX_POST_PROMPT="${postHookPath}"
export OPENCODE_PRE_PROMPT="${preHookPath}"
export OPENCODE_POST_PROMPT="${postHookPath}"
`;

			let updatedProfile = false;
			for (const profile of shellProfiles) {
				if (fs.existsSync(profile)) {
					const content = fs.readFileSync(profile, "utf8");
					if (!content.includes("Engram Prompt Hooks")) {
						fs.appendFileSync(profile, `\n${hookEnvVars}\n`);
						printSuccess(`Added hook environment variables to ${profile}`);
						updatedProfile = true;
					} else {
						printInfo(`Hooks already configured in ${profile}`);
						updatedProfile = true;
					}
				}
			}

			if (!updatedProfile) {
				printWarning(
					"Could not find shell profile to update. Please add manually:",
				);
				console.log(hookEnvVars);
			}
		} catch (err) {
			printError(`Failed to create hooks: ${err.message}`);
		}
	}

	printHeader("Deployment Complete!");
	printInfo(
		"Please restart your AI clients and terminal for the changes to take effect.",
	);

	rl.close();
}

main().catch(console.error);
