import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SectionHeader } from '../components/SectionHeader';

describe('SectionHeader', () => {
  it('renders title', () => {
    render(<SectionHeader title="Dashboard" />);
    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
  });

  it('renders breadcrumb when provided', () => {
    render(<SectionHeader title="Details" breadcrumb={['Home', 'Settings']} />);
    expect(screen.getByText('Home / Settings')).toBeInTheDocument();
  });

  it('does not render breadcrumb when not provided', () => {
    const { container } = render(<SectionHeader title="Dashboard" />);
    const breadcrumb = container.querySelector('p');
    expect(breadcrumb).not.toBeInTheDocument();
  });

  it('does not render breadcrumb when array is empty', () => {
    const { container } = render(<SectionHeader title="Dashboard" breadcrumb={[]} />);
    const breadcrumb = container.querySelector('p');
    expect(breadcrumb).not.toBeInTheDocument();
  });

  it('renders action when provided', () => {
    render(<SectionHeader title="Test" action={<button type="button">Add New</button>} />);
    expect(screen.getByRole('button', { name: 'Add New' })).toBeInTheDocument();
  });

  it('does not render action when not provided', () => {
    render(<SectionHeader title="Test" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<SectionHeader title="Test" className="my-header" />);
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.className).toContain('my-header');
  });
});
