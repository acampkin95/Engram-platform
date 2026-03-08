import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MotionProvider } from '../MotionProvider';

vi.mock('framer-motion', () => ({
  domMax: {},
  LazyMotion: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="lazy-motion">{children}</div>
  ),
}));

describe('MotionProvider', () => {
  it('wraps children with LazyMotion', () => {
    render(
      <MotionProvider>
        <div>Animated content</div>
      </MotionProvider>,
    );

    expect(screen.getByTestId('lazy-motion')).toBeInTheDocument();
    expect(screen.getByText('Animated content')).toBeInTheDocument();
  });
});
