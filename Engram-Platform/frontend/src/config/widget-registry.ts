import type { ReactNode } from 'react';

export interface WidgetDefinition {
  id: string;
  title: string;
  icon?: ReactNode;
  defaultLayout?: {
    x: number;
    y: number;
    w: number;
    h: number;
    minW?: number;
    minH?: number;
  };
}

// Widget registry - extend with new widgets here
export const WIDGET_REGISTRY: Record<string, WidgetDefinition> = {
  stats: {
    id: 'stats',
    title: 'Key Metrics',
    defaultLayout: { x: 0, y: 0, w: 6, h: 5, minW: 4, minH: 4 },
  },
  'quick-links': {
    id: 'quick-links',
    title: 'Quick Access',
    defaultLayout: { x: 6, y: 0, w: 6, h: 5, minW: 3, minH: 3 },
  },
  'crawler-health': {
    id: 'crawler-health',
    title: 'Crawler Service',
    defaultLayout: { x: 0, y: 5, w: 6, h: 6, minW: 3, minH: 4 },
  },
  'memory-health': {
    id: 'memory-health',
    title: 'Memory Service',
    defaultLayout: { x: 6, y: 5, w: 6, h: 6, minW: 3, minH: 4 },
  },
  system: {
    id: 'system',
    title: 'System',
    defaultLayout: { x: 0, y: 11, w: 4, h: 5, minW: 3, minH: 4 },
  },
};

// Available widgets for a given dashboard
export function getAvailableWidgets(dashboard: 'home' | 'memory' | 'crawler'): string[] {
  switch (dashboard) {
    case 'home':
      return ['stats', 'quick-links', 'crawler-health', 'memory-health', 'system'];
    case 'memory':
      return ['analytics', 'recent-memories', 'matters'];
    case 'crawler':
      return ['stats', 'recent-jobs', 'active-crawls'];
    default:
      return [];
  }
}
