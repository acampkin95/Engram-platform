import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { runMaintenanceAction } from '@/src/server/system-admin';

const schema = z.object({
  action: z.string(),
});

export async function POST(request: Request) {
  try {
    await requireAdminAccess();
    const payload = schema.parse(await request.json());
    const result = await runMaintenanceAction(payload.action as never);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to run maintenance action' },
      { status: error instanceof Error && error.message === 'Unauthorized' ? 401 : error instanceof Error && error.message === 'Forbidden' ? 403 : 400 },
    );
  }
}
