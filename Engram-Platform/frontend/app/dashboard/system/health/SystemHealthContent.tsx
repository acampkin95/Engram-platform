'use client';

import {
  Activity,
  Bell,
  Database,
  Play,
  RefreshCw,
  RotateCcw,
  Server,
  Settings,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FadeIn } from '@/src/components/animations/PageTransition';
import { StaggerContainer, StaggerItem } from '@/src/components/animations/stagger';
import { Button } from '@/src/design-system/components/Button';
import { Card } from '@/src/design-system/components/Card';
import { type Column, DataTable } from '@/src/design-system/components/DataTable';
import { SearchInput } from '@/src/design-system/components/SearchInput';
import { StatCard } from '@/src/design-system/components/StatCard';
import { StatusDot } from '@/src/design-system/components/StatusDot';
import { addToast } from '@/src/design-system/components/Toast';
import { systemClient } from '@/src/lib/system-client';

type Snapshot = {
  summary: {
    status: 'healthy' | 'degraded' | 'offline';
    healthyServices: number;
    totalServices: number;
    incidentCount: number;
  };
  services: Array<{
    name: string;
    state: string;
    health: string;
    source: string;
    detail?: string;
  }>;
  resources: Array<{ name: string; cpu: string; memory: string; net?: string }>;
  maintenance: Record<string, unknown>;
};

type HistoryPoint = { day: string; incidents: number; maintenanceRuns: number };
type LogEntry = { id: string; line: string; level: 'info' | 'warn' | 'error' };
type LogLevelFilter = 'all' | 'error' | 'warn' | 'info';

const serviceColumns: Column<Snapshot['services'][number]>[] = [
  { key: 'name', header: 'Service' },
  {
    key: 'health',
    header: 'Health',
    render: (row) => (
      <StatusDot
        variant={
          row.health === 'healthy' ? 'online' : row.health === 'degraded' ? 'degraded' : 'offline'
        }
        label={row.health}
      />
    ),
  },
  { key: 'state', header: 'State' },
  { key: 'source', header: 'Source' },
];

const resourceColumns: Column<Snapshot['resources'][number]>[] = [
  { key: 'name', header: 'Container' },
  { key: 'cpu', header: 'CPU' },
  { key: 'memory', header: 'Memory' },
  { key: 'net', header: 'Network' },
];

const controlTargets = ['all', 'memory-api', 'crawler-api', 'mcp-server', 'weaviate'] as const;

export default function SystemHealthContent() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeService, setActiveService] = useState<string>('all');
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [logLevel, setLogLevel] = useState<LogLevelFilter>('all');
  const [logQuery, setLogQuery] = useState('');
  const sourceRef = useRef<EventSource | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [snapshotRes, historyRes, logsRes] = await Promise.all([
      systemClient.getSnapshot(),
      systemClient.getHistory(),
      systemClient.getLogs(activeService),
    ]);

    if (snapshotRes.data) setSnapshot(snapshotRes.data as Snapshot);
    if (historyRes.data) setHistory(historyRes.data as HistoryPoint[]);
    if (logsRes.data) setLogs(logsRes.data as LogEntry[]);

    if (snapshotRes.error) addToast({ type: 'error', message: snapshotRes.error });
    setLoading(false);
  }, [activeService]);

  useEffect(() => {
    void load();
    const interval = window.setInterval(() => void load(), 15000);
    return () => window.clearInterval(interval);
  }, [load]);

  useEffect(() => {
    sourceRef.current?.close();
    sourceRef.current = systemClient.subscribeLogs(activeService, {
      onMessage: (event) => {
        try {
          const parsed = JSON.parse(event.data) as { line: string };
          setLogs((prev) => {
            const next: LogEntry[] = [
              ...prev,
              {
                id: `${Date.now()}-${prev.length}`,
                line: parsed.line,
                level: /error|exception|failed/i.test(parsed.line)
                  ? 'error'
                  : /warn/i.test(parsed.line)
                    ? 'warn'
                    : 'info',
              },
            ];
            return next.slice(-250);
          });
        } catch {
          // Ignore malformed JSON from log stream — continue to next message
        }
      },
      onError: () => {
        addToast({ type: 'error', message: 'Live log stream disconnected' });
      },
    });

    return () => sourceRef.current?.close();
  }, [activeService]);

  const runControl = async (target: string, action: string) => {
    setBusyAction(`${action}:${target}`);
    const result = await systemClient.runControl({ target, action });
    setBusyAction(null);
    if (result.error) {
      addToast({ type: 'error', message: result.error });
      return;
    }
    addToast({ type: 'success', message: `${action} ${target} requested` });
    void load();
  };

  const runMaintenance = async (action: string) => {
    setBusyAction(`maintenance:${action}`);
    const result = await systemClient.runMaintenance({ action });
    setBusyAction(null);
    if (result.error) {
      addToast({ type: 'error', message: result.error });
      return;
    }
    addToast({ type: 'success', message: `${action} started` });
    void load();
  };

  const sendTestNotification = async () => {
    setBusyAction('notify');
    const result = await systemClient.sendNotification({
      subject: 'Engram system dashboard test notification',
      text: 'This is a test notification from the unified system health dashboard.',
      channels: ['email', 'ntfy'],
      priority: 'default',
      tags: ['test', 'system-health'],
    });
    setBusyAction(null);
    if (result.error) {
      addToast({ type: 'error', message: result.error });
      return;
    }
    addToast({ type: 'success', message: 'Test notification sent to all channels' });
  };

  const summary = snapshot?.summary;
  const maintenanceRuns = useMemo(() => {
    const value = snapshot?.maintenance?.jobs_run;
    return typeof value === 'number' ? value : 0;
  }, [snapshot]);

  const filteredLogs = useMemo(() => {
    return logs.filter((entry) => {
      const levelMatch = logLevel === 'all' ? true : entry.level === logLevel;
      const queryMatch = logQuery.trim()
        ? entry.line.toLowerCase().includes(logQuery.trim().toLowerCase())
        : true;
      const serviceMatch = activeService === 'all' ? true : entry.line.includes(activeService);
      return levelMatch && queryMatch && serviceMatch;
    });
  }, [activeService, logLevel, logQuery, logs]);

  const logStats = useMemo(
    () => ({
      error: logs.filter((entry) => entry.level === 'error').length,
      warn: logs.filter((entry) => entry.level === 'warn').length,
      info: logs.filter((entry) => entry.level === 'info').length,
    }),
    [logs],
  );

  return (
    <StaggerContainer className="space-y-6" variant="card">
      <FadeIn className="flex items-center justify-between gap-4" delay={0.02}>
        <div>
          <div className="mb-2 flex items-center gap-3">
            <StatusDot
              variant={
                summary?.status === 'healthy'
                  ? 'online'
                  : summary?.status === 'degraded'
                    ? 'degraded'
                    : 'offline'
              }
              label="Live"
            />
            <span className="rounded-full border border-[#2EC4C4]/20 bg-[#2EC4C4]/10 px-2.5 py-1 text-[10px] font-mono uppercase tracking-[0.22em] text-[#2EC4C4]">
              Realtime Admin Surface
            </span>
          </div>
          <h1 className="text-2xl font-bold font-display text-[#f0eef8]">System Health</h1>
          <p className="text-sm text-[#a09bb8]">
            Unified operational control surface for the Engram stack.
          </p>
        </div>
        <Button variant="secondary" onClick={() => void load()} loading={loading}>
          <RefreshCw className="h-4 w-4" /> Refresh
        </Button>
      </FadeIn>

      <StaggerItem variant="card">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Overall Status"
            value={summary?.status ?? 'unknown'}
            icon={<Activity className="h-4 w-4" />}
            accent="teal"
          />
          <StatCard
            label="Healthy Services"
            value={`${summary?.healthyServices ?? 0}/${summary?.totalServices ?? 0}`}
            icon={<Server className="h-4 w-4" />}
            accent="blue"
          />
          <StatCard
            label="Open Incidents"
            value={summary?.incidentCount ?? 0}
            icon={<ShieldAlert className="h-4 w-4" />}
            accent="rose"
          />
          <StatCard
            label="Maintenance Runs"
            value={maintenanceRuns}
            icon={<Database className="h-4 w-4" />}
            accent="amber"
          />
        </div>
      </StaggerItem>

      <StaggerItem variant="card">
        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <Card
            variant="elevated"
            header={
              <div className="text-sm font-medium text-[#f0eef8]">7-Day Service Activity</div>
            }
          >
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="h-72 overflow-auto" data-testid="line-chart">
                <div className="flex h-full flex-col justify-between gap-4 p-4">
                  <div className="text-xs text-[#a09bb8]">Incidents (7 days)</div>
                  <div className="space-y-2">
                    {history.map((point) => (
                      <div key={point.day} className="flex items-center gap-2">
                        <span className="min-w-8 text-xs text-[#5c5878]">{point.day}</span>
                        <div
                          className="h-6 rounded-sm bg-[#E07D9B]"
                          style={{
                            width: `${Math.max(20, (point.incidents / Math.max(...history.map((h) => h.incidents), 1)) * 100)}px`,
                          }}
                        />
                        <span className="text-xs text-[#a09bb8]">{point.incidents}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="h-72 overflow-auto" data-testid="area-chart">
                <div className="flex h-full flex-col justify-between gap-4 p-4">
                  <div className="text-xs text-[#a09bb8]">Maintenance Runs (7 days)</div>
                  <div className="space-y-2">
                    {history.map((point) => (
                      <div key={point.day} className="flex items-center gap-2">
                        <span className="min-w-8 text-xs text-[#5c5878]">{point.day}</span>
                        <div
                          className="h-6 rounded-sm bg-[#2EC4C4]"
                          style={{
                            width: `${Math.max(20, (point.maintenanceRuns / Math.max(...history.map((h) => h.maintenanceRuns), 1)) * 100)}px`,
                          }}
                        />
                        <span className="text-xs text-[#a09bb8]">{point.maintenanceRuns}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </Card>

          <Card
            variant="elevated"
            header={<div className="text-sm font-medium text-[#f0eef8]">Service Control</div>}
          >
            <div className="space-y-3">
              <div className="grid gap-2 sm:grid-cols-2">
                <Button
                  onClick={() => void runControl('all', 'restart')}
                  loading={busyAction === 'restart:all'}
                >
                  <RotateCcw className="h-4 w-4" /> Restart All
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => void runControl('all', 'start')}
                  loading={busyAction === 'start:all'}
                >
                  <Play className="h-4 w-4" /> Start All
                </Button>
                <Button
                  variant="danger"
                  onClick={() => void runControl('all', 'stop')}
                  loading={busyAction === 'stop:all'}
                >
                  <Trash2 className="h-4 w-4" /> Stop All
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => void sendTestNotification()}
                  loading={busyAction === 'notify'}
                >
                  <Bell className="h-4 w-4" /> Send Test Notification
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => (window.location.href = '/dashboard/system/settings')}
                >
                  <Settings className="h-4 w-4" /> Alert Settings
                </Button>
              </div>

              <div className="grid gap-2">
                {controlTargets
                  .filter((item) => item !== 'all')
                  .map((service) => (
                    <div
                      key={service}
                      className="flex items-center justify-between rounded-lg border border-[#222633]/60 bg-[#13151c] px-3 py-2"
                    >
                      <span className="text-sm text-[#f0eef8]">{service}</span>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => void runControl(service, 'start')}
                          loading={busyAction === `start:${service}`}
                        >
                          Start
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => void runControl(service, 'restart')}
                          loading={busyAction === `restart:${service}`}
                        >
                          Restart
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => void runControl(service, 'stop')}
                          loading={busyAction === `stop:${service}`}
                        >
                          Stop
                        </Button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </Card>
        </div>
      </StaggerItem>

      <StaggerItem variant="card">
        <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <Card
            variant="elevated"
            header={<div className="text-sm font-medium text-[#f0eef8]">Maintenance Actions</div>}
          >
            <div className="grid gap-2 sm:grid-cols-2">
              <Button
                variant="secondary"
                onClick={() => void runMaintenance('decay')}
                loading={busyAction === 'maintenance:decay'}
              >
                Run Decay
              </Button>
              <Button
                variant="secondary"
                onClick={() => void runMaintenance('consolidate')}
                loading={busyAction === 'maintenance:consolidate'}
              >
                Run Consolidation
              </Button>
              <Button
                variant="secondary"
                onClick={() => void runMaintenance('cleanup')}
                loading={busyAction === 'maintenance:cleanup'}
              >
                Cleanup Expired
              </Button>
              <Button
                variant="secondary"
                onClick={() => void runMaintenance('confidence-maintenance')}
                loading={busyAction === 'maintenance:confidence-maintenance'}
              >
                Confidence Refresh
              </Button>
            </div>
          </Card>

          <Card
            variant="elevated"
            header={
              <div className="text-sm font-medium text-[#f0eef8]">Current Resource Metrics</div>
            }
          >
            <DataTable
              columns={resourceColumns}
              data={snapshot?.resources ?? []}
              emptyMessage="No resource metrics yet"
            />
          </Card>
        </div>
      </StaggerItem>

      <StaggerItem variant="card">
        <Card
          variant="elevated"
          header={<div className="text-sm font-medium text-[#f0eef8]">Service Status</div>}
        >
          <DataTable
            columns={serviceColumns}
            data={snapshot?.services ?? []}
            emptyMessage="No service snapshot yet"
          />
        </Card>
      </StaggerItem>

      <StaggerItem variant="card">
        <Card
          variant="elevated"
          header={
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-[#f0eef8]">Live Error Logs</span>
              <select
                aria-label="Log service filter"
                value={activeService}
                onChange={(e) => setActiveService(e.target.value)}
                className="rounded-md border border-[#2a2f3e]/60 bg-[#13151c] px-3 py-1.5 text-xs text-[#f0eef8]"
              >
                <option value="all">All services</option>
                {controlTargets
                  .filter((item) => item !== 'all')
                  .map((service) => (
                    <option key={service} value={service}>
                      {service}
                    </option>
                  ))}
              </select>
            </div>
          }
        >
          <div className="rounded-xl border border-[#222633]/60 bg-[#13151c] p-3">
            <div className="mb-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono uppercase tracking-widest text-[#5c5878]">
                    Streaming via SSE
                  </span>
                  <div className="flex items-center gap-2 rounded-full border border-white/[0.08] bg-black/10 px-2.5 py-1 text-[11px] text-[#a09bb8]">
                    <span>{filteredLogs.length} visible</span>
                    <span className="text-[#5c5878]">/</span>
                    <span>{logs.length} total</span>
                  </div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => setLogs([])}>
                  Clear
                </Button>
              </div>

              <div className="flex flex-wrap gap-2">
                {(['all', 'error', 'warn', 'info'] as const).map((level) => (
                  <Button
                    key={level}
                    size="sm"
                    variant={logLevel === level ? 'primary' : 'secondary'}
                    onClick={() => setLogLevel(level)}
                  >
                    {level === 'all'
                      ? 'All'
                      : level === 'error'
                        ? 'Errors'
                        : level === 'warn'
                          ? 'Warnings'
                          : 'Info'}
                    {level !== 'all' ? (
                      <span className="ml-1 rounded bg-black/20 px-1.5 py-0.5 text-[10px]">
                        {logStats[level]}
                      </span>
                    ) : null}
                  </Button>
                ))}
              </div>

              <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
                <SearchInput
                  value={logQuery}
                  onChange={setLogQuery}
                  placeholder="Search log lines"
                  debounceMs={0}
                />
                <div className="flex flex-wrap gap-2">
                  {controlTargets.map((service) => (
                    <Button
                      key={service}
                      size="sm"
                      variant={activeService === service ? 'primary' : 'secondary'}
                      onClick={() => setActiveService(service)}
                    >
                      {service === 'all' ? 'All services' : service}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
            <div className="max-h-[24rem] overflow-auto rounded-lg bg-black/20 p-3 font-mono text-xs leading-6">
              {filteredLogs.length === 0 ? (
                <p className="text-[#5c5878]">No log lines received yet.</p>
              ) : (
                filteredLogs.map((entry) => (
                  <div
                    key={entry.id}
                    className={
                      entry.level === 'error'
                        ? 'animate-pulse text-[#E07D9B]'
                        : entry.level === 'warn'
                          ? 'text-[#F2A93B]'
                          : 'text-[#a09bb8]'
                    }
                  >
                    {entry.line}
                  </div>
                ))
              )}
            </div>
          </div>
        </Card>
      </StaggerItem>
    </StaggerContainer>
  );
}
