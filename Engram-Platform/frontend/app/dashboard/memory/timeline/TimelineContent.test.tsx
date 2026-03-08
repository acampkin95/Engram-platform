import { render, screen, waitFor } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import TimelineContent from './TimelineContent';

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
    if (key && key.includes('matters')) {
      return { data: { data: { matters: [] } }, error: null, isLoading: false };
    }
    return { data: { data: { results: [] } }, error: null, isLoading: false, mutate: vi.fn() };
  }),
}));

vi.mock('date-fns', () => ({
  format: vi.fn(() => 'Jan 1, 2024'),
}));

vi.mock('@/src/lib/memory-client', () => ({
  memoryClient: {
    getMatters: vi.fn(),
  },
}));

test('renders TimelineContent without crashing', async () => {
  render(<TimelineContent />);

  await screen.findByText('Event Timeline');
});
