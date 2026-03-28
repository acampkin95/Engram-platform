import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InvestigationMode } from '../InvestigationMode';

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

const mockToggleInvestigationMode = vi.fn();
const mockClearSelection = vi.fn();

vi.mock('@/src/stores/canvasStore', () => ({
  useIntelligenceStore: vi.fn(() => ({
    investigationMode: false,
    toggleInvestigationMode: mockToggleInvestigationMode,
    pinnedEntities: new Set<string>(),
    selectedEntities: new Set<string>(),
    clearSelection: mockClearSelection,
  })),
}));

describe('InvestigationMode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render INVESTIGATE button when not in investigation mode', () => {
    render(<InvestigationMode />);
    expect(screen.getByText('INVESTIGATE')).toBeInTheDocument();
  });

  it('should render with custom className', () => {
    const { container } = render(<InvestigationMode className="custom-class" />);
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('should call toggleInvestigationMode when button clicked', () => {
    render(<InvestigationMode />);
    fireEvent.click(screen.getByText('INVESTIGATE'));
    expect(mockToggleInvestigationMode).toHaveBeenCalled();
  });

  it('should call onEnter callback when entering investigation mode', () => {
    const onEnter = vi.fn();
    render(<InvestigationMode onEnter={onEnter} />);
    expect(onEnter).not.toHaveBeenCalled();
  });

  it('should call onExit callback when exiting investigation mode', () => {
    const onExit = vi.fn();
    render(<InvestigationMode onExit={onExit} />);
    expect(onExit).not.toHaveBeenCalled();
  });
});
