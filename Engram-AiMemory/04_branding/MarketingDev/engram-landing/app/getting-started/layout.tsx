import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Getting Started | Engram Platform',
  description: 'Deploy the Engram Platform in minutes. Step-by-step guide covering prerequisites, Docker setup, service verification, and MCP integration.',
};

export default function GettingStartedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
