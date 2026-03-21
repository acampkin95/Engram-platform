import { render, screen } from '@testing-library/react';
import { test, vi } from 'vitest';
import { DashboardClient } from './DashboardClient';

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock Next.js routing hooks
vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/dashboard'),
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
  })),
}));

vi.mock('@/src/hooks/useHealthPolling', () => ({
  useHealthPolling: vi.fn().mockReturnValue({
    memoryHealth: 'healthy',
    crawlerHealth: 'healthy',
    memoryError: null,
    crawlerError: null,
    isInitialLoading: false,
  }),
}));

test('renders DashboardClient without crashing', async () => {
  render(
    <DashboardClient>
      <div data-testid="dashboard-content">Dashboard Content</div>
    </DashboardClient>,
  );

  await screen.findByTestId('dashboard-content');
});
