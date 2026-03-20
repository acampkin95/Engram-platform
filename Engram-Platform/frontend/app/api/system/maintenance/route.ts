import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminAccess } from '@/src/server/admin-access';
import { MAINTENANCE_ALLOWLIST, runMaintenanceAction } from '@/src/server/system-admin';

const schema = z.object({
  action: z.enum(MAINTENANCE_ALLOWLIST),
});

export async function POST(request: Request) {
  try {
    await requireAdminAccess();
    const payload = schema.parse(await request.json());
    const result = await runMaintenanceAction(payload.action);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to run maintenance action' },
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
