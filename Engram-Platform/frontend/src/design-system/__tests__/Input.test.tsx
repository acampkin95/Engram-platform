import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Input } from '../components/Input';

// Mock Tooltip since it uses Radix portal
vi.mock('../components/Tooltip', () => ({
  Tooltip: ({ children, content }: { children: React.ReactNode; content: string }) => (
    <span title={content}>{children}</span>
  ),
}));

describe('Input', () => {
  it('renders a text input', () => {
    render(<Input />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('renders label when provided', () => {
    render(<Input label="Username" />);
    expect(screen.getByText('Username')).toBeInTheDocument();
  });

  it('associates label with input via htmlFor', () => {
    render(<Input label="Email" />);
    const input = screen.getByRole('textbox');
    expect(input.id).toBe('email');
  });

  it('uses custom id when provided', () => {
    render(<Input label="Email" id="custom-id" />);
    const input = screen.getByRole('textbox');
    expect(input.id).toBe('custom-id');
  });

  it('renders error message', () => {
    render(<Input error="Required field" />);
    expect(screen.getByText('Required field')).toBeInTheDocument();
  });

  it('renders help text when no error', () => {
    render(<Input helpText="Enter your email" />);
    expect(screen.getByText('Enter your email')).toBeInTheDocument();
  });

  it('hides help text when error is present', () => {
    render(<Input helpText="Enter your email" error="Required" />);
    expect(screen.queryByText('Enter your email')).not.toBeInTheDocument();
    expect(screen.getByText('Required')).toBeInTheDocument();
  });

  it('renders tooltip icon when tooltip is provided', () => {
    render(<Input label="Password" tooltip="Must be 8+ chars" />);
    expect(screen.getByTitle('Must be 8+ chars')).toBeInTheDocument();
  });

  it('renders prefix icon when provided', () => {
    render(<Input prefixIcon={<span data-testid="prefix-icon">🔍</span>} />);
    expect(screen.getByTestId('prefix-icon')).toBeInTheDocument();
  });

  it('applies mono font class when mono prop is true', () => {
    render(<Input mono />);
    const input = screen.getByRole('textbox');
    expect(input.className).toContain('font-mono');
  });

  it('handles user typing', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Input onChange={onChange} />);

    await user.type(screen.getByRole('textbox'), 'hello');
    expect(onChange).toHaveBeenCalled();
  });

  it('applies custom className', () => {
    render(<Input className="my-input" />);
    const input = screen.getByRole('textbox');
    expect(input.className).toContain('my-input');
  });

  it('forwards ref', () => {
    const ref = { current: null as HTMLInputElement | null };
    render(<Input ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });

  it('passes through HTML attributes', () => {
    render(<Input placeholder="Type here..." disabled />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('placeholder', 'Type here...');
    expect(input).toBeDisabled();
  });
});
