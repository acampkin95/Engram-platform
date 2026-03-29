import { execShell } from './system-shell';

const FRONTEND_SUFFIX = `${pathSeparator()}frontend`;
const PLATFORM_ROOT = getPlatformRoot();
const COMPOSE_FILE = joinPath(PLATFORM_ROOT, 'docker-compose.yml');
const CONTROLLER_SCRIPT = joinPath(PLATFORM_ROOT, 'scripts', 'engram-controller.sh');
const HEALTH_LOG_FILE = '/var/log/engram/health-monitor.log';

function pathSeparator() {
  return process.platform === 'win32' ? '\\' : '/';
}

function getPlatformRoot() {
  return process.cwd().endsWith(FRONTEND_SUFFIX)
    ? process.cwd().slice(0, -FRONTEND_SUFFIX.length)
    : process.cwd();
}

function joinPath(...parts: string[]) {
  return parts.join(pathSeparator());
}

export const SERVICE_ALLOWLIST = [
  'all',
  'crawler-api',
  'memory-api',
  'mcp-server',
  'weaviate',
  'crawler-redis',
  'memory-redis',
  'platform-frontend',
  'nginx',
] as const;

export const ACTION_ALLOWLIST = ['start', 'stop', 'restart'] as const;
export const MAINTENANCE_ALLOWLIST = [
  'decay',
  'consolidate',
  'cleanup',
  'confidence-maintenance',
] as const;

export type ServiceTarget = (typeof SERVICE_ALLOWLIST)[number];
export type ServiceAction = (typeof ACTION_ALLOWLIST)[number];
export type MaintenanceAction = (typeof MAINTENANCE_ALLOWLIST)[number];

export interface ServiceHealthRow {
  name: string;
  state: string;
  health: string;
  source: 'controller' | 'memory' | 'crawler' | 'mcp';
  detail?: string;
}

export interface ResourceRow {
  name: string;
  cpu: string;
  memory: string;
  net?: string;
}

export interface HistoryPoint {
  day: string;
  incidents: number;
  maintenanceRuns: number;
}

export interface SystemSnapshot {
  summary: {
    status: 'healthy' | 'degraded' | 'offline';
    healthyServices: number;
    totalServices: number;
    incidentCount: number;
  };
  services: ServiceHealthRow[];
  resources: ResourceRow[];
  maintenance: Record<string, unknown>;
}

type ExecResult = { stdout: string; stderr: string };

function parseJsonLines<T>(raw: string): T[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];

  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) return parsed as T[];
    if (typeof parsed === 'object') return [parsed as T];
  } catch {
    // ignore and fall through
  }

  return trimmed
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line) as T];
      } catch {
        return [];
      }
    });
}

async function runCommand(command: string, args: string[]): Promise<ExecResult> {
  const result = await execShell(command, args, {
    cwd: PLATFORM_ROOT,
    env: process.env,
    maxBuffer: 2 * 1024 * 1024,
  });

  return {
    stdout: typeof result.stdout === 'string' ? result.stdout : String(result.stdout ?? ''),
    stderr: typeof result.stderr === 'string' ? result.stderr : String(result.stderr ?? ''),
  };
}

async function fetchFirstJson(candidates: string[]): Promise<Record<string, unknown> | null> {
  for (const url of candidates) {
    try {
      const response = await fetch(url, {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) continue;
      return (await response.json()) as Record<string, unknown>;
    } catch {
      // URL unreachable or response not JSON — try next candidate
      continue;
    }
  }

  return null;
}

function memoryCandidates(pathname: string) {
  return [
    process.env.MEMORY_API_INTERNAL_URL
      ? `${process.env.MEMORY_API_INTERNAL_URL}${pathname}`
      : null,
    `http://memory-api:8000${pathname}`,
    `http://localhost:8000${pathname}`,
  ].filter(Boolean) as string[];
}

function crawlerCandidates(pathname: string) {
  return [
    process.env.CRAWLER_API_INTERNAL_URL
      ? `${process.env.CRAWLER_API_INTERNAL_URL}${pathname}`
      : null,
    `http://crawler-api:11235${pathname}`,
    `http://localhost:11235${pathname}`,
  ].filter(Boolean) as string[];
}

function mcpCandidates(pathname: string) {
  return [
    process.env.MCP_INTERNAL_URL ? `${process.env.MCP_INTERNAL_URL}${pathname}` : null,
    `http://mcp-server:3000${pathname}`,
    `http://localhost:3000${pathname}`,
  ].filter(Boolean) as string[];
}

function serviceStatusFromJson(
  name: string,
  payload: Record<string, unknown> | null,
  source: ServiceHealthRow['source'],
): ServiceHealthRow {
  if (!payload) {
    return { name, state: 'unknown', health: 'offline', source, detail: 'unreachable' };
  }

  const rawStatus = String(payload.status ?? payload.state ?? 'unknown');
  const normalized = rawStatus === 'healthy' || rawStatus === 'up' ? 'healthy' : rawStatus;

  return {
    name,
    state: normalized === 'healthy' ? 'running' : normalized,
    health: normalized,
    source,
    detail: JSON.stringify(payload).slice(0, 240),
  };
}

export function buildSevenDayHistory(logLines: string[], now = new Date()): HistoryPoint[] {
  const days: HistoryPoint[] = [];
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date(now);
    d.setUTCDate(now.getUTCDate() - i);
    days.push({
      day: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }),
      incidents: 0,
      maintenanceRuns: 0,
    });
  }

  const byDay = new Map(days.map((d) => [d.day, d]));

  for (const line of logLines) {
    const match = line.match(/\[(\d{4}-\d{2}-\d{2})\s/);
    if (!match) continue;
    const date = new Date(`${match[1]}T00:00:00Z`);
    const key = date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    });
    const bucket = byDay.get(key);
    if (!bucket) continue;

    if (/CRASH LOOP DETECTED|SERVICE DOWN|SERVICE UNHEALTHY|\[ERROR\]/i.test(line)) {
      bucket.incidents += 1;
    }
    if (/maintenance|decay|consolidat|cleanup|confidence/i.test(line)) {
      bucket.maintenanceRuns += 1;
    }
  }

  return days;
}

export async function getSevenDayHistory(): Promise<HistoryPoint[]> {
  const { existsSync } = await import('node:fs');
  if (!existsSync(HEALTH_LOG_FILE)) {
    return buildSevenDayHistory([]);
  }

  const { readFile } = await import('node:fs/promises');
  const content = await readFile(HEALTH_LOG_FILE, 'utf8');
  return buildSevenDayHistory(content.split('\n'));
}

export async function getRecentLogs(service = 'all', lines = 200) {
  const args = ['compose', '-f', COMPOSE_FILE, 'logs', '--tail', String(lines)];
  if (service !== 'all') args.push(service);

  const { stdout } = await runCommand('docker', args);
  return stdout
    .split('\n')
    .filter(Boolean)
    .slice(-lines)
    .map((line, index) => ({
      id: `${Date.now()}-${index}`,
      line,
      level: /error|exception|failed/i.test(line) ? 'error' : /warn/i.test(line) ? 'warn' : 'info',
    }));
}

export async function getSystemHealthSnapshot(): Promise<SystemSnapshot> {
  const [memoryHealth, memoryDetailed, crawlerHealth, crawlerStats, mcpHealth] = await Promise.all([
    fetchFirstJson(memoryCandidates('/health')),
    fetchFirstJson(memoryCandidates('/health/detailed')),
    fetchFirstJson(crawlerCandidates('/health')),
    fetchFirstJson(crawlerCandidates('/api/stats/dashboard')),
    fetchFirstJson(mcpCandidates('/health')),
  ]);

  const [{ stdout: psRaw }, { stdout: statsRaw }] = await Promise.all([
    runCommand('docker', ['compose', '-f', COMPOSE_FILE, 'ps', '--format', 'json']),
    runCommand('docker', ['stats', '--no-stream', '--format', 'json']),
  ]);

  const controllerServices = parseJsonLines<Record<string, unknown>>(psRaw).map((row) => ({
    name: String(row.Service ?? row.Name ?? 'unknown'),
    state: String(row.State ?? 'unknown'),
    health: String(row.Health ?? 'unknown'),
    source: 'controller' as const,
  }));

  const resources = parseJsonLines<Record<string, unknown>>(statsRaw).map((row) => ({
    name: String(row.Name ?? row.Container ?? 'unknown'),
    cpu: String(row.CPUPerc ?? row.CPU ?? 'n/a'),
    memory: String(row.MemUsage ?? row.Memory ?? 'n/a'),
    net: String(row.NetIO ?? row.NetworkIO ?? ''),
  }));

  const serviceMap = new Map<string, ServiceHealthRow>();
  for (const svc of controllerServices) serviceMap.set(svc.name, svc);

  for (const svc of [
    serviceStatusFromJson('memory-api', memoryHealth, 'memory'),
    serviceStatusFromJson('crawler-api', crawlerHealth, 'crawler'),
    serviceStatusFromJson('mcp-server', mcpHealth, 'mcp'),
  ]) {
    serviceMap.set(svc.name, {
      ...(serviceMap.get(svc.name) ?? svc),
      ...svc,
      state: serviceMap.get(svc.name)?.state ?? svc.state,
    });
  }

  const services = [...serviceMap.values()];
  const healthyServices = services.filter((s) => s.health === 'healthy').length;
  const totalServices = services.length;
  const summaryStatus =
    healthyServices === totalServices && totalServices > 0
      ? 'healthy'
      : healthyServices > 0
        ? 'degraded'
        : 'offline';

  return {
    summary: {
      status: summaryStatus,
      healthyServices,
      totalServices,
      incidentCount: services.filter((s) => s.health !== 'healthy').length,
    },
    services,
    resources,
    maintenance: (memoryDetailed?.maintenance_queue ?? crawlerStats ?? {}) as Record<
      string,
      unknown
    >,
  };
}

export async function runMaintenanceAction(action: MaintenanceAction) {
  if (!MAINTENANCE_ALLOWLIST.includes(action)) {
    throw new Error(`Unsupported maintenance action: ${action}`);
  }

  const candidates = memoryCandidates(`/memories/${action}`);
  for (const url of candidates) {
    try {
      const response = await fetch(url, { method: 'POST' });
      if (response.ok) {
        return await response.json().catch(() => ({ ok: true }));
      }
    } catch {
      // URL unreachable — try next candidate
      continue;
    }
  }

  throw new Error(`Failed to execute maintenance action: ${action}`);
}

export async function runSystemControl(input: { target: ServiceTarget; action: ServiceAction }) {
  const { target, action } = input;
  if (!SERVICE_ALLOWLIST.includes(target)) {
    throw new Error(`Unsupported target: ${target}`);
  }
  if (!ACTION_ALLOWLIST.includes(action)) {
    throw new Error(`Unsupported action: ${action}`);
  }

  if (target === 'all') {
    const { existsSync } = await import('node:fs');
    if (!existsSync(CONTROLLER_SCRIPT)) {
      throw new Error('Controller script not available');
    }

    const controllerAction = action === 'start' ? 'start' : action === 'stop' ? 'stop' : 'restart';
    const { stdout } = await runCommand(CONTROLLER_SCRIPT, [controllerAction]);
    return { ok: true, output: stdout };
  }

  const dockerAction = action === 'start' ? ['up', '-d', target] : [action, target];
  const { stdout, stderr } = await runCommand('docker', [
    'compose',
    '-f',
    COMPOSE_FILE,
    ...dockerAction,
  ]);
  return { ok: true, output: stdout || stderr };
}

async function sendViaResend(input: {
  to?: string[];
  subject: string;
  text: string;
}): Promise<{ success: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  const recipients = input.to?.filter(Boolean) ?? [];

  if (!apiKey || !from) {
    return { success: false, error: 'RESEND_API_KEY or EMAIL_FROM not configured' };
  }
  if (recipients.length === 0) {
    return { success: false, error: 'No email recipients specified' };
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: recipients,
        subject: input.subject,
        text: input.text,
      }),
    });

    return response.ok
      ? { success: true }
      : { success: false, error: `Resend: ${response.status}` };
  } catch (err) {
    return { success: false, error: `Resend: ${err instanceof Error ? err.message : 'unknown'}` };
  }
}

async function sendViaNtfy(input: {
  subject: string;
  text: string;
  priority?: string;
  tags?: string[];
}): Promise<{ success: boolean; error?: string }> {
  const topicUrl = process.env.NTFY_TOPIC_URL;
  const apiKey = process.env.NTFY_API_KEY;

  if (!topicUrl) {
    return { success: false, error: 'NTFY_TOPIC_URL not configured' };
  }

  const headers: Record<string, string> = {
    Title: input.subject,
    Priority: input.priority ?? 'default',
    Tags: (input.tags ?? ['engram']).join(','),
  };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  try {
    const response = await fetch(topicUrl, {
      method: 'POST',
      headers,
      body: input.text,
    });

    return response.ok ? { success: true } : { success: false, error: `ntfy: ${response.status}` };
  } catch (err) {
    return { success: false, error: `ntfy: ${err instanceof Error ? err.message : 'unknown'}` };
  }
}

export async function sendNotification(input: {
  to?: string[];
  subject: string;
  text: string;
  channels?: ('email' | 'ntfy')[];
  priority?: 'low' | 'default' | 'high' | 'urgent';
  tags?: string[];
}): Promise<Record<string, { success: boolean; error?: string }>> {
  const channels = input.channels ?? ['email', 'ntfy'];
  const results: Record<string, { success: boolean; error?: string }> = {};

  if (channels.includes('email')) {
    results.email = await sendViaResend(input);
  }
  if (channels.includes('ntfy')) {
    results.ntfy = await sendViaNtfy(input);
  }

  notificationLog.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    subject: input.subject,
    channels,
    results,
  });
  if (notificationLog.length > MAX_LOG_ENTRIES) notificationLog.shift();

  return results;
}

export function getNotificationChannelStatus() {
  const resendKey = process.env.RESEND_API_KEY;
  const emailFrom = process.env.EMAIL_FROM;
  const ntfyTopic = process.env.NTFY_TOPIC_URL;
  const ntfyKey = process.env.NTFY_API_KEY;

  return {
    resend: {
      configured: Boolean(resendKey && emailFrom),
      from: emailFrom ? emailFrom.replace(/^(.{3}).*(@.*)$/, '$1***$2') : null,
    },
    ntfy: {
      configured: Boolean(ntfyTopic),
      topicUrl: ntfyTopic ? ntfyTopic.replace(/\/[^/]+$/, '/***') : null,
      authenticated: Boolean(ntfyKey),
    },
  };
}

interface NotificationLogEntry {
  id: string;
  timestamp: string;
  subject: string;
  channels: string[];
  results: Record<string, { success: boolean; error?: string }>;
}

const notificationLog: NotificationLogEntry[] = [];
const MAX_LOG_ENTRIES = 50;

export function getNotificationLog(): NotificationLogEntry[] {
  return [...notificationLog].reverse();
}

let lastAlertedStatus: string | null = null;

export async function checkAndAlertHealth(): Promise<{ alerted: boolean; status: string }> {
  const snapshot = await getSystemHealthSnapshot();
  const currentStatus = snapshot.summary.status;

  // Only alert on status CHANGES to degraded or offline (not repeated)
  if (currentStatus !== 'healthy' && currentStatus !== lastAlertedStatus) {
    const unhealthyServices = snapshot.services
      .filter((s) => s.health !== 'healthy')
      .map((s) => `${s.name}: ${s.health}`)
      .join(', ');

    await sendNotification({
      subject: `Engram system ${currentStatus}`,
      text: `System status changed to ${currentStatus}. Affected services: ${unhealthyServices}`,
      channels: ['email', 'ntfy'],
      priority: currentStatus === 'offline' ? 'urgent' : 'high',
      tags: ['system-health', currentStatus],
    });
    lastAlertedStatus = currentStatus;
    return { alerted: true, status: currentStatus };
  }

  // Reset when healthy again
  if (currentStatus === 'healthy' && lastAlertedStatus) {
    await sendNotification({
      subject: 'Engram system recovered',
      text: `System status recovered to healthy. All ${snapshot.summary.totalServices} services operational.`,
      channels: ['email', 'ntfy'],
      priority: 'default',
      tags: ['system-health', 'recovered'],
    });
    lastAlertedStatus = null;
    return { alerted: true, status: 'recovered' };
  }

  lastAlertedStatus = currentStatus;
  return { alerted: false, status: currentStatus };
}

/** @deprecated Use sendNotification instead */
export async function sendAdminNotification(input: {
  to?: string[];
  subject: string;
  text: string;
}) {
  const results = await sendNotification(input);
  const anySuccess = Object.values(results).some((r) => r.success);

  if (!anySuccess) {
    const errors = Object.entries(results)
      .filter(([, r]) => !r.success)
      .map(([ch, r]) => `${ch}: ${r.error}`)
      .join('; ');
    throw new Error(errors || 'All notification channels failed');
  }
  return results;
}
