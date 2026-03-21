import { act, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BRAND_COLORS, BrandPalette } from '@/src/components/BrandPalette';

// ─── Clipboard mock ────────────────────────────────────────────────────────────

const writeText = vi.fn();

beforeEach(() => {
  writeText.mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    writable: true,
    configurable: true,
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

/** Helper: click a button and flush the clipboard promise resolution. */
async function clickAndFlush(btn: HTMLElement) {
  await act(async () => {
    fireEvent.click(btn);
    // flush the resolved clipboard promise microtask
    await Promise.resolve();
  });
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('BrandPalette', () => {
  it('renders with role=list and accessible label', () => {
    render(<BrandPalette />);
    expect(screen.getByRole('list', { name: 'Brand color palette' })).toBeDefined();
  });

  it('renders all brand colors as list items', () => {
    render(<BrandPalette />);
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(BRAND_COLORS.length);
  });

  it('renders a color swatch for every brand color', () => {
    render(<BrandPalette />);
    for (const color of BRAND_COLORS) {
      const slug = color.name.toLowerCase().replace(/\s+/g, '-');
      const swatch = screen.getByTestId(`color-swatch-${slug}`);
      expect(swatch).toBeDefined();
      expect(swatch.getAttribute('data-color')).toBe(color.hex);
    }
  });

  it('renders a copy button for each color with an accessible label', () => {
    render(<BrandPalette />);
    for (const color of BRAND_COLORS) {
      const btn = screen.getByRole('button', { name: `Copy ${color.name} color ${color.hex}` });
      expect(btn).toBeDefined();
    }
  });

  it('renders each color name and role label', () => {
    render(<BrandPalette />);
    for (const color of BRAND_COLORS) {
      expect(screen.getByText(color.name)).toBeDefined();
      expect(screen.getByText(color.role)).toBeDefined();
    }
  });

  it('shows hex value in button by default', () => {
    render(<BrandPalette />);
    const amber = BRAND_COLORS.find((c) => c.name === 'Amber')!;
    expect(screen.getByText(amber.hex)).toBeDefined();
  });

  it('calls clipboard.writeText with the hex value when a color is clicked', async () => {
    render(<BrandPalette />);
    const amber = BRAND_COLORS.find((c) => c.name === 'Amber')!;
    const btn = screen.getByRole('button', { name: `Copy ${amber.name} color ${amber.hex}` });

    await clickAndFlush(btn);

    expect(writeText).toHaveBeenCalledWith(amber.hex);
  });

  it('shows "Copied!" after clicking a color button', async () => {
    render(<BrandPalette />);
    const amber = BRAND_COLORS.find((c) => c.name === 'Amber')!;
    const btn = screen.getByRole('button', { name: `Copy ${amber.name} color ${amber.hex}` });

    await clickAndFlush(btn);

    expect(screen.getByText('Copied!')).toBeDefined();
  });

  it('restores hex value after 2 seconds', async () => {
    vi.useFakeTimers();
    render(<BrandPalette />);
    const amber = BRAND_COLORS.find((c) => c.name === 'Amber')!;
    const btn = screen.getByRole('button', { name: `Copy ${amber.name} color ${amber.hex}` });

    await act(async () => {
      fireEvent.click(btn);
      await Promise.resolve();
    });

    expect(screen.getByText('Copied!')).toBeDefined();

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    expect(screen.getByText(amber.hex)).toBeDefined();
    vi.useRealTimers();
  });

  it('shows "Copied!" only on the clicked color, not others', async () => {
    render(<BrandPalette />);
    const amber = BRAND_COLORS.find((c) => c.name === 'Amber')!;
    const violet = BRAND_COLORS.find((c) => c.name === 'Violet')!;

    const amberBtn = screen.getByRole('button', {
      name: `Copy ${amber.name} color ${amber.hex}`,
    });

    await clickAndFlush(amberBtn);

    expect(screen.getByText('Copied!')).toBeDefined();
    // Violet hex should still show (not "Copied!")
    expect(screen.getByText(violet.hex)).toBeDefined();
  });

  it('applies a custom className to the root element', () => {
    const { container } = render(<BrandPalette className="custom-class" />);
    expect((container.firstChild as HTMLElement)?.className).toContain('custom-class');
  });

  it('renders color swatches with the correct background color', () => {
    render(<BrandPalette />);
    for (const color of BRAND_COLORS) {
      const slug = color.name.toLowerCase().replace(/\s+/g, '-');
      const swatch = screen.getByTestId(`color-swatch-${slug}`);
      expect(swatch.getAttribute('data-color')).toBe(color.hex);
    }
  });

  it('includes aria-live="polite" on the hex/copied text for screen readers', () => {
    render(<BrandPalette />);
    // Each button has an aria-live polite span for the hex/copied feedback
    const liveRegions = document.querySelectorAll('[aria-live="polite"]');
    expect(liveRegions.length).toBe(BRAND_COLORS.length);
  });

  it('each color swatch has aria-hidden so screen readers skip decorative element', () => {
    render(<BrandPalette />);
    for (const color of BRAND_COLORS) {
      const slug = color.name.toLowerCase().replace(/\s+/g, '-');
      const swatch = screen.getByTestId(`color-swatch-${slug}`);
      expect(swatch.getAttribute('aria-hidden')).toBe('true');
    }
  });

  it('renders all 4 primary brand colors', () => {
    render(<BrandPalette />);
    const primaryColors = BRAND_COLORS.filter((c) => c.group === 'primary');
    expect(primaryColors).toHaveLength(4);
    for (const color of primaryColors) {
      expect(screen.getByText(color.name)).toBeDefined();
    }
  });

  it('renders neutral colors including background and panel', () => {
    render(<BrandPalette />);
    expect(screen.getByText('Deep Void')).toBeDefined();
    expect(screen.getByText('Panel')).toBeDefined();
  });

  it('renders semantic error color', () => {
    render(<BrandPalette />);
    expect(screen.getByText('Error')).toBeDefined();
    expect(screen.getByText('Destructive')).toBeDefined();
  });

  it('button title attribute shows "Copied!" after copy', async () => {
    render(<BrandPalette />);
    const amber = BRAND_COLORS.find((c) => c.name === 'Amber')!;
    const btn = screen.getByRole('button', { name: `Copy ${amber.name} color ${amber.hex}` });

    expect(btn.getAttribute('title')).toContain(amber.hex);

    await clickAndFlush(btn);

    expect(btn.getAttribute('title')).toBe('Copied!');
  });
});
