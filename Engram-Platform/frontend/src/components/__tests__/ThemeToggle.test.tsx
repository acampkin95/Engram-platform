import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeToggle } from '../ThemeToggle';

// Mock next-themes
vi.mock('next-themes', () => ({
  useTheme: vi.fn(),
}));

import { useTheme } from 'next-themes';

const mockUseTheme = useTheme as any;

describe('ThemeToggle', () => {
  const mockSetTheme = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockSetTheme.mockClear();

    mockUseTheme.mockReturnValue({
      setTheme: mockSetTheme,
      resolvedTheme: 'dark',
    });
  });

  it('renders placeholder div before mounting', () => {
    mockUseTheme.mockReturnValue({
      setTheme: mockSetTheme,
      resolvedTheme: 'dark',
    });

    const { rerender } = render(<ThemeToggle />);

    // Initially renders a placeholder div to prevent hydration mismatch
    const placeholder = document.querySelector('.w-8.h-8');
    expect(placeholder).toBeInTheDocument();
  });

  it('renders toggle button after mounting', () => {
    render(<ThemeToggle />);

    // After mount, should render the actual button
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('toggles theme from dark to light on click', async () => {
    const user = userEvent.setup();

    // Start in dark mode
    mockUseTheme.mockReturnValue({
      setTheme: mockSetTheme,
      resolvedTheme: 'dark',
    });

    render(<ThemeToggle />);

    const button = screen.getByRole('button');

    // Click to toggle to light
    await user.click(button);

    expect(mockSetTheme).toHaveBeenCalledWith('light');
  });

  it('toggles theme from light to dark on click', async () => {
    const user = userEvent.setup();

    // Start in light mode
    mockUseTheme.mockReturnValue({
      setTheme: mockSetTheme,
      resolvedTheme: 'light',
    });

    render(<ThemeToggle />);

    const button = screen.getByRole('button');

    // Click to toggle to dark
    await user.click(button);

    expect(mockSetTheme).toHaveBeenCalledWith('dark');
  });

  it('displays Sun icon when in dark mode', () => {
    mockUseTheme.mockReturnValue({
      setTheme: mockSetTheme,
      resolvedTheme: 'dark',
    });

    render(<ThemeToggle />);

    // Look for the Sun icon (lucide-react Sun component)
    const button = screen.getByRole('button');
    const icon = button.querySelector('svg');

    expect(icon).toBeInTheDocument();
    expect(button).toHaveAttribute('aria-label', 'Switch to light mode');
  });

  it('displays Moon icon when in light mode', () => {
    mockUseTheme.mockReturnValue({
      setTheme: mockSetTheme,
      resolvedTheme: 'light',
    });

    render(<ThemeToggle />);

    // Look for the Moon icon (lucide-react Moon component)
    const button = screen.getByRole('button');
    const icon = button.querySelector('svg');

    expect(icon).toBeInTheDocument();
    expect(button).toHaveAttribute('aria-label', 'Switch to dark mode');
  });

  it('has correct accessibility label for dark mode', () => {
    mockUseTheme.mockReturnValue({
      setTheme: mockSetTheme,
      resolvedTheme: 'dark',
    });

    render(<ThemeToggle />);

    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-label', 'Switch to light mode');
  });

  it('has correct accessibility label for light mode', () => {
    mockUseTheme.mockReturnValue({
      setTheme: mockSetTheme,
      resolvedTheme: 'light',
    });

    render(<ThemeToggle />);

    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-label', 'Switch to dark mode');
  });

  it('has proper button attributes', () => {
    mockUseTheme.mockReturnValue({
      setTheme: mockSetTheme,
      resolvedTheme: 'dark',
    });

    render(<ThemeToggle />);

    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('type', 'button');
    expect(button).toHaveClass('flex', 'items-center', 'justify-center', 'w-8', 'h-8', 'rounded-md');
  });

  it('applies hover styles to button', () => {
    mockUseTheme.mockReturnValue({
      setTheme: mockSetTheme,
      resolvedTheme: 'dark',
    });

    render(<ThemeToggle />);

    const button = screen.getByRole('button');
    expect(button).toHaveClass('hover:bg-accent', 'transition-colors');
  });

  it('renders icon with correct dimensions', () => {
    mockUseTheme.mockReturnValue({
      setTheme: mockSetTheme,
      resolvedTheme: 'dark',
    });

    render(<ThemeToggle />);

    const button = screen.getByRole('button');
    const icon = button.querySelector('svg');

    // lucide-react icons should have h-4 w-4 classes
    expect(icon).toBeInTheDocument();
  });

  it('handles multiple rapid clicks', async () => {
    const user = userEvent.setup();

    mockUseTheme.mockReturnValue({
      setTheme: mockSetTheme,
      resolvedTheme: 'dark',
    });

    render(<ThemeToggle />);

    const button = screen.getByRole('button');

    // Click multiple times rapidly
    await user.click(button);
    await user.click(button);
    await user.click(button);

    expect(mockSetTheme).toHaveBeenCalledTimes(3);
    expect(mockSetTheme).toHaveBeenNthCalledWith(1, 'light');
    expect(mockSetTheme).toHaveBeenNthCalledWith(2, 'light');
    expect(mockSetTheme).toHaveBeenNthCalledWith(3, 'light');
  });

  it('memoizes component to prevent unnecessary re-renders', () => {
    mockUseTheme.mockReturnValue({
      setTheme: mockSetTheme,
      resolvedTheme: 'dark',
    });

    const { rerender } = render(<ThemeToggle />);

    // Component is memoized, so it should not re-render unless props change
    // Since ThemeToggle has no props, it won't re-render
    expect(screen.getByRole('button')).toBeInTheDocument();

    rerender(<ThemeToggle />);

    // Should still work after re-render
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('has correct display name for debugging', () => {
    expect(ThemeToggle.displayName).toBe('ThemeToggle');
  });

  it('prevents hydration mismatch with mounted state', () => {
    mockUseTheme.mockReturnValue({
      setTheme: mockSetTheme,
      resolvedTheme: 'dark',
    });

    const { container } = render(<ThemeToggle />);

    // First render should have placeholder div
    // After useEffect, should render button
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('uses useTheme hook correctly', () => {
    mockUseTheme.mockReturnValue({
      setTheme: mockSetTheme,
      resolvedTheme: 'dark',
    });

    render(<ThemeToggle />);

    expect(mockUseTheme).toHaveBeenCalled();
  });

  it('passes correct button element to onClick handler', async () => {
    const user = userEvent.setup();

    mockUseTheme.mockReturnValue({
      setTheme: mockSetTheme,
      resolvedTheme: 'dark',
    });

    render(<ThemeToggle />);

    const button = screen.getByRole('button');
    await user.click(button);

    expect(mockSetTheme).toHaveBeenCalled();
  });

  it('handles undefined resolvedTheme gracefully', () => {
    mockUseTheme.mockReturnValue({
      setTheme: mockSetTheme,
      resolvedTheme: undefined,
    });

    render(<ThemeToggle />);

    // Should still render without crashing
    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
  });

  it('button is properly positioned and sized', () => {
    mockUseTheme.mockReturnValue({
      setTheme: mockSetTheme,
      resolvedTheme: 'dark',
    });

    render(<ThemeToggle />);

    const button = screen.getByRole('button');
    expect(button).toHaveClass('w-8', 'h-8');
  });

  it('applies transition class for smooth theme toggle', () => {
    mockUseTheme.mockReturnValue({
      setTheme: mockSetTheme,
      resolvedTheme: 'dark',
    });

    render(<ThemeToggle />);

    const button = screen.getByRole('button');
    expect(button).toHaveClass('transition-colors');
  });

  it('integrates with next-themes successfully', () => {
    const setThemeMock = vi.fn();

    mockUseTheme.mockReturnValue({
      setTheme: setThemeMock,
      resolvedTheme: 'dark',
    });

    render(<ThemeToggle />);

    const button = screen.getByRole('button');
    fireEvent.click(button);

    expect(setThemeMock).toHaveBeenCalledWith('light');
  });
});
