import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InspectorPanel } from '../InspectorPanel';

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

const mockPinEntity = vi.fn();
const mockUnpinEntity = vi.fn();

vi.mock('@/src/stores/canvasStore', () => ({
  useIntelligenceStore: vi.fn(() => ({
    pinnedEntities: new Set<string>(),
    pinEntity: mockPinEntity,
    unpinEntity: mockUnpinEntity,
  })),
}));

describe('InspectorPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render empty state when no entity', () => {
    render(<InspectorPanel />);
    expect(screen.getByText('Select an entity to inspect')).toBeInTheDocument();
  });

  it('should render with custom className', () => {
    const { container } = render(<InspectorPanel className="custom-class" />);
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('should render entity name when provided', () => {
    const entity = {
      id: '1',
      name: 'Test Entity',
      type: 'person' as const,
      status: 'active' as const,
    };
    render(<InspectorPanel entity={entity} />);
    expect(screen.getByText('Test Entity')).toBeInTheDocument();
  });

  it('should render entity type label', () => {
    const entity = {
      id: '1',
      name: 'Test Entity',
      type: 'person' as const,
      status: 'active' as const,
    };
    render(<InspectorPanel entity={entity} />);
    expect(screen.getByText('Person')).toBeInTheDocument();
  });

  it('should render entity status badge', () => {
    const entity = {
      id: '1',
      name: 'Test Entity',
      type: 'person' as const,
      status: 'active' as const,
    };
    render(<InspectorPanel entity={entity} />);
    expect(screen.getByText('ACTIVE')).toBeInTheDocument();
  });

  it('should render PIN button', () => {
    const entity = {
      id: '1',
      name: 'Test Entity',
      type: 'person' as const,
      status: 'active' as const,
    };
    render(<InspectorPanel entity={entity} />);
    expect(screen.getByText('PIN')).toBeInTheDocument();
  });

  it('should call pinEntity when PIN clicked', () => {
    const entity = {
      id: '1',
      name: 'Test Entity',
      type: 'person' as const,
      status: 'active' as const,
    };
    render(<InspectorPanel entity={entity} />);
    fireEvent.click(screen.getByText('PIN'));
    expect(mockPinEntity).toHaveBeenCalledWith('1');
  });

  it('should render description when provided', () => {
    const entity = {
      id: '1',
      name: 'Test Entity',
      type: 'person' as const,
      status: 'active' as const,
      description: 'Test description',
    };
    render(<InspectorPanel entity={entity} />);
    expect(screen.getByText('Test description')).toBeInTheDocument();
  });

  it('should render metadata when provided', () => {
    const entity = {
      id: '1',
      name: 'Test Entity',
      type: 'person' as const,
      status: 'active' as const,
      metadata: { key: 'value' },
    };
    render(<InspectorPanel entity={entity} />);
    expect(screen.getByText('Metadata')).toBeInTheDocument();
    expect(screen.getByText('key:')).toBeInTheDocument();
    expect(screen.getByText('value')).toBeInTheDocument();
  });

  it('should render relationships when provided', () => {
    const entity = {
      id: '1',
      name: 'Test Entity',
      type: 'person' as const,
      status: 'active' as const,
      relationships: [
        { entityId: '2', entityName: 'Related Entity', relationshipType: 'associated' },
      ],
    };
    render(<InspectorPanel entity={entity} />);
    expect(screen.getByText('Relationships (1)')).toBeInTheDocument();
    expect(screen.getByText('Related Entity')).toBeInTheDocument();
  });

  it('should render sources when provided', () => {
    const entity = {
      id: '1',
      name: 'Test Entity',
      type: 'person' as const,
      status: 'active' as const,
      sources: [{ type: 'web', url: 'https://example.com', timestamp: new Date() }],
    };
    render(<InspectorPanel entity={entity} />);
    expect(screen.getByText('Sources (1)')).toBeInTheDocument();
    expect(screen.getByText('web')).toBeInTheDocument();
  });

  it('should render close button when onClose provided', () => {
    const entity = {
      id: '1',
      name: 'Test Entity',
      type: 'person' as const,
      status: 'active' as const,
    };
    const onClose = vi.fn();
    render(<InspectorPanel entity={entity} onClose={onClose} />);
    expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument();
  });

  it('should call onClose when close button clicked', () => {
    const entity = {
      id: '1',
      name: 'Test Entity',
      type: 'person' as const,
      status: 'active' as const,
    };
    const onClose = vi.fn();
    render(<InspectorPanel entity={entity} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
