import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, test, vi } from 'vitest';
import NotificationSettings from './NotificationSettings';

const { getNotificationSettingsMock, testNotificationChannelMock } = vi.hoisted(() => ({
  getNotificationSettingsMock: vi.fn(),
  testNotificationChannelMock: vi.fn(),
}));

vi.mock('@/src/lib/system-client', () => ({
  systemClient: {
    getNotificationSettings: getNotificationSettingsMock,
    testNotificationChannel: testNotificationChannelMock,
  },
}));

vi.mock('@/src/design-system/components/Toast', () => ({
  addToast: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

test('renders loading state initially', async () => {
  getNotificationSettingsMock.mockImplementation(
    () =>
      new Promise((resolve) => {
        setTimeout(
          () =>
            resolve({
              data: {
                resend: { configured: true, from: 'noreply@example.com' },
                ntfy: { configured: true, topicUrl: 'https://ntfy.sh/topic', authenticated: true },
              },
              error: null,
            }),
          100,
        );
      }),
  );

  render(<NotificationSettings />);

  expect(screen.getByText('Notification Settings')).toBeInTheDocument();
});

test('renders configured channels when both configured', async () => {
  getNotificationSettingsMock.mockResolvedValue({
    data: {
      resend: { configured: true, from: 'noreply@example.com' },
      ntfy: { configured: true, topicUrl: 'https://ntfy.sh/topic', authenticated: true },
    },
    error: null,
  });

  render(<NotificationSettings />);

  await waitFor(() => {
    expect(screen.getByText('Resend Email')).toBeInTheDocument();
    expect(screen.getByText('ntfy.sh Push')).toBeInTheDocument();
  });

  await waitFor(() => {
    const configuredBadges = screen.getAllByText('Configured');
    expect(configuredBadges.length).toBeGreaterThanOrEqual(2);
  });

  expect(screen.getByText('noreply@example.com')).toBeInTheDocument();
  expect(screen.getByText('https://ntfy.sh/topic')).toBeInTheDocument();
});

test('renders unconfigured state when channels not set up', async () => {
  getNotificationSettingsMock.mockResolvedValue({
    data: {
      resend: { configured: false, from: null },
      ntfy: { configured: false, topicUrl: null, authenticated: false },
    },
    error: null,
  });

  render(<NotificationSettings />);

  await waitFor(() => {
    const notConfiguredBadges = screen.getAllByText('Not configured');
    expect(notConfiguredBadges.length).toBeGreaterThanOrEqual(2);
  });

  expect(screen.getByText(/RESEND_API_KEY/)).toBeInTheDocument();
  expect(screen.getByText(/NTFY_TOPIC_URL/)).toBeInTheDocument();
});

test('calls testNotificationChannel("email") when test email button clicked', async () => {
  const user = userEvent.setup();
  getNotificationSettingsMock.mockResolvedValue({
    data: {
      resend: { configured: true, from: 'noreply@example.com' },
      ntfy: { configured: true, topicUrl: 'https://ntfy.sh/topic', authenticated: true },
    },
    error: null,
  });

  testNotificationChannelMock.mockResolvedValue({
    data: { email: { success: true } },
    error: null,
  });

  render(<NotificationSettings />);

  await waitFor(() => {
    expect(screen.getByText('Send Test Email')).toBeInTheDocument();
  });

  const testEmailButton = screen.getByRole('button', { name: /Send Test Email/i });
  await user.click(testEmailButton);

  await waitFor(() => {
    expect(testNotificationChannelMock).toHaveBeenCalledWith('email');
  });
});

test('calls testNotificationChannel("ntfy") when test push button clicked', async () => {
  const user = userEvent.setup();
  getNotificationSettingsMock.mockResolvedValue({
    data: {
      resend: { configured: true, from: 'noreply@example.com' },
      ntfy: { configured: true, topicUrl: 'https://ntfy.sh/topic', authenticated: true },
    },
    error: null,
  });

  testNotificationChannelMock.mockResolvedValue({
    data: { ntfy: { success: true } },
    error: null,
  });

  render(<NotificationSettings />);

  await waitFor(() => {
    expect(screen.getByText('Send Test Push')).toBeInTheDocument();
  });

  const testPushButton = screen.getByRole('button', { name: /Send Test Push/i });
  await user.click(testPushButton);

  await waitFor(() => {
    expect(testNotificationChannelMock).toHaveBeenCalledWith('ntfy');
  });
});

test('shows success toast on successful test', async () => {
  const { addToast } = await import('@/src/design-system/components/Toast');
  const user = userEvent.setup();

  getNotificationSettingsMock.mockResolvedValue({
    data: {
      resend: { configured: true, from: 'noreply@example.com' },
      ntfy: { configured: false, topicUrl: null, authenticated: false },
    },
    error: null,
  });

  testNotificationChannelMock.mockResolvedValue({
    data: { email: { success: true } },
    error: null,
  });

  render(<NotificationSettings />);

  await waitFor(() => {
    expect(screen.getByText('Send Test Email')).toBeInTheDocument();
  });

  await user.click(screen.getByRole('button', { name: /Send Test Email/i }));

  await waitFor(() => {
    expect(addToast).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'success',
        message: expect.stringContaining('Test email notification sent'),
      }),
    );
  });
});

test('shows error toast on failed test', async () => {
  const { addToast } = await import('@/src/design-system/components/Toast');
  const user = userEvent.setup();

  getNotificationSettingsMock.mockResolvedValue({
    data: {
      resend: { configured: true, from: 'noreply@example.com' },
      ntfy: { configured: false, topicUrl: null, authenticated: false },
    },
    error: null,
  });

  testNotificationChannelMock.mockResolvedValue({
    data: { email: { success: false, error: 'Invalid API key' } },
    error: null,
  });

  render(<NotificationSettings />);

  await waitFor(() => {
    expect(screen.getByText('Send Test Email')).toBeInTheDocument();
  });

  await user.click(screen.getByRole('button', { name: /Send Test Email/i }));

  await waitFor(() => {
    expect(addToast).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
        message: 'Invalid API key',
      }),
    );
  });
});

test('disables test buttons when channel not configured', async () => {
  getNotificationSettingsMock.mockResolvedValue({
    data: {
      resend: { configured: false, from: null },
      ntfy: { configured: false, topicUrl: null, authenticated: false },
    },
    error: null,
  });

  render(<NotificationSettings />);

  await waitFor(() => {
    expect(screen.getByText('Send Test Email')).toBeInTheDocument();
  });

  const testEmailButton = screen.getByRole('button', { name: /Send Test Email/i });
  const testPushButton = screen.getByRole('button', { name: /Send Test Push/i });

  expect(testEmailButton).toBeDisabled();
  expect(testPushButton).toBeDisabled();
});

test('enables test buttons when channel is configured', async () => {
  getNotificationSettingsMock.mockResolvedValue({
    data: {
      resend: { configured: true, from: 'noreply@example.com' },
      ntfy: { configured: true, topicUrl: 'https://ntfy.sh/topic', authenticated: true },
    },
    error: null,
  });

  render(<NotificationSettings />);

  await waitFor(() => {
    expect(screen.getByText('Send Test Email')).toBeInTheDocument();
  });

  const testEmailButton = screen.getByRole('button', { name: /Send Test Email/i });
  const testPushButton = screen.getByRole('button', { name: /Send Test Push/i });

  expect(testEmailButton).not.toBeDisabled();
  expect(testPushButton).not.toBeDisabled();
});

test('displays authenticated status badge for ntfy when authenticated', async () => {
  getNotificationSettingsMock.mockResolvedValue({
    data: {
      resend: { configured: false, from: null },
      ntfy: { configured: true, topicUrl: 'https://ntfy.sh/topic', authenticated: true },
    },
    error: null,
  });

  render(<NotificationSettings />);

  await waitFor(() => {
    expect(screen.getByText('Authenticated')).toBeInTheDocument();
  });
});

test('displays anonymous status badge for ntfy when not authenticated', async () => {
  getNotificationSettingsMock.mockResolvedValue({
    data: {
      resend: { configured: false, from: null },
      ntfy: { configured: true, topicUrl: 'https://ntfy.sh/topic', authenticated: false },
    },
    error: null,
  });

  render(<NotificationSettings />);

  await waitFor(() => {
    expect(screen.getByText('Anonymous')).toBeInTheDocument();
  });
});
