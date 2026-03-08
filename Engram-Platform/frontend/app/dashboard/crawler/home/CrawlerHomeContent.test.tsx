import { render, screen, waitFor } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import CrawlerHomeContent from './CrawlerHomeContent';

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // Deprecated
    removeListener: vi.fn(), // Deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

vi.mock('swr', () => ({
  default: vi.fn((key: string) => {
    if (key.includes('stats')) {
      return {
        data: { data: { total_jobs: 5, total_crawls: 4, active_crawls: 1 } },
        error: null,
        isLoading: false,
      };
    }
    if (key.includes('jobs')) {
      return {
        data: {
          data: {
            jobs: [
              {
                job_id: 'job-1',
                status: 'running',
                created_at: '2023-01-01T00:00:00Z',
                metadata: { url: 'https://example.com' },
              },
            ],
          },
        },
        error: null,
        isLoading: false,
      };
    }
    return { data: null, error: null, isLoading: false };
  }),
}));

vi.mock('@/src/lib/crawler-client', () => ({
  crawlerClient: {
    getStats: vi.fn(),
    getJobs: vi.fn(),
    cancelJob: vi.fn(),
  },
}));

vi.mock('@/src/design-system/components/Toast', () => ({
  addToast: vi.fn(),
}));

test('renders CrawlerHomeContent without crashing', async () => {
  render(<CrawlerHomeContent />);

  await waitFor(() => {
    expect(screen.getByText('Key Metrics')).toBeInTheDocument();
    expect(screen.getByText('Recent Jobs')).toBeInTheDocument();
    expect(screen.getByText('https://example.com')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument(); // Verifies cancel button rendered for 'running' state
  });
});
