// @vitest-environment node

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { getSessionMock } = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
}));

vi.mock('@/src/lib/auth', () => ({
  auth: {
    api: {
      getSession: getSessionMock,
    },
  },
}));

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));

describe('admin-access', () => {
  const originalSecret = process.env.BETTER_AUTH_SECRET;
  const originalAdmins = process.env.ENGRAM_ADMIN_EMAILS;
  const _originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.BETTER_AUTH_SECRET = 'test-secret';
    delete process.env.ENGRAM_ADMIN_EMAILS;
    // NODE_ENV stays as-is (test) unless overridden per-test
  });

  afterAll(() => {
    process.env.BETTER_AUTH_SECRET = originalSecret;
    process.env.ENGRAM_ADMIN_EMAILS = originalAdmins;
    vi.unstubAllEnvs();
  });

  it('returns disabled mode when auth is not configured outside production', async () => {
    delete process.env.BETTER_AUTH_SECRET;
    const { requireAdminAccess } = await import('../admin-access');
    await expect(requireAdminAccess()).resolves.toEqual({
      userId: null,
      email: null,
      mode: 'disabled',
    });
  });

  it('throws Forbidden when auth is not configured in production', async () => {
    delete process.env.BETTER_AUTH_SECRET;
    vi.stubEnv('NODE_ENV', 'production');
    const { requireAdminAccess } = await import('../admin-access');
    await expect(requireAdminAccess()).rejects.toThrow('Forbidden');
  });

  it('throws Unauthorized when there is no active session', async () => {
    getSessionMock.mockResolvedValue(null);
    const { requireAdminAccess } = await import('../admin-access');
    await expect(requireAdminAccess()).rejects.toThrow('Unauthorized');
  });

  it('allows any authenticated user when no allowlist is configured', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'user_123', email: 'anyone@example.com' } });
    const { requireAdminAccess } = await import('../admin-access');
    await expect(requireAdminAccess()).resolves.toMatchObject({
      userId: 'user_123',
      email: 'anyone@example.com',
      mode: 'allowlist',
    });
  });

  it('allows an explicitly allowlisted admin email', async () => {
    process.env.ENGRAM_ADMIN_EMAILS = 'admin@example.com,ops@example.com';
    getSessionMock.mockResolvedValue({ user: { id: 'user_ops', email: 'ops@example.com' } });
    const { requireAdminAccess } = await import('../admin-access');
    await expect(requireAdminAccess()).resolves.toMatchObject({
      userId: 'user_ops',
      email: 'ops@example.com',
      mode: 'allowlist',
    });
  });

  it('rejects authenticated users not in the allowlist', async () => {
    process.env.ENGRAM_ADMIN_EMAILS = 'admin@example.com';
    getSessionMock.mockResolvedValue({
      user: { id: 'user_regular', email: 'regular@example.com' },
    });
    const { requireAdminAccess } = await import('../admin-access');
    await expect(requireAdminAccess()).rejects.toThrow('Forbidden');
  });

  it('allowlist check is case-insensitive', async () => {
    process.env.ENGRAM_ADMIN_EMAILS = 'Admin@Example.com';
    getSessionMock.mockResolvedValue({ user: { id: 'user_admin', email: 'ADMIN@EXAMPLE.COM' } });
    const { requireAdminAccess } = await import('../admin-access');
    await expect(requireAdminAccess()).resolves.toMatchObject({
      userId: 'user_admin',
      mode: 'allowlist',
    });
  });
});
