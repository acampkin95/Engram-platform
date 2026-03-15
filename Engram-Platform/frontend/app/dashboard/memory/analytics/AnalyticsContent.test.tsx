import { render, screen } from '@testing-library/react';
import { test, vi } from 'vitest';
import AnalyticsContent from './AnalyticsContent';

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

vi.mock('echarts', () => ({
  default: {
    init: vi.fn(() => ({
      setOption: vi.fn(),
      resize: vi.fn(),
      dispose: vi.fn(),
    })),
    getInstanceByDom: vi.fn(),
  },
  init: vi.fn(() => ({
    setOption: vi.fn(),
    resize: vi.fn(),
    dispose: vi.fn(),
  })),
}));

// Mock zrender to completely disable any rendering engine loops just in case
vi.mock('zrender', () => ({
  init: vi.fn(),
  dispose: vi.fn(),
}));

// Mock ResizeObserver for Recharts

global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

vi.mock('swr', () => ({
  default: vi.fn((key: string) => {
    if (key?.includes('matters')) {
      return { data: { data: { matters: [] } }, error: null, isLoading: false };
    }
    if (key?.includes('memories')) {
      return { data: { data: { memories: [] } }, error: null, isLoading: false };
    }
    return {
      data: {
        data: {
          total_memories: 100,
          total_entities: 50,
          confidence_metrics: { average_confidence: 0.8 },
        },
      },
      error: null,
      isLoading: false,
      mutate: vi.fn(),
    };
  }),
}));

vi.mock('@/src/hooks/useMounted', () => ({
  useMounted: () => false,
}));

vi.mock('@/src/lib/memory-client', () => ({
  memoryClient: {
    getAnalytics: vi.fn(),
  },
}));

// Mock Recharts
vi.mock('recharts', () => {
  const MockComponent = ({ children }: any) => <div>{children}</div>;
  return {
    ResponsiveContainer: ({ children }: any) => (
      <div style={{ width: '100%', height: 300 }}>{children}</div>
    ),
    LineChart: MockComponent,
    Line: MockComponent,
    BarChart: MockComponent,
    Bar: MockComponent,
    XAxis: MockComponent,
    YAxis: MockComponent,
    CartesianGrid: MockComponent,
    Tooltip: MockComponent,
    Legend: MockComponent,
  };
});

vi.mock('./ScatterChart', () => ({
  default: () => <div data-testid="mock-scatter-chart">Scatter Chart</div>,
}));

test('renders AnalyticsContent without crashing', async () => {
  render(<AnalyticsContent />);

  await screen.findByText('Analytics');
});
