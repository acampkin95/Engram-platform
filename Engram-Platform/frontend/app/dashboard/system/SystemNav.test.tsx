import { render, screen } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import SystemNav from './SystemNav';

const { usePathnameMock } = vi.hoisted(() => ({
  usePathnameMock: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  usePathname: usePathnameMock,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

test('renders both nav tabs', () => {
  usePathnameMock.mockReturnValue('/dashboard/system/health');

  render(<SystemNav />);

  expect(screen.getByText('System Health')).toBeInTheDocument();
  expect(screen.getByText('Notification Settings')).toBeInTheDocument();
});

test('highlights System Health tab when on /dashboard/system/health', () => {
  usePathnameMock.mockReturnValue('/dashboard/system/health');

  render(<SystemNav />);

  const systemHealthLink = screen.getByRole('link', { name: /System Health/i });
  expect(systemHealthLink).toHaveClass('border-[#f2a93b]');
  expect(systemHealthLink).toHaveClass('text-[#f0eef8]');
});

test('highlights Notification Settings tab when on /dashboard/system/settings', () => {
  usePathnameMock.mockReturnValue('/dashboard/system/settings');

  render(<SystemNav />);

  const notificationLink = screen.getByRole('link', { name: /Notification Settings/i });
  expect(notificationLink).toHaveClass('border-[#f2a93b]');
  expect(notificationLink).toHaveClass('text-[#f0eef8]');
});

test('does not highlight other tabs when not on active path', () => {
  usePathnameMock.mockReturnValue('/dashboard/system/health');

  render(<SystemNav />);

  const notificationLink = screen.getByRole('link', { name: /Notification Settings/i });
  expect(notificationLink).toHaveClass('border-transparent');
  expect(notificationLink).toHaveClass('text-[#a09bb8]');
});

test('renders correct hrefs for both tabs', () => {
  usePathnameMock.mockReturnValue('/dashboard/system');

  render(<SystemNav />);

  const systemHealthLink = screen.getByRole('link', { name: /System Health/i });
  const notificationLink = screen.getByRole('link', { name: /Notification Settings/i });

  expect(systemHealthLink).toHaveAttribute('href', '/dashboard/system/health');
  expect(notificationLink).toHaveAttribute('href', '/dashboard/system/settings');
});

test('renders Activity icon for System Health tab', () => {
  usePathnameMock.mockReturnValue('/dashboard/system/health');

  const { container } = render(<SystemNav />);

  const systemHealthLink = screen.getByRole('link', { name: /System Health/i });

  const svg = systemHealthLink.querySelector('svg');
  expect(svg).toBeInTheDocument();
});

test('renders Bell icon for Notification Settings tab', () => {
  usePathnameMock.mockReturnValue('/dashboard/system/health');

  const { container } = render(<SystemNav />);

  const notificationLink = screen.getByRole('link', { name: /Notification Settings/i });

  const svg = notificationLink.querySelector('svg');
  expect(svg).toBeInTheDocument();
});

test('applies hover styles to inactive tabs', () => {
  usePathnameMock.mockReturnValue('/dashboard/system/health');

  render(<SystemNav />);

  const notificationLink = screen.getByRole('link', { name: /Notification Settings/i });
  expect(notificationLink).toHaveClass('hover:text-[#f0eef8]');
});
