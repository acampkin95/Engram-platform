import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Providers } from '../Providers';

// Mock Clerk
vi.mock('@clerk/nextjs', () => ({
  ClerkProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="clerk-provider">{children}</div>
  ),
}));

// Mock SWR
vi.mock('swr', () => ({
  SWRConfig: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock Toast
vi.mock('@/src/design-system/components/Toast', () => ({
  ToastContainer: () => <div data-testid="toast-container" />,
}));

describe('Providers', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('renders children', () => {
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_123';
    render(
      <Providers>
        <div>App Content</div>
      </Providers>,
    );
    expect(screen.getByText('App Content')).toBeInTheDocument();
  });

  it('renders ToastContainer', () => {
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_123';
    render(
      <Providers>
        <div>Content</div>
      </Providers>,
    );
    expect(screen.getByTestId('toast-container')).toBeInTheDocument();
  });
});
