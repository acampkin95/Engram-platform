import { act, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useWidgetState, WidgetToolbar } from '../WidgetToolbar';

describe('WidgetToolbar', () => {
  it('renders title when provided', () => {
    render(<WidgetToolbar title="Test Widget" />);
    expect(screen.getByText('Test Widget')).toBeInTheDocument();
  });

  it('does not render title when not provided', () => {
    const { container } = render(<WidgetToolbar />);
    const spans = container.querySelectorAll('span.text-xs');
    expect(spans.length).toBe(0);
  });

  it('renders icon when provided', () => {
    render(<WidgetToolbar icon={<span data-testid="widget-icon">★</span>} />);
    expect(screen.getByTestId('widget-icon')).toBeInTheDocument();
  });

  it('renders expand button when onToggleExpand is provided', () => {
    render(<WidgetToolbar onToggleExpand={() => {}} />);
    expect(screen.getByLabelText('Maximize')).toBeInTheDocument();
  });

  it('shows Minimize label when expanded', () => {
    render(<WidgetToolbar onToggleExpand={() => {}} isExpanded={true} />);
    expect(screen.getByLabelText('Minimize')).toBeInTheDocument();
  });

  it('calls onToggleExpand when expand button is clicked', async () => {
    const user = userEvent.setup();
    const onToggleExpand = vi.fn();
    render(<WidgetToolbar onToggleExpand={onToggleExpand} />);

    await user.click(screen.getByLabelText('Maximize'));
    expect(onToggleExpand).toHaveBeenCalledOnce();
  });

  it('renders remove button when onRemove is provided', () => {
    render(<WidgetToolbar onRemove={() => {}} />);
    expect(screen.getByLabelText('Remove widget')).toBeInTheDocument();
  });

  it('calls onRemove when remove button is clicked', async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    render(<WidgetToolbar onRemove={onRemove} />);

    await user.click(screen.getByLabelText('Remove widget'));
    expect(onRemove).toHaveBeenCalledOnce();
  });

  it('applies custom className', () => {
    const { container } = render(<WidgetToolbar className="my-toolbar" />);
    const toolbar = container.firstElementChild as HTMLElement;
    expect(toolbar.className).toContain('my-toolbar');
  });
});

describe('useWidgetState', () => {
  const mockStorage: Record<string, string> = {};

  beforeEach(() => {
    Object.keys(mockStorage).forEach((k) => {
      delete mockStorage[k];
    });
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) => mockStorage[key] ?? null),
      setItem: vi.fn((key: string, value: string) => {
        mockStorage[key] = value;
      }),
      removeItem: vi.fn((key: string) => delete mockStorage[key]),
    });
  });

  it('initializes with empty visible widgets', () => {
    const { result } = renderHook(() => useWidgetState('test-dashboard'));
    expect(result.current.visibleWidgets).toEqual([]);
    expect(result.current.expandedWidget).toBeNull();
  });

  it('loads saved widgets from localStorage', () => {
    mockStorage['test-dashboard-widgets'] = JSON.stringify(['widget-1', 'widget-2']);
    const { result } = renderHook(() => useWidgetState('test-dashboard'));

    expect(result.current.visibleWidgets).toEqual(['widget-1', 'widget-2']);
  });

  it('toggleWidget adds a widget', () => {
    const { result } = renderHook(() => useWidgetState('test-dashboard'));

    act(() => {
      result.current.toggleWidget('widget-1');
    });

    expect(result.current.visibleWidgets).toContain('widget-1');
  });

  it('toggleWidget removes an existing widget', () => {
    mockStorage['test-dashboard-widgets'] = JSON.stringify(['widget-1']);
    const { result } = renderHook(() => useWidgetState('test-dashboard'));

    act(() => {
      result.current.toggleWidget('widget-1');
    });

    expect(result.current.visibleWidgets).not.toContain('widget-1');
  });

  it('toggleExpand sets expanded widget', () => {
    const { result } = renderHook(() => useWidgetState('test-dashboard'));

    act(() => {
      result.current.toggleExpand('widget-1');
    });

    expect(result.current.expandedWidget).toBe('widget-1');
  });

  it('toggleExpand toggles off when same widget', () => {
    const { result } = renderHook(() => useWidgetState('test-dashboard'));

    act(() => {
      result.current.toggleExpand('widget-1');
    });
    act(() => {
      result.current.toggleExpand('widget-1');
    });

    expect(result.current.expandedWidget).toBeNull();
  });

  it('sets mounted to true after mount', () => {
    const { result } = renderHook(() => useWidgetState('test-dashboard'));
    expect(result.current.mounted).toBe(true);
  });
});
