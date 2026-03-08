import { describe, expect, it } from 'vitest';
import { getAvailableWidgets, WIDGET_REGISTRY } from '../widget-registry';

describe('WIDGET_REGISTRY', () => {
  it('contains expected widget definitions', () => {
    expect(Object.keys(WIDGET_REGISTRY)).toEqual([
      'stats',
      'quick-links',
      'crawler-health',
      'memory-health',
      'system',
    ]);
  });

  it('each widget has required fields', () => {
    for (const [key, widget] of Object.entries(WIDGET_REGISTRY)) {
      expect(widget.id).toBe(key);
      expect(widget.title).toBeTruthy();
      expect(widget.defaultLayout).toBeDefined();
    }
  });

  it('default layouts have valid x, y, w, h values', () => {
    for (const widget of Object.values(WIDGET_REGISTRY)) {
      const layout = widget.defaultLayout;
      expect(layout).toBeDefined();
      if (!layout) continue;
      expect(layout.x).toBeGreaterThanOrEqual(0);
      expect(layout.y).toBeGreaterThanOrEqual(0);
      expect(layout.w).toBeGreaterThan(0);
      expect(layout.h).toBeGreaterThan(0);
    }
  });
});

describe('getAvailableWidgets', () => {
  it('returns home dashboard widgets', () => {
    const widgets = getAvailableWidgets('home');
    expect(widgets).toEqual(['stats', 'quick-links', 'crawler-health', 'memory-health', 'system']);
  });

  it('returns memory dashboard widgets', () => {
    const widgets = getAvailableWidgets('memory');
    expect(widgets).toEqual(['analytics', 'recent-memories', 'matters']);
  });

  it('returns crawler dashboard widgets', () => {
    const widgets = getAvailableWidgets('crawler');
    expect(widgets).toEqual(['stats', 'recent-jobs', 'active-crawls']);
  });

  it('returns empty array for unknown dashboard', () => {
    // @ts-expect-error - testing invalid input
    const widgets = getAvailableWidgets('unknown');
    expect(widgets).toEqual([]);
  });
});
