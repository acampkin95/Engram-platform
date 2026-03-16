"use client";

import type { ReactNode } from "react";
import { SWRConfig } from "swr";

interface SWRProviderProps {
  children: ReactNode;
}

export function SWRProvider({ children }: SWRProviderProps) {
  return (
    <SWRConfig
      value={{
        onErrorRetry: (error, _key, _config, revalidate, { retryCount }) => {
          // Do not retry on 401 or 404
          if (error.status === 401 || error.status === 404) return;
          // Stop retrying after 3 attempts
          if (retryCount >= 3) return;
          // Retry after 5 seconds
          setTimeout(() => revalidate({ retryCount }), 5000);
        },
        revalidateOnFocus: false,
      }}
    >
      {children}
    </SWRConfig>
  );
}
