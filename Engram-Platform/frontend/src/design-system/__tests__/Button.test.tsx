import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from '@/src/design-system/components/Button';

describe('Button', () => {
  it('renders children text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('calls onClick handler when clicked', async () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click me</Button>);

    const button = screen.getByRole('button', { name: /click me/i });
    await userEvent.click(button);

    expect(handleClick).toHaveBeenCalledOnce();
  });

  it('disables button and shows spinner when loading=true', () => {
    render(<Button loading>Save</Button>);
    const btn = screen.getByRole('button', { name: /save/i });
    expect(btn).toBeDisabled();
    // Loader2 renders as an SVG inside the button
    expect(btn.querySelector('svg')).toBeInTheDocument();
  });

  it('does not fire onClick when disabled', async () => {
    const fn = vi.fn();
    render(
      <Button disabled onClick={fn}>
        Click
      </Button>,
    );
    await userEvent.click(screen.getByRole('button', { name: /click/i }));
    expect(fn).not.toHaveBeenCalled();
  });
});
