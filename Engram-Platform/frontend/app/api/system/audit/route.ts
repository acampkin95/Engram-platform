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

export async function GET(request: NextRequest) {
  try {
    await requireAdminAccess();
    const { searchParams } = new URL(request.url);

    // Summary endpoint
    if (searchParams.get('summary') === 'true') {
      const hours = searchParams.get('hours') || '24';
      const res = await fetch(
        `${MEMORY_API_URL}/admin/audit-log/summary?hours=${encodeURIComponent(hours)}`,
        { headers: apiHeaders(), cache: 'no-store' },
      );
      const data = await res.json();
      if (!res.ok) {
        return NextResponse.json(
          { error: data?.detail ?? 'Failed to fetch audit summary' },
          { status: res.status },
        );
      }
      return NextResponse.json(data);
    }

    // Log entries endpoint
    const params = new URLSearchParams();
    for (const key of ['key_id', 'path', 'method', 'limit', 'offset']) {
      const val = searchParams.get(key);
      if (val) params.set(key, val);
    }
    const qs = params.toString();
    const res = await fetch(
      `${MEMORY_API_URL}/admin/audit-log${qs ? `?${qs}` : ''}`,
      { headers: apiHeaders(), cache: 'no-store' },
    );
    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json(
        { error: data?.detail ?? 'Failed to fetch audit log' },
        { status: res.status },
      );
    }
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch audit log' },
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
