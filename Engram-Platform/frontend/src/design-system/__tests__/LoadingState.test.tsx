import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LoadingState } from '../components/LoadingState';

describe('LoadingState', () => {
  it('renders spinner variant by default', () => {
    render(<LoadingState />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('renders label when provided with spinner variant', () => {
    render(<LoadingState label="Loading data..." />);
    expect(screen.getByText('Loading data...')).toBeInTheDocument();
  });

  it('does not render label when not provided', () => {
    render(<LoadingState />);
    expect(screen.queryByText('Loading data...')).not.toBeInTheDocument();
  });

  it('renders skeleton variant with default 3 rows', () => {
    const { container } = render(<LoadingState variant="skeleton" />);
    const rows = container.querySelectorAll('.animate-pulse');
    expect(rows.length).toBe(3);
  });

  it('renders skeleton variant with custom row count', () => {
    const { container } = render(<LoadingState variant="skeleton" rows={5} />);
    const rows = container.querySelectorAll('.animate-pulse');
    expect(rows.length).toBe(5);
  });

  it('skeleton rows have varying widths', () => {
    const { container } = render(<LoadingState variant="skeleton" rows={3} />);
    const rows = container.querySelectorAll('.animate-pulse');
    // Row 0: w-full, Row 1: w-3/4, Row 2: w-1/2
    expect(rows[0].className).toContain('w-full');
    expect(rows[1].className).toContain('w-3/4');
    expect(rows[2].className).toContain('w-1/2');
  });

  it('applies custom className to spinner variant', () => {
    const { container } = render(<LoadingState className="my-loader" />);
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.className).toContain('my-loader');
  });

  it('applies custom className to skeleton variant', () => {
    const { container } = render(<LoadingState variant="skeleton" className="my-skeleton" />);
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.className).toContain('my-skeleton');
  });
});
