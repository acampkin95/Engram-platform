import { render, screen, waitFor } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import OsintContent from './OsintContent';

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
  default: vi.fn(() => ({
    data: { data: { results: [], active_jobs: [] } },
    error: null,
    isLoading: false,
    mutate: vi.fn(),
  })),
}));

vi.mock('@/src/lib/crawler-client', () => ({
  crawlerClient: {
    startCrawl: vi.fn(),
  },
}));

test('renders OsintContent without crashing', async () => {
  render(<OsintContent />);

  await waitFor(() => {
    expect(screen.getByText('OSINT')).toBeInTheDocument();
    expect(screen.getByText('Crawl Configuration')).toBeInTheDocument();
  });
});
