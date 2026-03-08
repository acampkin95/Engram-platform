import * as ToastPrimitive from '@radix-ui/react-toast';
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ToastItem } from '../components/Toast';
import { addToast, Toast, ToastContainer } from '../components/Toast';

describe('Toast', () => {
  const successToast: ToastItem = {
    id: 'toast-1',
    type: 'success',
    message: 'Operation successful',
  };

  const errorToast: ToastItem = {
    id: 'toast-2',
    type: 'error',
    message: 'Something failed',
  };

  const warningToast: ToastItem = {
    id: 'toast-3',
    type: 'warning',
    message: 'Be careful',
  };

  const infoToast: ToastItem = {
    id: 'toast-4',
    type: 'info',
    message: 'FYI info',
  };

  // Wrap Toast in required Radix provider
  const renderToast = (toast: ToastItem, onDismiss = vi.fn()) => {
    return render(
      <ToastPrimitive.Provider>
        <Toast toast={toast} onDismiss={onDismiss} />
        <ToastPrimitive.Viewport />
      </ToastPrimitive.Provider>,
    );
  };

  it('renders success toast message', () => {
    renderToast(successToast);
    expect(screen.getByText('Operation successful')).toBeInTheDocument();
  });

  it('renders error toast message', () => {
    renderToast(errorToast);
    expect(screen.getByText('Something failed')).toBeInTheDocument();
  });

  it('renders warning toast message', () => {
    renderToast(warningToast);
    expect(screen.getByText('Be careful')).toBeInTheDocument();
  });

  it('renders info toast message', () => {
    renderToast(infoToast);
    expect(screen.getByText('FYI info')).toBeInTheDocument();
  });

  it('renders close button with sr-only text', () => {
    renderToast(successToast);
    expect(screen.getByText('Close')).toBeInTheDocument();
  });
});

describe('ToastContainer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders without toasts initially', () => {
    const { container } = render(<ToastContainer />);
    expect(container).toBeInTheDocument();
  });
});

describe('addToast', () => {
  it('is a function', () => {
    expect(typeof addToast).toBe('function');
  });

  it('can be called without error', () => {
    expect(() => addToast({ type: 'success', message: 'Test' })).not.toThrow();
  });
});
