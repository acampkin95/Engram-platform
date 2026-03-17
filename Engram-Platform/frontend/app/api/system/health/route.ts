import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { getSystemHealthSnapshot } from '@/src/server/system-admin';

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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
