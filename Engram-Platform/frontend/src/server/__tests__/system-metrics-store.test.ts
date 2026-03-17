// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { execShellMock } = vi.hoisted(() => ({
  execShellMock: vi.fn(),
}));

vi.mock('../system-shell', () => ({
  execShell: execShellMock,
}));

describe('system-metrics-store', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    delete process.env.ENGRAM_METRICS_REDIS_CONTAINER;
  });

  it('persists a system health snapshot to redis history', async () => {
    const { persistSystemMetricsSnapshot } = await import('../system-metrics-store');

    execShellMock.mockResolvedValue({ stdout: 'OK', stderr: '' } as never);

    await persistSystemMetricsSnapshot({
      summary: { status: 'healthy', healthyServices: 4, totalServices: 4, incidentCount: 0 },
      services: [
        { name: 'memory-api', state: 'running', health: 'healthy', source: 'memory' },
        { name: 'crawler-api', state: 'running', health: 'healthy', source: 'crawler' },
      ],
      resources: [{ name: 'memory-api', cpu: '5%', memory: '256MiB / 512MiB' }],
      maintenance: { jobs_run: 12 },
    });

    expect(execShellMock).toHaveBeenCalled();
    const args = execShellMock.mock.calls[0]?.[1] as string[];
    expect(args.join(' ')).toContain('redis-cli');
    expect(args.join(' ')).toContain('ZADD');
  });

  it('reads and aggregates seven day history from redis snapshots', async () => {
    const { getSystemMetricsHistory } = await import('../system-metrics-store');

    execShellMock.mockResolvedValue({
      stdout: [
        JSON.stringify({
          timestamp: '2026-03-14T10:00:00.000Z',
          summary: { status: 'healthy', incidentCount: 0 },
          maintenance: { jobs_run: 3 },
        }),
        JSON.stringify({
          timestamp: '2026-03-15T10:00:00.000Z',
          summary: { status: 'degraded', incidentCount: 2 },
          maintenance: { jobs_run: 5 },
        }),
      ].join('\n'),
      stderr: '',
    } as never);

    const history = await getSystemMetricsHistory(new Date('2026-03-16T12:00:00Z'));

    expect(history).toHaveLength(7);
    expect(history.some((point) => point.incidents > 0)).toBe(true);
    expect(history.some((point) => point.maintenanceRuns > 0)).toBe(true);
  });

  it('falls back to empty history when redis is unavailable', async () => {
    const { getSystemMetricsHistory } = await import('../system-metrics-store');

    execShellMock.mockRejectedValue(new Error('redis unavailable'));

    const history = await getSystemMetricsHistory(new Date('2026-03-16T12:00:00Z'));

    expect(history).toHaveLength(7);
    expect(history.every((point) => point.incidents === 0)).toBe(true);
  });
});
