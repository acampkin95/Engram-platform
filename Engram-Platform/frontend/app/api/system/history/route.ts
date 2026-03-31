import { NextResponse } from 'next/server';
import { requireAdminAccess } from '@/src/server/admin-access';
import { getSevenDayHistory } from '@/src/server/system-admin';

export async function GET() {
  await requireAdminAccess();

  try {
    const history = await getSevenDayHistory();
    return NextResponse.json(history, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load history' },
      { status: 500 },
    );
  }
}
