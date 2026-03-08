import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let reduceMotion = false;

vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
}));

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="animate-presence">{children}</div>
  ),
  motion: {
    div: ({ children, className }: { children: React.ReactNode; className?: string }) => (
      <div data-testid="motion-div" className={className}>
        {children}
      </div>
    ),
  },
  useReducedMotion: () => reduceMotion,
}));

import { FadeIn, PageTransition, SlideIn } from '../PageTransition';

describe('PageTransition animations', () => {
  beforeEach(() => {
    reduceMotion = false;
  });

  it('renders animated page transition when reduced motion is disabled', () => {
    render(
      <PageTransition className="page-shell" variant="fade">
        <div>Dashboard content</div>
      </PageTransition>,
    );

    expect(screen.getByTestId('animate-presence')).toBeInTheDocument();
    expect(screen.getByTestId('motion-div')).toHaveClass('page-shell');
    expect(screen.getByText('Dashboard content')).toBeInTheDocument();
  });

  it('renders static content when reduced motion is enabled', () => {
    reduceMotion = true;

    render(
      <PageTransition className="static-shell">
        <div>Static content</div>
      </PageTransition>,
    );

    expect(screen.queryByTestId('animate-presence')).not.toBeInTheDocument();
    expect(screen.getByText('Static content')).toBeInTheDocument();
  });

  it('renders FadeIn and SlideIn wrappers', () => {
    render(
      <>
        <FadeIn className="fade-item">Fade item</FadeIn>
        <SlideIn direction="left" className="slide-item">
          Slide item
        </SlideIn>
      </>,
    );

    const wrappers = screen.getAllByTestId('motion-div');
    expect(wrappers).toHaveLength(2);
    expect(screen.getByText('Fade item')).toBeInTheDocument();
    expect(screen.getByText('Slide item')).toBeInTheDocument();
  });

  it('falls back to static wrappers for FadeIn and SlideIn when reduced motion is enabled', () => {
    reduceMotion = true;

    render(
      <>
        <FadeIn className="fade-static">A</FadeIn>
        <SlideIn direction="down" className="slide-static">
          B
        </SlideIn>
      </>,
    );

    expect(screen.queryByTestId('motion-div')).not.toBeInTheDocument();
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument();
  });
});
