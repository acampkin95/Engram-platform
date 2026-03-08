import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  mockSetNodes: vi.fn(),
  mockGetNodes: vi.fn(),
  mockGetEdges: vi.fn(),
  stopSimulation: vi.fn(),
  forceSimulation: vi.fn(),
}));

vi.mock('@xyflow/react', () => ({
  useReactFlow: () => ({
    setNodes: mocks.mockSetNodes,
    getNodes: mocks.mockGetNodes,
    getEdges: mocks.mockGetEdges,
  }),
}));

vi.mock('d3-force', () => {
  const simulation = {
    force: vi.fn(),
    on: vi.fn(),
    stop: mocks.stopSimulation,
  };

  simulation.force.mockImplementation(() => simulation);
  simulation.on.mockImplementation((event: string, callback: () => void) => {
    if (event === 'tick') {
      callback();
    }
    return simulation;
  });

  return {
    forceSimulation: mocks.forceSimulation.mockImplementation(() => simulation),
    forceManyBody: vi.fn(() => ({
      strength: vi.fn().mockReturnThis(),
    })),
    forceLink: vi.fn(() => ({
      id: vi.fn().mockReturnThis(),
      distance: vi.fn().mockReturnThis(),
    })),
    forceX: vi.fn(() => ({
      strength: vi.fn().mockReturnThis(),
    })),
    forceY: vi.fn(() => ({
      strength: vi.fn().mockReturnThis(),
    })),
  };
});

import { forceSimulation } from 'd3-force';
import { useForceLayout } from '@/src/hooks/useForceLayout';

describe('useForceLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.mockSetNodes.mockImplementation((updater: unknown) => {
      if (typeof updater === 'function') {
        updater(mocks.mockGetNodes());
      }
    });
  });

  it('skips layout when there are no nodes', () => {
    mocks.mockGetNodes.mockReturnValue([]);
    mocks.mockGetEdges.mockReturnValue([]);

    renderHook(() => useForceLayout());

    expect(forceSimulation).not.toHaveBeenCalled();
    expect(mocks.mockSetNodes).not.toHaveBeenCalled();
  });

  it('runs force simulation and stops it on unmount', () => {
    const nodes = [
      { id: 'node-1', position: { x: 120, y: 100 } },
      { id: 'node-2', position: { x: 300, y: 200 } },
      { id: 'child', parentId: 'node-1', position: { x: 40, y: 20 } },
    ];

    mocks.mockGetNodes.mockReturnValue(nodes);
    mocks.mockGetEdges.mockReturnValue([
      { source: 'node-1', target: 'node-2' },
      { source: 'node-1', target: 'child' },
    ]);

    let updatedNodes: unknown[] = [];
    mocks.mockSetNodes.mockImplementation((updater: unknown) => {
      if (typeof updater === 'function') {
        updatedNodes = updater(nodes as never[]) as unknown[];
      }
    });

    const { unmount } = renderHook(() => useForceLayout({ strength: -200, distance: 80 }));

    expect(forceSimulation).toHaveBeenCalled();
    expect(mocks.mockSetNodes).toHaveBeenCalled();
    expect(updatedNodes).toHaveLength(3);

    unmount();

    expect(mocks.stopSimulation).toHaveBeenCalledOnce();
  });
});
