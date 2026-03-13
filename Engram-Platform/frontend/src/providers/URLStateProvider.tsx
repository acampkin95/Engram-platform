'use client';

import { NuqsAdapter } from 'nuqs/adapters/next/app';
import type { ReactNode } from 'react';

interface URLStateProviderProps {
  children: ReactNode;
}

export function URLStateProvider({ children }: URLStateProviderProps) {
  return <NuqsAdapter>{children}</NuqsAdapter>;
}
