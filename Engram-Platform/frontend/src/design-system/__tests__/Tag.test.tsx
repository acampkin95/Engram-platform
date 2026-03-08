import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Tag } from '../components/Tag';

describe('Tag', () => {
  it('renders label text', () => {
    render(<Tag label="JavaScript" />);
    expect(screen.getByText('JavaScript')).toBeInTheDocument();
  });

  it('renders remove button when onRemove is provided', () => {
    render(<Tag label="React" onRemove={() => {}} />);
    expect(screen.getByRole('button', { name: 'Remove React tag' })).toBeInTheDocument();
  });

  it('does not render remove button when onRemove is not provided', () => {
    render(<Tag label="React" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('calls onRemove when remove button is clicked', async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    render(<Tag label="React" onRemove={onRemove} />);

    await user.click(screen.getByRole('button', { name: 'Remove React tag' }));
    expect(onRemove).toHaveBeenCalledOnce();
  });

  it('renders with default variant', () => {
    const { container } = render(<Tag label="Default" />);
    expect(container.firstElementChild).toBeInTheDocument();
  });

  it('renders with active variant', () => {
    const { container } = render(<Tag label="Active" variant="active" />);
    expect(container.firstElementChild).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<Tag label="Custom" className="my-tag" />);
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.className).toContain('my-tag');
  });
});
