import type { ReactNode } from 'react';

export default function CanvasLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <div className="h-full flex flex-col">{children}</div>;
}
