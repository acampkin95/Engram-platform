import { describe, expect, it } from 'vitest';
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
});
