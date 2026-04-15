import path from 'node:path';
import { apiKey } from '@better-auth/api-key';
import { betterAuth } from 'better-auth';
import Database from 'better-sqlite3';

const dbPath = process.env.AUTH_DB_PATH ?? path.join(process.cwd(), 'auth.db');

export const auth = betterAuth({
  database: new Database(dbPath),
  baseURL: process.env.BETTER_AUTH_URL ?? 'http://localhost:3002',
  secret: process.env.BETTER_AUTH_SECRET,
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },
  socialProviders: {
    google: {
      enabled: Boolean(process.env.GOOGLE_CLIENT_ID),
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // refresh if older than 1 day
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // 5 min client-side cache
    },
  },
  plugins: [
    apiKey({
      enableSessionForAPIKeys: true,
      defaultPrefix: 'ek',
      rateLimit: {
        enabled: true,
        timeWindow: 60 * 1000, // 1 minute
        maxRequests: 120,
      },
    }),
  ],
  trustedOrigins: [
    process.env.BETTER_AUTH_URL ?? 'http://localhost:3002',
    'https://memory.velocitydigi.com',
    'https://engram.velocitydigi.com',
    'http://localhost:3002',
    `http://localhost:${process.env.PORT || 3000}`,
  ],
});

export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;
