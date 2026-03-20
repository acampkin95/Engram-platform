import { execShell } from './system-shell';

const REDIS_CONTAINER = process.env.ENGRAM_METRICS_REDIS_CONTAINER || 'engram-memory-redis';
const HISTORY_KEY = 'engram:system:metrics:history';
const TTL_SECONDS = 8 * 24 * 60 * 60;

type SnapshotSummary = {
  status: 'healthy' | 'degraded' | 'offline';
  healthyServices: number;
  totalServices: number;
  incidentCount: number;
};

type PersistedSnapshot = {
  timestamp: string;
  summary: SnapshotSummary;
  maintenance?: Record<string, unknown>;
};

export type SystemMetricsHistoryPoint = {
  day: string;
  incidents: number;
  maintenanceRuns: number;
};

export async function persistSystemMetricsSnapshot(snapshot: {
  summary: SnapshotSummary;
  services?: unknown[];
  resources?: unknown[];
  maintenance?: Record<string, unknown>;
}) {
  const now = new Date();
  const score = now.getTime();
  const payload: PersistedSnapshot = {
    timestamp: now.toISOString(),
    summary: snapshot.summary,
    maintenance: snapshot.maintenance,
  };

  const serialized = JSON.stringify(payload);

  await execShell('docker', [
    'exec',
    REDIS_CONTAINER,
    'redis-cli',
    'ZADD',
    HISTORY_KEY,
    String(score),
    serialized,
  ]);

  const cutoff = score - TTL_SECONDS * 1000;
  await execShell('docker', [
    'exec',
    REDIS_CONTAINER,
    'redis-cli',
    'ZREMRANGEBYSCORE',
    HISTORY_KEY,
    '0',
    String(cutoff),
  ]);
}

function emptyHistory(now = new Date()): SystemMetricsHistoryPoint[] {
  const rows: SystemMetricsHistoryPoint[] = [];
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date(now);
    d.setUTCDate(now.getUTCDate() - i);
    rows.push({
      day: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }),
      incidents: 0,
      maintenanceRuns: 0,
    });
  }
  return rows;
}

export async function getSystemMetricsHistory(
  now = new Date(),
): Promise<SystemMetricsHistoryPoint[]> {
  try {
    const start = new Date(now);
    start.setUTCDate(now.getUTCDate() - 6);
    start.setUTCHours(0, 0, 0, 0);

    const { stdout } = await execShell('docker', [
      'exec',
      REDIS_CONTAINER,
      'redis-cli',
      '--raw',
      'ZRANGEBYSCORE',
      HISTORY_KEY,
      String(start.getTime()),
      String(now.getTime()),
    ]);

    const rows = emptyHistory(now);
    const byDay = new Map(rows.map((row) => [row.day, row]));

    String(stdout)
      .split('\n')
      .map((line: string) => line.trim())
      .filter(Boolean)
      .forEach((line: string) => {
        try {
          const parsed = JSON.parse(line) as PersistedSnapshot;
          const d = new Date(parsed.timestamp);
          const key = d.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            timeZone: 'UTC',
          });
          const bucket = byDay.get(key);
          if (!bucket) return;
          bucket.incidents = Math.max(bucket.incidents, parsed.summary.incidentCount || 0);
          const jobsRun =
            parsed.maintenance && typeof parsed.maintenance.jobs_run === 'number'
              ? parsed.maintenance.jobs_run
              : 0;
          bucket.maintenanceRuns = Math.max(bucket.maintenanceRuns, jobsRun);
        } catch {
          // ignore malformed rows
        }
      });

    return rows;
  } catch {
    return emptyHistory(now);
  }
}
