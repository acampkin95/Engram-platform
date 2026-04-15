'use client';
import * as Sentry from '@sentry/nextjs';
import { SWRConfig } from 'swr';
import { LiveRegionProvider } from '@/src/components/LiveRegion';
import { ToastContainer } from '../design-system/components/Toast';
import { URLStateProvider } from './URLStateProvider';

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <URLStateProvider>
      <LiveRegionProvider>
        <SWRConfig
          value={{
            revalidateOnFocus: false,
            revalidateOnReconnect: true,
            revalidateIfStale: true,
            dedupingInterval: 10000,
            focusThrottleInterval: 30000,
            errorRetryCount: 3,
            errorRetryInterval: 3000,
            keepPreviousData: true,
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
      </LiveRegionProvider>
    </URLStateProvider>
  );
}
