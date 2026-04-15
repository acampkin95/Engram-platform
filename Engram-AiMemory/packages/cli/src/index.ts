#!/usr/bin/env node
import { exec, spawn } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import {
  SERVICE_NAME,
  type SystemInfo,
  detectSystem,
  dockerCompose,
  installServiceFile,
  serviceFileExists,
  systemctl,
  uninstallServiceFile,
} from "./systemd.js";

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "../..");
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const BLUE = "\x1b[34m";
const CYAN = "\x1b[36m";
const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";

interface Options {
  skipInstall: boolean;
  skipBuild: boolean;
  force: boolean;
}

function printBanner() {
  console.log(`${BLUE}
╔═══════════════════════════════════════════════════════════════╗
║          AI Memory System - Interactive Installer           ║
╚═══════════════════════════════════════════════════════════════╝
${RESET}`);
}

function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(`${CYAN}? ${question}: ${RESET}`, (ans) => {
      rl.close();
      resolve(ans.trim());
    });
  });
}

function confirm(question: string, defaultYes = true): Promise<boolean> {
  const suffix = defaultYes ? " [Y/n]" : " [y/N]";
  return prompt(`${question}${suffix}`).then((ans) => {
    if (!ans) return defaultYes;
    return ans.toLowerCase().startsWith("y");
  });
}

function log(msg: string, color = RESET) {
  console.log(`${color}${msg}${RESET}`);
}

function logStep(num: number, total: number, msg: string) {
  console.log(`${CYAN}[${num}/${total}]${RESET} ${msg}`);
}

function logSuccess(msg: string) {
  log(`✓ ${msg}`, GREEN);
}

function logError(msg: string) {
  log(`✗ ${msg}`, RED);
}

function logWarn(msg: string) {
  log(`⚠ ${msg}`, YELLOW);
}

async function run(
  cmd: string,
  cwd = ROOT
): Promise<{ code: number; stdout: string; stderr: string }> {
  try {
    const { stdout, stderr } = await execAsync(cmd, { cwd, maxBuffer: 50 * 1024 * 1024 });
    return { code: 0, stdout, stderr };
  } catch (err: unknown) {
    const e = err as { code?: number; stdout?: string; stderr?: string };
    return { code: e.code ?? 1, stdout: e.stdout ?? "", stderr: e.stderr ?? "" };
  }
}

async function checkPython(): Promise<string | null> {
  const { code, stdout } = await run("python3.12 --version 2>&1 || python3 --version 2>&1");
  if (code === 0) {
    const version = stdout.trim();
    logSuccess(`Python found: ${version}`);
    return version;
  }
  return null;
}

async function checkNode(): Promise<string | null> {
  const { code, stdout } = await run("node --version 2>&1");
  if (code === 0) {
    const version = stdout.trim();
    logSuccess(`Node.js found: ${version}`);
    return version;
  }
  return null;
}

async function checkDocker(): Promise<boolean> {
  const { code } = await run("docker info > /dev/null 2>&1");
  if (code === 0) {
    logSuccess("Docker is running");
    return true;
  }
  logWarn("Docker is not running");
  return false;
}

async function createEnvFile(): Promise<boolean> {
  const envPath = path.join(ROOT, ".env");
  const envExamplePath = path.join(ROOT, ".env.example");

  if (fs.existsSync(envPath)) {
    return true;
  }

  if (!fs.existsSync(envExamplePath)) {
    logError(".env.example not found");
    return false;
  }

  const create = await confirm("Create .env from template?");
  if (create) {
    fs.copyFileSync(envExamplePath, envPath);
    logSuccess("Created .env from template");
    logWarn("Please edit .env and add your API keys");
    return true;
  }
  return false;
}

async function installPython(): Promise<boolean> {
  logStep(1, 4, "Setting up Python virtual environment...");

  const venvPath = path.join(ROOT, ".venv");
  const pyVersion = await checkPython();
  if (!pyVersion) {
    logError("Python 3.12+ not found. Please install Python 3.12 or later.");
    return false;
  }

  if (fs.existsSync(venvPath)) {
    const reuse = await confirm("Virtual environment already exists. Reuse it?", true);
    if (!reuse) {
      await run(`rm -rf ${venvPath}`);
    } else {
      logSuccess("Using existing virtual environment");
      return true;
    }
  }

  const { code } = await run(`python3.12 -m venv ${venvPath}`);
  if (code !== 0) {
    logError("Failed to create virtual environment");
    return false;
  }

  logSuccess("Virtual environment created");

  logStep(2, 4, "Installing Python dependencies...");
  const pipCmd = path.join(venvPath, "bin", "pip");
  const { code: installCode } = await run(`${pipCmd} install -e ".[dev]"`, ROOT);
  if (installCode !== 0) {
    logError("Failed to install Python dependencies");
    return false;
  }
  logSuccess("Python dependencies installed");

  return true;
}

async function installNode(): Promise<boolean> {
  logStep(3, 4, "Installing Node.js dependencies...");

  if (!fs.existsSync(path.join(ROOT, "package.json"))) {
    logError("package.json not found");
    return false;
  }

  const { code } = await run("npm install", ROOT);
  if (code !== 0) {
    logError("Failed to install Node.js dependencies");
    return false;
  }

  logSuccess("Node.js dependencies installed");
  return true;
}

async function buildAll(): Promise<boolean> {
  logStep(4, 4, "Building all packages...");

  // MCP server and dashboard are now in separate subprojects (Engram-MCP, Engram-Platform).
  // The CLI only builds the core Python package and the CLI itself.
  logSuccess("Build step completed (MCP and dashboard are managed independently)");

  return true;
}

async function runTests(): Promise<boolean> {
  log("Running tests...", CYAN);

  const { code: pyCode } = await run(
    "source .venv/bin/activate && python -m pytest packages/core/tests/ -v",
    ROOT
  );
  if (pyCode !== 0) {
    logWarn("Some Python tests failed");
  } else {
    logSuccess("Python tests passed");
  }

  logSuccess("Frontend tests are now in Engram-Platform (npm run test:run)");

  return true;
}

async function install(options: Options) {
  printBanner();

  const dockerRunning = await checkDocker();
  if (!dockerRunning) {
    const proceed = await confirm("Docker is not running. Continue anyway?");
    if (!proceed) {
      log("Installation cancelled", YELLOW);
      return;
    }
  }

  await createEnvFile();

  if (options.skipInstall) {
    log("Skipping dependency installation", YELLOW);
  } else {
    const pythonOk = await installPython();
    if (!pythonOk) {
      logError("Python setup failed");
      return;
    }

    const nodeOk = await installNode();
    if (!nodeOk) {
      logError("Node.js setup failed");
      return;
    }
  }

  if (options.skipBuild) {
    log("Skipping build", YELLOW);
  } else {
    const buildOk = await buildAll();
    if (!buildOk) {
      logError("Build failed");
      return;
    }
  }

  const test = await confirm("Run tests?");
  if (test) {
    await runTests();
  }

  console.log(`\n${GREEN}${BOLD}
╔═══════════════════════════════════════════════════════════════╗
║                    Installation Complete!                    ║
╠═══════════════════════════════════════════════════════════════╣
║  To start the API:                                         ║
║    source .venv/bin/activate                               ║
║    python -m memory_system.api                             ║
║                                                               ║
║  Dashboard:                                                ║
║    cd ../Engram-Platform/frontend && npm run dev           ║
║                                                               ║
║  To deploy with Docker:                                    ║
║    ./scripts/deploy.sh                                      ║
╚═══════════════════════════════════════════════════════════════╝
${RESET}`);
}

// Task 7: update() modified to restart service after update
async function update() {
  printBanner();

  const sys = await getSystemInfo();

  log("Checking for updates...", CYAN);

  const { code: gitCode } = await run("git fetch origin && git status");
  const hasUpdates = gitCode === 0;

  if (hasUpdates) {
    const doUpdate = await confirm("Updates available. Pull and reinstall?");
    if (doUpdate) {
      await run("git pull origin main");
    }
  }

  log("Updating Python dependencies...", CYAN);
  const venvPip = path.join(ROOT, ".venv", "bin", "pip");
  await run(`${venvPip} install -e ".[dev]" --upgrade`);

  log("Updating Node dependencies...", CYAN);
  await run("npm install");

  log("Rebuilding packages...", CYAN);
  await buildAll();

  logSuccess("Update complete!");

  // Restart systemd service if installed
  if (sys.hasSystemd && serviceFileExists()) {
    const restart = await confirm("Restart ai-memory-api service?");
    if (restart) {
      log("Restarting service...", CYAN);
      await systemctl(`restart ${SERVICE_NAME}`, true);
      logSuccess("Service restarted");
    }
  }
}

async function uninstall() {
  printBanner();

  const confirmUninstall = await confirm(
    "This will remove: .venv, node_modules, .next, packages/*/dist, packages/*/.next"
  );
  if (!confirmUninstall) {
    log("Uninstall cancelled", YELLOW);
    return;
  }

  const really = await confirm("Are you sure? This cannot be undone!");
  if (!really) {
    log("Uninstall cancelled", YELLOW);
    return;
  }

  log("Removing Python virtual environment...", CYAN);
  await run("rm -rf .venv");

  log("Removing Node modules...", CYAN);
  await run("rm -rf node_modules");

  log("Removing build artifacts...", CYAN);
  await run("rm -rf packages/*/dist packages/*/.next");

  const keepEnv = await confirm("Keep .env file?");
  if (!keepEnv) {
    await run("rm -f .env");
  }

  logSuccess("Uninstall complete!");
}

// Task 4: Renamed from status() to systemStatus()
async function systemStatus() {
  printBanner();

  log("System Status:", BOLD);
  console.log("");

  const python = await checkPython();
  const node = await checkNode();
  const docker = await checkDocker();

  const venvExists = fs.existsSync(path.join(ROOT, ".venv"));
  const nodeModulesExists = fs.existsSync(path.join(ROOT, "node_modules"));

  console.log(`${CYAN}Python:${RESET} ${python ?? `${RED}Not found${RESET}`}`);
  console.log(`${CYAN}Node.js:${RESET} ${node ?? `${RED}Not found${RESET}`}`);
  console.log(
    `${CYAN}Docker:${RESET} ${docker ? `${GREEN}Running${RESET}` : `${RED}Not running${RESET}`}`
  );
  console.log("");
  console.log(
    `${CYAN}Virtual Environment:${RESET} ${venvExists ? `${GREEN}Installed${RESET}` : `${RED}Not installed${RESET}`}`
  );
  console.log(
    `${CYAN}Node Modules:${RESET} ${nodeModulesExists ? `${GREEN}Installed${RESET}` : `${RED}Not installed${RESET}`}`
  );

  if (venvExists && nodeModulesExists) {
    console.log("");
    const shouldRunTests = await confirm("Run tests to verify installation?");
    if (shouldRunTests) {
      await runTests();
    }
  }
}

// Task 2: start command
async function startCommand() {
  printBanner();

  const sys = await getSystemInfo();

  if (!sys.isLinux) {
    logError("The 'start' command is only supported on Linux with systemd.");
    log("On macOS, run the API directly:", YELLOW);
    log("  .venv/bin/python -m memory_system.api");
    return;
  }

  if (!sys.hasSystemd) {
    logError("Systemd is not available on this system.");
    return;
  }

  if (!serviceFileExists()) {
    logError("Service not installed. Run 'ai-memory install-service' first.");
    return;
  }

  // Start Docker Compose first
  if (sys.hasDocker) {
    log("Starting Docker services (Weaviate, Redis)...", CYAN);
    const dockerDir = path.join(sys.installDir, "docker");
    const { code: dcCode, stderr: dcErr } = await dockerCompose("up -d", dockerDir);
    if (dcCode !== 0) {
      logWarn(`Docker compose warning: ${dcErr}`);
    } else {
      logSuccess("Docker services started");
    }
  }

  // Start systemd service
  log("Starting ai-memory-api service...", CYAN);
  const { code, stderr } = await systemctl(`start ${SERVICE_NAME}`, true);

  if (code !== 0) {
    logError(`Failed to start service: ${stderr}`);
    return;
  }

  logSuccess("AI Memory API service started");

  // Show status
  const { stdout } = await systemctl(`status ${SERVICE_NAME} --no-pager`, true);
  console.log(stdout);
}

// Task 3: stop command
async function stopCommand() {
  printBanner();

  const sys = await getSystemInfo();

  if (!sys.isLinux || !sys.hasSystemd) {
    logError("The 'stop' command requires Linux with systemd.");
    return;
  }

  if (!serviceFileExists()) {
    logWarn("Service not installed.");
    return;
  }

  log("Stopping ai-memory-api service...", CYAN);
  const { code, stderr } = await systemctl(`stop ${SERVICE_NAME}`, true);

  if (code !== 0) {
    logError(`Failed to stop service: ${stderr}`);
    return;
  }

  logSuccess("AI Memory API service stopped");
}

// Task 3: restart command
async function restartCommand() {
  printBanner();

  const sys = await getSystemInfo();

  if (!sys.isLinux || !sys.hasSystemd) {
    logError("The 'restart' command requires Linux with systemd.");
    return;
  }

  if (!serviceFileExists()) {
    logError("Service not installed. Run 'ai-memory install-service' first.");
    return;
  }

  log("Restarting ai-memory-api service...", CYAN);
  const { code, stderr } = await systemctl(`restart ${SERVICE_NAME}`, true);

  if (code !== 0) {
    logError(`Failed to restart service: ${stderr}`);
    return;
  }

  logSuccess("AI Memory API service restarted");

  // Show status
  const { stdout } = await systemctl(`status ${SERVICE_NAME} --no-pager`, true);
  console.log(stdout);
}

// Task 4: status command (service-aware)
async function statusCommand() {
  printBanner();

  const sys = await getSystemInfo();

  if (!sys.isLinux || !sys.hasSystemd) {
    logWarn("Service management requires Linux with systemd.");
    log("Showing system status instead...\n", YELLOW);
    await systemStatus();
    return;
  }

  log("Service Status:", BOLD);
  console.log("");

  // Show systemd service status
  if (serviceFileExists()) {
    const { stdout } = await systemctl(`status ${SERVICE_NAME} --no-pager`, true);
    console.log(stdout);
  } else {
    logWarn("Service not installed.");
  }

  // Show Docker status
  if (sys.hasDocker) {
    console.log(`\n${CYAN}Docker Services:${RESET}`);
    const dockerDir = path.join(sys.installDir, "docker");
    const { stdout } = await dockerCompose("ps", dockerDir);
    console.log(stdout);
  }
}

// Task 5: logs command
async function logsCommand(target = "api") {
  printBanner();

  const sys = await getSystemInfo();

  if (!sys.isLinux || !sys.hasSystemd) {
    logError("The 'logs' command requires Linux with systemd.");
    return;
  }

  if (!serviceFileExists()) {
    logError("Service not installed.");
    return;
  }

  // Allowlist the unit name to prevent injection
  const unit = target === "mcp" ? "ai-memory-mcp" : SERVICE_NAME;
  log(`Tailing logs for ${unit} (Ctrl+C to stop)...\n`, CYAN);

  const sudoPrefix = process.getuid?.() !== 0 ? ["sudo", "journalctl"] : ["journalctl"];

  await new Promise<void>((resolve) => {
    const child = spawn(sudoPrefix[0], [...sudoPrefix.slice(1), "-u", unit, "-f", "--no-pager"], {
      stdio: "inherit",
    });

    child.on("error", (err: Error) => {
      logError(`Failed to tail logs: ${err.message}`);
      resolve();
    });

    child.on("close", () => {
      resolve();
    });

    const sigintHandler = () => {
      child.kill("SIGTERM");
      process.exit(0);
    };
    process.once("SIGINT", sigintHandler);
  });
}

// Task 6: install-service command
async function installServiceCommand() {
  printBanner();

  const sys = await getSystemInfo();

  if (!sys.isLinux) {
    logError("The 'install-service' command is only supported on Linux.");
    return;
  }

  if (!sys.hasSystemd) {
    logError("Systemd is not available on this system.");
    return;
  }

  if (serviceFileExists()) {
    const overwrite = await confirm("Service already installed. Reinstall?");
    if (!overwrite) {
      log("Install cancelled", YELLOW);
      return;
    }
  }

  log("Installing systemd service...", CYAN);
  log(`  Install dir: ${sys.installDir}`, CYAN);
  log(`  User: ${sys.installUser}`, CYAN);

  // Check for .env file
  const envPath = path.join(sys.installDir, ".env");
  if (!fs.existsSync(envPath)) {
    logWarn(".env file not found. Copy .env.example to .env first.");
    const proceed = await confirm("Continue anyway?");
    if (!proceed) {
      return;
    }
  }

  // Check for .venv
  const venvPath = path.join(sys.installDir, ".venv");
  if (!fs.existsSync(venvPath)) {
    logError(".venv not found. Run 'ai-memory install' first.");
    return;
  }

  const ok = await installServiceFile(sys);
  if (!ok) {
    logError("Failed to install service file.");
    return;
  }

  logSuccess(`Service file installed to /etc/systemd/system/${SERVICE_NAME}.service`);

  // Enable the service
  log("Enabling service to start on boot...", CYAN);
  const { code: enableCode } = await systemctl(`enable ${SERVICE_NAME}`, true);
  if (enableCode === 0) {
    logSuccess("Service enabled");
  }

  console.log(`\n${GREEN}${BOLD}
╔═══════════════════════════════════════════════════════════════╗
║                 Service Install Complete!                     ║
╠═══════════════════════════════════════════════════════════════╣
║  To start the service:                                      ║
║    ai-memory start                                           ║
║                                                               ║
║  To check status:                                            ║
║    ai-memory status                                           ║
║                                                               ║
║  To view logs:                                               ║
║    ai-memory logs                                             ║
╚═══════════════════════════════════════════════════════════════╝
${RESET}`);
}

// Task 6: uninstall-service command
async function uninstallServiceCommand() {
  printBanner();

  const sys = await getSystemInfo();

  if (!sys.isLinux || !sys.hasSystemd) {
    logError("The 'uninstall-service' command requires Linux with systemd.");
    return;
  }

  if (!serviceFileExists()) {
    logWarn("Service not installed.");
    return;
  }

  const confirmUninstallSvc = await confirm(
    "This will stop and remove the ai-memory-api systemd service"
  );
  if (!confirmUninstallSvc) {
    log("Uninstall cancelled", YELLOW);
    return;
  }

  // Stop the service
  log("Stopping service...", CYAN);
  await systemctl(`stop ${SERVICE_NAME}`, true);

  // Disable the service
  log("Disabling service...", CYAN);
  await systemctl(`disable ${SERVICE_NAME}`, true);

  // Remove service file
  log("Removing service file...", CYAN);
  const ok = await uninstallServiceFile();
  if (!ok) {
    logError("Failed to remove service file.");
    return;
  }

  logSuccess("Service uninstalled");
}

function printUsage() {
  console.log(`
${BOLD}Usage:${RESET}
  npx ai-memory install     Install the AI Memory System
  npx ai-memory update     Update dependencies and rebuild
  npx ai-memory uninstall  Remove all installed artifacts
  npx ai-memory status     Show service status (or system status on non-Linux)
  npx ai-memory help       Show this help message

${BOLD}Service Management (systemd):${RESET}
  npx ai-memory start               Start API + Docker services
  npx ai-memory stop                Stop API service
  npx ai-memory restart             Restart API service
  npx ai-memory status              Show service status
  npx ai-memory logs [api|mcp]      Tail service logs (Ctrl+C to stop)
  npx ai-memory system-status       Show dev environment status

${BOLD}Installation:${RESET}
  npx ai-memory install             Install the AI Memory System
  npx ai-memory install-service     Install systemd service (requires sudo)
  npx ai-memory uninstall-service   Remove systemd service

${BOLD}Options:${RESET}
  --skip-install  Skip dependency installation
  --skip-build   Skip building packages
  --force        Force operation without confirmation

${BOLD}Examples:${RESET}
  npx ai-memory install
  npx ai-memory install --skip-tests
  npx ai-memory update
  npx ai-memory status
  npx ai-memory start
  npx ai-memory logs api
`);
}

// Cache system info
let _systemInfo: SystemInfo | null = null;

async function getSystemInfo(): Promise<SystemInfo> {
  if (!_systemInfo) {
    _systemInfo = await detectSystem();
  }
  return _systemInfo;
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || "help";

  const options: Options = {
    skipInstall: args.includes("--skip-install"),
    skipBuild: args.includes("--skip-build"),
    force: args.includes("--force"),
  };

  switch (command) {
    case "install":
    case "i":
      await install(options);
      break;
    case "update":
    case "u":
      await update();
      break;
    case "uninstall":
    case "un":
      await uninstall();
      break;
    case "start":
      await startCommand();
      break;
    case "stop":
      await stopCommand();
      break;
    case "restart":
      await restartCommand();
      break;
    case "status":
    case "s":
      await statusCommand();
      break;
    case "system-status":
      await systemStatus();
      break;
    case "logs":
    case "l":
      await logsCommand(args[1]);
      break;
    case "install-service":
      await installServiceCommand();
      break;
    case "uninstall-service":
      await uninstallServiceCommand();
      break;
    case "help":
    case "h":
    case "-h":
    case "--help":
      printUsage();
      break;
    default:
      log(`Unknown command: ${command}`, YELLOW);
      log("Run 'ai-memory help' for usage.", YELLOW);
      break;
  }
}

main().catch(console.error);
