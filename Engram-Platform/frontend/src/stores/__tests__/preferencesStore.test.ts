import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock zustand/middleware so persist() is a no-op passthrough.
vi.mock('zustand/middleware', () => ({
  persist: (config: (set: unknown, get: unknown, api: unknown) => unknown) => config,
}));

import { DENSITY_TOKENS, usePreferencesStore } from '@/src/stores/preferencesStore';

beforeEach(() => {
  vi.clearAllMocks();
  usePreferencesStore.setState({
    density: 'comfortable',
    animationLevel: 'full',
    reducedMotion: false,
    compactSidebar: false,
    commandPaletteHintDismissed: false,
    onboardingCompleted: false,
    keyboardShortcutsDismissed: false,
  });
});

describe('preferencesStore', () => {
  describe('default values', () => {
    it('has comfortable density by default', () => {
      expect(usePreferencesStore.getState().density).toBe('comfortable');
    });

    it('has full animation level by default', () => {
      expect(usePreferencesStore.getState().animationLevel).toBe('full');
    });

    it('has reducedMotion disabled by default', () => {
      expect(usePreferencesStore.getState().reducedMotion).toBe(false);
    });

    it('has compactSidebar disabled by default', () => {
      expect(usePreferencesStore.getState().compactSidebar).toBe(false);
    });

    it('has all dismissal flags as false by default', () => {
      const state = usePreferencesStore.getState();
      expect(state.commandPaletteHintDismissed).toBe(false);
      expect(state.onboardingCompleted).toBe(false);
      expect(state.keyboardShortcutsDismissed).toBe(false);
    });
  });

  describe('setDensity', () => {
    it('changes density to compact', () => {
      usePreferencesStore.getState().setDensity('compact');
      expect(usePreferencesStore.getState().density).toBe('compact');
    });

    it('changes density to spacious', () => {
      usePreferencesStore.getState().setDensity('spacious');
      expect(usePreferencesStore.getState().density).toBe('spacious');
    });
  });

  describe('setAnimationLevel', () => {
    it('changes animation level to reduced', () => {
      usePreferencesStore.getState().setAnimationLevel('reduced');
      expect(usePreferencesStore.getState().animationLevel).toBe('reduced');
    });

    it('changes animation level to minimal', () => {
      usePreferencesStore.getState().setAnimationLevel('minimal');
      expect(usePreferencesStore.getState().animationLevel).toBe('minimal');
    });
  });

  describe('setReducedMotion', () => {
    it('enables reduced motion', () => {
      usePreferencesStore.getState().setReducedMotion(true);
      expect(usePreferencesStore.getState().reducedMotion).toBe(true);
    });

    it('disables reduced motion after enabling', () => {
      usePreferencesStore.getState().setReducedMotion(true);
      usePreferencesStore.getState().setReducedMotion(false);
      expect(usePreferencesStore.getState().reducedMotion).toBe(false);
    });
  });

  describe('setCompactSidebar', () => {
    it('enables compact sidebar', () => {
      usePreferencesStore.getState().setCompactSidebar(true);
      expect(usePreferencesStore.getState().compactSidebar).toBe(true);
    });
  });

  describe('dismissal actions', () => {
    it('dismissCommandPaletteHint sets flag to true', () => {
      usePreferencesStore.getState().dismissCommandPaletteHint();
      expect(usePreferencesStore.getState().commandPaletteHintDismissed).toBe(true);
    });

    it('completeOnboarding sets flag to true', () => {
      usePreferencesStore.getState().completeOnboarding();
      expect(usePreferencesStore.getState().onboardingCompleted).toBe(true);
    });

    it('dismissKeyboardShortcuts sets flag to true', () => {
      usePreferencesStore.getState().dismissKeyboardShortcuts();
      expect(usePreferencesStore.getState().keyboardShortcutsDismissed).toBe(true);
    });
  });

  describe('state isolation', () => {
    it('setting density does not affect other preferences', () => {
      usePreferencesStore.getState().setReducedMotion(true);
      usePreferencesStore.getState().setDensity('compact');
      expect(usePreferencesStore.getState().reducedMotion).toBe(true);
      expect(usePreferencesStore.getState().animationLevel).toBe('full');
    });
  });

  describe('DENSITY_TOKENS', () => {
    it('provides tokens for all three density modes', () => {
      expect(DENSITY_TOKENS.compact).toEqual({ padding: 'p-3', gap: 'gap-2', text: 'text-xs' });
      expect(DENSITY_TOKENS.comfortable).toEqual({
        padding: 'p-5',
        gap: 'gap-4',
        text: 'text-sm',
      });
      expect(DENSITY_TOKENS.spacious).toEqual({
        padding: 'p-6',
        gap: 'gap-6',
        text: 'text-base',
      });
    });
  });
});
