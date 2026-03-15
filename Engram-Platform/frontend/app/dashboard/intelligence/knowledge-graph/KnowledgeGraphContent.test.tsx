import { render, screen } from '@testing-library/react';
import { test, vi } from 'vitest';
import KnowledgeGraphContent from './KnowledgeGraphContent';

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
  ReactFlow: vi.fn(() => <div data-testid="react-flow-mock">Graph</div>),
  useReactFlow: () => ({ setNodes: vi.fn(), getNodes: vi.fn(() => []), getEdges: vi.fn(() => []) }),
  useNodesState: () => [[], vi.fn(), vi.fn()],
  useEdgesState: () => [[], vi.fn(), vi.fn()],
  Controls: () => null,
  MiniMap: () => null,
  Background: () => null,
  Panel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Handle: () => null,
  Position: { Top: 'top', Bottom: 'bottom', Left: 'left', Right: 'right' },
}));

vi.mock('swr', () => ({
  default: vi.fn((_key: string) => {
    return {
      data: {
        entities: [{ id: '1', name: 'Test Entity', type: 'Entity', properties: {} }],
        relationships: [],
      },
      error: null,
      isLoading: false,
      mutate: vi.fn(),
    };
  }),
}));

vi.mock('@/src/stores/uiStore', () => ({
  useUIStore: vi.fn(() => ({})),
}));

vi.mock('@/src/lib/crawler-client', () => ({
  crawlerClient: {
    getKnowledgeGraph: vi.fn(),
  },
}));

vi.mock('@/src/lib/memory-client', () => ({
  memoryClient: {
    getKnowledgeGraph: vi.fn(),
  },
}));

test('renders KnowledgeGraphContent without crashing', async () => {
  render(<KnowledgeGraphContent />);

  await screen.findByText('Knowledge Graph');
});
