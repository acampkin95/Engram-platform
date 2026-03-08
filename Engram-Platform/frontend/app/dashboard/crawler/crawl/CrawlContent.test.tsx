import { render, screen, waitFor } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import CrawlContent from './CrawlContent';

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

vi.mock('@/src/lib/crawler-client', () => ({
  crawlerClient: {
    startCrawl: vi.fn(),
  },
}));

vi.mock('@/src/design-system/components/Toast', () => ({
  addToast: vi.fn(),
}));

test('renders CrawlContent without crashing', async () => {
  render(<CrawlContent />);

  await waitFor(() => {
    expect(screen.getByText('New Crawl')).toBeInTheDocument();
    expect(screen.getByText('Start Crawl')).toBeInTheDocument();
  });
});
