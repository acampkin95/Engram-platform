import { render, screen, waitFor } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import MemoriesContent from './MemoriesContent';

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
    data: { data: { memories: [] } },
    error: null,
    isLoading: false,
    mutate: vi.fn(),
  })),
}));

vi.mock('@/src/lib/memory-client', () => ({
  memoryClient: {
    getMemories: vi.fn(),
  },
}));

test('renders MemoriesContent without crashing', async () => {
  render(<MemoriesContent />);

  await screen.findByText('Memories');
});
