import { render, screen } from '@testing-library/react';
import { test, vi } from 'vitest';
import SearchContent from './SearchContent';

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

vi.mock('@/src/lib/memory-client', () => ({
  memoryClient: {
    searchMemories: vi.fn().mockResolvedValue({ data: { results: [], total_count: 0 } }),
  },
}));

vi.mock('@/src/lib/crawler-client', () => ({
  crawlerClient: {
    searchResults: vi.fn().mockResolvedValue({ data: { results: [], total_count: 0 } }),
  },
}));

test('renders SearchContent without crashing', async () => {
  render(<SearchContent />);

  // 'Search' is the title
  await screen.findByText('Search across all systems');
});
