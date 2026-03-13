import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import MemoryGraphContent from './MemoryGraphContent';
import { useUIStore } from '@/src/stores/uiStore';

vi.mock('@/src/stores/uiStore', () => {
  let state = {
    sidebarCollapsed: false,
    serviceStatus: { crawler: 'loading' as const, memory: 'loading' as const },
    wsConnected: false,
    activeSection: 'crawler' as const,
    selectedEntityId: null as string | null,
  };

  const hook = ((selector: (value: typeof state & {
    setSelectedEntityId: (entityId: string | null) => void;
    clearSelectedEntity: () => void;
  }) => unknown) =>
    selector({
      ...state,
      setSelectedEntityId: (selectedEntityId: string | null) => {
        state = { ...state, selectedEntityId };
      },
      clearSelectedEntity: () => {
        state = { ...state, selectedEntityId: null };
      },
    })) as unknown as typeof useUIStore;

  hook.getState = () => state;
  hook.setState = (next: Partial<typeof state>) => {
    state = { ...state, ...next };
  };

  return { useUIStore: hook };
});

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

// Mock @xyflow/react
vi.mock('@xyflow/react', () => ({
  ReactFlowProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ReactFlow: vi.fn((props: { onNodeClick?: (event: React.MouseEvent, node: { id: string }) => void }) => (
    <div>
      <div data-testid="react-flow-mock">Graph</div>
      <button
        type="button"
        data-testid="graph-node-1"
        onClick={() => props.onNodeClick?.({} as React.MouseEvent, { id: '1' })}
      >
        Select Node
      </button>
    </div>
  )),
  useReactFlow: () => ({ setNodes: vi.fn(), getNodes: vi.fn(() => []), getEdges: vi.fn(() => []) }),
  useNodesState: () => [[], vi.fn(), vi.fn()],
  useEdgesState: () => [[], vi.fn(), vi.fn()],
  Controls: () => null,
  MiniMap: () => null,
  Background: () => null,
  Panel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Handle: () => null,
  Position: { Top: 'top', Bottom: 'bottom', Left: 'left', Right: 'right' }
}));

vi.mock('swr', () => ({
  default: vi.fn(() => ({
    data: { data: { entities: [{ id: '1', name: 'Test Entity', type: 'Entity', properties: {} }], relations: [] } },
    error: null,
    isLoading: false,
    mutate: vi.fn(),
  })),
}));

vi.mock('@/src/lib/memory-client', () => ({
  memoryClient: {
    getKnowledgeGraph: vi.fn(async () => ({
      data: {
        entities: [
          {
            entity_id: '1',
            name: 'Test Entity',
            entity_type: 'Entity',
            properties: {},
            created_at: '2024-01-01T00:00:00Z',
          },
        ],
        relations: [],
      },
    })),
  },
}));

beforeEach(() => {
  useUIStore.setState({
    sidebarCollapsed: false,
    serviceStatus: { crawler: 'loading', memory: 'loading' },
    wsConnected: false,
    activeSection: 'crawler',
    selectedEntityId: null,
  });
});

test('renders MemoryGraphContent without crashing', async () => {
  render(<MemoryGraphContent />);

  await screen.findByText('Knowledge Graph');
  await screen.findByTestId('react-flow-mock');
});

test('clicking a graph node stores the selected entity id', async () => {
  render(<MemoryGraphContent />);

  const button = await screen.findByTestId('graph-node-1');
  fireEvent.click(button);

  await waitFor(() => {
    expect(useUIStore.getState().selectedEntityId).toBe('1');
  });
});
