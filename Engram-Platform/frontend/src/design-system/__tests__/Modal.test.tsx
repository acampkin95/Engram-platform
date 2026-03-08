import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTrigger,
  Modal,
} from '../components/Modal';

describe('Modal', () => {
  it('renders children when open', () => {
    render(
      <Modal isOpen={true} onClose={() => {}}>
        <p>Modal content</p>
      </Modal>,
    );
    expect(screen.getByText('Modal content')).toBeInTheDocument();
  });

  it('does not render children when closed', () => {
    render(
      <Modal isOpen={false} onClose={() => {}}>
        <p>Modal content</p>
      </Modal>,
    );
    expect(screen.queryByText('Modal content')).not.toBeInTheDocument();
  });

  it('renders title when provided', () => {
    render(
      <Modal isOpen={true} onClose={() => {}} title="My Modal">
        <p>Content</p>
      </Modal>,
    );
    expect(screen.getByText('My Modal')).toBeInTheDocument();
  });

  it('renders close button with sr-only text', () => {
    render(
      <Modal isOpen={true} onClose={() => {}} title="Test">
        <p>Content</p>
      </Modal>,
    );
    expect(screen.getByText('Close')).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Modal isOpen={true} onClose={onClose} title="Test">
        <p>Content</p>
      </Modal>,
    );

    // Click the close button (X icon)
    const closeButton = screen.getByText('Close').closest('button');
    if (closeButton) await user.click(closeButton);
    expect(onClose).toHaveBeenCalled();
  });

  it('does not render title section when title is not provided', () => {
    render(
      <Modal isOpen={true} onClose={() => {}}>
        <p>Content only</p>
      </Modal>,
    );
    expect(screen.queryByText('Close')).not.toBeInTheDocument();
  });
});

describe('Dialog primitive exports', () => {
  it('exports Dialog', () => {
    expect(Dialog).toBeDefined();
  });

  it('exports DialogTrigger', () => {
    expect(DialogTrigger).toBeDefined();
  });

  it('exports DialogContent', () => {
    expect(DialogContent).toBeDefined();
  });

  it('exports DialogHeader', () => {
    expect(DialogHeader).toBeDefined();
  });

  it('exports DialogClose', () => {
    expect(DialogClose).toBeDefined();
  });
});
