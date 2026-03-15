import { render, screen, waitFor } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import MemoryHomeContent from './MemoryHomeContent';

// Mock matchMedia to prevent DraggableGrid from breaking in JSDOM
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
    if (key === 'memory-matters') {
      return { data: { data: { matters: [] } }, error: null, isLoading: false };
    }
    if (key === 'memory-recent') {
      return { data: { data: { memories: [] } }, error: null, isLoading: false };
    }
    return {
      data: { data: { total_memories: 10, total_entities: 50 } },
      error: null,
      isLoading: false,
    };
  }),
}));

vi.mock('@/src/lib/memory-client', () => ({
  memoryClient: {
    getAnalytics: vi.fn(),
    getMemories: vi.fn(),
    getMatters: vi.fn(),
    runDecay: vi.fn(),
    consolidateMemories: vi.fn(),
    cleanupExpired: vi.fn(),
  },
}));

test('renders MemoryHomeContent without crashing', async () => {
  render(<MemoryHomeContent />);

  await waitFor(() => {
    expect(screen.getByText('Key Metrics')).toBeInTheDocument();
    expect(screen.getByText('System Maintenance')).toBeInTheDocument();
  });
});
