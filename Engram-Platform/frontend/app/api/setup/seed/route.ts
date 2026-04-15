import path from 'node:path';
import Database from 'better-sqlite3';
import { type NextRequest, NextResponse } from 'next/server';

const ADMIN_EMAIL = process.env.ENGRAM_ADMIN_EMAIL || 'admin@engram.local';
const ADMIN_PASSWORD = process.env.ENGRAM_ADMIN_PASSWORD || 'EngramAdmin2026!';

function getDbPath() {
  return process.env.AUTH_DB_PATH || path.join(process.cwd(), 'auth.db');
}

function checkUserCount(): { exists: boolean; count: number } {
  try {
    const db = new Database(getDbPath(), { readonly: true });
    try {
      const row = db.prepare('SELECT COUNT(*) as count FROM user').get() as { count: number };
      return { exists: row.count > 0, count: row.count };
    } catch {
      return { exists: false, count: 0 };
    } finally {
      db.close();
    }
  } catch {
    return { exists: false, count: 0 };
  }
}

/**
 * Create BetterAuth tables if they don't exist.
 * These are hardcoded DDL statements with no user input — safe from injection.
 */
function ensureAuthTables(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS "user" (
      "id" TEXT PRIMARY KEY,
      "name" TEXT NOT NULL,
      "email" TEXT UNIQUE NOT NULL,
      "emailVerified" INTEGER DEFAULT 0,
      "image" TEXT,
      "createdAt" TEXT DEFAULT (datetime('now')),
      "updatedAt" TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS "session" (
      "id" TEXT PRIMARY KEY,
      "userId" TEXT NOT NULL REFERENCES "user"("id"),
      "token" TEXT UNIQUE NOT NULL,
      "expiresAt" TEXT NOT NULL,
      "ipAddress" TEXT,
      "userAgent" TEXT,
      "createdAt" TEXT DEFAULT (datetime('now')),
      "updatedAt" TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS "account" (
      "id" TEXT PRIMARY KEY,
      "userId" TEXT NOT NULL REFERENCES "user"("id"),
      "accountId" TEXT NOT NULL,
      "providerId" TEXT NOT NULL,
      "accessToken" TEXT,
      "refreshToken" TEXT,
      "idToken" TEXT,
      "accessTokenExpiresAt" TEXT,
      "refreshTokenExpiresAt" TEXT,
      "scope" TEXT,
      "password" TEXT,
      "createdAt" TEXT DEFAULT (datetime('now')),
      "updatedAt" TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS "verification" (
      "id" TEXT PRIMARY KEY,
      "identifier" TEXT NOT NULL,
      "value" TEXT NOT NULL,
      "expiresAt" TEXT NOT NULL,
      "createdAt" TEXT DEFAULT (datetime('now')),
      "updatedAt" TEXT DEFAULT (datetime('now'))
    );
  `);
}

export async function GET() {
  const { exists, count } = checkUserCount();
  return NextResponse.json({ seeded: exists, userCount: count });
}

export async function POST(_request: NextRequest) {
  const { exists, count } = checkUserCount();

  if (exists) {
    return NextResponse.json(
      {
        seeded: false,
        error: `${count} user(s) already exist. Delete all users first to re-seed.`,
      },
      { status: 409 },
    );
  }

  try {
    // Ensure BetterAuth tables exist before calling the signup endpoint
    const dbPath = getDbPath();
    const db = new Database(dbPath);
    try {
      ensureAuthTables(db);
    } finally {
      db.close();
    }

    const internalUrl = `http://localhost:${process.env.PORT || 3000}`;
    const signUpUrl = new URL('/api/auth/sign-up/email', internalUrl);

    const res = await fetch(signUpUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        origin: internalUrl,
      },
      body: JSON.stringify({
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        name: 'Admin',
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      const detail =
        (data as { message?: string })?.message ??
        (data as { error?: string })?.error ??
        JSON.stringify(data);
      return NextResponse.json(
        { seeded: false, error: `Auth API error: ${detail}` },
        { status: res.status },
      );
    }

    const user = (data as { user?: { id: string } })?.user;

    // Fetch bootstrap API key from Memory API (auto-created on startup)
    let bootstrapKey: string | null = null;
    try {
      const memoryApiUrl = process.env.MEMORY_API_URL || 'http://localhost:8000';
      const bootstrapRes = await fetch(`${memoryApiUrl}/admin/bootstrap-key`);
      if (bootstrapRes.ok) {
        const bootstrapData = (await bootstrapRes.json()) as { key?: string };
        bootstrapKey = bootstrapData.key ?? null;
      }
    } catch {
      // Bootstrap key fetch is best-effort
    }

    return NextResponse.json(
      {
        seeded: true,
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        userId: user?.id,
        bootstrapKey,
        message: 'Default admin created. Sign in with these credentials.',
      },
      { status: 201 },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create admin user';
    return NextResponse.json({ seeded: false, error: message }, { status: 500 });
  }
}
