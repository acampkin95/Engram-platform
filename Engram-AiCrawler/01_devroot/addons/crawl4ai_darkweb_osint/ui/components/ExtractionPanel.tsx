import React, { useState } from 'react';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Download, Loader2, Link, FileText } from 'lucide-react';

interface ExtractionResult {
  success: boolean;
  url: string;
  content?: {
    title: string;
    content: string;
    markdown: string;
    links: string[];
    metadata: Record<string, unknown>;
  };
  error?: string;
  extraction_time: number;
}

export function ExtractionPanel() {
  const [url, setUrl] = useState('');
  const [result, setResult] = useState<ExtractionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExtract = async () => {
    if (!url.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/darkweb/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) {
        throw new Error('Extraction failed');
      }

      const data = await response.json();
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Extraction failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* URL Input */}
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Extract Content</h2>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Enter .onion URL..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleExtract()}
              className="flex-1"
            />
            <Button onClick={handleExtract} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Extract content from .onion sites via Tor proxy
          </p>
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Result */}
      {result && result.success && result.content && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{result.content.title || 'Untitled'}</h3>
                <Badge variant="outline">
                  {result.extraction_time.toFixed(2)}s
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="h-4 w-4" />
                  <span className="text-sm font-medium">Content</span>
                </div>
                <Textarea
                  value={result.content.content.slice(0, 5000)}
                  readOnly
                  className="min-h-[200px] font-mono text-sm"
                />
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Link className="h-4 w-4" />
                  <span className="text-sm font-medium">Links ({result.content.links.length})</span>
                </div>
                <div className="max-h-[200px] overflow-auto space-y-1">
                  {result.content.links.slice(0, 20).map((link, i) => (
                    <div key={i} className="text-xs text-muted-foreground truncate">
                      {link}
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

export default ExtractionPanel;
