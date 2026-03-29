import { NextResponse } from 'next/server';
import { requireAdminAccess } from '@/src/server/admin-access';
import { getNotificationLog } from '@/src/server/system-admin';

export async function GET() {
  try {
    await requireAdminAccess();
    return NextResponse.json(getNotificationLog());
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch log' },
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
