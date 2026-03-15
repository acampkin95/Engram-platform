import { render, screen } from '@testing-library/react';
import { test, vi } from 'vitest';
import MattersContent from './MattersContent';

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
    data: { data: { matters: [] } },
    error: null,
    isLoading: false,
    mutate: vi.fn(),
  })),
}));

vi.mock('@/src/lib/memory-client', () => ({
  memoryClient: {
    getMatters: vi.fn(),
  },
}));

test('renders MattersContent without crashing', async () => {
  render(<MattersContent />);

  await screen.findByText('Matters');
});
