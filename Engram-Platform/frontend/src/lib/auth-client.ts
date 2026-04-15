import { apiKeyClient } from '@better-auth/api-key/client';
import { createAuthClient } from 'better-auth/react';

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3002',
  plugins: [apiKeyClient()],
});

export const { signIn, signOut, signUp, useSession } = authClient;
