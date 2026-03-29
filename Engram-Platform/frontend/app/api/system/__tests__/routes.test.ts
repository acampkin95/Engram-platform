// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
}));

const { requireAdminAccessMock } = vi.hoisted(() => ({
  requireAdminAccessMock: vi.fn(),
}));

const {
  getSystemHealthSnapshotMock,
  runSystemControlMock,
  getSevenDayHistoryMock,
  getRecentLogsMock,
  runMaintenanceActionMock,
  sendAdminNotificationMock,
  sendNotificationMock,
  getNotificationChannelStatusMock,
} = vi.hoisted(() => ({
  getSystemHealthSnapshotMock: vi.fn(),
  runSystemControlMock: vi.fn(),
  getSevenDayHistoryMock: vi.fn(),
  getRecentLogsMock: vi.fn(),
  runMaintenanceActionMock: vi.fn(),
  sendAdminNotificationMock: vi.fn(),
  sendNotificationMock: vi.fn(),
  getNotificationChannelStatusMock: vi.fn(),
}));

vi.mock('@clerk/nextjs/server', () => ({
  auth: authMock,
}));

vi.mock('@/src/server/admin-access', () => ({
  requireAdminAccess: requireAdminAccessMock,
}));

vi.mock('@/src/server/system-admin', () => ({
  getSystemHealthSnapshot: getSystemHealthSnapshotMock,
  runSystemControl: runSystemControlMock,
  getSevenDayHistory: getSevenDayHistoryMock,
  getRecentLogs: getRecentLogsMock,
  runMaintenanceAction: runMaintenanceActionMock,
  sendAdminNotification: sendAdminNotificationMock,
  sendNotification: sendNotificationMock,
  getNotificationChannelStatus: getNotificationChannelStatusMock,
  SERVICE_ALLOWLIST: [
    'all',
    'crawler-api',
    'memory-api',
    'mcp-server',
    'weaviate',
    'crawler-redis',
    'memory-redis',
    'platform-frontend',
    'nginx',
  ] as const,
  ACTION_ALLOWLIST: ['start', 'stop', 'restart'] as const,
  MAINTENANCE_ALLOWLIST: ['decay', 'consolidate', 'cleanup', 'confidence-maintenance'] as const,
}));

const { spawn } = vi.hoisted(() => {
  const mockEmitter = {
    stdout: {
      on: vi.fn(),
    },
    stderr: {
      on: vi.fn(),
    },
    on: vi.fn(),
  };
  return {
    spawn: vi.fn(() => mockEmitter),
  };
});

vi.mock('node:child_process', () => ({
  spawn: spawn,
}));

describe('System API Routes', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  describe('POST /api/system/control', () => {
    it('should control a service when admin is authorized', async () => {
      requireAdminAccessMock.mockResolvedValue({ userId: 'user_admin', mode: 'allowlist' });
      runSystemControlMock.mockResolvedValue({ ok: true, output: 'Service restarted' });

      const { POST } = await import('../control/route');
      const request = new Request('http://localhost/api/system/control', {
        method: 'POST',
        body: JSON.stringify({ target: 'memory-api', action: 'restart' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ ok: true, output: 'Service restarted' });
      expect(runSystemControlMock).toHaveBeenCalledWith({
        target: 'memory-api',
        action: 'restart',
      });
    });

    it('should return 401 when user is not authenticated', async () => {
      requireAdminAccessMock.mockRejectedValue(new Error('Unauthorized'));

      const { POST } = await import('../control/route');
      const request = new Request('http://localhost/api/system/control', {
        method: 'POST',
        body: JSON.stringify({ target: 'memory-api', action: 'restart' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 403 when user lacks admin permissions', async () => {
      requireAdminAccessMock.mockRejectedValue(new Error('Forbidden'));

      const { POST } = await import('../control/route');
      const request = new Request('http://localhost/api/system/control', {
        method: 'POST',
        body: JSON.stringify({ target: 'memory-api', action: 'restart' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Forbidden');
    });

    it('should return 400 for invalid service target', async () => {
      requireAdminAccessMock.mockResolvedValue({ userId: 'user_admin', mode: 'allowlist' });

      const { POST } = await import('../control/route');
      const request = new Request('http://localhost/api/system/control', {
        method: 'POST',
        body: JSON.stringify({ target: 'invalid-service', action: 'restart' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it('should return 400 for invalid action', async () => {
      requireAdminAccessMock.mockResolvedValue({ userId: 'user_admin', mode: 'allowlist' });

      const { POST } = await import('../control/route');
      const request = new Request('http://localhost/api/system/control', {
        method: 'POST',
        body: JSON.stringify({ target: 'memory-api', action: 'destroy' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it('should return 400 for missing required fields', async () => {
      requireAdminAccessMock.mockResolvedValue({ userId: 'user_admin', mode: 'allowlist' });

      const { POST } = await import('../control/route');
      const request = new Request('http://localhost/api/system/control', {
        method: 'POST',
        body: JSON.stringify({ target: 'memory-api' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });
  });

  describe('GET /api/system/health', () => {
    it('should return system health snapshot when authenticated', async () => {
      authMock.mockResolvedValue({ userId: 'user_123', sessionClaims: null });
      const mockSnapshot = {
        summary: { status: 'healthy', healthyServices: 8, totalServices: 8, incidentCount: 0 },
        services: [],
        resources: [],
        maintenance: {},
      };
      getSystemHealthSnapshotMock.mockResolvedValue(mockSnapshot);

      const { GET } = await import('../health/route');
      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockSnapshot);
      expect(response.headers.get('Cache-Control')).toBe('no-store');
    });

    it('should return 401 when user is not authenticated', async () => {
      authMock.mockResolvedValue({ userId: null, sessionClaims: null });

      const { GET } = await import('../health/route');
      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 500 when health snapshot fails', async () => {
      authMock.mockResolvedValue({ userId: 'user_123', sessionClaims: null });
      getSystemHealthSnapshotMock.mockRejectedValue(new Error('Service unavailable'));

      const { GET } = await import('../health/route');
      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Service unavailable');
    });
  });

  describe('GET /api/system/history', () => {
    it('should return seven day history when authenticated', async () => {
      authMock.mockResolvedValue({ userId: 'user_123', sessionClaims: null });
      const mockHistory = [
        { day: 'Mar 10', incidents: 2, maintenanceRuns: 1 },
        { day: 'Mar 11', incidents: 0, maintenanceRuns: 0 },
      ];
      getSevenDayHistoryMock.mockResolvedValue(mockHistory);

      const { GET } = await import('../history/route');
      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockHistory);
      expect(response.headers.get('Cache-Control')).toBe('no-store');
    });

    it('should return 401 when user is not authenticated', async () => {
      authMock.mockResolvedValue({ userId: null, sessionClaims: null });

      const { GET } = await import('../history/route');
      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 500 when history retrieval fails', async () => {
      authMock.mockResolvedValue({ userId: 'user_123', sessionClaims: null });
      getSevenDayHistoryMock.mockRejectedValue(new Error('File read error'));

      const { GET } = await import('../history/route');
      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('File read error');
    });
  });

  describe('GET /api/system/logs', () => {
    it('should return recent logs for all services when authenticated', async () => {
      authMock.mockResolvedValue({ userId: 'user_123', sessionClaims: null });
      const mockLogs = [
        { id: '1', line: 'Service started', level: 'info' },
        { id: '2', line: 'Error occurred', level: 'error' },
      ];
      getRecentLogsMock.mockResolvedValue(mockLogs);

      const { GET } = await import('../logs/route');
      const request = new Request('http://localhost/api/system/logs');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockLogs);
      expect(getRecentLogsMock).toHaveBeenCalledWith('all', 200);
    });

    it('should return logs for specific service with custom line count', async () => {
      authMock.mockResolvedValue({ userId: 'user_123', sessionClaims: null });
      const mockLogs = [{ id: '1', line: 'Memory API started', level: 'info' }];
      getRecentLogsMock.mockResolvedValue(mockLogs);

      const { GET } = await import('../logs/route');
      const request = new Request('http://localhost/api/system/logs?service=memory-api&lines=50');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockLogs);
      expect(getRecentLogsMock).toHaveBeenCalledWith('memory-api', 50);
    });

    it('should return 401 when user is not authenticated', async () => {
      authMock.mockResolvedValue({ userId: null, sessionClaims: null });

      const { GET } = await import('../logs/route');
      const request = new Request('http://localhost/api/system/logs');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should use default line count for invalid number', async () => {
      authMock.mockResolvedValue({ userId: 'user_123', sessionClaims: null });
      getRecentLogsMock.mockResolvedValue([]);

      const { GET } = await import('../logs/route');
      const request = new Request('http://localhost/api/system/logs?lines=invalid');
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(getRecentLogsMock).toHaveBeenCalledWith('all', 200);
    });

    it('should return 500 when log retrieval fails', async () => {
      authMock.mockResolvedValue({ userId: 'user_123', sessionClaims: null });
      getRecentLogsMock.mockRejectedValue(new Error('Docker command failed'));

      const { GET } = await import('../logs/route');
      const request = new Request('http://localhost/api/system/logs');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Docker command failed');
    });
  });

  describe('GET /api/system/logs/stream', () => {
    it('should stream logs when admin is authorized', async () => {
      requireAdminAccessMock.mockResolvedValue({ userId: 'user_admin', mode: 'allowlist' });

      const { GET } = await import('../logs/stream/route');
      const request = new Request('http://localhost/api/system/logs/stream');
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('text/event-stream');
      expect(response.headers.get('Cache-Control')).toBe('no-cache, no-transform');
      expect(response.headers.get('Connection')).toBe('keep-alive');
    });

    it('should stream logs for specific service', async () => {
      requireAdminAccessMock.mockResolvedValue({ userId: 'user_admin', mode: 'allowlist' });

      const { GET } = await import('../logs/stream/route');
      const request = new Request('http://localhost/api/system/logs/stream?service=memory-api');
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('text/event-stream');
    });

    it('should return 401 when user is not authenticated', async () => {
      requireAdminAccessMock.mockRejectedValue(new Error('Unauthorized'));

      const { GET } = await import('../logs/stream/route');
      const request = new Request('http://localhost/api/system/logs/stream');
      const response = await GET(request);
      const text = await response.text();

      expect(response.status).toBe(401);
      expect(text).toBe('Unauthorized');
    });

    it('should return 403 when user lacks admin permissions', async () => {
      requireAdminAccessMock.mockRejectedValue(new Error('Forbidden'));

      const { GET } = await import('../logs/stream/route');
      const request = new Request('http://localhost/api/system/logs/stream');
      const response = await GET(request);
      const text = await response.text();

      expect(response.status).toBe(403);
      expect(text).toBe('Forbidden');
    });
  });

  describe('POST /api/system/maintenance', () => {
    it('should execute maintenance action when admin is authorized', async () => {
      requireAdminAccessMock.mockResolvedValue({ userId: 'user_admin', mode: 'allowlist' });
      runMaintenanceActionMock.mockResolvedValue({ ok: true, completed: true });

      const { POST } = await import('../maintenance/route');
      const request = new Request('http://localhost/api/system/maintenance', {
        method: 'POST',
        body: JSON.stringify({ action: 'decay' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ ok: true, completed: true });
      expect(runMaintenanceActionMock).toHaveBeenCalledWith('decay');
    });

    it('should return 401 when user is not authenticated', async () => {
      requireAdminAccessMock.mockRejectedValue(new Error('Unauthorized'));

      const { POST } = await import('../maintenance/route');
      const request = new Request('http://localhost/api/system/maintenance', {
        method: 'POST',
        body: JSON.stringify({ action: 'decay' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 403 when user lacks admin permissions', async () => {
      requireAdminAccessMock.mockRejectedValue(new Error('Forbidden'));

      const { POST } = await import('../maintenance/route');
      const request = new Request('http://localhost/api/system/maintenance', {
        method: 'POST',
        body: JSON.stringify({ action: 'decay' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Forbidden');
    });

    it('should return 400 for invalid maintenance action', async () => {
      requireAdminAccessMock.mockResolvedValue({ userId: 'user_admin', mode: 'allowlist' });

      const { POST } = await import('../maintenance/route');
      const request = new Request('http://localhost/api/system/maintenance', {
        method: 'POST',
        body: JSON.stringify({ action: 'invalid-action' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it('should return 400 for missing action field', async () => {
      requireAdminAccessMock.mockResolvedValue({ userId: 'user_admin', mode: 'allowlist' });

      const { POST } = await import('../maintenance/route');
      const request = new Request('http://localhost/api/system/maintenance', {
        method: 'POST',
        body: JSON.stringify({}),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });
  });

  describe('POST /api/system/notifications', () => {
    it('should send admin notification when authorized', async () => {
      requireAdminAccessMock.mockResolvedValue({ userId: 'user_admin', mode: 'allowlist' });
      sendNotificationMock.mockResolvedValue({ email: { success: true }, ntfy: { success: true } });

      const { POST } = await import('../notifications/route');
      const request = new Request('http://localhost/api/system/notifications', {
        method: 'POST',
        body: JSON.stringify({
          to: ['admin@example.com'],
          subject: 'System Alert',
          text: 'A system issue has occurred',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ email: { success: true }, ntfy: { success: true } });
      expect(sendNotificationMock).toHaveBeenCalledWith({
        to: ['admin@example.com'],
        subject: 'System Alert',
        text: 'A system issue has occurred',
      });
    });

    it('should lowercase email addresses without extra spaces', async () => {
      requireAdminAccessMock.mockResolvedValue({ userId: 'user_admin', mode: 'allowlist' });
      sendNotificationMock.mockResolvedValue({ email: { success: true }, ntfy: { success: true } });

      const { POST } = await import('../notifications/route');
      const request = new Request('http://localhost/api/system/notifications', {
        method: 'POST',
        body: JSON.stringify({
          to: ['ADMIN@EXAMPLE.COM', 'USER@test.com'],
          subject: 'Alert',
          text: 'Message',
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(sendNotificationMock).toHaveBeenCalledWith({
        to: ['admin@example.com', 'user@test.com'],
        subject: 'Alert',
        text: 'Message',
      });
    });

    it('should trim subject and text', async () => {
      requireAdminAccessMock.mockResolvedValue({ userId: 'user_admin', mode: 'allowlist' });
      sendNotificationMock.mockResolvedValue({ email: { success: true }, ntfy: { success: true } });

      const { POST } = await import('../notifications/route');
      const request = new Request('http://localhost/api/system/notifications', {
        method: 'POST',
        body: JSON.stringify({
          to: ['admin@example.com'],
          subject: '  System Alert  ',
          text: '  A system issue has occurred  ',
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(sendNotificationMock).toHaveBeenCalledWith({
        to: ['admin@example.com'],
        subject: 'System Alert',
        text: 'A system issue has occurred',
      });
    });

    it('should return 401 when user is not authenticated', async () => {
      requireAdminAccessMock.mockRejectedValue(new Error('Unauthorized'));

      const { POST } = await import('../notifications/route');
      const request = new Request('http://localhost/api/system/notifications', {
        method: 'POST',
        body: JSON.stringify({
          to: ['admin@example.com'],
          subject: 'Alert',
          text: 'Message',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 403 when user lacks admin permissions', async () => {
      requireAdminAccessMock.mockRejectedValue(new Error('Forbidden'));

      const { POST } = await import('../notifications/route');
      const request = new Request('http://localhost/api/system/notifications', {
        method: 'POST',
        body: JSON.stringify({
          to: ['admin@example.com'],
          subject: 'Alert',
          text: 'Message',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Forbidden');
    });

    it('should return 400 for invalid email address', async () => {
      requireAdminAccessMock.mockResolvedValue({ userId: 'user_admin', mode: 'allowlist' });

      const { POST } = await import('../notifications/route');
      const request = new Request('http://localhost/api/system/notifications', {
        method: 'POST',
        body: JSON.stringify({
          to: ['not-an-email'],
          subject: 'Alert',
          text: 'Message',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it('should return 400 for empty subject', async () => {
      requireAdminAccessMock.mockResolvedValue({ userId: 'user_admin', mode: 'allowlist' });

      const { POST } = await import('../notifications/route');
      const request = new Request('http://localhost/api/system/notifications', {
        method: 'POST',
        body: JSON.stringify({
          to: ['admin@example.com'],
          subject: '',
          text: 'Message',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it('should return 400 for empty text', async () => {
      requireAdminAccessMock.mockResolvedValue({ userId: 'user_admin', mode: 'allowlist' });

      const { POST } = await import('../notifications/route');
      const request = new Request('http://localhost/api/system/notifications', {
        method: 'POST',
        body: JSON.stringify({
          to: ['admin@example.com'],
          subject: 'Alert',
          text: '',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it('should return 400 for subject exceeding max length', async () => {
      requireAdminAccessMock.mockResolvedValue({ userId: 'user_admin', mode: 'allowlist' });

      const { POST } = await import('../notifications/route');
      const request = new Request('http://localhost/api/system/notifications', {
        method: 'POST',
        body: JSON.stringify({
          to: ['admin@example.com'],
          subject: 'a'.repeat(201),
          text: 'Message',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it('should return 400 for text exceeding max length', async () => {
      requireAdminAccessMock.mockResolvedValue({ userId: 'user_admin', mode: 'allowlist' });

      const { POST } = await import('../notifications/route');
      const request = new Request('http://localhost/api/system/notifications', {
        method: 'POST',
        body: JSON.stringify({
          to: ['admin@example.com'],
          subject: 'Alert',
          text: 'a'.repeat(10001),
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it('should send notification to ntfy only when channels specified', async () => {
      requireAdminAccessMock.mockResolvedValue({ userId: 'user_admin', mode: 'allowlist' });
      sendNotificationMock.mockResolvedValue({ ntfy: { success: true } });

      const { POST } = await import('../notifications/route');
      const request = new Request('http://localhost/api/system/notifications', {
        method: 'POST',
        body: JSON.stringify({
          subject: 'Alert',
          text: 'Message',
          channels: ['ntfy'],
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ ntfy: { success: true } });
      expect(sendNotificationMock).toHaveBeenCalledWith(
        expect.objectContaining({
          channels: ['ntfy'],
        }),
      );
    });

    it('should send notification with priority', async () => {
      requireAdminAccessMock.mockResolvedValue({ userId: 'user_admin', mode: 'allowlist' });
      sendNotificationMock.mockResolvedValue({ email: { success: true }, ntfy: { success: true } });

      const { POST } = await import('../notifications/route');
      const request = new Request('http://localhost/api/system/notifications', {
        method: 'POST',
        body: JSON.stringify({
          subject: 'Alert',
          text: 'Message',
          priority: 'high',
        }),
      });

      const response = await POST(request);
      const _data = await response.json();

      expect(response.status).toBe(200);
      expect(sendNotificationMock).toHaveBeenCalledWith(
        expect.objectContaining({
          priority: 'high',
        }),
      );
    });

    it('should send notification with tags', async () => {
      requireAdminAccessMock.mockResolvedValue({ userId: 'user_admin', mode: 'allowlist' });
      sendNotificationMock.mockResolvedValue({ email: { success: true }, ntfy: { success: true } });

      const { POST } = await import('../notifications/route');
      const request = new Request('http://localhost/api/system/notifications', {
        method: 'POST',
        body: JSON.stringify({
          subject: 'Alert',
          text: 'Message',
          tags: ['test', 'alert'],
        }),
      });

      const response = await POST(request);
      const _data = await response.json();

      expect(response.status).toBe(200);
      expect(sendNotificationMock).toHaveBeenCalledWith(
        expect.objectContaining({
          tags: ['test', 'alert'],
        }),
      );
    });

    it('should reject invalid channel name', async () => {
      requireAdminAccessMock.mockResolvedValue({ userId: 'user_admin', mode: 'allowlist' });

      const { POST } = await import('../notifications/route');
      const request = new Request('http://localhost/api/system/notifications', {
        method: 'POST',
        body: JSON.stringify({
          subject: 'Alert',
          text: 'Message',
          channels: ['sms'],
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });
  });

  describe('GET /api/system/notifications/settings', () => {
    it('should return channel status when authenticated', async () => {
      requireAdminAccessMock.mockResolvedValue({ userId: 'user_admin', mode: 'allowlist' });
      const mockStatus = {
        email: { configured: true, lastTestTime: null },
        ntfy: { configured: true, lastTestTime: '2026-03-27T10:00:00Z' },
      };
      getNotificationChannelStatusMock.mockReturnValue(mockStatus);

      const { GET } = await import('../notifications/settings/route');
      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockStatus);
    });

    it('should return 401 when not authenticated', async () => {
      requireAdminAccessMock.mockRejectedValue(new Error('Unauthorized'));

      const { GET } = await import('../notifications/settings/route');
      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 403 when user lacks admin permissions', async () => {
      requireAdminAccessMock.mockRejectedValue(new Error('Forbidden'));

      const { GET } = await import('../notifications/settings/route');
      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Forbidden');
    });
  });

  describe('PUT /api/system/notifications/settings', () => {
    it('should test a channel when admin is authorized', async () => {
      requireAdminAccessMock.mockResolvedValue({ userId: 'user_admin', mode: 'allowlist' });
      sendNotificationMock.mockResolvedValue({ ntfy: { success: true } });

      const { PUT } = await import('../notifications/settings/route');
      const request = new Request('http://localhost/api/system/notifications/settings', {
        method: 'PUT',
        body: JSON.stringify({ channel: 'ntfy' }),
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ ntfy: { success: true } });
      expect(sendNotificationMock).toHaveBeenCalledWith(
        expect.objectContaining({
          channels: ['ntfy'],
          tags: ['test'],
        }),
      );
    });

    it('should test email channel', async () => {
      requireAdminAccessMock.mockResolvedValue({ userId: 'user_admin', mode: 'allowlist' });
      sendNotificationMock.mockResolvedValue({ email: { success: true } });

      const { PUT } = await import('../notifications/settings/route');
      const request = new Request('http://localhost/api/system/notifications/settings', {
        method: 'PUT',
        body: JSON.stringify({ channel: 'email' }),
      });

      const response = await PUT(request);
      const _data = await response.json();

      expect(response.status).toBe(200);
      expect(sendNotificationMock).toHaveBeenCalledWith(
        expect.objectContaining({
          channels: ['email'],
          tags: ['test'],
        }),
      );
    });

    it('should return 401 when not authenticated', async () => {
      requireAdminAccessMock.mockRejectedValue(new Error('Unauthorized'));

      const { PUT } = await import('../notifications/settings/route');
      const request = new Request('http://localhost/api/system/notifications/settings', {
        method: 'PUT',
        body: JSON.stringify({ channel: 'ntfy' }),
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 403 when user lacks admin permissions', async () => {
      requireAdminAccessMock.mockRejectedValue(new Error('Forbidden'));

      const { PUT } = await import('../notifications/settings/route');
      const request = new Request('http://localhost/api/system/notifications/settings', {
        method: 'PUT',
        body: JSON.stringify({ channel: 'ntfy' }),
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Forbidden');
    });

    it('should reject invalid channel name', async () => {
      requireAdminAccessMock.mockResolvedValue({ userId: 'user_admin', mode: 'allowlist' });

      const { PUT } = await import('../notifications/settings/route');
      const request = new Request('http://localhost/api/system/notifications/settings', {
        method: 'PUT',
        body: JSON.stringify({ channel: 'sms' }),
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid channel');
    });

    it('should reject missing channel field', async () => {
      requireAdminAccessMock.mockResolvedValue({ userId: 'user_admin', mode: 'allowlist' });

      const { PUT } = await import('../notifications/settings/route');
      const request = new Request('http://localhost/api/system/notifications/settings', {
        method: 'PUT',
        body: JSON.stringify({}),
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid channel');
    });
  });
});
