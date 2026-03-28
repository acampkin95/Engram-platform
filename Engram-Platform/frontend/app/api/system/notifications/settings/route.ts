import { NextResponse } from 'next/server';
import { requireAdminAccess } from '@/src/server/admin-access';
import { getNotificationChannelStatus, sendNotification } from '@/src/server/system-admin';

export async function GET() {
  try {
    await requireAdminAccess();
    return NextResponse.json(getNotificationChannelStatus());
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch settings' },
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

export async function PUT(request: Request) {
  try {
    await requireAdminAccess();
    const { channel } = (await request.json()) as { channel?: 'email' | 'ntfy' };

    if (!channel || !['email', 'ntfy'].includes(channel)) {
      return NextResponse.json({ error: 'Invalid channel' }, { status: 400 });
    }

    const result = await sendNotification({
      subject: 'Engram notification test',
      text: `Test ${channel} notification from Engram system settings.`,
      channels: [channel],
      tags: ['test'],
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to test channel' },
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
