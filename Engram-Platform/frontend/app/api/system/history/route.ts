import { NextResponse } from 'next/server';
import { requireAdminAccess } from '@/src/server/admin-access';
import { getSevenDayHistory } from '@/src/server/system-admin';

export async function GET() {
  try {
    await requireAdminAccess();
    const history = await getSevenDayHistory();
    return NextResponse.json(history, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized')
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      if (error.message === 'Forbidden')
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load history' },
      { status: 500 },
    );
  }
}
