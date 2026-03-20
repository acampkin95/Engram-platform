import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminAccess } from '@/src/server/admin-access';
import { ACTION_ALLOWLIST, runSystemControl, SERVICE_ALLOWLIST } from '@/src/server/system-admin';

const schema = z.object({
  target: z.enum(SERVICE_ALLOWLIST),
  action: z.enum(ACTION_ALLOWLIST),
});

export async function POST(request: Request) {
  try {
    await requireAdminAccess();
    const payload = schema.parse(await request.json());
    const result = await runSystemControl(payload);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to run control action' },
      {
        status:
          error instanceof Error && error.message === 'Unauthorized'
            ? 401
            : error instanceof Error && error.message === 'Forbidden'
              ? 403
              : 400,
      },
    );
  }
}
