import { render, screen } from '@testing-library/react';
import { Badge } from '@/src/design-system/components/Badge';

describe('Badge', () => {
  it('renders children text', () => {
    render(<Badge>Success</Badge>);
    expect(screen.getByText('Success')).toBeInTheDocument();
  });

  it('renders dot when dot prop is true', () => {
    render(<Badge dot>With dot</Badge>);
    const dot = screen.getByTestId('badge-dot');
    expect(dot).toBeInTheDocument();
    expect(dot).toHaveClass('w-1.5', 'h-1.5', 'rounded-full');
  });

  it('does not render dot when dot prop is false', () => {
    const { container } = render(<Badge dot={false}>No dot</Badge>);
    const spans = container.querySelectorAll('span');
    // Only the outer span should exist, not the dot span
    expect(spans.length).toBe(1);
  });

  it('renders all supported variants without throwing', () => {
    const variants = [
      'success',
      'warning',
      'error',
      'info',
      'neutral',
      'crawler',
      'memory',
    ] as const;
    for (const variant of variants) {
      const { unmount } = render(<Badge variant={variant}>{variant}</Badge>);
      expect(screen.getByText(variant)).toBeInTheDocument();
      unmount();
    }
  });

  it('renders dot with correct size classes', () => {
    render(
      <Badge variant="success" dot>
        Success
      </Badge>,
    );
    const dot = screen.getByTestId('badge-dot');
    expect(dot).toBeInTheDocument();
    expect(dot).toHaveClass('w-1.5', 'h-1.5', 'rounded-full');
  });
});
