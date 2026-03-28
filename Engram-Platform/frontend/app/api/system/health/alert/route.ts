import { NextResponse } from 'next/server';
import { requireAdminAccess } from '@/src/server/admin-access';
import { checkAndAlertHealth } from '@/src/server/system-admin';

export async function POST() {
  try {
    await requireAdminAccess();
    const result = await checkAndAlertHealth();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Health alert check failed' },
      {
        status:
          error instanceof Error && error.message === 'Unauthorized'
            ? 401
            : error instanceof Error && error.message === 'Forbidden'
              ? 403
              : 500,
      },
    );
  }
}
