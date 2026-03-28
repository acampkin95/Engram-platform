import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PreferencesManager } from '../PreferencesManager';

// Mock the preferencesStore
vi.mock('@/src/stores/preferencesStore', () => ({
  usePreferencesStore: vi.fn(),
}));

import { usePreferencesStore } from '@/src/stores/preferencesStore';

describe('PreferencesManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset document.documentElement styles and classes
    document.documentElement.setAttribute('style', '');
    document.documentElement.className = '';
  });

  afterEach(() => {
    document.documentElement.setAttribute('style', '');
    document.documentElement.className = '';
  });

  describe('density preferences', () => {
    it('applies compact density tokens to root element', () => {
      const mockUsePreferencesStore = usePreferencesStore as any;
      mockUsePreferencesStore.mockImplementation((selector: any) => {
        const state = {
          density: 'compact',
          animationLevel: 'full',
          reducedMotion: false,
        };
        return selector(state);
      });

      render(<PreferencesManager />);

      const root = document.documentElement;
      expect(root.style.getPropertyValue('--density-padding')).toBe('0.75rem');
      expect(root.style.getPropertyValue('--density-gap')).toBe('0.5rem');
      expect(root.style.getPropertyValue('--density-text-scale')).toBe('0.875');
    });

    it('applies comfortable density tokens to root element', () => {
      const mockUsePreferencesStore = usePreferencesStore as any;
      mockUsePreferencesStore.mockImplementation((selector: any) => {
        const state = {
          density: 'comfortable',
          animationLevel: 'full',
          reducedMotion: false,
        };
        return selector(state);
      });

      render(<PreferencesManager />);

      const root = document.documentElement;
      expect(root.style.getPropertyValue('--density-padding')).toBe('1.25rem');
      expect(root.style.getPropertyValue('--density-gap')).toBe('1rem');
      expect(root.style.getPropertyValue('--density-text-scale')).toBe('1');
    });

    it('applies spacious density tokens to root element', () => {
      const mockUsePreferencesStore = usePreferencesStore as any;
      mockUsePreferencesStore.mockImplementation((selector: any) => {
        const state = {
          density: 'spacious',
          animationLevel: 'full',
          reducedMotion: false,
        };
        return selector(state);
      });

      render(<PreferencesManager />);

      const root = document.documentElement;
      expect(root.style.getPropertyValue('--density-padding')).toBe('1.5rem');
      expect(root.style.getPropertyValue('--density-gap')).toBe('1.5rem');
      expect(root.style.getPropertyValue('--density-text-scale')).toBe('1.125');
    });

    it('updates density tokens when density preference changes', () => {
      const mockUsePreferencesStore = usePreferencesStore as any;
      let currentState = {
        density: 'comfortable',
        animationLevel: 'full',
        reducedMotion: false,
      };

      mockUsePreferencesStore.mockImplementation((selector: any) => {
        return selector(currentState);
      });

      const { rerender } = render(<PreferencesManager />);

      let root = document.documentElement;
      expect(root.style.getPropertyValue('--density-padding')).toBe('1.25rem');

      // Update to spacious
      currentState = {
        density: 'spacious',
        animationLevel: 'full',
        reducedMotion: false,
      };

      rerender(<PreferencesManager />);

      root = document.documentElement;
      expect(root.style.getPropertyValue('--density-padding')).toBe('1.5rem');
    });
  });

  describe('animation level preferences', () => {
    it('applies full animation multiplier', () => {
      const mockUsePreferencesStore = usePreferencesStore as any;
      mockUsePreferencesStore.mockImplementation((selector: any) => {
        const state = {
          density: 'comfortable',
          animationLevel: 'full',
          reducedMotion: false,
        };
        return selector(state);
      });

      render(<PreferencesManager />);

      const root = document.documentElement;
      expect(root.style.getPropertyValue('--motion-duration-multiplier')).toBe('1');
    });

    it('applies reduced animation multiplier', () => {
      const mockUsePreferencesStore = usePreferencesStore as any;
      mockUsePreferencesStore.mockImplementation((selector: any) => {
        const state = {
          density: 'comfortable',
          animationLevel: 'reduced',
          reducedMotion: false,
        };
        return selector(state);
      });

      render(<PreferencesManager />);

      const root = document.documentElement;
      expect(root.style.getPropertyValue('--motion-duration-multiplier')).toBe('0.4');
    });

    it('applies minimal animation multiplier', () => {
      const mockUsePreferencesStore = usePreferencesStore as any;
      mockUsePreferencesStore.mockImplementation((selector: any) => {
        const state = {
          density: 'comfortable',
          animationLevel: 'minimal',
          reducedMotion: false,
        };
        return selector(state);
      });

      render(<PreferencesManager />);

      const root = document.documentElement;
      expect(root.style.getPropertyValue('--motion-duration-multiplier')).toBe('0.1');
    });

    it('updates animation multiplier when animation level changes', () => {
      const mockUsePreferencesStore = usePreferencesStore as any;
      let currentState = {
        density: 'comfortable',
        animationLevel: 'full',
        reducedMotion: false,
      };

      mockUsePreferencesStore.mockImplementation((selector: any) => {
        return selector(currentState);
      });

      const { rerender } = render(<PreferencesManager />);

      let root = document.documentElement;
      expect(root.style.getPropertyValue('--motion-duration-multiplier')).toBe('1');

      // Update to reduced
      currentState = {
        density: 'comfortable',
        animationLevel: 'reduced',
        reducedMotion: false,
      };

      rerender(<PreferencesManager />);

      root = document.documentElement;
      expect(root.style.getPropertyValue('--motion-duration-multiplier')).toBe('0.4');
    });
  });

  describe('reduced motion class', () => {
    it('adds motion-reduced class when reducedMotion is true', () => {
      const mockUsePreferencesStore = usePreferencesStore as any;
      mockUsePreferencesStore.mockImplementation((selector: any) => {
        const state = {
          density: 'comfortable',
          animationLevel: 'full',
          reducedMotion: true,
        };
        return selector(state);
      });

      render(<PreferencesManager />);

      const root = document.documentElement;
      expect(root.classList.contains('motion-reduced')).toBe(true);
    });

    it('removes motion-reduced class when reducedMotion is false', () => {
      const mockUsePreferencesStore = usePreferencesStore as any;
      mockUsePreferencesStore.mockImplementation((selector: any) => {
        const state = {
          density: 'comfortable',
          animationLevel: 'full',
          reducedMotion: false,
        };
        return selector(state);
      });

      render(<PreferencesManager />);

      const root = document.documentElement;
      expect(root.classList.contains('motion-reduced')).toBe(false);
    });

    it('adds motion-reduced class when animationLevel is minimal', () => {
      const mockUsePreferencesStore = usePreferencesStore as any;
      mockUsePreferencesStore.mockImplementation((selector: any) => {
        const state = {
          density: 'comfortable',
          animationLevel: 'minimal',
          reducedMotion: false,
        };
        return selector(state);
      });

      render(<PreferencesManager />);

      const root = document.documentElement;
      expect(root.classList.contains('motion-reduced')).toBe(true);
    });

    it('adds motion-reduced class when both reducedMotion and minimal animation are set', () => {
      const mockUsePreferencesStore = usePreferencesStore as any;
      mockUsePreferencesStore.mockImplementation((selector: any) => {
        const state = {
          density: 'comfortable',
          animationLevel: 'minimal',
          reducedMotion: true,
        };
        return selector(state);
      });

      render(<PreferencesManager />);

      const root = document.documentElement;
      expect(root.classList.contains('motion-reduced')).toBe(true);
    });

    it('updates motion-reduced class when reducedMotion changes', () => {
      const mockUsePreferencesStore = usePreferencesStore as any;
      let currentState = {
        density: 'comfortable',
        animationLevel: 'full',
        reducedMotion: false,
      };

      mockUsePreferencesStore.mockImplementation((selector: any) => {
        return selector(currentState);
      });

      const { rerender } = render(<PreferencesManager />);

      let root = document.documentElement;
      expect(root.classList.contains('motion-reduced')).toBe(false);

      // Update to reduced motion
      currentState = {
        density: 'comfortable',
        animationLevel: 'full',
        reducedMotion: true,
      };

      rerender(<PreferencesManager />);

      root = document.documentElement;
      expect(root.classList.contains('motion-reduced')).toBe(true);
    });

    it('updates motion-reduced class when animationLevel changes to minimal', () => {
      const mockUsePreferencesStore = usePreferencesStore as any;
      let currentState = {
        density: 'comfortable',
        animationLevel: 'full',
        reducedMotion: false,
      };

      mockUsePreferencesStore.mockImplementation((selector: any) => {
        return selector(currentState);
      });

      const { rerender } = render(<PreferencesManager />);

      let root = document.documentElement;
      expect(root.classList.contains('motion-reduced')).toBe(false);

      // Update to minimal animation
      currentState = {
        density: 'comfortable',
        animationLevel: 'minimal',
        reducedMotion: false,
      };

      rerender(<PreferencesManager />);

      root = document.documentElement;
      expect(root.classList.contains('motion-reduced')).toBe(true);
    });
  });

  describe('renders without UI', () => {
    it('returns null (no visible output)', () => {
      const mockUsePreferencesStore = usePreferencesStore as any;
      mockUsePreferencesStore.mockImplementation((selector: any) => {
        const state = {
          density: 'comfortable',
          animationLevel: 'full',
          reducedMotion: false,
        };
        return selector(state);
      });

      const { container } = render(<PreferencesManager />);

      expect(container.firstChild).toBeNull();
    });
  });

  describe('combined preferences', () => {
    it('applies all preferences simultaneously', () => {
      const mockUsePreferencesStore = usePreferencesStore as any;
      mockUsePreferencesStore.mockImplementation((selector: any) => {
        const state = {
          density: 'spacious',
          animationLevel: 'reduced',
          reducedMotion: true,
        };
        return selector(state);
      });

      render(<PreferencesManager />);

      const root = document.documentElement;
      expect(root.style.getPropertyValue('--density-padding')).toBe('1.5rem');
      expect(root.style.getPropertyValue('--density-gap')).toBe('1.5rem');
      expect(root.style.getPropertyValue('--density-text-scale')).toBe('1.125');
      expect(root.style.getPropertyValue('--motion-duration-multiplier')).toBe('0.4');
      expect(root.classList.contains('motion-reduced')).toBe(true);
    });

    it('updates all properties when multiple preferences change', () => {
      const mockUsePreferencesStore = usePreferencesStore as any;
      let currentState = {
        density: 'compact',
        animationLevel: 'full',
        reducedMotion: false,
      };

      mockUsePreferencesStore.mockImplementation((selector: any) => {
        return selector(currentState);
      });

      const { rerender } = render(<PreferencesManager />);

      let root = document.documentElement;
      expect(root.style.getPropertyValue('--density-padding')).toBe('0.75rem');
      expect(root.style.getPropertyValue('--motion-duration-multiplier')).toBe('1');

      // Change multiple preferences
      currentState = {
        density: 'spacious',
        animationLevel: 'minimal',
        reducedMotion: true,
      };

      rerender(<PreferencesManager />);

      root = document.documentElement;
      expect(root.style.getPropertyValue('--density-padding')).toBe('1.5rem');
      expect(root.style.getPropertyValue('--motion-duration-multiplier')).toBe('0.1');
      expect(root.classList.contains('motion-reduced')).toBe(true);
    });
  });

  describe('store selector behavior', () => {
    it('uses store selectors correctly for density', () => {
      const mockUsePreferencesStore = usePreferencesStore as any;
      const mockDensitySelector = vi.fn(() => 'comfortable');
      const mockAnimationSelector = vi.fn(() => 'full');
      const mockReducedMotionSelector = vi.fn(() => false);

      mockUsePreferencesStore
        .mockReturnValueOnce(mockDensitySelector())
        .mockReturnValueOnce(mockAnimationSelector())
        .mockReturnValueOnce(mockReducedMotionSelector());

      mockUsePreferencesStore.mockImplementation((selector: any) => {
        const state = {
          density: 'comfortable',
          animationLevel: 'full',
          reducedMotion: false,
        };
        return selector(state);
      });

      render(<PreferencesManager />);

      // Verify the component reads from store
      const root = document.documentElement;
      expect(root.style.getPropertyValue('--density-padding')).toBe('1.25rem');
    });
  });

  describe('edge cases', () => {
    it('handles rapid preference changes', () => {
      const mockUsePreferencesStore = usePreferencesStore as any;
      let currentState = {
        density: 'compact',
        animationLevel: 'full',
        reducedMotion: false,
      };

      mockUsePreferencesStore.mockImplementation((selector: any) => {
        return selector(currentState);
      });

      const { rerender } = render(<PreferencesManager />);

      const densities: Array<'compact' | 'comfortable' | 'spacious'> = [
        'comfortable',
        'spacious',
        'compact',
        'comfortable',
      ];

      for (const density of densities) {
        currentState = {
          density,
          animationLevel: 'full',
          reducedMotion: false,
        };
        rerender(<PreferencesManager />);
      }

      const root = document.documentElement;
      // Final state should be comfortable
      expect(root.style.getPropertyValue('--density-padding')).toBe('1.25rem');
    });

    it('preserves previously set CSS variables not managed by component', () => {
      document.documentElement.style.setProperty('--custom-var', 'custom-value');

      const mockUsePreferencesStore = usePreferencesStore as any;
      mockUsePreferencesStore.mockImplementation((selector: any) => {
        const state = {
          density: 'comfortable',
          animationLevel: 'full',
          reducedMotion: false,
        };
        return selector(state);
      });

      render(<PreferencesManager />);

      const root = document.documentElement;
      expect(root.style.getPropertyValue('--custom-var')).toBe('custom-value');
    });
  });

  describe('useEffect dependency tracking', () => {
    it('re-applies styles when density changes', () => {
      const mockUsePreferencesStore = usePreferencesStore as any;
      let _callCount = 0;
      let currentState = {
        density: 'compact',
        animationLevel: 'full',
        reducedMotion: false,
      };

      const setPropertySpy = vi.spyOn(document.documentElement.style, 'setProperty');

      mockUsePreferencesStore.mockImplementation((selector: any) => {
        _callCount++;
        return selector(currentState);
      });

      const { rerender } = render(<PreferencesManager />);

      const initialCallCount = setPropertySpy.mock.calls.length;

      currentState = {
        density: 'comfortable',
        animationLevel: 'full',
        reducedMotion: false,
      };

      rerender(<PreferencesManager />);

      // Should have made more setProperty calls
      expect(setPropertySpy.mock.calls.length).toBeGreaterThan(initialCallCount);

      setPropertySpy.mockRestore();
    });
  });
});
