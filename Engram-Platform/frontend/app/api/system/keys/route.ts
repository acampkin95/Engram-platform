import { NextResponse } from 'next/server';
import { requireAdminAccess } from '@/src/server/admin-access';

const MEMORY_API_URL = process.env.MEMORY_API_URL || 'http://localhost:8000';

function apiHeaders() {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (process.env.MEMORY_API_KEY) {
    headers['X-API-Key'] = process.env.MEMORY_API_KEY;
  }
  return headers;
}

export async function GET() {
  try {
    await requireAdminAccess();
    const res = await fetch(`${MEMORY_API_URL}/admin/keys`, {
      headers: apiHeaders(),
      cache: 'no-store',
    });
    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json(
        { error: data?.detail ?? 'Failed to list keys' },
        { status: res.status },
      );
    }
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to list keys' },
      {
        status:
          error instanceof Error && error.message === 'Unauthorized'
            ? 401
            : error instanceof Error && error.message === 'Forbidden'
              ? 403
              : 500,
      },
    );
  }
}

export async function POST(request: Request) {
  try {
    await requireAdminAccess();
    const body = await request.json();
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    if (!name || name.length > 128) {
      return NextResponse.json(
        { error: 'Key name is required and must be 128 characters or fewer' },
        { status: 400 },
      );
    }
    const res = await fetch(`${MEMORY_API_URL}/admin/keys`, {
      method: 'POST',
      headers: apiHeaders(),
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json(
        { error: data?.detail ?? 'Failed to create key' },
        { status: res.status },
      );
    }
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create key' },
      {
        status:
          error instanceof Error && error.message === 'Unauthorized'
            ? 401
            : error instanceof Error && error.message === 'Forbidden'
              ? 403
              : 500,
      },
    );
  }
}
