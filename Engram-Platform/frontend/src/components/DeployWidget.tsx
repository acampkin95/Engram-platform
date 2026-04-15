'use client';

import { Check, Copy, Terminal } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/src/design-system/components/Button';
import { Card } from '@/src/design-system/components/Card';

const DEPLOY_COMMAND = 'docker compose -f Engram-Platform/docker-compose.yml up -d';

export function DeployWidget() {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(DEPLOY_COMMAND);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card
      header={
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-[var(--color-amber)]" />
          <span className="text-sm font-semibold text-[var(--color-text-primary)]">
            Quick Deploy
          </span>
        </div>
      }
    >
      <div className="relative">
        <code className="block bg-[#0d0d1a] rounded p-3 text-sm font-mono text-[var(--color-teal)] overflow-x-auto">
          {DEPLOY_COMMAND}
        </code>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopy}
          className="absolute right-2 top-2"
          aria-label="Copy command"
        >
          {copied ? (
            <>
              <Check className="w-4 h-4 mr-1" />
              <span className="text-xs">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-4 h-4 mr-1" />
              <span className="text-xs">Copy</span>
            </>
          )}
        </Button>
      </div>
    </Card>
  );
}
