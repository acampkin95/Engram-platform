import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { getSevenDayHistory } from '@/src/server/system-admin';

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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
