import { beforeEach, describe, expect, it, vi } from 'vitest';

const { execShellMock } = vi.hoisted(() => ({
  execShellMock: vi.fn(),
}));

vi.mock('../system-shell', () => ({
  execShell: execShellMock,
}));

describe('system-admin', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('aggregates service health and controller status', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ status: 'healthy', initialized: true }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ status: 'healthy', maintenance_queue: { jobs_run: 12 } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ status: 'healthy' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ total_jobs: 42 }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ status: 'healthy' }) });
    vi.stubGlobal('fetch', fetchMock);

    execShellMock
      .mockResolvedValueOnce({
        stdout: JSON.stringify([
          { Service: 'memory-api', State: 'running', Health: 'healthy' },
          { Service: 'crawler-api', State: 'running', Health: 'healthy' },
          { Service: 'mcp-server', State: 'running', Health: 'healthy' },
          { Service: 'nginx', State: 'running', Health: 'healthy' },
        ]),
        stderr: '',
      } as never)
      .mockResolvedValueOnce({
        stdout: JSON.stringify([
          { Name: 'memory-api', CPUPerc: '5%', MemUsage: '256MiB / 512MiB' },
          { Name: 'crawler-api', CPUPerc: '3%', MemUsage: '512MiB / 2GiB' },
        ]),
        stderr: '',
      } as never);

    const { getSystemHealthSnapshot } = await import('../system-admin');
    const snapshot = await getSystemHealthSnapshot();

    expect(snapshot.summary.status).toBe('healthy');
    expect(snapshot.services).toHaveLength(4);
    expect(snapshot.resources[0]?.name).toBe('memory-api');
  });

  it('rejects unsupported service control actions', async () => {
    const { runSystemControl } = await import('../system-admin');

    await expect(runSystemControl({ target: 'memory-api', action: 'destroy' as never })).rejects.toThrow(
      'Unsupported action',
    );
  });

  it('rejects unsupported service targets', async () => {
    const { runSystemControl } = await import('../system-admin');

    await expect(runSystemControl({ target: 'postgres', action: 'restart' })).rejects.toThrow(
      'Unsupported target',
    );
  });

  it('builds seven day history buckets', async () => {
    const { buildSevenDayHistory } = await import('../system-admin');
    const history = buildSevenDayHistory([
      '[2026-03-10 10:00:00] [WARN] SERVICE UNHEALTHY memory-api',
      '[2026-03-10 11:00:00] [ERROR] CRASH LOOP DETECTED crawler-api',
      '[2026-03-12 09:00:00] [INFO] maintenance decay',
    ], new Date('2026-03-16T12:00:00Z'));

    expect(history).toHaveLength(7);
    expect(history.some((d) => d.incidents > 0)).toBe(true);
    expect(history.some((d) => d.maintenanceRuns > 0)).toBe(true);
  });
});
