import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ErrorState } from '../components/ErrorState';

describe('ErrorState', () => {
  it('renders default error message', () => {
    render(<ErrorState />);
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('renders custom error message', () => {
    render(<ErrorState message="Network error" />);
    expect(screen.getByText('Network error')).toBeInTheDocument();
  });

  it('renders heading', () => {
    render(<ErrorState />);
    expect(screen.getByText('Error Occurred')).toBeInTheDocument();
  });

  it('renders retry button when onRetry is provided', () => {
    render(<ErrorState onRetry={() => {}} />);
    expect(screen.getByRole('button', { name: 'Try Again' })).toBeInTheDocument();
  });

  it('does not render retry button when onRetry is not provided', () => {
    render(<ErrorState />);
    expect(screen.queryByRole('button', { name: 'Try Again' })).not.toBeInTheDocument();
  });

  it('calls onRetry when retry button is clicked', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(<ErrorState onRetry={onRetry} />);

    await user.click(screen.getByRole('button', { name: 'Try Again' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('applies custom className', () => {
    const { container } = render(<ErrorState className="custom-error" />);
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.className).toContain('custom-error');
  });
});
