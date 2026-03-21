import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock @sentry/nextjs to prevent side effects
vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}));

import * as Sentry from '@sentry/nextjs';
import { ErrorBoundary } from '../ErrorBoundary';

// A component that throws on render
function ThrowingChild({ message }: { message: string }): never {
  throw new Error(message);
}

// Suppress React error boundary console.error noise in tests
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('ErrorBoundary', () => {
  it('renders children when no error occurs', () => {
    render(
      <ErrorBoundary>
        <div>Child content</div>
      </ErrorBoundary>,
    );
    expect(screen.getByText('Child content')).toBeInTheDocument();
  });

  it('shows default fallback UI when a child throws', () => {
    render(
      <ErrorBoundary>
        <ThrowingChild message="test crash" />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('Try Again')).toBeInTheDocument();
    expect(screen.getByText('Go to Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Reload Page')).toBeInTheDocument();
  });

  it('renders custom fallback when provided', () => {
    render(
      <ErrorBoundary fallback={<div>Custom error page</div>}>
        <ThrowingChild message="boom" />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Custom error page')).toBeInTheDocument();
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
  });

  it('reports error to Sentry via getDerivedStateFromError', () => {
    vi.mocked(Sentry.captureException).mockClear();
    render(
      <ErrorBoundary>
        <ThrowingChild message="sentry test" />
      </ErrorBoundary>,
    );
    expect(Sentry.captureException).toHaveBeenCalled();
    // Check the last call (React strict mode may double-invoke)
    const calls = vi.mocked(Sentry.captureException).mock.calls;
    const lastError = calls[calls.length - 1][0] as Error;
    expect(lastError).toBeInstanceOf(Error);
    expect(lastError.message).toBe('sentry test');
  });

  it('displays error message in the error details section', () => {
    render(
      <ErrorBoundary>
        <ThrowingChild message="visible error message" />
      </ErrorBoundary>,
    );
    expect(screen.getByText(/visible error message/)).toBeInTheDocument();
  });

  it('resets error state and re-renders children when Try Again is clicked', async () => {
    const user = userEvent.setup();

    let shouldThrow = true;
    function ConditionalThrower() {
      if (shouldThrow) throw new Error('temporary');
      return <div>Recovered content</div>;
    }

    render(
      <ErrorBoundary>
        <ConditionalThrower />
      </ErrorBoundary>,
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();

    // Fix the child before clicking reset
    shouldThrow = false;
    await user.click(screen.getByText('Try Again'));

    expect(screen.getByText('Recovered content')).toBeInTheDocument();
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
  });

  it('does not render alert role when children render successfully', () => {
    render(
      <ErrorBoundary>
        <div>No error here</div>
      </ErrorBoundary>,
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
