'use client';
import { useEffect } from 'react';
import { usePreferencesStore } from '@/src/stores/preferencesStore';

const DENSITY_VAR_MAP = {
  compact: { padding: '0.75rem', gap: '0.5rem', textScale: '0.875' },
  comfortable: { padding: '1.25rem', gap: '1rem', textScale: '1' },
  spacious: { padding: '1.5rem', gap: '1.5rem', textScale: '1.125' },
} as const;

const MOTION_DURATION_MAP = {
  full: '1',
  reduced: '0.4',
  minimal: '0.1',
} as const;

export function PreferencesManager() {
  const density = usePreferencesStore((s) => s.density);
  const animationLevel = usePreferencesStore((s) => s.animationLevel);
  const reducedMotion = usePreferencesStore((s) => s.reducedMotion);

  useEffect(() => {
    const root = document.documentElement;

    const densityTokens = DENSITY_VAR_MAP[density];
    root.style.setProperty('--density-padding', densityTokens.padding);
    root.style.setProperty('--density-gap', densityTokens.gap);
    root.style.setProperty('--density-text-scale', densityTokens.textScale);

    const motionMultiplier = MOTION_DURATION_MAP[animationLevel];
    root.style.setProperty('--motion-duration-multiplier', motionMultiplier);

    if (reducedMotion || animationLevel === 'minimal') {
      root.classList.add('motion-reduced');
    } else {
      root.classList.remove('motion-reduced');
    }
  }, [density, animationLevel, reducedMotion]);

  return null;
}
