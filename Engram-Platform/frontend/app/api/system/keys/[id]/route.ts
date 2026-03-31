import { type NextRequest, NextResponse } from 'next/server';
import { requireAdminAccess } from '@/src/server/admin-access';

const MEMORY_API_URL = process.env.MEMORY_API_URL || 'http://localhost:8000';

function apiHeaders() {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (process.env.MEMORY_API_KEY) {
    headers['X-API-Key'] = process.env.MEMORY_API_KEY;
  }
  return headers;
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdminAccess();
    const { id } = await params;
    const body = await request.json();
    const res = await fetch(`${MEMORY_API_URL}/admin/keys/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: apiHeaders(),
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json(
        { error: data?.detail ?? 'Failed to update key' },
        { status: res.status },
      );
    }
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update key' },
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

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdminAccess();
    const { id } = await params;
    const res = await fetch(`${MEMORY_API_URL}/admin/keys/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: apiHeaders(),
    });
    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json(
        { error: data?.detail ?? 'Failed to revoke key' },
        { status: res.status },
      );
    }
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to revoke key' },
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
