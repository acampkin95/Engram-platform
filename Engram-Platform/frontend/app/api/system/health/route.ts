import { NextResponse } from 'next/server';
import { requireAdminAccess } from '@/src/server/admin-access';
import { getSystemHealthSnapshot } from '@/src/server/system-admin';

export async function GET() {
  try {
    await requireAdminAccess();
    const snapshot = await getSystemHealthSnapshot();
    return NextResponse.json(snapshot, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized')
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      if (error.message === 'Forbidden')
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load health snapshot' },
      { status: 500 },
    );
  }
}
