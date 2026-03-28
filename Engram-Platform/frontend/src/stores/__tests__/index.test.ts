import { describe, expect, it, vi } from 'vitest';

// Mock zustand/middleware so persist() is a no-op passthrough
vi.mock('zustand/middleware', () => ({
  persist: (config: (set: unknown, get: unknown, api: unknown) => unknown) => config,
}));

// Import AFTER mocking
import { useUIStore } from '../index';

describe('stores/index barrel export', () => {
  it('re-exports useUIStore', () => {
    expect(useUIStore).toBeDefined();
    expect(typeof useUIStore).toBe('function');
  });

  it('useUIStore has expected state shape', () => {
    const state = useUIStore.getState();
    expect(state).toHaveProperty('sidebarCollapsed');
    expect(state).toHaveProperty('toggleSidebar');
  });

  it('useUIStore toggleSidebar action works', () => {
    useUIStore.setState({ sidebarCollapsed: false });
    const store = useUIStore.getState();
    expect(store.sidebarCollapsed).toBe(false);

    store.toggleSidebar();
    expect(useUIStore.getState().sidebarCollapsed).toBe(true);
  });
});
