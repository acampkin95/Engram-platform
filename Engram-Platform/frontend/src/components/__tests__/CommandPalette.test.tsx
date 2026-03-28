import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CommandPalette, KeyboardShortcutsModal, NotificationBell } from '../CommandPalette';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}));

// Stable mock references to prevent infinite re-render loops
const stableDismissHint = vi.fn();
const stableToggleSidebar = vi.fn();
const stableDismissShortcuts = vi.fn();

const prefsState = {
  dismissCommandPaletteHint: stableDismissHint,
  commandPaletteHintDismissed: false,
  dismissKeyboardShortcuts: stableDismissShortcuts,
};

const uiState = {
  toggleSidebar: stableToggleSidebar,
  sidebarCollapsed: false,
};

vi.mock('@/src/stores/preferencesStore', () => ({
  usePreferencesStore: vi.fn((selector?: (...args: unknown[]) => unknown) =>
    typeof selector === 'function' ? selector(prefsState) : prefsState,
  ),
}));

vi.mock('@/src/stores/uiStore', () => ({
  useUIStore: vi.fn((selector?: (...args: unknown[]) => unknown) =>
    typeof selector === 'function' ? selector(uiState) : uiState,
  ),
}));

import { useRouter } from 'next/navigation';

describe('CommandPalette', () => {
  const mockRouter = {
    push: vi.fn(),
  };

  const mockOnClose = vi.fn();
  const _mockOnShowShortcuts = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useRouter).mockReturnValue(mockRouter as any);
  });

  it('renders command palette when mounted', () => {
    render(<CommandPalette onClose={mockOnClose} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('displays search input with correct placeholder', () => {
    render(<CommandPalette onClose={mockOnClose} />);
    const input = screen.getByPlaceholderText('Search commands, pages, or actions…');
    expect(input).toBeInTheDocument();
  });

  it('renders command groups with section headers', () => {
    render(<CommandPalette onClose={mockOnClose} />);
    expect(screen.getByText('Navigate')).toBeInTheDocument();
    expect(screen.getByText('Actions')).toBeInTheDocument();
    expect(screen.getByText('Admin')).toBeInTheDocument();
  });

  it('displays all navigation items', () => {
    render(<CommandPalette onClose={mockOnClose} />);
    expect(screen.getByRole('option', { name: /Dashboard Home/ })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Crawl/ })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /OSINT/ })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Memories/ })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Investigations/ })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /System Health/ })).toBeInTheDocument();
  });

  it('displays action items including keyboard shortcuts and preferences', () => {
    render(<CommandPalette onClose={mockOnClose} />);
    expect(screen.getByRole('option', { name: /Toggle Sidebar/ })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Keyboard Shortcuts/ })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Preferences/ })).toBeInTheDocument();
  });

  it('filters items by search query', async () => {
    const user = userEvent.setup();
    render(<CommandPalette onClose={mockOnClose} />);

    const input = screen.getByRole('combobox');

    // Initially all items should be visible
    expect(screen.getByRole('option', { name: /Dashboard Home/ })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Memories/ })).toBeInTheDocument();

    // Type to filter
    await user.clear(input);
    await user.type(input, 'toggle');

    // Dashboard Home should be gone, but toggle sidebar should remain
    await waitFor(() => {
      expect(screen.getByRole('option', { name: /Toggle Sidebar/ })).toBeInTheDocument();
    });
    expect(screen.queryByRole('option', { name: /Dashboard Home/ })).not.toBeInTheDocument();
  });

  it('shows empty state when no results match search', async () => {
    const user = userEvent.setup();
    render(<CommandPalette onClose={mockOnClose} />);

    const input = screen.getByRole('combobox');
    await user.type(input, 'nonexistent-command-xyz');

    await waitFor(() => {
      expect(screen.getByText(/No results for/)).toBeInTheDocument();
    });
  });

  it('filters by section name', async () => {
    const user = userEvent.setup();
    render(<CommandPalette onClose={mockOnClose} />);

    const input = screen.getByRole('combobox');
    await user.type(input, 'navigate');

    expect(screen.getByRole('option', { name: /Dashboard Home/ })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Toggle Sidebar/ })).not.toBeInTheDocument();
  });

  it('navigates with arrow down key', () => {
    render(<CommandPalette onClose={mockOnClose} />);

    // First item should be selected initially
    let options = screen.getAllByRole('option');
    expect(options[0]).toHaveAttribute('aria-selected', 'true');

    // onKeyDown is on role="application" div
    const appDiv = screen.getByRole('application');
    fireEvent.keyDown(appDiv, { key: 'ArrowDown' });

    // Second item should be selected
    options = screen.getAllByRole('option');
    expect(options[1]).toHaveAttribute('aria-selected', 'true');
  });

  it('navigates with arrow up key', () => {
    render(<CommandPalette onClose={mockOnClose} />);

    const appDiv = screen.getByRole('application');
    fireEvent.keyDown(appDiv, { key: 'ArrowDown' });
    fireEvent.keyDown(appDiv, { key: 'ArrowDown' });
    fireEvent.keyDown(appDiv, { key: 'ArrowUp' });

    const options = screen.getAllByRole('option');
    expect(options[1]).toHaveAttribute('aria-selected', 'true');
  });

  it('closes palette with escape key', () => {
    render(<CommandPalette onClose={mockOnClose} />);

    const appDiv = screen.getByRole('application');
    fireEvent.keyDown(appDiv, { key: 'Escape' });

    expect(mockOnClose).toHaveBeenCalledOnce();
  });

  it('closes palette when close button is clicked', async () => {
    const user = userEvent.setup();
    render(<CommandPalette onClose={mockOnClose} />);

    const closeButton = screen.getByLabelText('Close command palette');
    await user.click(closeButton);

    expect(mockOnClose).toHaveBeenCalledOnce();
  });

  it('closes palette when backdrop is clicked', async () => {
    const user = userEvent.setup();
    render(<CommandPalette onClose={mockOnClose} />);

    const backdrop = screen
      .getByRole('dialog')
      .querySelector('[aria-hidden="true"]') as HTMLElement;
    await user.click(backdrop);

    expect(mockOnClose).toHaveBeenCalledOnce();
  });

  it('executes dashboard home command and closes', async () => {
    const user = userEvent.setup();
    render(<CommandPalette onClose={mockOnClose} />);

    const homeOption = screen.getByRole('option', { name: /Dashboard Home/ });
    await user.click(homeOption);

    expect(mockRouter.push).toHaveBeenCalledWith('/dashboard/home');
    expect(mockOnClose).toHaveBeenCalledOnce();
  });

  it('executes crawl command with correct route', async () => {
    const user = userEvent.setup();
    render(<CommandPalette onClose={mockOnClose} />);

    const crawlOption = screen.getByRole('option', { name: /Crawl/ });
    await user.click(crawlOption);

    expect(mockRouter.push).toHaveBeenCalledWith('/dashboard/crawler/crawl');
    expect(mockOnClose).toHaveBeenCalledOnce();
  });

  it('executes OSINT command with correct route', async () => {
    const user = userEvent.setup();
    render(<CommandPalette onClose={mockOnClose} />);

    const osintOption = screen.getByRole('option', { name: /OSINT/ });
    await user.click(osintOption);

    expect(mockRouter.push).toHaveBeenCalledWith('/dashboard/crawler/osint');
    expect(mockOnClose).toHaveBeenCalledOnce();
  });

  it('executes memories command with correct route', async () => {
    const user = userEvent.setup();
    render(<CommandPalette onClose={mockOnClose} />);

    const memoriesOption = screen.getByRole('option', { name: /Memories/ });
    await user.click(memoriesOption);

    expect(mockRouter.push).toHaveBeenCalledWith('/dashboard/memory/memories');
    expect(mockOnClose).toHaveBeenCalledOnce();
  });

  it('executes investigations command with correct route', async () => {
    const user = userEvent.setup();
    render(<CommandPalette onClose={mockOnClose} />);

    const investigationsOption = screen.getByRole('option', { name: /Investigations/ });
    await user.click(investigationsOption);

    expect(mockRouter.push).toHaveBeenCalledWith('/dashboard/crawler/investigations');
    expect(mockOnClose).toHaveBeenCalledOnce();
  });

  it('executes system health command with correct route', async () => {
    const user = userEvent.setup();
    render(<CommandPalette onClose={mockOnClose} />);

    const systemOption = screen.getByRole('option', { name: /System Health/ });
    await user.click(systemOption);

    expect(mockRouter.push).toHaveBeenCalledWith('/dashboard/system/health');
    expect(mockOnClose).toHaveBeenCalledOnce();
  });

  it('highlights item on mouse enter', async () => {
    const user = userEvent.setup();
    render(<CommandPalette onClose={mockOnClose} />);

    const options = screen.getAllByRole('option');
    const secondOption = options[1];

    await user.hover(secondOption);
    expect(secondOption).toHaveAttribute('aria-selected', 'true');
  });

  it('displays keyboard shortcuts in items', () => {
    render(<CommandPalette onClose={mockOnClose} />);

    // Check for shortcut displays
    expect(screen.getByText('G then H')).toBeInTheDocument();
    expect(screen.getByText('G then C')).toBeInTheDocument();
    expect(screen.getByText('G then M')).toBeInTheDocument();
    expect(screen.getByText('⌘B')).toBeInTheDocument();
    expect(screen.getByText('?')).toBeInTheDocument();
  });

  it('shows keyboard help at bottom', () => {
    render(<CommandPalette onClose={mockOnClose} />);

    // The help text should be visible
    expect(screen.getByText('navigate')).toBeInTheDocument();
    expect(screen.getByText('select')).toBeInTheDocument();
    expect(screen.getByText('close')).toBeInTheDocument();
  });

  it('has proper accessibility roles and attributes', () => {
    render(<CommandPalette onClose={mockOnClose} />);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-label', 'Command palette');

    const input = screen.getByRole('combobox');
    expect(input).toHaveAttribute('aria-expanded', 'true');
    expect(input).toHaveAttribute('aria-controls', 'command-list');
    expect(input).toHaveAttribute('aria-autocomplete', 'list');

    const listbox = screen.getByRole('listbox');
    expect(listbox).toHaveAttribute('id', 'command-list');
  });
});

describe('KeyboardShortcutsModal', () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders keyboard shortcuts modal', () => {
    render(<KeyboardShortcutsModal onClose={mockOnClose} />);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument();
  });

  it('displays all shortcut categories', () => {
    render(<KeyboardShortcutsModal onClose={mockOnClose} />);

    expect(screen.getByText('Navigation')).toBeInTheDocument();
    expect(screen.getByText('Go To (G then key)')).toBeInTheDocument();
    expect(screen.getByText('Data Tables')).toBeInTheDocument();
    expect(screen.getByText('Modals')).toBeInTheDocument();
  });

  it('displays global shortcuts', () => {
    render(<KeyboardShortcutsModal onClose={mockOnClose} />);

    expect(screen.getByText('Open command palette')).toBeInTheDocument();
    expect(screen.getByText('Toggle sidebar')).toBeInTheDocument();
    expect(screen.getByText('Show keyboard shortcuts')).toBeInTheDocument();
    expect(screen.getByText('Go to Home')).toBeInTheDocument();
    expect(screen.getByText('Go to Memories')).toBeInTheDocument();
    expect(screen.getByText('Go to Crawl')).toBeInTheDocument();
  });

  it('displays data table shortcuts', () => {
    render(<KeyboardShortcutsModal onClose={mockOnClose} />);

    expect(screen.getByText('Navigate rows')).toBeInTheDocument();
    expect(screen.getByText('Select / edit row')).toBeInTheDocument();
  });

  it('closes when close button is clicked', async () => {
    const user = userEvent.setup();
    render(<KeyboardShortcutsModal onClose={mockOnClose} />);

    const closeButton = screen.getByLabelText('Close');
    await user.click(closeButton);

    expect(mockOnClose).toHaveBeenCalledOnce();
  });

  it('closes when backdrop is clicked', async () => {
    const user = userEvent.setup();
    render(<KeyboardShortcutsModal onClose={mockOnClose} />);

    const backdrop = screen
      .getByRole('dialog')
      .querySelector('[aria-hidden="true"]') as HTMLElement;
    await user.click(backdrop);

    expect(mockOnClose).toHaveBeenCalledOnce();
  });
});

describe('NotificationBell', () => {
  it('renders notification bell button', () => {
    render(<NotificationBell />);

    const button = screen.getByLabelText(/Notifications/);
    expect(button).toBeInTheDocument();
  });

  it('opens notification dropdown when clicked', async () => {
    const user = userEvent.setup();
    render(<NotificationBell />);

    const button = screen.getByLabelText(/Notifications/);
    await user.click(button);

    expect(screen.getByText('Notifications')).toBeInTheDocument();
    expect(button).toHaveAttribute('aria-expanded', 'true');
  });

  it('displays empty state when no notifications', async () => {
    const user = userEvent.setup();
    render(<NotificationBell />);

    const button = screen.getByLabelText(/Notifications/);
    await user.click(button);

    expect(screen.getByText('No notifications')).toBeInTheDocument();
  });

  it('closes dropdown when clicked again', async () => {
    const user = userEvent.setup();
    render(<NotificationBell />);

    const button = screen.getByLabelText(/Notifications/);

    // Open
    await user.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');

    // Close
    await user.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'false');
  });

  it('does not show badge when no notifications', () => {
    render(<NotificationBell />);

    const badge = screen.queryByText(/^\d+$/);
    expect(badge).not.toBeInTheDocument();
  });
});
