/**
 * Systemd service management utilities.
 *
 * Detects systemd availability and provides helpers for service control.
 */

import { exec } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const SERVICE_NAME = "ai-memory-api";
export const SERVICE_FILE = `/etc/systemd/system/${SERVICE_NAME}.service`;

export interface SystemInfo {
  isLinux: boolean;
  isUbuntu: boolean;
  hasSystemd: boolean;
  hasDocker: boolean;
  isRoot: boolean;
  installDir: string;
  installUser: string;
}

/**
 * Detect system capabilities for systemd management.
 */
export async function detectSystem(): Promise<SystemInfo> {
  const isLinux = process.platform === "linux";
  let isUbuntu = false;
  let hasSystemd = false;

  if (isLinux) {
    // Check for Ubuntu via /etc/os-release
    try {
      const osRelease = fs.readFileSync("/etc/os-release", "utf-8");
      isUbuntu =
        /^ID=(ubuntu|debian)$/m.test(osRelease) ||
        /\bID_LIKE=.*\b(ubuntu|debian)\b/m.test(osRelease);
    } catch {
      // Not Ubuntu
    }

    // Check for systemd
    hasSystemd = fs.existsSync("/run/systemd/system");
  }

  // Check for docker
  let hasDocker = false;
  try {
    await execAsync("docker --version");
    hasDocker = true;
  } catch {
    // Docker not installed
  }

  // Check if running as root
  const isRoot = process.getuid?.() === 0;

  // Get install directory (repo root)
  const installDir = path.resolve(__dirname, "..", "..", "..");

  // Get current user
  let installUser = process.env.USER ?? process.env.LOGNAME ?? "root";
  if (!isRoot && installUser === "root") {
    try {
      const { stdout } = await execAsync("whoami");
      installUser = stdout.trim();
    } catch {
      // Keep env fallback
    }
  }

  return {
    isLinux,
    isUbuntu,
    hasSystemd,
    hasDocker,
    isRoot,
    installDir,
    installUser,
  };
}

/**
 * Check if the systemd service file exists.
 */
export function serviceFileExists(): boolean {
  return fs.existsSync(SERVICE_FILE);
}

/**
 * Generate systemd unit file content.
 */
export function generateServiceFile(info: SystemInfo): string {
  return `[Unit]
Description=AI Memory System API
After=network.target docker.service
Wants=docker.service

[Service]
Type=simple
User=${info.installUser}
WorkingDirectory=${info.installDir}
EnvironmentFile=-${info.installDir}/.env
ExecStart=${info.installDir}/.venv/bin/python -m memory_system.api
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
`;
}

/**
 * Run a systemctl command with sudo if needed.
 */
export async function systemctl(
  args: string,
  requireSudo = true
): Promise<{ code: number; stdout: string; stderr: string }> {
  const cmd =
    requireSudo && process.getuid?.() !== 0 ? `sudo systemctl ${args}` : `systemctl ${args}`;
  try {
    const { stdout, stderr } = await execAsync(cmd, { maxBuffer: 10 * 1024 * 1024 });
    return { code: 0, stdout, stderr };
  } catch (err: unknown) {
    const e = err as { code?: number; stdout?: string; stderr?: string };
    return { code: e.code ?? 1, stdout: e.stdout ?? "", stderr: e.stderr ?? "" };
  }
}

/**
 * Run a journalctl command.
 */
export async function journalctl(
  args: string
): Promise<{ code: number; stdout: string; stderr: string }> {
  const cmd = process.getuid?.() !== 0 ? `sudo journalctl ${args}` : `journalctl ${args}`;
  try {
    const { stdout, stderr } = await execAsync(cmd, { maxBuffer: 50 * 1024 * 1024 });
    return { code: 0, stdout, stderr };
  } catch (err: unknown) {
    const e = err as { code?: number; stdout?: string; stderr?: string };
    return { code: e.code ?? 1, stdout: e.stdout ?? "", stderr: e.stderr ?? "" };
  }
}

/**
 * Run docker compose command in the docker directory.
 */
export async function dockerCompose(
  args: string,
  cwd: string
): Promise<{ code: number; stdout: string; stderr: string }> {
  const cmd = `docker compose ${args}`;
  try {
    const { stdout, stderr } = await execAsync(cmd, { cwd, maxBuffer: 10 * 1024 * 1024 });
    return { code: 0, stdout, stderr };
  } catch (err: unknown) {
    const e = err as { code?: number; stdout?: string; stderr?: string };
    return { code: e.code ?? 1, stdout: e.stdout ?? "", stderr: e.stderr ?? "" };
  }
}

/**
 * Write the systemd service file (requires sudo).
 */
export async function installServiceFile(info: SystemInfo): Promise<boolean> {
  const content = generateServiceFile(info);
  const tmpFile = `/tmp/${SERVICE_NAME}.service`;

  // Write to temp file
  fs.writeFileSync(tmpFile, content);

  // Move to system directory with sudo
  try {
    await execAsync(`sudo mv ${tmpFile} ${SERVICE_FILE} && sudo chmod 644 ${SERVICE_FILE}`);
  } catch {
    return false;
  }

  // Reload systemd daemon
  await systemctl("daemon-reload", true);
  return true;
}

/**
 * Remove the systemd service file (requires sudo).
 */
export async function uninstallServiceFile(): Promise<boolean> {
  if (!serviceFileExists()) {
    return true;
  }

  try {
    await execAsync(`sudo rm -f ${SERVICE_FILE}`);
  } catch {
    return false;
  }

  await systemctl("daemon-reload", true);
  return true;
}
