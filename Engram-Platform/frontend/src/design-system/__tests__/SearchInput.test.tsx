import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SearchInput } from '../components/SearchInput';

// Mock Tooltip used by Input
vi.mock('../components/Tooltip', () => ({
  Tooltip: ({ children, content }: { children: React.ReactNode; content: string }) => (
    <span title={content}>{children}</span>
  ),
}));

describe('SearchInput', () => {
  it('renders with default placeholder', () => {
    render(<SearchInput />);
    expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument();
  });

  it('renders with custom placeholder', () => {
    render(<SearchInput placeholder="Find items..." />);
    expect(screen.getByPlaceholderText('Find items...')).toBeInTheDocument();
  });

  it('shows clear button when input has value', async () => {
    const user = userEvent.setup();
    render(<SearchInput />);

    await user.type(screen.getByRole('textbox'), 'test');
    expect(screen.getByLabelText('Clear search')).toBeInTheDocument();
  });

  it('hides clear button when input is empty', () => {
    render(<SearchInput />);
    expect(screen.queryByLabelText('Clear search')).not.toBeInTheDocument();
  });

  it('clears input when clear button is clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SearchInput onChange={onChange} />);

    await user.type(screen.getByRole('textbox'), 'test');
    await user.click(screen.getByLabelText('Clear search'));

    expect(screen.getByRole('textbox')).toHaveValue('');
  });

  it('calls onChange on input change', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SearchInput onChange={onChange} />);

    await user.type(screen.getByRole('textbox'), 'a');
    expect(onChange).toHaveBeenCalledWith('a');
  });

  it('debounces onSearch callback', async () => {
    const user = userEvent.setup();
    const onSearch = vi.fn();
    render(<SearchInput onSearch={onSearch} debounceMs={100} />);

    await user.type(screen.getByRole('textbox'), 'test');

    // Wait for debounce to fire
    await waitFor(() => {
      expect(onSearch).toHaveBeenCalledWith('test');
    });
  });

  it('calls onSearch on Enter key', async () => {
    const user = userEvent.setup();
    const onSearch = vi.fn();
    render(<SearchInput onSearch={onSearch} />);

    await user.type(screen.getByRole('textbox'), 'query{enter}');
    expect(onSearch).toHaveBeenCalledWith('query');
  });

  it('uses controlled value', () => {
    render(<SearchInput value="controlled" />);
    expect(screen.getByRole('textbox')).toHaveValue('controlled');
  });

  it('syncs when controlled value changes', () => {
    const { rerender } = render(<SearchInput value="first" />);
    expect(screen.getByRole('textbox')).toHaveValue('first');

    rerender(<SearchInput value="second" />);
    expect(screen.getByRole('textbox')).toHaveValue('second');
  });
});
