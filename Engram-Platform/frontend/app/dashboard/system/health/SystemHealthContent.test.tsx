import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, test, vi } from 'vitest';
import SystemHealthContent from './SystemHealthContent';

const { getLogsMock } = vi.hoisted(() => ({
  getLogsMock: vi.fn(),
}));

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  LineChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Line: () => <div data-testid="line-chart" />,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
  AreaChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Area: () => <div data-testid="area-chart" />,
}));

vi.mock('@/src/lib/system-client', async () => {
  const base = {
    getSnapshot: vi.fn().mockResolvedValue({
      data: {
        summary: { status: 'healthy', incidentCount: 2, healthyServices: 4, totalServices: 4 },
        services: [
          { name: 'memory-api', state: 'running', health: 'healthy', source: 'memory' },
          { name: 'crawler-api', state: 'running', health: 'healthy', source: 'crawler' },
        ],
        resources: [{ name: 'memory-api', cpu: '5%', memory: '256MiB / 512MiB' }],
        maintenance: { jobs_run: 12, ai_jobs_skipped: 1, last_run: {} },
      },
      error: null,
    }),
    getHistory: vi.fn().mockResolvedValue({
      data: [
        { day: 'Mar 10', incidents: 1, maintenanceRuns: 0 },
        { day: 'Mar 11', incidents: 0, maintenanceRuns: 1 },
      ],
      error: null,
    }),
    getLogs: getLogsMock,
    runMaintenance: vi.fn().mockResolvedValue({ data: { ok: true }, error: null }),
    runControl: vi.fn().mockResolvedValue({ data: { ok: true }, error: null }),
    sendNotification: vi.fn().mockResolvedValue({ data: { ok: true }, error: null }),
    subscribeLogs: vi.fn(),
  };

  getLogsMock.mockResolvedValue({
    data: [
      { id: '1', line: 'memory-api started', level: 'info' },
      { id: '2', line: 'crawler-api warning threshold reached', level: 'warn' },
      { id: '3', line: 'mcp-server error connection refused', level: 'error' },
    ],
    error: null,
  });

  return { systemClient: base };
});

beforeEach(() => {
  vi.clearAllMocks();
});

test('renders system admin dashboard with key controls and graphs', async () => {
  render(<SystemHealthContent />);

  await waitFor(() => {
    expect(screen.getByText('System Health')).toBeInTheDocument();
    expect(screen.getByText('Service Control')).toBeInTheDocument();
    expect(screen.getByText('Maintenance Actions')).toBeInTheDocument();
    expect(screen.getByText('Live Error Logs')).toBeInTheDocument();
  });

  expect(screen.getAllByTestId('line-chart').length).toBeGreaterThan(0);
  expect(screen.getAllByTestId('area-chart').length).toBeGreaterThan(0);
  expect(screen.getAllByText('memory-api').length).toBeGreaterThan(0);
  expect(screen.getAllByText('crawler-api').length).toBeGreaterThan(0);
  expect(screen.getByText('Restart All')).toBeInTheDocument();
  expect(screen.getByText('Run Decay')).toBeInTheDocument();
  expect(screen.getByText('Send Test Notification')).toBeInTheDocument();
});

test('filters live logs by service, severity, and search query', async () => {
  const user = userEvent.setup();
  render(<SystemHealthContent />);

  await waitFor(() => {
    expect(screen.getByText('mcp-server error connection refused')).toBeInTheDocument();
  });

  await user.click(screen.getByRole('button', { name: /Errors/i }));
  expect(screen.queryByText('memory-api started')).not.toBeInTheDocument();
  expect(screen.getByText('mcp-server error connection refused')).toBeInTheDocument();

  await user.type(screen.getByPlaceholderText('Search log lines'), 'crawler');
  expect(screen.queryByText('mcp-server error connection refused')).not.toBeInTheDocument();
  expect(screen.queryByText('memory-api started')).not.toBeInTheDocument();
});
