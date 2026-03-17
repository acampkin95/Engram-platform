import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { sendAdminNotification } from '@/src/server/system-admin';

const schema = z.object({
  to: z.array(z.string().email()).optional(),
  subject: z.string().min(1),
  text: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    await requireAdminAccess();
    const payload = schema.parse(await request.json());
    const result = await sendAdminNotification(payload);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to send notification' },
      { status: error instanceof Error && error.message === 'Unauthorized' ? 401 : error instanceof Error && error.message === 'Forbidden' ? 403 : 400 },
    );
  }
}
