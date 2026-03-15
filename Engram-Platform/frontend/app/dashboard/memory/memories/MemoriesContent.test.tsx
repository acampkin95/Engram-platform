import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import MemoriesContent from './MemoriesContent';

const setSearchMock = vi.fn();
const setFilterMock = vi.fn();

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

vi.mock('@/src/hooks/useURLState', () => ({
  useSearchFilterState: () => ({
    search: '',
    filter: '',
    sort: '',
    setSearch: setSearchMock,
    setFilter: setFilterMock,
    setSort: vi.fn(),
  }),
}));

vi.mock('@/src/components/FilterBar', () => ({
  FilterBar: ({
    onFiltersChange,
  }: {
    onFiltersChange: (filters: { search?: string; status?: string }) => void;
  }) => (
    <button
      type="button"
      data-testid="filter-change"
      onClick={() => onFiltersChange({ search: 'fraud', status: 'matter-1' })}
    >
      Change Filters
    </button>
  ),
}));

vi.mock('@/src/lib/memory-client', () => ({
  memoryClient: {
    getMemories: vi.fn(),
  },
}));

beforeEach(() => {
  setSearchMock.mockReset();
  setFilterMock.mockReset();
});

test('renders MemoriesContent without crashing', async () => {
  render(<MemoriesContent />);

  await screen.findByText('Memories');
});

test('pushes search and matter filters into URL state', async () => {
  render(<MemoriesContent />);

  fireEvent.click(screen.getByTestId('filter-change'));

  expect(setSearchMock).toHaveBeenCalledWith('fraud');
  expect(setFilterMock).toHaveBeenCalledWith('matter-1');
});
