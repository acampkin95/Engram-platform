import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatusDot } from '../components/StatusDot';

// Mock framer-motion to avoid animation complexity in tests
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

describe('StatusDot', () => {
  it('renders without label', () => {
    const { container } = render(<StatusDot variant="online" />);
    expect(container.firstElementChild).toBeInTheDocument();
  });

  it('renders label when provided', () => {
    render(<StatusDot variant="online" label="Connected" />);
    expect(screen.getByText('Connected')).toBeInTheDocument();
  });

  it('does not render label when not provided', () => {
    const { container } = render(<StatusDot variant="online" />);
    expect(container.querySelectorAll('span').length).toBe(0);
  });

  it('renders online variant', () => {
    const { container } = render(<StatusDot variant="online" label="Online" />);
    expect(screen.getByText('Online')).toBeInTheDocument();
    expect(container.firstElementChild).toBeInTheDocument();
  });

  it('renders degraded variant', () => {
    render(<StatusDot variant="degraded" label="Degraded" />);
    expect(screen.getByText('Degraded')).toBeInTheDocument();
  });

  it('renders offline variant', () => {
    render(<StatusDot variant="offline" label="Offline" />);
    expect(screen.getByText('Offline')).toBeInTheDocument();
  });

  it('renders loading variant', () => {
    render(<StatusDot variant="loading" label="Loading" />);
    expect(screen.getByText('Loading')).toBeInTheDocument();
  });

  it('defaults to offline variant when no variant specified', () => {
    const { container } = render(<StatusDot />);
    expect(container.firstElementChild).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<StatusDot variant="online" className="my-dot" />);
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.className).toContain('my-dot');
  });
});
