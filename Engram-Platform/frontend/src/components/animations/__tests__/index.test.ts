import { describe, expect, it } from 'vitest';
import * as Animations from '../index';

describe('animations barrel exports', () => {
  it('exports page transition components', () => {
    expect(Animations.PageTransition).toBeDefined();
    expect(Animations.FadeIn).toBeDefined();
    expect(Animations.SlideIn).toBeDefined();
  });

  it('exports stagger helpers and components', () => {
    expect(Animations.containerVariants).toBeDefined();
    expect(Animations.itemVariants).toBeDefined();
    expect(Animations.StaggerContainer).toBeDefined();
    expect(Animations.StaggerItem).toBeDefined();
    expect(Animations.StaggerList).toBeDefined();
  });
});
