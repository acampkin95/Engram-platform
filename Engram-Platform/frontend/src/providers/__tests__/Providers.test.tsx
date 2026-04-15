import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Providers } from '../Providers';

const swrConfigSpy = vi.fn();
const captureExceptionSpy = vi.fn();

vi.mock('swr', () => ({
  SWRConfig: ({ children, value }: { children: React.ReactNode; value: unknown }) => {
    swrConfigSpy(value);
    return <>{children}</>;
  },
}));

vi.mock('nuqs/adapters/next/app', () => ({
  NuqsAdapter: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="nuqs-adapter">{children}</div>
  ),
}));

vi.mock('@sentry/nextjs', () => ({
  captureException: (...args: unknown[]) => captureExceptionSpy(...args),
}));

vi.mock('@/src/design-system/components/Toast', () => ({
  ToastContainer: () => <div data-testid="toast-container" />,
}));

describe('Providers', () => {
  beforeEach(() => {
    swrConfigSpy.mockReset();
    captureExceptionSpy.mockReset();
  });

  it('renders children', () => {
    render(
      <Providers>
        <div>App Content</div>
      </Providers>,
    );
    expect(screen.getByText('App Content')).toBeInTheDocument();
  });

  it('renders ToastContainer', () => {
    render(
      <Providers>
        <div>Content</div>
      </Providers>,
    );
    expect(screen.getByTestId('toast-container')).toBeInTheDocument();
  });

  it('wraps children with the URL state adapter', () => {
    render(
      <Providers>
        <div>URL State Content</div>
      </Providers>,
    );
    expect(screen.getByTestId('nuqs-adapter')).toBeInTheDocument();
  });

  it('captures SWR errors through Sentry', () => {
    render(
      <Providers>
        <div>Content</div>
      </Providers>,
    );

    const swrValue = swrConfigSpy.mock.calls[0]?.[0] as { onError?: (error: Error) => void };
    const error = new Error('network failure');
    swrValue.onError?.(error);

    expect(captureExceptionSpy).toHaveBeenCalledWith(error, {
      tags: { area: 'swr' },
    });
  });
});
