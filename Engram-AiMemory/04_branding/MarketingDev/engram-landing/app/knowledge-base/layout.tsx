import type { Metadata } from 'next';
import KBLayout from './KBLayout';

export const metadata: Metadata = {
  title: 'Knowledge Base | Engram Platform',
  description: 'Comprehensive documentation covering Engram architecture, API reference, deployment guides, security, and MCP integration.',
};

export default function KnowledgeBaseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <KBLayout>{children}</KBLayout>;
}
