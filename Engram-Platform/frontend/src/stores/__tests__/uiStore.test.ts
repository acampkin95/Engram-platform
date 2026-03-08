import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock zustand/middleware so persist() is a no-op passthrough.
// This prevents the store from touching localStorage at all.
vi.mock('zustand/middleware', () => ({
  persist: (config: (set: unknown, get: unknown, api: unknown) => unknown) => config,
}));

// Import AFTER mocking so the store is created with the no-op persist.
import { useUIStore } from '@/src/stores/uiStore';

// Reset store state before each test to prevent bleed-through.
beforeEach(() => {
  vi.clearAllMocks();
  useUIStore.setState({
    sidebarCollapsed: false,
    serviceStatus: { crawler: 'loading', memory: 'loading' },
    wsConnected: false,
    activeSection: 'crawler',
  });
});

describe('uiStore', () => {
  it('sidebarCollapsed starts as false and toggleSidebar flips it', () => {
    const store = useUIStore.getState();
    expect(store.sidebarCollapsed).toBe(false);

    store.toggleSidebar();
    expect(useUIStore.getState().sidebarCollapsed).toBe(true);

    useUIStore.getState().toggleSidebar();
    expect(useUIStore.getState().sidebarCollapsed).toBe(false);
  });

  it('setSidebarCollapsed sets value directly', () => {
    useUIStore.getState().setSidebarCollapsed(true);
    expect(useUIStore.getState().sidebarCollapsed).toBe(true);
  });

  it('setServiceStatus merges partial status without overwriting other fields', () => {
    useUIStore.getState().setServiceStatus({ crawler: 'online' });
    const { serviceStatus } = useUIStore.getState();
    expect(serviceStatus.crawler).toBe('online');
    expect(serviceStatus.memory).toBe('loading'); // unchanged
  });

  it('setWsConnected updates wsConnected', () => {
    expect(useUIStore.getState().wsConnected).toBe(false);
    useUIStore.getState().setWsConnected(true);
    expect(useUIStore.getState().wsConnected).toBe(true);
  });

  it('setActiveSection changes activeSection', () => {
    expect(useUIStore.getState().activeSection).toBe('crawler');
    useUIStore.getState().setActiveSection('memory');
    expect(useUIStore.getState().activeSection).toBe('memory');
  });
});
