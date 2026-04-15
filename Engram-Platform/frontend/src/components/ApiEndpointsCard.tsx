'use client';

import { Check, Copy, Server } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/src/design-system/components/Button';
import { Card } from '@/src/design-system/components/Card';

const endpoints = [
  { service: 'Memory API', port: 8000, baseUrl: 'http://localhost:8000', color: '#2EC4C4' },
  { service: 'Crawler API', port: 11235, baseUrl: 'http://localhost:11235', color: '#9B7DE0' },
  { service: 'MCP Server', port: 3000, baseUrl: 'http://localhost:3000', color: '#F2A93B' },
  { service: 'Platform UI', port: 3002, baseUrl: 'http://localhost:3002', color: '#F2A93B' },
  { service: 'Weaviate', port: 8080, baseUrl: 'http://localhost:8080', color: '#2EC4C4' },
];

function EndpointRow({ endpoint }: { endpoint: (typeof endpoints)[number] }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(endpoint.baseUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center justify-between py-2 border-b border-[#1e1e3a] last:border-0">
      <div className="flex items-center gap-3">
        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: endpoint.color }} />
        <span className="text-sm text-[var(--color-text-primary)]">{endpoint.service}</span>
        <span className="text-xs font-mono text-[var(--color-text-muted)]">:{endpoint.port}</span>
      </div>
      <div className="flex items-center gap-2">
        <code className="text-xs font-mono text-[var(--color-teal)]">{endpoint.baseUrl}</code>
        <Button variant="ghost" size="icon" onClick={handleCopy} className="h-6 w-6">
          {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
        </Button>
      </div>
    </div>
  );
}

export function ApiEndpointsCard() {
  return (
    <Card
      header={
        <div className="flex items-center gap-2">
          <Server className="w-4 h-4 text-[var(--color-amber)]" />
          <span className="text-sm font-semibold text-[var(--color-text-primary)]">
            API Endpoints
          </span>
        </div>
      }
    >
      <div className="divide-y divide-[#1e1e3a]">
        {endpoints.map((ep) => (
          <EndpointRow key={ep.service} endpoint={ep} />
        ))}
      </div>
    </Card>
  );
}
