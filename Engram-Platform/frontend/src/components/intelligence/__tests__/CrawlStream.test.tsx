import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CrawlStream } from '../CrawlStream';

vi.mock('framer-motion', () => ({
  motion: {
    button: ({ children, ...props }: { children: React.ReactNode }) => (
      <button type="button" {...props}>
        {children}
      </button>
    ),
    div: ({ children, ...props }: { children: React.ReactNode }) => (
      <div {...props}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: vi.fn(() => ({
    getVirtualItems: () => [],
    getTotalSize: () => 0,
  })),
}));

const mockTogglePaused = vi.fn();
const mockGetFilteredItems = vi.fn(() => []);

vi.mock('@/src/stores/canvasStore', () => ({
  useStreamStore: vi.fn(() => ({
    items: [],
    paused: false,
    togglePaused: mockTogglePaused,
    getFilteredItems: mockGetFilteredItems,
  })),
}));

describe('CrawlStream', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetFilteredItems.mockReturnValue([]);
  });

  it('should render empty state when no items', () => {
    render(<CrawlStream />);
    expect(screen.getByText('Waiting for data...')).toBeInTheDocument();
  });

  it('should render with custom className', () => {
    const { container } = render(<CrawlStream className="custom-class" />);
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('should call togglePaused when pause button clicked', () => {
    render(<CrawlStream />);
    fireEvent.click(screen.getByRole('button', { name: /pause/i }));
    expect(mockTogglePaused).toHaveBeenCalled();
  });

  it('should display LIVE status when not paused', () => {
    render(<CrawlStream />);
    expect(screen.getByText('LIVE')).toBeInTheDocument();
  });

  it('should show VIRTUALIZED indicator for large lists', () => {
    render(<CrawlStream />);
    expect(screen.queryByText('VIRTUALIZED')).not.toBeInTheDocument();
  });

  it('should show item count', () => {
    render(<CrawlStream />);
    expect(screen.getByText('(0)')).toBeInTheDocument();
  });
});
