import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminAccess } from '@/src/server/admin-access';
import { sendNotification } from '@/src/server/system-admin';

const schema = z.object({
  to: z
    .array(
      z
        .string()
        .email()
        .transform((e) => e.toLowerCase().trim()),
    )
    .optional(),
  subject: z
    .string()
    .min(1)
    .max(200)
    .transform((s) => s.trim()),
  text: z
    .string()
    .min(1)
    .max(10000)
    .transform((s) => s.trim()),
  channels: z.array(z.enum(['email', 'ntfy'])).optional(),
  priority: z.enum(['low', 'default', 'high', 'urgent']).optional(),
  tags: z.array(z.string().max(50)).optional(),
});

export async function POST(request: Request) {
  try {
    await requireAdminAccess();
    const payload = schema.parse(await request.json());
    const result = await sendNotification(payload);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to send notification' },
      {
        status:
          error instanceof Error && error.message === 'Unauthorized'
            ? 401
            : error instanceof Error && error.message === 'Forbidden'
              ? 403
              : 400,
      },
    );
  }
}
