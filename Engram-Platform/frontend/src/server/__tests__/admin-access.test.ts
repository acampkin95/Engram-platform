// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
}));

vi.mock('@clerk/nextjs/server', () => ({
  auth: authMock,
}));

describe('admin-access', () => {
  const originalPublishable = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const originalAdmins = process.env.ENGRAM_ADMIN_USER_IDS;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_123';
    delete process.env.ENGRAM_ADMIN_USER_IDS;
  });

  afterAll(() => {
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = originalPublishable;
    process.env.ENGRAM_ADMIN_USER_IDS = originalAdmins;
  });

  it('allows access when Clerk is disabled', async () => {
    delete process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
    const { requireAdminAccess } = await import('../admin-access');

    await expect(requireAdminAccess()).resolves.toEqual({ userId: null, mode: 'disabled' });
  });

  it('rejects unauthenticated access when Clerk is enabled', async () => {
    authMock.mockResolvedValue({ userId: null, sessionClaims: null, orgRole: null });
    const { requireAdminAccess } = await import('../admin-access');

    await expect(requireAdminAccess()).rejects.toThrow('Unauthorized');
  });

  it('allows an explicitly allowlisted admin user id', async () => {
    process.env.ENGRAM_ADMIN_USER_IDS = 'user_admin,user_ops';
    authMock.mockResolvedValue({ userId: 'user_ops', sessionClaims: null, orgRole: null });
    const { requireAdminAccess } = await import('../admin-access');

    await expect(requireAdminAccess()).resolves.toMatchObject({ userId: 'user_ops', mode: 'allowlist' });
  });

  it('allows admin role from session claims metadata', async () => {
    authMock.mockResolvedValue({
      userId: 'user_meta_admin',
      orgRole: null,
      sessionClaims: { metadata: { role: 'admin' } },
    });
    const { requireAdminAccess } = await import('../admin-access');

    await expect(requireAdminAccess()).resolves.toMatchObject({ userId: 'user_meta_admin', mode: 'metadata' });
  });

  it('rejects authenticated non-admin users', async () => {
    authMock.mockResolvedValue({
      userId: 'user_regular',
      orgRole: 'org:member',
      sessionClaims: { metadata: { role: 'user' } },
    });
    const { requireAdminAccess } = await import('../admin-access');

    await expect(requireAdminAccess()).rejects.toThrow('Forbidden');
  });
});
