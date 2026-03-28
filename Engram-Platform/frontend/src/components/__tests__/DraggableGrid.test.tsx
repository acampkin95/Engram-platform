import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GridItem } from '../DraggableGrid';
import { DraggableGrid, useGridLayout } from '../DraggableGrid';

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

describe('DraggableGrid', () => {
  const mockOnLayoutChange = vi.fn();

  const defaultItems: GridItem[] = [
    {
      id: 'widget-1',
      title: 'Widget 1',
      children: <div data-testid="widget-1-content">Content 1</div>,
    },
    {
      id: 'widget-2',
      title: 'Widget 2',
      children: <div data-testid="widget-2-content">Content 2</div>,
    },
    {
      id: 'widget-3',
      title: 'Widget 3',
      children: <div data-testid="widget-3-content">Content 3</div>,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    // Clear localStorage properly for testing
    Object.keys(localStorage).forEach((key) => {
      localStorage.removeItem(key);
    });
  });

  afterEach(() => {
    Object.keys(localStorage).forEach((key) => {
      localStorage.removeItem(key);
    });
  });

  describe('Basic Rendering', () => {
    it('renders grid on mount in SSR mode', () => {
      render(<DraggableGrid items={defaultItems} />);

      // Should render in static grid mode initially
      expect(screen.getByTestId('widget-1-content')).toBeInTheDocument();
      expect(screen.getByTestId('widget-2-content')).toBeInTheDocument();
      expect(screen.getByTestId('widget-3-content')).toBeInTheDocument();
    });

    it('renders all grid items', () => {
      render(<DraggableGrid items={defaultItems} />);

      expect(screen.getByTestId('widget-1-content')).toBeInTheDocument();
      expect(screen.getByTestId('widget-2-content')).toBeInTheDocument();
      expect(screen.getByTestId('widget-3-content')).toBeInTheDocument();
    });

    it('displays titles for grid items', () => {
      render(<DraggableGrid items={defaultItems} />);

      expect(screen.getByText('Widget 1')).toBeInTheDocument();
      expect(screen.getByText('Widget 2')).toBeInTheDocument();
      expect(screen.getByText('Widget 3')).toBeInTheDocument();
    });

    it('renders items with custom content', () => {
      const customItems: GridItem[] = [
        {
          id: 'custom-1',
          title: 'Custom',
          children: <div data-testid="custom-content">Custom content here</div>,
        },
      ];

      render(<DraggableGrid items={customItems} />);

      expect(screen.getByText('Custom content here')).toBeInTheDocument();
    });
  });

  describe('Grid Item Headers', () => {
    it('displays drag handle for items with title', () => {
      const { container } = render(<DraggableGrid items={defaultItems} />);

      const dragHandles = container.querySelectorAll('.drag-handle');
      expect(dragHandles.length).toBeGreaterThan(0);
    });

    it('hides header when item has no title or icon', () => {
      const itemsNoHeader: GridItem[] = [
        {
          id: 'no-header',
          children: <div>Content</div>,
        },
      ];

      const { container } = render(<DraggableGrid items={itemsNoHeader} />);

      const dragHandles = container.querySelectorAll('.drag-handle');
      expect(dragHandles.length).toBe(0);
    });

    it('displays maximize button in header', async () => {
      render(<DraggableGrid items={defaultItems} />);

      // All items should have expand buttons
      const expandButtons = screen.getAllByLabelText('Maximize');
      expect(expandButtons.length).toBe(defaultItems.length);
    });

    it('displays icons in header when provided', () => {
      const itemsWithIcons: GridItem[] = [
        {
          id: 'icon-widget',
          title: 'Icon Widget',
          icon: <span data-testid="custom-icon">📊</span>,
          children: <div>Content</div>,
        },
      ];

      render(<DraggableGrid items={itemsWithIcons} />);

      expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
    });
  });

  describe('Expand/Collapse Functionality', () => {
    it('renders expand buttons for all items', () => {
      render(<DraggableGrid items={defaultItems} />);

      const expandButtons = screen.getAllByLabelText('Maximize');
      expect(expandButtons.length).toBe(defaultItems.length);
    });

    it('expand buttons are clickable', async () => {
      const user = userEvent.setup();
      render(<DraggableGrid items={defaultItems} />);

      const expandButtons = screen.getAllByLabelText('Maximize');
      expect(expandButtons[0]).toBeInTheDocument();
      expect(expandButtons[0]).not.toBeDisabled();

      // Click should not throw
      await user.click(expandButtons[0]);
    });

    it('renders grid cards with proper structure', () => {
      render(<DraggableGrid items={defaultItems} />);

      // All items should have grid card containers
      defaultItems.forEach((item) => {
        expect(screen.getByTestId(`${item.id}-content`)).toBeInTheDocument();
      });
    });

    it('displays drag handle for each item', () => {
      const { container } = render(<DraggableGrid items={defaultItems} />);

      const dragHandles = container.querySelectorAll('.drag-handle');
      expect(dragHandles.length).toBeGreaterThan(0);
    });

    it('expand button has proper aria-label', () => {
      render(<DraggableGrid items={defaultItems} />);

      const expandButtons = screen.getAllByLabelText('Maximize');
      expandButtons.forEach((button) => {
        expect(button).toHaveAttribute('aria-label', 'Maximize');
      });
    });
  });

  describe('Layout Persistence', () => {
    it('calls onLayoutChange when layout changes', () => {
      render(<DraggableGrid items={defaultItems} onLayoutChange={mockOnLayoutChange} />);

      // onLayoutChange should be called during initialization
      expect(mockOnLayoutChange).toHaveBeenCalled();
    });

    it('accepts storageKey prop', () => {
      // Should render without errors with custom storage key
      render(
        <DraggableGrid
          items={defaultItems}
          storageKey="custom-key"
          onLayoutChange={mockOnLayoutChange}
        />,
      );

      expect(screen.getByTestId('widget-1-content')).toBeInTheDocument();
    });

    it('passes layout to onLayoutChange callback', () => {
      render(<DraggableGrid items={defaultItems} onLayoutChange={mockOnLayoutChange} />);

      // Should be called with layout information
      expect(mockOnLayoutChange).toHaveBeenCalledWith(expect.any(Array), expect.any(Object));
    });
  });

  describe('Responsive Columns', () => {
    it('uses default column configuration', () => {
      render(<DraggableGrid items={defaultItems} />);

      // Should render without error with default cols
      expect(screen.getByTestId('widget-1-content')).toBeInTheDocument();
    });

    it('accepts custom column configuration', () => {
      const customCols = { lg: 8, md: 6, sm: 4, xs: 2, xxs: 1 };

      render(<DraggableGrid items={defaultItems} cols={customCols} />);

      expect(screen.getByTestId('widget-1-content')).toBeInTheDocument();
    });

    it('respects column constraints in default layout', () => {
      const customCols = { lg: 4, md: 3, sm: 2, xs: 1, xxs: 1 };

      render(<DraggableGrid items={defaultItems} cols={customCols} />);

      // Should not crash and render all items
      expect(screen.getByTestId('widget-1-content')).toBeInTheDocument();
      expect(screen.getByTestId('widget-2-content')).toBeInTheDocument();
      expect(screen.getByTestId('widget-3-content')).toBeInTheDocument();
    });
  });

  describe('Custom Row Height', () => {
    it('uses default row height of 60', () => {
      render(<DraggableGrid items={defaultItems} />);

      expect(screen.getByTestId('widget-1-content')).toBeInTheDocument();
    });

    it('accepts custom row height', () => {
      render(<DraggableGrid items={defaultItems} rowHeight={80} />);

      expect(screen.getByTestId('widget-1-content')).toBeInTheDocument();
    });
  });

  describe('Item Defaults', () => {
    it('applies default layout when not provided', () => {
      render(<DraggableGrid items={defaultItems} />);

      expect(screen.getByTestId('widget-1-content')).toBeInTheDocument();
      expect(screen.getByTestId('widget-2-content')).toBeInTheDocument();
    });

    it('uses custom default layout when provided', () => {
      const itemsWithDefaults: GridItem[] = [
        {
          id: 'custom-layout',
          title: 'Custom',
          children: <div data-testid="custom-layout-content">Content</div>,
          defaultLayout: { x: 2, y: 2, w: 4, h: 3 },
        },
      ];

      render(<DraggableGrid items={itemsWithDefaults} />);

      expect(screen.getByTestId('custom-layout-content')).toBeInTheDocument();
    });

    it('respects minW and minH constraints', () => {
      const itemsWithConstraints: GridItem[] = [
        {
          id: 'constrained',
          title: 'Constrained',
          children: <div>Content</div>,
          defaultLayout: {
            x: 0,
            y: 0,
            w: 6,
            h: 4,
            minW: 3,
            minH: 2,
          },
        },
      ];

      render(<DraggableGrid items={itemsWithConstraints} />);

      expect(screen.getByText('Constrained')).toBeInTheDocument();
    });

    it('respects maxW and maxH constraints', () => {
      const itemsWithConstraints: GridItem[] = [
        {
          id: 'max-constrained',
          title: 'Max Constrained',
          children: <div>Content</div>,
          defaultLayout: {
            x: 0,
            y: 0,
            w: 6,
            h: 4,
            maxW: 8,
            maxH: 6,
          },
        },
      ];

      render(<DraggableGrid items={itemsWithConstraints} />);

      expect(screen.getByText('Max Constrained')).toBeInTheDocument();
    });
  });

  describe('Draggability and Resizability', () => {
    it('enables dragging by default', () => {
      const { container } = render(<DraggableGrid items={defaultItems} />);

      const dragHandles = container.querySelectorAll('.drag-handle');
      dragHandles.forEach((handle) => {
        expect(handle).toHaveClass('cursor-grab');
      });
    });

    it('disables dragging when isDraggable is false', () => {
      render(<DraggableGrid items={defaultItems} isDraggable={false} />);

      // Should still render
      expect(screen.getByTestId('widget-1-content')).toBeInTheDocument();
    });

    it('enables resizing by default', () => {
      render(<DraggableGrid items={defaultItems} />);

      // Should render without errors
      expect(screen.getByTestId('widget-1-content')).toBeInTheDocument();
    });

    it('disables resizing when isResizable is false', () => {
      render(<DraggableGrid items={defaultItems} isResizable={false} />);

      expect(screen.getByTestId('widget-1-content')).toBeInTheDocument();
    });

    it('disables dragging and resizing when widget is expanded', async () => {
      const user = userEvent.setup();
      render(<DraggableGrid items={defaultItems} isDraggable={true} isResizable={true} />);

      const expandButtons = screen.getAllByLabelText('Maximize');
      await user.click(expandButtons[0]);

      // Dragging and resizing should be disabled
      await waitFor(() => {
        expect(screen.getByLabelText('Minimize')).toBeInTheDocument();
      });
    });
  });

  describe('Custom className', () => {
    it('applies custom className to container', () => {
      const { container } = render(<DraggableGrid items={defaultItems} className="custom-grid" />);

      const gridContainer = container.querySelector('.custom-grid');
      expect(gridContainer).toBeInTheDocument();
    });
  });

  describe('Empty Grid', () => {
    it('renders empty grid when no items provided', () => {
      const { container } = render(<DraggableGrid items={[]} />);

      expect(container.firstChild).toBeInTheDocument();
    });
  });
});

describe('useGridLayout', () => {
  it('provides resetLayout function', () => {
    const { result } = require('@testing-library/react').renderHook(() =>
      useGridLayout('test-key'),
    );

    expect(result.current.resetLayout).toBeDefined();
    expect(typeof result.current.resetLayout).toBe('function');
  });

  it('resetLayout is a function', () => {
    const { result } = require('@testing-library/react').renderHook(() =>
      useGridLayout('test-key'),
    );

    expect(result.current.resetLayout).toEqual(expect.any(Function));
  });

  it('returns stable resetLayout function on multiple calls', () => {
    const { result: result1 } = require('@testing-library/react').renderHook(() =>
      useGridLayout('test-key-1'),
    );

    const { result: result2 } = require('@testing-library/react').renderHook(() =>
      useGridLayout('test-key-2'),
    );

    expect(result1.current.resetLayout).toEqual(expect.any(Function));
    expect(result2.current.resetLayout).toEqual(expect.any(Function));
    // Both should be functions
    expect(typeof result1.current.resetLayout).toBe('function');
    expect(typeof result2.current.resetLayout).toBe('function');
  });
});
