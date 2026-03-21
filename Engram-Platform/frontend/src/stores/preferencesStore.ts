'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type DensityMode = 'compact' | 'comfortable' | 'spacious';
export type AnimationLevel = 'full' | 'reduced' | 'minimal';

interface PreferencesState {
  density: DensityMode;
  animationLevel: AnimationLevel;
  reducedMotion: boolean;
  compactSidebar: boolean;
  commandPaletteHintDismissed: boolean;
  onboardingCompleted: boolean;
  keyboardShortcutsDismissed: boolean;
  setDensity: (d: DensityMode) => void;
  setAnimationLevel: (a: AnimationLevel) => void;
  setReducedMotion: (r: boolean) => void;
  setCompactSidebar: (c: boolean) => void;
  dismissCommandPaletteHint: () => void;
  completeOnboarding: () => void;
  dismissKeyboardShortcuts: () => void;
}

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      density: 'comfortable',
      animationLevel: 'full',
      reducedMotion: false,
      compactSidebar: false,
      commandPaletteHintDismissed: false,
      onboardingCompleted: false,
      keyboardShortcutsDismissed: false,

      setDensity: (density) => set({ density }),
      setAnimationLevel: (animationLevel) => set({ animationLevel }),
      setReducedMotion: (reducedMotion) => set({ reducedMotion }),
      setCompactSidebar: (compactSidebar) => set({ compactSidebar }),
      dismissCommandPaletteHint: () => set({ commandPaletteHintDismissed: true }),
      completeOnboarding: () => set({ onboardingCompleted: true }),
      dismissKeyboardShortcuts: () => set({ keyboardShortcutsDismissed: true }),
    }),
    {
      name: 'engram-preferences',
    },
  ),
);

export const DENSITY_TOKENS: Record<DensityMode, { padding: string; gap: string; text: string }> = {
  compact: { padding: 'p-3', gap: 'gap-2', text: 'text-xs' },
  comfortable: { padding: 'p-5', gap: 'gap-4', text: 'text-sm' },
  spacious: { padding: 'p-6', gap: 'gap-6', text: 'text-base' },
};
