import { auth } from '@clerk/nextjs/server';

type AdminAccess = {
  userId: string | null;
  mode: 'disabled' | 'allowlist' | 'metadata' | 'org-role';
};

function isClerkEnabled() {
  return Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
}

function parseAllowlist(value: string | undefined) {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function hasAdminMetadata(sessionClaims: Record<string, unknown> | null | undefined) {
  if (!sessionClaims || typeof sessionClaims !== 'object') return false;
  const metadata = (sessionClaims as { metadata?: Record<string, unknown> }).metadata;
  if (!metadata || typeof metadata !== 'object') return false;
  return metadata.role === 'admin';
}

function hasAdminOrgRole(orgRole: unknown) {
  return orgRole === 'org:admin' || orgRole === 'org:owner';
}

export async function requireAdminAccess(): Promise<AdminAccess> {
  if (!isClerkEnabled()) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Forbidden');
    }
    return { userId: null, mode: 'disabled' };
  }

  const { userId, sessionClaims, orgRole } = await auth();
  if (!userId) {
    throw new Error('Unauthorized');
  }

  const allowlist = parseAllowlist(process.env.ENGRAM_ADMIN_USER_IDS);
  if (allowlist.includes(userId)) {
    return { userId, mode: 'allowlist' };
  }

  if (hasAdminMetadata(sessionClaims as Record<string, unknown> | null | undefined)) {
    return { userId, mode: 'metadata' };
  }

  if (hasAdminOrgRole(orgRole)) {
    return { userId, mode: 'org-role' };
  }

  throw new Error('Forbidden');
}
