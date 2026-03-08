import { render, screen, waitFor } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import HomeContent from './HomeContent';

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

vi.mock('swr', () => ({
  default: vi.fn((key: string) => {
    return { data: { data: {} }, error: null, isLoading: false, mutate: vi.fn() };
  }),
}));

// HomeContent.tsx uses import { crawlerClient } from '@/src/lib/crawler-client';
// so we need to mock that default export properly.
vi.mock('@/src/lib/crawler-client', () => {
  return {
    crawlerClient: {
      getStats: vi.fn().mockResolvedValue({ data: { total_jobs: 50 } }),
      getHealth: vi.fn().mockResolvedValue({
        data: { status: 'healthy', version: '1.0.0', redis: 'connected' },
      }),
    },
  };
});

vi.mock('@/src/lib/memory-client', () => {
  return {
    memoryClient: {
      getAnalytics: vi.fn().mockResolvedValue({ data: { total_memories: 100 } }),
      getHealth: vi.fn().mockResolvedValue({
        data: {
          status: 'healthy',
          version: '1.0.0',
          database: 'connected',
          cache: 'connected',
        },
      }),
    },
  };
});

test('renders HomeContent without crashing', async () => {
  render(<HomeContent />);

  await waitFor(() => {
    expect(screen.getByText('Platform Overview')).toBeInTheDocument();
    expect(screen.getByText('Crawler Service')).toBeInTheDocument();
  });
});
