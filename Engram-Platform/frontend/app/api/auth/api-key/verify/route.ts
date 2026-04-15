import { auth } from '@/src/lib/auth';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const key = body.key as string | undefined;

    if (!key) {
      return NextResponse.json({ valid: false, error: 'Missing key' }, { status: 400 });
    }

    const result = await auth.api.verifyApiKey({
      body: { key },
    });

    if (result.valid) {
      return NextResponse.json({
        valid: true,
        key: {
          id: result.key?.id ?? null,
          name: result.key?.name ?? null,
          prefix: result.key?.prefix ?? null,
        },
      });
    }

    return NextResponse.json({ valid: false, error: 'Invalid key' }, { status: 401 });
  } catch {
    return NextResponse.json({ valid: false, error: 'Verification failed' }, { status: 500 });
  }
}
