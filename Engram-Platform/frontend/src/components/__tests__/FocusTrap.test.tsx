import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FocusTrap } from '../FocusTrap';

describe('FocusTrap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders children correctly', () => {
      render(
        <FocusTrap>
          <div>Trapped content</div>
        </FocusTrap>,
      );
      expect(screen.getByText('Trapped content')).toBeInTheDocument();
    });

    it('renders with multiple children', () => {
      render(
        <FocusTrap>
          <button>Button 1</button>
          <button>Button 2</button>
        </FocusTrap>,
      );
      expect(screen.getByText('Button 1')).toBeInTheDocument();
      expect(screen.getByText('Button 2')).toBeInTheDocument();
    });
  });

  describe('focus trapping with Tab key', () => {
    it('cycles focus from last button to first button on Tab', async () => {
      const user = userEvent.setup();
      render(
        <FocusTrap>
          <button>First</button>
          <button>Last</button>
        </FocusTrap>,
      );

      const lastButton = screen.getByText('Last');
      await user.click(lastButton);
      expect(lastButton).toHaveFocus();

      await user.tab();

      const firstButton = screen.getByText('First');
      expect(firstButton).toHaveFocus();
    });

    it('cycles focus from first button to last button on Shift+Tab', async () => {
      const user = userEvent.setup();
      render(
        <FocusTrap>
          <button>First</button>
          <button>Last</button>
        </FocusTrap>,
      );

      const firstButton = screen.getByText('First');
      await user.click(firstButton);
      expect(firstButton).toHaveFocus();

      await user.tab({ shift: true });

      const lastButton = screen.getByText('Last');
      expect(lastButton).toHaveFocus();
    });

    it('allows normal Tab navigation through middle elements', async () => {
      const user = userEvent.setup();
      render(
        <FocusTrap>
          <button>First</button>
          <button>Middle</button>
          <button>Last</button>
        </FocusTrap>,
      );

      const firstButton = screen.getByText('First');
      const middleButton = screen.getByText('Middle');

      await user.click(firstButton);
      await user.tab();

      expect(middleButton).toHaveFocus();
    });
  });

  describe('focusable element types', () => {
    it('traps focus with button elements', async () => {
      const user = userEvent.setup();
      render(
        <FocusTrap>
          <button>Button 1</button>
          <button>Button 2</button>
        </FocusTrap>,
      );

      await user.click(screen.getByText('Button 2'));
      await user.tab();
      expect(screen.getByText('Button 1')).toHaveFocus();
    });

    it('traps focus with input elements', async () => {
      const user = userEvent.setup();
      render(
        <FocusTrap>
          <input placeholder="Input 1" />
          <input placeholder="Input 2" />
        </FocusTrap>,
      );

      const input2 = screen.getByPlaceholderText('Input 2');
      await user.click(input2);
      await user.tab();

      expect(screen.getByPlaceholderText('Input 1')).toHaveFocus();
    });

    it('traps focus with textarea elements', async () => {
      const user = userEvent.setup();
      render(
        <FocusTrap>
          <textarea placeholder="Textarea 1" />
          <textarea placeholder="Textarea 2" />
        </FocusTrap>,
      );

      const textarea2 = screen.getByPlaceholderText('Textarea 2');
      await user.click(textarea2);
      await user.tab();

      expect(screen.getByPlaceholderText('Textarea 1')).toHaveFocus();
    });

    it('traps focus with select elements', async () => {
      const user = userEvent.setup();
      render(
        <FocusTrap>
          <select>
            <option>Select 1</option>
          </select>
          <select>
            <option>Select 2</option>
          </select>
        </FocusTrap>,
      );

      const selects = screen.getAllByRole('combobox');
      await user.click(selects[1]);
      await user.tab();

      expect(selects[0]).toHaveFocus();
    });

    it('traps focus with anchor elements', async () => {
      const user = userEvent.setup();
      render(
        <FocusTrap>
          <a href="https://example.com">Link 1</a>
          <a href="https://example.com">Link 2</a>
        </FocusTrap>,
      );

      const link2 = screen.getByText('Link 2');
      await user.click(link2);
      await user.tab();

      expect(screen.getByText('Link 1')).toHaveFocus();
    });

    it('traps focus with tabindex elements', async () => {
      const user = userEvent.setup();
      render(
        <FocusTrap>
          <div tabIndex={0}>Div 1</div>
          <div tabIndex={0}>Div 2</div>
        </FocusTrap>,
      );

      const div2 = screen.getByText('Div 2');
      await user.click(div2);
      await user.tab();

      expect(screen.getByText('Div 1')).toHaveFocus();
    });

    it('ignores elements with tabindex="-1"', async () => {
      const user = userEvent.setup();
      render(
        <FocusTrap>
          <button>Button 1</button>
          <button tabIndex={-1}>Disabled Focus</button>
          <button>Button 2</button>
        </FocusTrap>,
      );

      await user.click(screen.getByText('Button 2'));
      await user.tab();

      expect(screen.getByText('Button 1')).toHaveFocus();
    });
  });

  describe('Escape key handling', () => {
    it('calls onEscape callback when Escape is pressed', async () => {
      const user = userEvent.setup();
      const onEscape = vi.fn();

      render(
        <FocusTrap onEscape={onEscape}>
          <button>Button</button>
        </FocusTrap>,
      );

      await user.keyboard('{Escape}');

      expect(onEscape).toHaveBeenCalledTimes(1);
    });

    it('does not call onEscape if callback is not provided', async () => {
      const user = userEvent.setup();

      render(
        <FocusTrap>
          <button>Button</button>
        </FocusTrap>,
      );

      // Should not throw error
      await user.keyboard('{Escape}');
    });
  });

  describe('active prop', () => {
    it('disables focus trapping when active is false', async () => {
      const user = userEvent.setup();
      const onEscape = vi.fn();

      const { rerender } = render(
        <FocusTrap active={false} onEscape={onEscape}>
          <button>First</button>
          <button>Last</button>
        </FocusTrap>,
      );

      const lastButton = screen.getByText('Last');
      await user.click(lastButton);
      expect(lastButton).toHaveFocus();

      await user.tab();

      // Focus should not cycle when active is false
      expect(onEscape).not.toHaveBeenCalled();
      expect(lastButton).not.toHaveFocus();
    });

    it('enables focus trapping when active changes to true', async () => {
      const user = userEvent.setup();

      const { rerender } = render(
        <FocusTrap active={false}>
          <button>First</button>
          <button>Last</button>
        </FocusTrap>,
      );

      rerender(
        <FocusTrap active={true}>
          <button>First</button>
          <button>Last</button>
        </FocusTrap>,
      );

      const lastButton = screen.getByText('Last');
      await user.click(lastButton);
      await user.tab();

      expect(screen.getByText('First')).toHaveFocus();
    });

    it('defaults to active=true', async () => {
      const user = userEvent.setup();

      render(
        <FocusTrap>
          <button>First</button>
          <button>Last</button>
        </FocusTrap>,
      );

      const lastButton = screen.getByText('Last');
      await user.click(lastButton);
      await user.tab();

      expect(screen.getByText('First')).toHaveFocus();
    });
  });

  describe('edge cases', () => {
    it('handles single focusable element gracefully', async () => {
      const user = userEvent.setup();

      render(
        <FocusTrap>
          <button>Only Button</button>
        </FocusTrap>,
      );

      const button = screen.getByText('Only Button');
      await user.click(button);
      await user.tab();

      expect(button).toHaveFocus();
    });

    it('handles no focusable children gracefully', async () => {
      const user = userEvent.setup();

      render(
        <FocusTrap>
          <div>Non-focusable content</div>
        </FocusTrap>,
      );

      // Should not throw error
      await user.keyboard('{Tab}');
      expect(screen.getByText('Non-focusable content')).toBeInTheDocument();
    });

    it('ignores non-Tab keys', async () => {
      const user = userEvent.setup();

      render(
        <FocusTrap>
          <button>Button 1</button>
          <button>Button 2</button>
        </FocusTrap>,
      );

      const button1 = screen.getByText('Button 1');
      await user.click(button1);

      // Press a non-Tab key
      await user.keyboard('{Enter}');

      // Focus should remain on Button 1
      expect(button1).toHaveFocus();
    });

    it('handles mixed focusable and non-focusable elements', async () => {
      const user = userEvent.setup();

      render(
        <FocusTrap>
          <button>Button 1</button>
          <div>Non-focusable</div>
          <button>Button 2</button>
        </FocusTrap>,
      );

      await user.click(screen.getByText('Button 2'));
      await user.tab();

      expect(screen.getByText('Button 1')).toHaveFocus();
    });
  });

  describe('cleanup', () => {
    it('removes event listener on unmount', async () => {
      const spy = vi.spyOn(document, 'removeEventListener');

      const { unmount } = render(
        <FocusTrap>
          <button>Button</button>
        </FocusTrap>,
      );

      unmount();

      expect(spy).toHaveBeenCalledWith('keydown', expect.any(Function));
      spy.mockRestore();
    });

    it('does not add event listener when active is false', () => {
      const spy = vi.spyOn(document, 'addEventListener');

      render(
        <FocusTrap active={false}>
          <button>Button</button>
        </FocusTrap>,
      );

      expect(spy).not.toHaveBeenCalledWith('keydown', expect.any(Function));
      spy.mockRestore();
    });
  });
});
