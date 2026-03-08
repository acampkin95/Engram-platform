'use client';


import type { ReactNode } from 'react';

interface URLStateProviderProps {
  children: ReactNode;
}

export function URLStateProvider({ children }: URLStateProviderProps) {
  return <>{children}</>;
}
