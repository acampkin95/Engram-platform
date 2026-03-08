import type { ReactNode } from'react';

interface AuthProviderProps {
 children: ReactNode;
}

export function ClerkProvider({ children }: AuthProviderProps) {
 return <>{children}</>;
}
