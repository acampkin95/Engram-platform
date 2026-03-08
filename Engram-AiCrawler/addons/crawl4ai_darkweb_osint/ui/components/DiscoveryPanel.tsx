import React, { useState } from 'react';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Search, Loader2, ExternalLink, Globe } from 'lucide-react';

interface SearchResult {
  url: string;
  title: string;
  description: string;
  engine: string;
  rank: number;
  is_onion: boolean;
  timestamp: string;
}

interface EngineInfo {
  name: string;
  display_name: string;
  status: string;
  requires_onion: boolean;
}

export function DiscoveryPanel() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [engines, setEngines] = useState<EngineInfo[]>([]);
  const [selectedEngines, setSelectedEngines] = useState<string[]>([]);
  const [refineQuery, setRefineQuery] = useState(true);

  React.useEffect(() => {
    fetchEngines();
  }, []);

  const fetchEngines = async () => {
    try {
      const response = await fetch('/api/darkweb/engines/status');
      const data = await response.json();
      setEngines(data.engines || []);
    } catch (e) {
      console.error('Failed to fetch engines:', e);
    }
  };

  const handleSearch = async () => {
    if (!query.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/darkweb/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          engines: selectedEngines.length > 0 ? selectedEngines : undefined,
          refine_query: refineQuery,
          deduplicate: true,
        }),
      });

      if (!response.ok) {
        throw new Error('Search failed');
      }

      const data = await response.json();
      setResults(data.results || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  const toggleEngine = (name: string) => {
    setSelectedEngines(prev =>
      prev.includes(name)
        ? prev.filter(e => e !== name)
        : [...prev, name]
    );
  };

  return (
    <div className="space-y-6">
      {/* Search Form */}
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Search Dark Web</h2>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Enter search query..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="flex-1"
            />
            <Button onClick={handleSearch} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="refine"
              checked={refineQuery}
              onCheckedChange={(checked) => setRefineQuery(checked as boolean)}
            />
            <label htmlFor="refine" className="text-sm">
              Refine query with LLM
            </label>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Engines</label>
            <div className="flex flex-wrap gap-2">
              {engines.map((engine) => (
                <Badge
                  key={engine.name}
                  variant={selectedEngines.includes(engine.name) ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => toggleEngine(engine.name)}
                >
                  {engine.display_name}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error Display */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      <div className="space-y-4">
        {results.map((result, index) => (
          <Card key={index}>
            <CardContent className="pt-4">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    {result.is_onion && (
                      <Badge variant="secondary" className="text-xs">
                        <Globe className="h-3 w-3 mr-1" />
                        .onion
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-xs">
                      {result.engine}
                    </Badge>
                  </div>
                  <h3 className="font-medium">{result.title}</h3>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {result.description}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => window.open(result.url, '_blank')}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {results.length === 0 && !loading && query && (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            No results found. Try a different query.
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default DiscoveryPanel;
