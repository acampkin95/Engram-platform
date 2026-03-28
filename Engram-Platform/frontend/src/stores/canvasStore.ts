import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ─────────────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────────────

export interface CanvasPanel {
  id: string;
  type: 'graph' | 'stream' | 'timeline' | 'inspector' | 'agent-console' | 'custom';
  x: number;
  y: number;
  width: number;
  height: number;
  minWidth?: number;
  minHeight?: number;
  data?: Record<string, unknown>;
}

export interface PanelLayout {
  panels: CanvasPanel[];
  gridCols: number;
  maxPanels: number;
}

export type IntelligenceLayer = 'raw' | 'processed' | 'agent';
export type StatusColor =
  | 'intelligence'
  | 'anomaly'
  | 'active'
  | 'success'
  | 'critical'
  | 'neutral';
export type EntityType =
  | 'person'
  | 'organization'
  | 'location'
  | 'document'
  | 'event'
  | 'artifact'
  | 'unknown';
export type RelationshipType =
  | 'associated'
  | 'communicated'
  | 'located_at'
  | 'owns'
  | 'member_of'
  | 'referenced';

// ─────────────────────────────────────────────────────────────────────────────────────
// Canvas Store
// ─────────────────────────────────────────────────────────────────────────────────────
interface CanvasState {
  panels: CanvasPanel[];
  gridCols: number;
  maxPanels: number;

  // Panel operations
  addPanel: (panel: Omit<CanvasPanel, 'id'>) => string;
  removePanel: (id: string) => void;
  updatePanel: (id: string, updates: Partial<CanvasPanel>) => void;
  movePanel: (id: string, x: number, y: number) => void;
  resizePanel: (id: string, width: number, height: number) => void;

  // Grid operations
  setGridCols: (cols: number) => void;

  // Layout persistence
  saveLayout: () => void;
  loadLayout: () => PanelLayout | null;
  resetLayout: () => void;
}

export const useCanvasStore = create<CanvasState>()(
  persist(
    (set, get) => ({
      panels: [],
      gridCols: 12,
      maxPanels: 8,

      addPanel: (panel) => {
        const id = `panel-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        set((state) => ({
          panels: [...state.panels, { ...panel, id }],
        }));
        return id;
      },

      removePanel: (id) => {
        set((state) => ({
          panels: state.panels.filter((p) => p.id !== id),
        }));
      },

      updatePanel: (id, updates) => {
        set((state) => ({
          panels: state.panels.map((p) => (p.id === id ? { ...p, ...updates } : p)),
        }));
      },

      movePanel: (id, x, y) => {
        set((state) => ({
          panels: state.panels.map((p) => (p.id === id ? { ...p, x, y } : p)),
        }));
      },

      resizePanel: (id, width, height) => {
        set((state) => ({
          panels: state.panels.map((p) => (p.id === id ? { ...p, width, height } : p)),
        }));
      },

      setGridCols: (cols) => {
        set({ gridCols: cols });
      },

      saveLayout: () => {
        const state = get();
        localStorage.setItem(
          'canvas-layout',
          JSON.stringify({
            panels: state.panels,
            gridCols: state.gridCols,
          }),
        );
      },

      loadLayout: () => {
        const saved = localStorage.getItem('canvas-layout');
        if (saved) {
          try {
            const layout = JSON.parse(saved) as PanelLayout;
            set({
              panels: layout.panels,
              gridCols: layout.gridCols,
            });
            return layout;
          } catch {
            return null;
          }
        }
        return null;
      },

      resetLayout: () => {
        set({
          panels: [],
          gridCols: 12,
        });
        localStorage.removeItem('canvas-layout');
      },
    }),
    {
      name: 'canvas-storage',
      partialize: (state) => ({
        panels: state.panels,
        gridCols: state.gridCols,
      }),
    },
  ),
);

// ─────────────────────────────────────────────────────────────────────────────────────
// Intelligence Store
// ─────────────────────────────────────────────────────────────────────────────────────
interface IntelligenceState {
  // Selection
  selectedEntities: Set<string>;
  hoveredEntity: string | null;

  // Filters
  entityTypeFilter: EntityType[];
  statusFilter: StatusColor[];
  timeRangeStart: Date | null;
  timeRangeEnd: Date | null;

  // View settings
  intelligenceLayer: IntelligenceLayer;
  memoryDepthHours: number;

  // Investigation mode
  investigationMode: boolean;
  pinnedEntities: Set<string>;

  // Actions
  selectEntity: (id: string) => void;
  deselectEntity: (id: string) => void;
  clearSelection: () => void;
  setHoveredEntity: (id: string | null) => void;

  setEntityTypeFilter: (types: EntityType[]) => void;
  setStatusFilter: (statuses: StatusColor[]) => void;
  setTimeRange: (start: Date | null, end: Date | null) => void;

  setIntelligenceLayer: (layer: IntelligenceLayer) => void;
  setMemoryDepth: (hours: number) => void;

  toggleInvestigationMode: () => void;
  pinEntity: (id: string) => void;
  unpinEntity: (id: string) => void;
}

export const useIntelligenceStore = create<IntelligenceState>((set) => ({
  selectedEntities: new Set<string>(),
  hoveredEntity: null,

  entityTypeFilter: [],
  statusFilter: [],
  timeRangeStart: null,
  timeRangeEnd: null,

  intelligenceLayer: 'processed',
  memoryDepthHours: 168,

  investigationMode: false,
  pinnedEntities: new Set<string>(),

  selectEntity: (id) => {
    set((state) => ({
      selectedEntities: new Set([...state.selectedEntities, id]),
    }));
  },

  deselectEntity: (id) => {
    set((state) => ({
      selectedEntities: new Set([...state.selectedEntities].filter((eid: string) => eid !== id)),
    }));
  },

  clearSelection: () => {
    set({
      selectedEntities: new Set<string>(),
      hoveredEntity: null,
    });
  },

  setHoveredEntity: (id) => {
    set({ hoveredEntity: id });
  },

  setEntityTypeFilter: (types) => {
    set({ entityTypeFilter: types });
  },

  setStatusFilter: (statuses) => {
    set({ statusFilter: statuses });
  },

  setTimeRange: (start, end) => {
    set({
      timeRangeStart: start,
      timeRangeEnd: end,
    });
  },

  setIntelligenceLayer: (layer) => {
    set({ intelligenceLayer: layer });
  },

  setMemoryDepth: (hours) => {
    set({ memoryDepthHours: hours });
  },

  toggleInvestigationMode: () => {
    set((state) => ({ investigationMode: !state.investigationMode }));
  },

  pinEntity: (id) => {
    set((state) => ({
      pinnedEntities: new Set([...state.pinnedEntities, id]),
    }));
  },

  unpinEntity: (id) => {
    set((state) => ({
      pinnedEntities: new Set([...state.pinnedEntities].filter((eid) => eid !== id)),
    }));
  },
}));

// ─────────────────────────────────────────────────────────────────────────────────────
// Stream Store
// ─────────────────────────────────────────────────────────────────────────────────────

export interface StreamItem {
  id: string;
  timestamp: Date;
  source: 'crawler' | 'osint' | 'api' | 'agent';
  type: EntityType;
  status: StatusColor;
  title: string;
  summary: string;
  metadata: Record<string, string>;
}

interface StreamState {
  items: StreamItem[];
  paused: boolean;
  maxItems: number;
  sourceFilter: string[];
  typeFilter: EntityType[];
  statusFilter: StatusColor[];

  addItem: (item: StreamItem) => void;
  addItems: (items: StreamItem[]) => void;
  removeItem: (id: string) => void;
  clearItems: () => void;
  togglePaused: () => void;
  setPaused: (paused: boolean) => void;
  setMaxItems: (max: number) => void;
  setSourceFilter: (sources: string[]) => void;
  setTypeFilter: (types: EntityType[]) => void;
  setStreamStatusFilter: (statuses: StatusColor[]) => void;
  getFilteredItems: () => StreamItem[];
}

export const useStreamStore = create<StreamState>((set, get) => ({
  items: [],
  paused: false,
  maxItems: 100,
  sourceFilter: [],
  typeFilter: [],
  statusFilter: [],

  addItem: (item) => {
    set((state) => {
      const newItems = [item, ...state.items];
      if (newItems.length > state.maxItems) {
        newItems.pop();
      }
      return { items: newItems };
    });
  },

  addItems: (items) => {
    set((state) => {
      const newItems = [...items, ...state.items].slice(0, state.maxItems);
      return { items: newItems };
    });
  },

  removeItem: (id) => {
    set((state) => ({
      items: state.items.filter((item) => item.id !== id),
    }));
  },

  clearItems: () => {
    set({ items: [] });
  },

  togglePaused: () => {
    set((state) => ({ paused: !state.paused }));
  },

  setPaused: (paused) => {
    set({ paused });
  },

  setMaxItems: (max) => {
    set({ maxItems: max });
  },

  setSourceFilter: (sources) => {
    set({ sourceFilter: sources });
  },

  setTypeFilter: (types) => {
    set({ typeFilter: types });
  },

  setStreamStatusFilter: (statuses) => {
    set({ statusFilter: statuses });
  },

  getFilteredItems: () => {
    const state = get();
    return state.items.filter((item) => {
      if (state.sourceFilter.length > 0 && !state.sourceFilter.includes(item.source)) {
        return false;
      }
      if (state.typeFilter.length > 0 && !state.typeFilter.includes(item.type)) {
        return false;
      }
      if (state.statusFilter.length > 0 && !state.statusFilter.includes(item.status)) {
        return false;
      }
      return true;
    });
  },
}));
