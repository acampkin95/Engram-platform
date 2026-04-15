import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { requireAdminAccess } from '@/src/server/admin-access';

export async function GET() {
  try {
    await requireAdminAccess();

    const mcpToken = process.env.MCP_AUTH_TOKEN ?? '';
    const masked = mcpToken
      ? `${mcpToken.slice(0, 4)}${'*'.repeat(Math.max(0, mcpToken.length - 8))}${mcpToken.slice(-4)}`
      : '';

    return NextResponse.json({
      mcp: {
        configured: mcpToken.length > 0,
        masked,
        length: mcpToken.length,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get tokens' },
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

export async function POST() {
  try {
    await requireAdminAccess();

    const newToken = randomBytes(32).toString('hex');

    return NextResponse.json({
      token: newToken,
      message:
        'Update MCP_AUTH_TOKEN in your .env file and restart the MCP server to apply this token.',
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate token' },
      { status: 500 },
    );
  }
}
