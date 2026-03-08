import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EmptyState } from '../components/EmptyState';

describe('EmptyState', () => {
  it('renders title', () => {
    render(<EmptyState title="No items found" />);
    expect(screen.getByText('No items found')).toBeInTheDocument();
  });

  it('renders description when provided', () => {
    render(<EmptyState title="Empty" description="Try adding some items" />);
    expect(screen.getByText('Try adding some items')).toBeInTheDocument();
  });

  it('does not render description when not provided', () => {
    render(<EmptyState title="Empty" />);
    expect(screen.queryByText('Try adding some items')).not.toBeInTheDocument();
  });

  it('renders action when provided', () => {
    render(<EmptyState title="Empty" action={<button type="button">Add Item</button>} />);
    expect(screen.getByRole('button', { name: 'Add Item' })).toBeInTheDocument();
  });

  it('renders custom icon when provided', () => {
    render(<EmptyState title="Empty" icon={<span data-testid="custom-icon">★</span>} />);
    expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
  });

  it('renders default icon when no custom icon provided', () => {
    const { container } = render(<EmptyState title="Empty" />);
    // Default Inbox icon from lucide-react renders as SVG
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('applies variant styles', () => {
    const { container } = render(<EmptyState title="Empty" variant="card" />);
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.className).toContain('bg-');
  });

  it('applies custom className', () => {
    const { container } = render(<EmptyState title="Empty" className="my-custom-class" />);
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.className).toContain('my-custom-class');
  });
});
