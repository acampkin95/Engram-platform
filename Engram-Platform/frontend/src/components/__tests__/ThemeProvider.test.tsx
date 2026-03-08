import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '../ThemeProvider';

// Mock next-themes to avoid SSR issues in tests
vi.mock('next-themes', () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('ThemeProvider', () => {
  it('renders children', () => {
    render(
      <ThemeProvider>
        <div>Themed content</div>
      </ThemeProvider>,
    );
    expect(screen.getByText('Themed content')).toBeInTheDocument();
  });
});
