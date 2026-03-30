import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock localStorage for all tests
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock zustand/middleware so persist() is a no-op passthrough.
// This prevents the store from touching localStorage at all.
vi.mock('zustand/middleware', () => ({
  persist: (config: (set: unknown, get: unknown, api: unknown) => unknown) => config,
}));

// Import AFTER mocking so the stores are created with the no-op persist.
import {
  type StreamItem,
  useCanvasStore,
  useIntelligenceStore,
  useStreamStore,
} from '@/src/stores/canvasStore';

// ─────────────────────────────────────────────────────────────────────────────────────
// Canvas Store Tests
// ─────────────────────────────────────────────────────────────────────────────────────

describe('useCanvasStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useCanvasStore.setState({
      panels: [],
      gridCols: 12,
      maxPanels: 8,
    });
  });

  describe('initial state', () => {
    it('starts with empty panels array', () => {
      const store = useCanvasStore.getState();
      expect(store.panels).toEqual([]);
    });

    it('starts with gridCols = 12', () => {
      const store = useCanvasStore.getState();
      expect(store.gridCols).toBe(12);
    });

    it('starts with maxPanels = 8', () => {
      const store = useCanvasStore.getState();
      expect(store.maxPanels).toBe(8);
    });
  });

  describe('addPanel', () => {
    it('adds a panel with generated id and returns id', () => {
      const panel = { type: 'graph' as const, x: 0, y: 0, width: 400, height: 300 };
      const id = useCanvasStore.getState().addPanel(panel);

      expect(typeof id).toBe('string');
      expect(id).toMatch(/^panel-[a-f0-9-]+$/);

      const state = useCanvasStore.getState();
      expect(state.panels).toHaveLength(1);
      expect(state.panels[0]).toMatchObject(panel);
      expect(state.panels[0].id).toBe(id);
    });

    it('generates unique ids for each panel', () => {
      const panel = { type: 'graph' as const, x: 0, y: 0, width: 400, height: 300 };
      const id1 = useCanvasStore.getState().addPanel(panel);
      const id2 = useCanvasStore.getState().addPanel(panel);

      expect(id1).not.toBe(id2);
    });

    it('preserves optional fields like minWidth, minHeight, and data', () => {
      const panel = {
        type: 'graph' as const,
        x: 10,
        y: 20,
        width: 400,
        height: 300,
        minWidth: 200,
        minHeight: 150,
        data: { someKey: 'someValue' },
      };
      const _id = useCanvasStore.getState().addPanel(panel);

      const state = useCanvasStore.getState();
      const addedPanel = state.panels[0];
      expect(addedPanel.minWidth).toBe(200);
      expect(addedPanel.minHeight).toBe(150);
      expect(addedPanel.data).toEqual({ someKey: 'someValue' });
    });

    it('adds new panel to end of array', () => {
      const id1 = useCanvasStore.getState().addPanel({
        type: 'graph' as const,
        x: 0,
        y: 0,
        width: 400,
        height: 300,
      });
      const id2 = useCanvasStore.getState().addPanel({
        type: 'stream' as const,
        x: 100,
        y: 100,
        width: 300,
        height: 200,
      });

      const state = useCanvasStore.getState();
      // First added panel should be at index 0
      expect(state.panels[0].type).toBe('graph');
      expect(state.panels[0].id).toBe(id1);
      // Most recently added panel should be at index 1
      expect(state.panels[1].type).toBe('stream');
      expect(state.panels[1].id).toBe(id2);
    });
  });

  describe('removePanel', () => {
    it('removes panel by id', () => {
      const id = useCanvasStore.getState().addPanel({
        type: 'graph' as const,
        x: 0,
        y: 0,
        width: 400,
        height: 300,
      });

      useCanvasStore.getState().removePanel(id);
      expect(useCanvasStore.getState().panels).toHaveLength(0);
    });

    it('removes correct panel when multiple exist', () => {
      const id1 = useCanvasStore.getState().addPanel({
        type: 'graph' as const,
        x: 0,
        y: 0,
        width: 400,
        height: 300,
      });
      const id2 = useCanvasStore.getState().addPanel({
        type: 'stream' as const,
        x: 100,
        y: 100,
        width: 300,
        height: 200,
      });

      useCanvasStore.getState().removePanel(id1);
      const state = useCanvasStore.getState();
      expect(state.panels).toHaveLength(1);
      expect(state.panels[0].id).toBe(id2);
    });

    it('silently succeeds when removing non-existent panel', () => {
      const id = useCanvasStore.getState().addPanel({
        type: 'graph' as const,
        x: 0,
        y: 0,
        width: 400,
        height: 300,
      });

      useCanvasStore.getState().removePanel('non-existent-id');
      expect(useCanvasStore.getState().panels).toHaveLength(1);
      expect(useCanvasStore.getState().panels[0].id).toBe(id);
    });
  });

  describe('updatePanel', () => {
    it('updates panel with partial updates', () => {
      const id = useCanvasStore.getState().addPanel({
        type: 'graph' as const,
        x: 0,
        y: 0,
        width: 400,
        height: 300,
      });

      useCanvasStore.getState().updatePanel(id, { width: 500, data: { test: true } });

      const panel = useCanvasStore.getState().panels[0];
      expect(panel.width).toBe(500);
      expect(panel.data).toEqual({ test: true });
      expect(panel.height).toBe(300); // unchanged
    });

    it('can update type field', () => {
      const id = useCanvasStore.getState().addPanel({
        type: 'graph' as const,
        x: 0,
        y: 0,
        width: 400,
        height: 300,
      });

      useCanvasStore.getState().updatePanel(id, { type: 'timeline' });

      expect(useCanvasStore.getState().panels[0].type).toBe('timeline');
    });

    it('silently succeeds when updating non-existent panel', () => {
      const _id = useCanvasStore.getState().addPanel({
        type: 'graph' as const,
        x: 0,
        y: 0,
        width: 400,
        height: 300,
      });

      useCanvasStore.getState().updatePanel('non-existent-id', { width: 600 });

      expect(useCanvasStore.getState().panels[0].width).toBe(400);
    });
  });

  describe('movePanel', () => {
    it('updates x and y position', () => {
      const id = useCanvasStore.getState().addPanel({
        type: 'graph' as const,
        x: 0,
        y: 0,
        width: 400,
        height: 300,
      });

      useCanvasStore.getState().movePanel(id, 100, 200);

      const panel = useCanvasStore.getState().panels[0];
      expect(panel.x).toBe(100);
      expect(panel.y).toBe(200);
    });

    it('does not change width and height', () => {
      const id = useCanvasStore.getState().addPanel({
        type: 'graph' as const,
        x: 0,
        y: 0,
        width: 400,
        height: 300,
      });

      useCanvasStore.getState().movePanel(id, 50, 75);

      const panel = useCanvasStore.getState().panels[0];
      expect(panel.width).toBe(400);
      expect(panel.height).toBe(300);
    });

    it('accepts negative coordinates', () => {
      const id = useCanvasStore.getState().addPanel({
        type: 'graph' as const,
        x: 0,
        y: 0,
        width: 400,
        height: 300,
      });

      useCanvasStore.getState().movePanel(id, -100, -50);

      const panel = useCanvasStore.getState().panels[0];
      expect(panel.x).toBe(-100);
      expect(panel.y).toBe(-50);
    });
  });

  describe('resizePanel', () => {
    it('updates width and height', () => {
      const id = useCanvasStore.getState().addPanel({
        type: 'graph' as const,
        x: 0,
        y: 0,
        width: 400,
        height: 300,
      });

      useCanvasStore.getState().resizePanel(id, 600, 450);

      const panel = useCanvasStore.getState().panels[0];
      expect(panel.width).toBe(600);
      expect(panel.height).toBe(450);
    });

    it('does not change x and y position', () => {
      const id = useCanvasStore.getState().addPanel({
        type: 'graph' as const,
        x: 50,
        y: 75,
        width: 400,
        height: 300,
      });

      useCanvasStore.getState().resizePanel(id, 500, 350);

      const panel = useCanvasStore.getState().panels[0];
      expect(panel.x).toBe(50);
      expect(panel.y).toBe(75);
    });
  });

  describe('setGridCols', () => {
    it('updates gridCols value', () => {
      useCanvasStore.getState().setGridCols(16);
      expect(useCanvasStore.getState().gridCols).toBe(16);
    });

    it('accepts different grid column values', () => {
      useCanvasStore.getState().setGridCols(8);
      expect(useCanvasStore.getState().gridCols).toBe(8);

      useCanvasStore.getState().setGridCols(24);
      expect(useCanvasStore.getState().gridCols).toBe(24);
    });
  });

  describe('saveLayout and loadLayout', () => {
    beforeEach(() => {
      window.localStorage.clear();
    });

    afterEach(() => {
      window.localStorage.clear();
    });

    it('saveLayout stores panels and gridCols to localStorage', () => {
      const id = useCanvasStore.getState().addPanel({
        type: 'graph' as const,
        x: 0,
        y: 0,
        width: 400,
        height: 300,
      });
      useCanvasStore.getState().setGridCols(14);

      useCanvasStore.getState().saveLayout();

      const saved = localStorage.getItem('canvas-layout');
      expect(saved).toBeTruthy();
      const parsed = JSON.parse(saved as string);
      expect(parsed.gridCols).toBe(14);
      expect(parsed.panels).toHaveLength(1);
      expect(parsed.panels[0].id).toBe(id);
    });

    it('loadLayout retrieves and applies saved layout', () => {
      const panel = {
        type: 'graph' as const,
        x: 10,
        y: 20,
        width: 500,
        height: 400,
        id: 'panel-test-123',
      };
      const layout = { panels: [panel], gridCols: 18, maxPanels: 8 };
      localStorage.setItem('canvas-layout', JSON.stringify(layout));

      const result = useCanvasStore.getState().loadLayout();

      expect(result).toEqual(layout);
      const state = useCanvasStore.getState();
      expect(state.gridCols).toBe(18);
      expect(state.panels).toHaveLength(1);
      expect(state.panels[0]).toEqual(panel);
    });

    it('loadLayout returns null if localStorage is empty', () => {
      const result = useCanvasStore.getState().loadLayout();
      expect(result).toBeNull();
    });

    it('loadLayout returns null on invalid JSON', () => {
      localStorage.setItem('canvas-layout', 'invalid json {]');

      const result = useCanvasStore.getState().loadLayout();
      expect(result).toBeNull();
    });
  });

  describe('resetLayout', () => {
    it('clears all panels and resets gridCols', () => {
      useCanvasStore.getState().addPanel({
        type: 'graph' as const,
        x: 0,
        y: 0,
        width: 400,
        height: 300,
      });
      useCanvasStore.getState().setGridCols(16);

      useCanvasStore.getState().resetLayout();

      const state = useCanvasStore.getState();
      expect(state.panels).toEqual([]);
      expect(state.gridCols).toBe(12);
    });

    it('removes canvas-layout from localStorage', () => {
      useCanvasStore.getState().addPanel({
        type: 'graph' as const,
        x: 0,
        y: 0,
        width: 400,
        height: 300,
      });
      useCanvasStore.getState().saveLayout();

      useCanvasStore.getState().resetLayout();

      expect(localStorage.getItem('canvas-layout')).toBeNull();
    });
  });

  describe('multiple panels workflow', () => {
    it('handles adding, moving, resizing, and removing multiple panels', () => {
      const id1 = useCanvasStore.getState().addPanel({
        type: 'graph' as const,
        x: 0,
        y: 0,
        width: 400,
        height: 300,
      });

      const id2 = useCanvasStore.getState().addPanel({
        type: 'stream' as const,
        x: 100,
        y: 100,
        width: 300,
        height: 200,
      });

      useCanvasStore.getState().movePanel(id1, 50, 50);
      useCanvasStore.getState().resizePanel(id2, 400, 250);

      let state = useCanvasStore.getState();
      expect(state.panels).toHaveLength(2);

      useCanvasStore.getState().removePanel(id1);
      state = useCanvasStore.getState();
      expect(state.panels).toHaveLength(1);
      expect(state.panels[0].id).toBe(id2);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────
// Intelligence Store Tests
// ─────────────────────────────────────────────────────────────────────────────────────

describe('useIntelligenceStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useIntelligenceStore.setState({
      selectedEntities: new Set(),
      hoveredEntity: null,
      entityTypeFilter: [],
      statusFilter: [],
      timeRangeStart: null,
      timeRangeEnd: null,
      intelligenceLayer: 'processed',
      memoryDepthHours: 168,
      investigationMode: false,
      pinnedEntities: new Set(),
    });
  });

  describe('initial state', () => {
    it('has empty selectedEntities set', () => {
      expect(useIntelligenceStore.getState().selectedEntities.size).toBe(0);
    });

    it('has null hoveredEntity', () => {
      expect(useIntelligenceStore.getState().hoveredEntity).toBeNull();
    });

    it('has no entity type filters', () => {
      expect(useIntelligenceStore.getState().entityTypeFilter).toEqual([]);
    });

    it('has no status filters', () => {
      expect(useIntelligenceStore.getState().statusFilter).toEqual([]);
    });

    it('has null time range', () => {
      expect(useIntelligenceStore.getState().timeRangeStart).toBeNull();
      expect(useIntelligenceStore.getState().timeRangeEnd).toBeNull();
    });

    it('intelligenceLayer is "processed"', () => {
      expect(useIntelligenceStore.getState().intelligenceLayer).toBe('processed');
    });

    it('memoryDepthHours is 168 (one week)', () => {
      expect(useIntelligenceStore.getState().memoryDepthHours).toBe(168);
    });

    it('investigationMode is false', () => {
      expect(useIntelligenceStore.getState().investigationMode).toBe(false);
    });

    it('has empty pinnedEntities set', () => {
      expect(useIntelligenceStore.getState().pinnedEntities.size).toBe(0);
    });
  });

  describe('selectEntity', () => {
    it('adds entity to selectedEntities', () => {
      useIntelligenceStore.getState().selectEntity('entity-1');
      expect(useIntelligenceStore.getState().selectedEntities).toContain('entity-1');
    });

    it('can select multiple entities', () => {
      useIntelligenceStore.getState().selectEntity('entity-1');
      useIntelligenceStore.getState().selectEntity('entity-2');

      const state = useIntelligenceStore.getState();
      expect(state.selectedEntities.size).toBe(2);
      expect(state.selectedEntities).toContain('entity-1');
      expect(state.selectedEntities).toContain('entity-2');
    });

    it('is idempotent (selecting same entity twice)', () => {
      useIntelligenceStore.getState().selectEntity('entity-1');
      useIntelligenceStore.getState().selectEntity('entity-1');

      expect(useIntelligenceStore.getState().selectedEntities.size).toBe(1);
    });
  });

  describe('deselectEntity', () => {
    it('removes entity from selectedEntities', () => {
      useIntelligenceStore.getState().selectEntity('entity-1');
      useIntelligenceStore.getState().selectEntity('entity-2');

      useIntelligenceStore.getState().deselectEntity('entity-1');

      const state = useIntelligenceStore.getState();
      expect(state.selectedEntities.size).toBe(1);
      expect(state.selectedEntities).toContain('entity-2');
      expect(state.selectedEntities).not.toContain('entity-1');
    });

    it('is safe to deselect non-existent entity', () => {
      useIntelligenceStore.getState().selectEntity('entity-1');

      useIntelligenceStore.getState().deselectEntity('entity-999');

      expect(useIntelligenceStore.getState().selectedEntities).toContain('entity-1');
      expect(useIntelligenceStore.getState().selectedEntities.size).toBe(1);
    });
  });

  describe('clearSelection', () => {
    it('clears all selected entities', () => {
      useIntelligenceStore.getState().selectEntity('entity-1');
      useIntelligenceStore.getState().selectEntity('entity-2');

      useIntelligenceStore.getState().clearSelection();

      expect(useIntelligenceStore.getState().selectedEntities.size).toBe(0);
    });

    it('also clears hoveredEntity', () => {
      useIntelligenceStore.getState().selectEntity('entity-1');
      useIntelligenceStore.getState().setHoveredEntity('entity-2');

      useIntelligenceStore.getState().clearSelection();

      expect(useIntelligenceStore.getState().selectedEntities.size).toBe(0);
      expect(useIntelligenceStore.getState().hoveredEntity).toBeNull();
    });
  });

  describe('setHoveredEntity', () => {
    it('sets hoveredEntity to provided id', () => {
      useIntelligenceStore.getState().setHoveredEntity('entity-1');
      expect(useIntelligenceStore.getState().hoveredEntity).toBe('entity-1');
    });

    it('can clear hoveredEntity with null', () => {
      useIntelligenceStore.getState().setHoveredEntity('entity-1');
      useIntelligenceStore.getState().setHoveredEntity(null);

      expect(useIntelligenceStore.getState().hoveredEntity).toBeNull();
    });

    it('does not affect selectedEntities', () => {
      useIntelligenceStore.getState().selectEntity('entity-1');

      useIntelligenceStore.getState().setHoveredEntity('entity-2');

      expect(useIntelligenceStore.getState().selectedEntities).toContain('entity-1');
      expect(useIntelligenceStore.getState().hoveredEntity).toBe('entity-2');
    });
  });

  describe('setEntityTypeFilter', () => {
    it('sets entity type filter array', () => {
      useIntelligenceStore.getState().setEntityTypeFilter(['person', 'organization']);

      expect(useIntelligenceStore.getState().entityTypeFilter).toEqual(['person', 'organization']);
    });

    it('can clear filters with empty array', () => {
      useIntelligenceStore.getState().setEntityTypeFilter(['person']);
      useIntelligenceStore.getState().setEntityTypeFilter([]);

      expect(useIntelligenceStore.getState().entityTypeFilter).toEqual([]);
    });

    it('accepts all valid entity types', () => {
      const types = [
        'person',
        'organization',
        'location',
        'document',
        'event',
        'artifact',
        'unknown',
      ] as const;
      useIntelligenceStore.getState().setEntityTypeFilter([...types]);

      expect(useIntelligenceStore.getState().entityTypeFilter).toEqual(types);
    });
  });

  describe('setStatusFilter', () => {
    it('sets status filter array', () => {
      useIntelligenceStore.getState().setStatusFilter(['active', 'critical']);

      expect(useIntelligenceStore.getState().statusFilter).toEqual(['active', 'critical']);
    });

    it('accepts all valid status colors', () => {
      const statuses = [
        'intelligence',
        'anomaly',
        'active',
        'success',
        'critical',
        'neutral',
      ] as const;
      useIntelligenceStore.getState().setStatusFilter([...statuses]);

      expect(useIntelligenceStore.getState().statusFilter).toEqual(statuses);
    });
  });

  describe('setTimeRange', () => {
    it('sets both start and end dates', () => {
      const start = new Date('2024-01-01');
      const end = new Date('2024-12-31');

      useIntelligenceStore.getState().setTimeRange(start, end);

      const state = useIntelligenceStore.getState();
      expect(state.timeRangeStart).toBe(start);
      expect(state.timeRangeEnd).toBe(end);
    });

    it('can clear time range with nulls', () => {
      useIntelligenceStore.getState().setTimeRange(new Date(), new Date());
      useIntelligenceStore.getState().setTimeRange(null, null);

      const state = useIntelligenceStore.getState();
      expect(state.timeRangeStart).toBeNull();
      expect(state.timeRangeEnd).toBeNull();
    });

    it('allows setting only start or end', () => {
      const start = new Date('2024-01-01');
      useIntelligenceStore.getState().setTimeRange(start, null);

      expect(useIntelligenceStore.getState().timeRangeStart).toBe(start);
      expect(useIntelligenceStore.getState().timeRangeEnd).toBeNull();
    });
  });

  describe('setIntelligenceLayer', () => {
    it('changes intelligence layer', () => {
      expect(useIntelligenceStore.getState().intelligenceLayer).toBe('processed');

      useIntelligenceStore.getState().setIntelligenceLayer('raw');
      expect(useIntelligenceStore.getState().intelligenceLayer).toBe('raw');

      useIntelligenceStore.getState().setIntelligenceLayer('agent');
      expect(useIntelligenceStore.getState().intelligenceLayer).toBe('agent');
    });

    it('accepts all valid layers', () => {
      const layers = ['raw', 'processed', 'agent'] as const;
      for (const layer of layers) {
        useIntelligenceStore.getState().setIntelligenceLayer(layer);
        expect(useIntelligenceStore.getState().intelligenceLayer).toBe(layer);
      }
    });
  });

  describe('setMemoryDepth', () => {
    it('updates memory depth in hours', () => {
      useIntelligenceStore.getState().setMemoryDepth(24);
      expect(useIntelligenceStore.getState().memoryDepthHours).toBe(24);
    });

    it('accepts various hour values', () => {
      const depths = [1, 24, 72, 168, 720];
      for (const depth of depths) {
        useIntelligenceStore.getState().setMemoryDepth(depth);
        expect(useIntelligenceStore.getState().memoryDepthHours).toBe(depth);
      }
    });
  });

  describe('toggleInvestigationMode', () => {
    it('toggles investigation mode from false to true', () => {
      expect(useIntelligenceStore.getState().investigationMode).toBe(false);

      useIntelligenceStore.getState().toggleInvestigationMode();
      expect(useIntelligenceStore.getState().investigationMode).toBe(true);
    });

    it('toggles investigation mode from true to false', () => {
      useIntelligenceStore.getState().toggleInvestigationMode();
      useIntelligenceStore.getState().toggleInvestigationMode();

      expect(useIntelligenceStore.getState().investigationMode).toBe(false);
    });
  });

  describe('pinEntity', () => {
    it('adds entity to pinnedEntities', () => {
      useIntelligenceStore.getState().pinEntity('entity-1');
      expect(useIntelligenceStore.getState().pinnedEntities).toContain('entity-1');
    });

    it('can pin multiple entities', () => {
      useIntelligenceStore.getState().pinEntity('entity-1');
      useIntelligenceStore.getState().pinEntity('entity-2');

      const state = useIntelligenceStore.getState();
      expect(state.pinnedEntities.size).toBe(2);
      expect(state.pinnedEntities).toContain('entity-1');
      expect(state.pinnedEntities).toContain('entity-2');
    });

    it('is idempotent', () => {
      useIntelligenceStore.getState().pinEntity('entity-1');
      useIntelligenceStore.getState().pinEntity('entity-1');

      expect(useIntelligenceStore.getState().pinnedEntities.size).toBe(1);
    });
  });

  describe('unpinEntity', () => {
    it('removes entity from pinnedEntities', () => {
      useIntelligenceStore.getState().pinEntity('entity-1');
      useIntelligenceStore.getState().pinEntity('entity-2');

      useIntelligenceStore.getState().unpinEntity('entity-1');

      const state = useIntelligenceStore.getState();
      expect(state.pinnedEntities.size).toBe(1);
      expect(state.pinnedEntities).toContain('entity-2');
      expect(state.pinnedEntities).not.toContain('entity-1');
    });

    it('is safe for non-existent entities', () => {
      useIntelligenceStore.getState().pinEntity('entity-1');

      useIntelligenceStore.getState().unpinEntity('entity-999');

      expect(useIntelligenceStore.getState().pinnedEntities).toContain('entity-1');
      expect(useIntelligenceStore.getState().pinnedEntities.size).toBe(1);
    });
  });

  describe('complex workflows', () => {
    it('handles selection, filtering, and investigation mode together', () => {
      useIntelligenceStore.getState().selectEntity('entity-1');
      useIntelligenceStore.getState().setEntityTypeFilter(['person', 'organization']);
      useIntelligenceStore.getState().toggleInvestigationMode();
      useIntelligenceStore.getState().pinEntity('entity-1');

      const state = useIntelligenceStore.getState();
      expect(state.selectedEntities).toContain('entity-1');
      expect(state.entityTypeFilter).toEqual(['person', 'organization']);
      expect(state.investigationMode).toBe(true);
      expect(state.pinnedEntities).toContain('entity-1');
    });

    it('independent selection and hover state', () => {
      useIntelligenceStore.getState().selectEntity('entity-1');
      useIntelligenceStore.getState().setHoveredEntity('entity-2');

      const state = useIntelligenceStore.getState();
      expect(state.selectedEntities).toContain('entity-1');
      expect(state.selectedEntities).not.toContain('entity-2');
      expect(state.hoveredEntity).toBe('entity-2');
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────
// Stream Store Tests
// ─────────────────────────────────────────────────────────────────────────────────────

describe('useStreamStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useStreamStore.setState({
      items: [],
      paused: false,
      maxItems: 100,
      sourceFilter: [],
      typeFilter: [],
      statusFilter: [],
    });
  });

  describe('initial state', () => {
    it('starts with empty items array', () => {
      expect(useStreamStore.getState().items).toEqual([]);
    });

    it('starts with paused = false', () => {
      expect(useStreamStore.getState().paused).toBe(false);
    });

    it('starts with maxItems = 100', () => {
      expect(useStreamStore.getState().maxItems).toBe(100);
    });

    it('starts with empty filters', () => {
      const state = useStreamStore.getState();
      expect(state.sourceFilter).toEqual([]);
      expect(state.typeFilter).toEqual([]);
      expect(state.statusFilter).toEqual([]);
    });
  });

  describe('addItem', () => {
    it('adds single item to front of items array', () => {
      const item: StreamItem = {
        id: 'item-1',
        timestamp: new Date(),
        source: 'crawler',
        type: 'person',
        status: 'active',
        title: 'Test Item',
        summary: 'Summary',
        metadata: {},
      };

      useStreamStore.getState().addItem(item);

      const state = useStreamStore.getState();
      expect(state.items).toHaveLength(1);
      expect(state.items[0].id).toBe('item-1');
    });

    it('prepends new items to front', () => {
      const item1: StreamItem = {
        id: 'item-1',
        timestamp: new Date(),
        source: 'crawler',
        type: 'person',
        status: 'active',
        title: 'Item 1',
        summary: 'Summary 1',
        metadata: {},
      };
      const item2: StreamItem = {
        id: 'item-2',
        timestamp: new Date(),
        source: 'api',
        type: 'organization',
        status: 'success',
        title: 'Item 2',
        summary: 'Summary 2',
        metadata: {},
      };

      useStreamStore.getState().addItem(item1);
      useStreamStore.getState().addItem(item2);

      const state = useStreamStore.getState();
      expect(state.items[0].id).toBe('item-2');
      expect(state.items[1].id).toBe('item-1');
    });

    it('respects maxItems limit and removes oldest items', () => {
      useStreamStore.setState({ maxItems: 3 });

      const items = Array.from({ length: 5 }, (_, i) => ({
        id: `item-${i}`,
        timestamp: new Date(),
        source: 'crawler' as const,
        type: 'person' as const,
        status: 'active' as const,
        title: `Item ${i}`,
        summary: 'Summary',
        metadata: {},
      }));

      for (const item of items) {
        useStreamStore.getState().addItem(item);
      }

      const state = useStreamStore.getState();
      expect(state.items).toHaveLength(3);
      expect(state.items[0].id).toBe('item-4');
      expect(state.items[1].id).toBe('item-3');
      expect(state.items[2].id).toBe('item-2');
    });
  });

  describe('addItems', () => {
    it('adds multiple items at once', () => {
      const items: StreamItem[] = [
        {
          id: 'item-1',
          timestamp: new Date(),
          source: 'crawler',
          type: 'person',
          status: 'active',
          title: 'Item 1',
          summary: 'Summary 1',
          metadata: {},
        },
        {
          id: 'item-2',
          timestamp: new Date(),
          source: 'api',
          type: 'organization',
          status: 'success',
          title: 'Item 2',
          summary: 'Summary 2',
          metadata: {},
        },
      ];

      useStreamStore.getState().addItems(items);

      const state = useStreamStore.getState();
      expect(state.items).toHaveLength(2);
    });

    it('prepends new items batch to front', () => {
      const item1: StreamItem = {
        id: 'item-1',
        timestamp: new Date(),
        source: 'crawler',
        type: 'person',
        status: 'active',
        title: 'Item 1',
        summary: 'Summary 1',
        metadata: {},
      };

      useStreamStore.getState().addItem(item1);

      const newItems: StreamItem[] = [
        {
          id: 'item-2',
          timestamp: new Date(),
          source: 'api',
          type: 'organization',
          status: 'success',
          title: 'Item 2',
          summary: 'Summary 2',
          metadata: {},
        },
        {
          id: 'item-3',
          timestamp: new Date(),
          source: 'osint',
          type: 'location',
          status: 'critical',
          title: 'Item 3',
          summary: 'Summary 3',
          metadata: {},
        },
      ];

      useStreamStore.getState().addItems(newItems);

      const state = useStreamStore.getState();
      expect(state.items[0].id).toBe('item-2');
      expect(state.items[1].id).toBe('item-3');
      expect(state.items[2].id).toBe('item-1');
    });

    it('respects maxItems with batch add', () => {
      useStreamStore.setState({ maxItems: 3 });

      const newItems: StreamItem[] = Array.from({ length: 5 }, (_, i) => ({
        id: `item-${i}`,
        timestamp: new Date(),
        source: 'crawler' as const,
        type: 'person' as const,
        status: 'active' as const,
        title: `Item ${i}`,
        summary: 'Summary',
        metadata: {},
      }));

      useStreamStore.getState().addItems(newItems);

      const state = useStreamStore.getState();
      expect(state.items).toHaveLength(3);
    });
  });

  describe('removeItem', () => {
    it('removes item by id', () => {
      const item: StreamItem = {
        id: 'item-1',
        timestamp: new Date(),
        source: 'crawler',
        type: 'person',
        status: 'active',
        title: 'Item 1',
        summary: 'Summary',
        metadata: {},
      };

      useStreamStore.getState().addItem(item);
      useStreamStore.getState().removeItem('item-1');

      expect(useStreamStore.getState().items).toHaveLength(0);
    });

    it('removes correct item when multiple exist', () => {
      const item1: StreamItem = {
        id: 'item-1',
        timestamp: new Date(),
        source: 'crawler',
        type: 'person',
        status: 'active',
        title: 'Item 1',
        summary: 'Summary 1',
        metadata: {},
      };
      const item2: StreamItem = {
        id: 'item-2',
        timestamp: new Date(),
        source: 'api',
        type: 'organization',
        status: 'success',
        title: 'Item 2',
        summary: 'Summary 2',
        metadata: {},
      };

      useStreamStore.getState().addItem(item1);
      useStreamStore.getState().addItem(item2);

      useStreamStore.getState().removeItem('item-1');

      const state = useStreamStore.getState();
      expect(state.items).toHaveLength(1);
      expect(state.items[0].id).toBe('item-2');
    });
  });

  describe('clearItems', () => {
    it('removes all items', () => {
      for (let i = 0; i < 5; i++) {
        useStreamStore.getState().addItem({
          id: `item-${i}`,
          timestamp: new Date(),
          source: 'crawler',
          type: 'person',
          status: 'active',
          title: `Item ${i}`,
          summary: 'Summary',
          metadata: {},
        });
      }

      useStreamStore.getState().clearItems();

      expect(useStreamStore.getState().items).toEqual([]);
    });
  });

  describe('togglePaused', () => {
    it('toggles paused from false to true', () => {
      expect(useStreamStore.getState().paused).toBe(false);

      useStreamStore.getState().togglePaused();
      expect(useStreamStore.getState().paused).toBe(true);
    });

    it('toggles paused from true to false', () => {
      useStreamStore.getState().togglePaused();
      useStreamStore.getState().togglePaused();

      expect(useStreamStore.getState().paused).toBe(false);
    });
  });

  describe('setPaused', () => {
    it('sets paused to true', () => {
      useStreamStore.getState().setPaused(true);
      expect(useStreamStore.getState().paused).toBe(true);
    });

    it('sets paused to false', () => {
      useStreamStore.getState().setPaused(true);
      useStreamStore.getState().setPaused(false);

      expect(useStreamStore.getState().paused).toBe(false);
    });
  });

  describe('setMaxItems', () => {
    it('updates maxItems value', () => {
      useStreamStore.getState().setMaxItems(200);
      expect(useStreamStore.getState().maxItems).toBe(200);
    });

    it('accepts various max values', () => {
      const maxValues = [50, 100, 200, 500];
      for (const max of maxValues) {
        useStreamStore.getState().setMaxItems(max);
        expect(useStreamStore.getState().maxItems).toBe(max);
      }
    });
  });

  describe('filter operations', () => {
    it('setSourceFilter sets source filter array', () => {
      useStreamStore.getState().setSourceFilter(['crawler', 'osint']);
      expect(useStreamStore.getState().sourceFilter).toEqual(['crawler', 'osint']);
    });

    it('setTypeFilter sets type filter array', () => {
      useStreamStore.getState().setTypeFilter(['person', 'organization']);
      expect(useStreamStore.getState().typeFilter).toEqual(['person', 'organization']);
    });

    it('setStreamStatusFilter sets status filter array', () => {
      useStreamStore.getState().setStreamStatusFilter(['active', 'critical']);
      expect(useStreamStore.getState().statusFilter).toEqual(['active', 'critical']);
    });
  });

  describe('getFilteredItems', () => {
    beforeEach(() => {
      // Add diverse test items
      useStreamStore.getState().addItems([
        {
          id: 'item-1',
          timestamp: new Date(),
          source: 'crawler',
          type: 'person',
          status: 'active',
          title: 'Person Item',
          summary: 'Summary',
          metadata: {},
        },
        {
          id: 'item-2',
          timestamp: new Date(),
          source: 'api',
          type: 'organization',
          status: 'success',
          title: 'Org Item',
          summary: 'Summary',
          metadata: {},
        },
        {
          id: 'item-3',
          timestamp: new Date(),
          source: 'osint',
          type: 'location',
          status: 'critical',
          title: 'Location Item',
          summary: 'Summary',
          metadata: {},
        },
      ]);
    });

    it('returns all items when no filters applied', () => {
      const filtered = useStreamStore.getState().getFilteredItems();
      expect(filtered).toHaveLength(3);
    });

    it('filters by source', () => {
      useStreamStore.getState().setSourceFilter(['crawler']);
      const filtered = useStreamStore.getState().getFilteredItems();

      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('item-1');
    });

    it('filters by type', () => {
      useStreamStore.getState().setTypeFilter(['person', 'organization']);
      const filtered = useStreamStore.getState().getFilteredItems();

      expect(filtered).toHaveLength(2);
      expect(filtered.map((i) => i.id)).toEqual(['item-1', 'item-2']);
    });

    it('filters by status', () => {
      useStreamStore.getState().setStreamStatusFilter(['critical']);
      const filtered = useStreamStore.getState().getFilteredItems();

      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('item-3');
    });

    it('combines multiple filters (AND logic)', () => {
      useStreamStore.getState().setSourceFilter(['crawler', 'api']);
      useStreamStore.getState().setTypeFilter(['person']);

      const filtered = useStreamStore.getState().getFilteredItems();

      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('item-1');
    });

    it('applies all three filter types together', () => {
      useStreamStore.getState().setSourceFilter(['crawler']);
      useStreamStore.getState().setTypeFilter(['person']);
      useStreamStore.getState().setStreamStatusFilter(['active']);

      const filtered = useStreamStore.getState().getFilteredItems();

      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('item-1');
    });

    it('returns empty array when filters match nothing', () => {
      useStreamStore.getState().setSourceFilter(['agent']);
      const filtered = useStreamStore.getState().getFilteredItems();

      expect(filtered).toEqual([]);
    });
  });

  describe('stream state management', () => {
    it('paused state does not affect getFilteredItems', () => {
      useStreamStore.getState().addItem({
        id: 'item-1',
        timestamp: new Date(),
        source: 'crawler',
        type: 'person',
        status: 'active',
        title: 'Test',
        summary: 'Summary',
        metadata: {},
      });

      useStreamStore.getState().setPaused(true);
      const filtered = useStreamStore.getState().getFilteredItems();

      expect(filtered).toHaveLength(1);
    });

    it('handles rapid add and filter operations', () => {
      for (let i = 0; i < 20; i++) {
        useStreamStore.getState().addItem({
          id: `item-${i}`,
          timestamp: new Date(),
          source: i % 2 === 0 ? 'crawler' : 'api',
          type: i % 3 === 0 ? 'person' : 'organization',
          status: 'active',
          title: `Item ${i}`,
          summary: 'Summary',
          metadata: {},
        });
      }

      useStreamStore.getState().setSourceFilter(['crawler']);
      const filtered = useStreamStore.getState().getFilteredItems();

      expect(filtered.length).toBeGreaterThan(0);
      expect(filtered.length).toBeLessThanOrEqual(20);
    });
  });
});
