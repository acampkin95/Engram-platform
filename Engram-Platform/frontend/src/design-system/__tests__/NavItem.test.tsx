import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { NavItem } from '../components/NavItem';

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children as React.ReactNode}
    </a>
  ),
}));

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

function TestIcon({ className }: { className?: string }) {
  return <svg className={className} data-testid="test-icon" />;
}

describe('NavItem', () => {
  it('renders label text', () => {
    render(<NavItem href="/test" label="Dashboard" icon={TestIcon} isActive={false} />);
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('renders link with correct href', () => {
    render(<NavItem href="/dashboard" label="Dashboard" icon={TestIcon} isActive={false} />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/dashboard');
  });

  it('renders icon', () => {
    render(<NavItem href="/test" label="Test" icon={TestIcon} isActive={false} />);
    expect(screen.getByTestId('test-icon')).toBeInTheDocument();
  });

  it('hides label when collapsed', () => {
    render(
      <NavItem href="/test" label="Dashboard" icon={TestIcon} isActive={false} collapsed={true} />,
    );
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
  });

  it('shows label when not collapsed', () => {
    render(
      <NavItem href="/test" label="Dashboard" icon={TestIcon} isActive={false} collapsed={false} />,
    );
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('adds title attribute when collapsed', () => {
    render(
      <NavItem href="/test" label="Dashboard" icon={TestIcon} isActive={false} collapsed={true} />,
    );
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('title', 'Dashboard');
  });

  it('does not add title when not collapsed', () => {
    render(
      <NavItem href="/test" label="Dashboard" icon={TestIcon} isActive={false} collapsed={false} />,
    );
    const link = screen.getByRole('link');
    expect(link).not.toHaveAttribute('title');
  });

  it('renders with active state', () => {
    const { container } = render(
      <NavItem href="/test" label="Active" icon={TestIcon} isActive={true} section="crawler" />,
    );
    expect(container.firstElementChild).toBeInTheDocument();
  });

  it('renders with different section colors', () => {
    const { container: c1 } = render(
      <NavItem href="/a" label="A" icon={TestIcon} isActive={true} section="crawler" />,
    );
    const { container: c2 } = render(
      <NavItem href="/b" label="B" icon={TestIcon} isActive={true} section="memory" />,
    );
    const { container: c3 } = render(
      <NavItem href="/c" label="C" icon={TestIcon} isActive={true} section="intelligence" />,
    );

    expect(c1.firstElementChild).toBeInTheDocument();
    expect(c2.firstElementChild).toBeInTheDocument();
    expect(c3.firstElementChild).toBeInTheDocument();
  });
});
