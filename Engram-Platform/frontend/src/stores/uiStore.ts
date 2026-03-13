// Zustand v5 store for UI state.
// Uses persist middleware to save sidebarCollapsed to localStorage.
// serviceStatus and wsConnected are runtime-only (not persisted).

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ServiceStatus {
  crawler: 'online' | 'degraded' | 'offline' | 'loading';
  memory: 'online' | 'degraded' | 'offline' | 'loading';
}

interface UIPersistedState {
  sidebarCollapsed: boolean;
}

interface UIState extends UIPersistedState {
  // Sidebar
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;

  // Service status (shown in header) — runtime only, not persisted
  serviceStatus: ServiceStatus;
  setServiceStatus: (status: Partial<ServiceStatus>) => void;

  // Active section for nav highlighting
  activeSection: 'crawler' | 'memory' | 'intelligence';
  setActiveSection: (section: 'crawler' | 'memory' | 'intelligence') => void;

  // WebSocket connection state — runtime only, not persisted
  wsConnected: boolean;
  setWsConnected: (connected: boolean) => void;

  // Graph selection state — runtime only, not persisted
  selectedEntityId: string | null;
  setSelectedEntityId: (entityId: string | null) => void;
  clearSelectedEntity: () => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      // Persisted state
      sidebarCollapsed: false,

      // Runtime state (not persisted)
      serviceStatus: {
        crawler: 'loading',
        memory: 'loading',
      },
      activeSection: 'crawler' as const,
      wsConnected: false,
      selectedEntityId: null,

      // Sidebar actions
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),

      // Service status actions
      setServiceStatus: (status) =>
        set((state) => ({
          serviceStatus: { ...state.serviceStatus, ...status },
        })),

      // Navigation actions
      setActiveSection: (activeSection) => set({ activeSection }),

      // WebSocket actions
      setWsConnected: (wsConnected) => set({ wsConnected }),

      // Graph selection actions
      setSelectedEntityId: (selectedEntityId) => set({ selectedEntityId }),
      clearSelectedEntity: () => set({ selectedEntityId: null }),
    }),
    {
      name: 'engram-ui-store',
      // Only persist sidebarCollapsed — all other state is runtime only
      partialize: (state): UIPersistedState => ({
        sidebarCollapsed: state.sidebarCollapsed,
      }),
    },
  ),
);
