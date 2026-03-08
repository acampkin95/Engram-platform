import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Spinner } from '../components/Spinner';

describe('Spinner', () => {
  it('renders with progressbar role', () => {
    render(<Spinner />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('has accessible label', () => {
    render(<Spinner />);
    expect(screen.getByLabelText('Loading')).toBeInTheDocument();
  });

  it('renders with default md size', () => {
    render(<Spinner />);
    const spinner = screen.getByRole('progressbar');
    expect(spinner.className).toContain('w-5');
    expect(spinner.className).toContain('h-5');
  });

  it('renders with xs size', () => {
    render(<Spinner size="xs" />);
    const spinner = screen.getByRole('progressbar');
    expect(spinner.className).toContain('w-3');
    expect(spinner.className).toContain('h-3');
  });

  it('renders with sm size', () => {
    render(<Spinner size="sm" />);
    const spinner = screen.getByRole('progressbar');
    expect(spinner.className).toContain('w-4');
  });

  it('renders with lg size', () => {
    render(<Spinner size="lg" />);
    const spinner = screen.getByRole('progressbar');
    expect(spinner.className).toContain('w-8');
  });

  it('applies custom color via style', () => {
    render(<Spinner color="red" />);
    const spinner = screen.getByRole('progressbar');
    expect(spinner.style.borderTopColor).toBe('red');
    expect(spinner.style.borderRightColor).toBe('red');
  });

  it('applies custom className', () => {
    render(<Spinner className="my-spinner" />);
    const spinner = screen.getByRole('progressbar');
    expect(spinner.className).toContain('my-spinner');
  });
});
