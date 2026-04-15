import { headers } from 'next/headers';
import { auth } from '@/src/lib/auth';

type AdminAccess = {
  userId: string | null;
  email: string | null;
  mode: 'disabled' | 'allowlist';
};

function isAuthEnabled() {
  return Boolean(process.env.BETTER_AUTH_SECRET);
}

function parseAllowlist(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

export async function requireAdminAccess(): Promise<AdminAccess> {
  if (!isAuthEnabled()) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Forbidden');
    }
    return { userId: null, email: null, mode: 'disabled' };
  }

  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    throw new Error('Unauthorized');
  }

  const { id: userId, email } = session.user;

  // Allowlist check — ENGRAM_ADMIN_EMAILS replaces ENGRAM_ADMIN_USER_IDS
  const allowlist = parseAllowlist(process.env.ENGRAM_ADMIN_EMAILS);

  // If no allowlist configured, any authenticated user is admin (single-user mode)
  if (allowlist.length === 0) {
    return { userId, email: email ?? null, mode: 'allowlist' };
  }

  if (email && allowlist.includes(email.toLowerCase())) {
    return { userId, email, mode: 'allowlist' };
  }

  throw new Error('Forbidden');
}
