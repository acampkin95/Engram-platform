import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SidebarGroup } from '../components/SidebarGroup';

// Mock framer-motion
vi.mock('framer-motion', () => ({
  m: {
    div: ({
      children,
      layoutId,
      initial,
      transition,
      animate,
      exit,
      variants,
      style,
      ...props
    }: Record<string, unknown>) => (
      <div style={style as React.CSSProperties} {...props}>
        {children as React.ReactNode}
      </div>
    ),
    span: ({
      children,
      layoutId,
      initial,
      transition,
      animate,
      exit,
      variants,
      style,
      ...props
    }: Record<string, unknown>) => (
      <span style={style as React.CSSProperties} {...props}>
        {children as React.ReactNode}
      </span>
    ),
  },
  AnimatePresence: ({ children }: Record<string, unknown>) => <>{children as React.ReactNode}</>,
  LazyMotion: ({ children }: Record<string, unknown>) => children,
  domAnimation: {},
}));

describe('SidebarGroup', () => {
  it('renders label', () => {
    render(
      <SidebarGroup label="Navigation">
        <div>Item 1</div>
      </SidebarGroup>,
    );
    expect(screen.getByText('Navigation')).toBeInTheDocument();
  });

  it('renders children when defaultOpen is true', () => {
    render(
      <SidebarGroup label="Nav" defaultOpen={true}>
        <div>Child content</div>
      </SidebarGroup>,
    );
    expect(screen.getByText('Child content')).toBeInTheDocument();
  });

  it('is open by default', () => {
    render(
      <SidebarGroup label="Nav">
        <div>Visible</div>
      </SidebarGroup>,
    );
    expect(screen.getByText('Visible')).toBeInTheDocument();
  });

  it('toggles children visibility on click', async () => {
    const user = userEvent.setup();
    render(
      <SidebarGroup label="Nav">
        <div>Content</div>
      </SidebarGroup>,
    );

    // Initially visible
    expect(screen.getByText('Content')).toBeInTheDocument();

    // Click to collapse
    await user.click(screen.getByRole('button', { name: /nav/i }));
    expect(screen.queryByText('Content')).not.toBeInTheDocument();

    // Click to expand
    await user.click(screen.getByRole('button', { name: /nav/i }));
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('starts collapsed when defaultOpen is false', () => {
    render(
      <SidebarGroup label="Nav" defaultOpen={false}>
        <div>Hidden content</div>
      </SidebarGroup>,
    );
    expect(screen.queryByText('Hidden content')).not.toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <SidebarGroup label="Nav" className="my-group">
        <div>Content</div>
      </SidebarGroup>,
    );
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.className).toContain('my-group');
  });
});
