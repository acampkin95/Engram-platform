// Design system token exports for use in TypeScript/JavaScript
// Values map to CSS custom properties in globals.css @theme block

export const colors = {
  bg: {
    primary: 'var(--color-void)',
    secondary: 'var(--color-deep)',
    tertiary: 'var(--color-layer-0)',
    elevated: 'var(--color-layer-1)',
  },
  border: {
    default: 'var(--color-border)',
    strong: 'rgba(255, 255, 255, 0.12)',
    focus: 'var(--color-ring)',
  },
  text: {
    primary: 'var(--color-text-primary)',
    secondary: 'var(--color-text-secondary)',
    muted: 'var(--color-text-muted)',
    disabled: 'var(--color-muted-foreground)',
  },
  accent: {
    amber: 'var(--color-amber)',
    amberDim: 'var(--color-primary-400)',
    purple: 'var(--color-accent-500)',
    purpleDim: 'var(--color-accent-400)',
    teal: 'var(--color-teal)',
    tealDim: 'var(--color-memory-tier3)',
  },
  semantic: {
    success: 'var(--color-memory-tier3)',
    warning: 'var(--color-memory-tier1)',
    error: 'var(--color-destructive)',
    info: 'var(--color-accent-500)',
  },
  system: {
    crawler: 'var(--color-memory-tier2)',
    crawlerDim: 'var(--color-accent-400)',
    memory: 'var(--color-memory-tier3)',
    memoryDim: 'var(--color-memory-tier3)',
    intelligence: 'var(--color-memory-tier1)',
    intelligenceDim: 'var(--color-primary-400)',
  },
} as const;

export const fonts = {
  display: 'var(--font-display)',
  mono: 'var(--font-mono)',
  serif: 'var(--font-serif)',
  sans: 'var(--font-sans)',
} as const;

export const spacing = {
  1: '0.25rem',
  2: '0.5rem',
  3: '0.75rem',
  4: '1rem',
  5: '1.25rem',
  6: '1.5rem',
  8: '2rem',
  10: '2.5rem',
  12: '3rem',
} as const;

export const radius = {
  sm: '0.375rem',
  md: '0.5rem',
  lg: '0.75rem',
  xl: '1rem',
  full: '9999px',
} as const;

export type SystemSection = 'crawler' | 'memory' | 'intelligence';

export const sectionColors: Record<SystemSection, { accent: string; dim: string; border: string }> =
  {
    crawler: {
      accent: colors.system.crawler,
      dim: colors.system.crawlerDim,
      border: 'var(--color-accent-400)',
    },
    memory: {
      accent: colors.system.memory,
      dim: colors.system.memoryDim,
      border: 'var(--color-memory-tier3)',
    },
    intelligence: {
      accent: colors.system.intelligence,
      dim: colors.system.intelligenceDim,
      border: 'var(--color-primary-400)',
    },
  };

export type ColorKey = keyof typeof colors;
export type SectionKey = keyof typeof sectionColors;
