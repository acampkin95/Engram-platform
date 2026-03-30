import type { Metadata } from 'next';
import KeysContent from './KeysContent';

export const metadata: Metadata = {
  title: 'API Keys | Engram System',
  description: 'Manage API keys for the Engram memory system.',
};

export default function ApiKeysPage() {
  return <KeysContent />;
}
