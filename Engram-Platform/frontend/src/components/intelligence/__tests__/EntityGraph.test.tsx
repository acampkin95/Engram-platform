import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EntityGraph, EntityGraphWrapper } from '../EntityGraph';

vi.mock('@xyflow/react', () => ({
  ReactFlow: ({ children, ...props }: { children: React.ReactNode }) => (
    <div data-testid="react-flow" {...props}>
      {children}
    </div>
  ),
  ReactFlowProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="rf-provider">{children}</div>
  ),
  Background: () => <div data-testid="background" />,
  Controls: () => <div data-testid="controls" />,
  MiniMap: () => <div data-testid="minimap" />,
  useNodesState: (initial: unknown[]) => [initial, vi.fn(), vi.fn()],
  useEdgesState: (initial: unknown[]) => [initial, vi.fn(), vi.fn()],
}));

vi.mock('@/src/stores/canvasStore', () => ({
  useIntelligenceStore: vi.fn(() => ({
    selectEntity: vi.fn(),
    deselectEntity: vi.fn(),
    setHoveredEntity: vi.fn(),
    entityTypeFilter: [],
    setEntityTypeFilter: vi.fn(),
  })),
}));

describe('EntityGraph', () => {
  it('should render empty graph with no entities', () => {
    render(<EntityGraph />);
    expect(screen.getByTestId('react-flow')).toBeInTheDocument();
  });

  it('should render with custom className', () => {
    const { container } = render(<EntityGraph className="custom-class" />);
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('should render background, controls, and minimap', () => {
    render(<EntityGraph />);
    expect(screen.getByTestId('background')).toBeInTheDocument();
    expect(screen.getByTestId('controls')).toBeInTheDocument();
    expect(screen.getByTestId('minimap')).toBeInTheDocument();
  });

  it('should accept entities and relationships props', () => {
    const entities = [
      { id: '1', name: 'Entity 1', type: 'person' as const, status: 'active' as const },
    ];
    const relationships = [{ id: 'r1', sourceId: '1', targetId: '2', type: 'associated' as const }];
    render(<EntityGraph entities={entities} relationships={relationships} />);
    expect(screen.getByTestId('react-flow')).toBeInTheDocument();
  });
});

describe('EntityGraphWrapper', () => {
  it('should wrap EntityGraph with ReactFlowProvider', () => {
    render(<EntityGraphWrapper />);
    expect(screen.getByTestId('rf-provider')).toBeInTheDocument();
    expect(screen.getByTestId('react-flow')).toBeInTheDocument();
  });
});
