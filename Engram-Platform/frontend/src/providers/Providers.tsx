'use client';
import { ClerkProvider } from '@clerk/nextjs';
import * as Sentry from '@sentry/nextjs';
import { SWRConfig } from 'swr';
import { ToastContainer } from '../design-system/components/Toast';
import { URLStateProvider } from './URLStateProvider';

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  const isClerkEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

  const content = (
    <URLStateProvider>
      <SWRConfig
        value={{
          revalidateOnFocus: false,
          revalidateOnReconnect: true,
          dedupingInterval: 5000,
          errorRetryCount: 3,
          onError: (error) => {
            Sentry.captureException(error, {
              tags: { area: 'swr' },
            });
          },
        }}
      >
        {children}
        <ToastContainer />
      </SWRConfig>
    </URLStateProvider>
  );

  // Clerk is optional — if not configured, render without auth
  if (!isClerkEnabled) {
    return content;
  }

  // NEXT_PUBLIC_CLERK_* env vars are read automatically by @clerk/nextjs v5
  // signInUrl/signUpUrl/afterSign*Url can also be set via env vars:
  //   NEXT_PUBLIC_CLERK_SIGN_IN_URL, NEXT_PUBLIC_CLERK_SIGN_UP_URL, etc.
  return (
    <ClerkProvider
      signInUrl={process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL || '/sign-in'}
      signUpUrl={process.env.NEXT_PUBLIC_CLERK_SIGN_UP_URL || '/sign-up'}
      signInFallbackRedirectUrl={process.env.NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL || '/dashboard'}
      signUpFallbackRedirectUrl={process.env.NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL || '/dashboard'}
    >
      {content}
    </ClerkProvider>
  );
}
