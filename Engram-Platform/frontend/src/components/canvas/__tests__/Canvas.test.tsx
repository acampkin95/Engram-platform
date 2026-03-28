'use client';

import { render, screen } from '@testing-library/react';
import { describe, expect, vi } from 'vitest';
import { Canvas } from '../Canvas';

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: { children: React.ReactNode; props: object }) => (
      <div {...props}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const mockPanels = [
  { id: 'panel-1', type: 'graph' as const, x: 0, y: 0, width: 8, height: 6 },
  { id: 'panel-2', type: 'stream' as const, x: 8, y: 0, width: 4, height: 6 },
];

const mockUseCanvasStore = {
  panels: mockPanels,
  addPanel: vi.fn(),
  removePanel: vi.fn(),
  movePanel: vi.fn(),
  resetLayout: vi.fn(),
};

vi.mock('@/src/stores/canvasStore', () => ({
  useCanvasStore: vi.fn(() => mockUseCanvasStore),
}));

const mockPanelContent = {
  graph: <div>GRAPH CONTENT</div>,
  stream: <div>STREAM CONTENT</div>,
  inspector: null,
  'agent-console': null,
  timeline: null,
  custom: null,
};

describe('Canvas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders panels after mount', () => {
    render(<Canvas panelContent={mockPanelContent} />);
    expect(screen.getByText('GRAPH CONTENT')).toBeInTheDocument();
    expect(screen.getByText('STREAM CONTENT')).toBeInTheDocument();
  });

  it('renders reset layout button', () => {
    render(<Canvas panelContent={mockPanelContent} />);
    const resetButton = screen.getByRole('button', { name: /reset layout/i });
    expect(resetButton).toBeInTheDocument();
  });

  it('calls resetLayout when reset button is clicked', () => {
    render(<Canvas panelContent={mockPanelContent} />);
    const resetButton = screen.getByRole('button', { name: /reset layout/i });
    resetButton.click();
    expect(mockUseCanvasStore.resetLayout).toHaveBeenCalled();
  });

  it('displays correct panel labels', () => {
    render(<Canvas panelContent={mockPanelContent} />);
    expect(screen.getByText('ENTITY GRAPH')).toBeInTheDocument();
    expect(screen.getByText('CRAWL STREAM')).toBeInTheDocument();
  });

  it('panel remove button calls removePanel', () => {
    render(<Canvas panelContent={mockPanelContent} />);
    const closeButtons = screen.getAllByRole('button', { name: /close panel/i });
    closeButtons[0].click();
    expect(mockUseCanvasStore.removePanel).toHaveBeenCalledWith('panel-1');
  });

  it('panel expand button is present', () => {
    render(<Canvas panelContent={mockPanelContent} />);
    const expandButtons = screen.getAllByRole('button', { name: /maximize/i });
    expect(expandButtons[0]).toBeInTheDocument();
  });
});
