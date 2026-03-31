import { NextResponse } from 'next/server';
import { requireAdminAccess } from '@/src/server/admin-access';
import { getSystemHealthSnapshot } from '@/src/server/system-admin';

export async function GET() {
  await requireAdminAccess();

  try {
    const snapshot = await getSystemHealthSnapshot();
    return NextResponse.json(snapshot, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load health snapshot' },
      { status: 500 },
    );
  }
}
