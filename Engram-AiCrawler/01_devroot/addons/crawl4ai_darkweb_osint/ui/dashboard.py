"""
Dark Web OSINT Dashboard UI.

Provides the main dashboard page and component exports for the frontend.
This module serves as the bridge between Python backend and React frontend.
"""

from dataclasses import dataclass
from typing import Any
from enum import Enum


class DashboardTab(str, Enum):
    """Available dashboard tabs."""

    DISCOVERY = "discovery"
    EXTRACTION = "extraction"
    ANALYSIS = "analysis"
    SETTINGS = "settings"


@dataclass
class NavItem:
    """Navigation item configuration."""

    id: str
    label: str
    icon: str
    path: str


# Navigation configuration for the dashboard
DASHBOARD_NAV: list[NavItem] = [
    NavItem(
        id="discovery",
        label="Discovery",
        icon="search",
        path="/darkweb/discovery",
    ),
    NavItem(
        id="extraction",
        label="Extraction",
        icon="download",
        path="/darkweb/extraction",
    ),
    NavItem(
        id="analysis",
        label="Analysis",
        icon="chart-bar",
        path="/darkweb/analysis",
    ),
    NavItem(
        id="settings",
        label="Settings",
        icon="cog",
        path="/darkweb/settings",
    ),
]


# Dashboard configuration
DASHBOARD_CONFIG = {
    "title": "Dark Web OSINT",
    "description": "Search and analyze dark web content via Tor",
    "icon": "shield",
    "basePath": "/darkweb",
    "apiBase": "/api/darkweb",
    "nav": [
        {
            "id": item.id,
            "label": item.label,
            "icon": item.icon,
            "path": item.path,
        }
        for item in DASHBOARD_NAV
    ],
}


def get_dashboard_config() -> dict[str, Any]:
    """Get dashboard configuration for frontend."""
    return DASHBOARD_CONFIG


def get_routes() -> list[str]:
    """Get all routes for the dashboard."""
    return [item.path for item in DASHBOARD_NAV]


# React component definitions (exported as strings for code generation)
DISCOVERY_PANEL_COMPONENT = """
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
"""


EXTRACTION_PANEL_COMPONENT = """
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
    metadata: Record<string, any>;
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
"""


ANALYSIS_PANEL_COMPONENT = """
import React, { useState } from 'react';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, Loader2, AlertCircle } from 'lucide-react';

interface Artifact {
  type: string;
  value: string;
  context?: string;
  confidence: number;
}

interface AnalysisResult {
  success: boolean;
  analysis_id: string;
  preset: string;
  analysis: string;
  artifacts: Artifact[];
  report_markdown?: string;
}

const PRESETS = [
  { value: 'threat_intel', label: 'Threat Intelligence' },
  { value: 'ransomware_malware', label: 'Ransomware & Malware' },
  { value: 'personal_identity', label: 'Personal Identity' },
  { value: 'corporate_espionage', label: 'Corporate Espionage' },
];

export function AnalysisPanel() {
  const [content, setContent] = useState('');
  const [preset, setPreset] = useState('threat_intel');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    if (!content.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/darkweb/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          preset,
          extract_artifacts: true,
          generate_report: true,
        }),
      });

      if (!response.ok) {
        throw new Error('Analysis failed');
      }

      const data = await response.json();
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Analysis failed');
    } finally {
      setLoading(false);
    }
  };

  const groupedArtifacts = result?.artifacts.reduce((acc, artifact) => {
    if (!acc[artifact.type]) acc[artifact.type] = [];
    acc[artifact.type].push(artifact);
    return acc;
  }, {} as Record<string, Artifact[]>) || {};

  return (
    <div className="space-y-6">
      {/* Input */}
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Analyze Content</h2>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            placeholder="Paste content to analyze..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="min-h-[200px]"
          />

          <div className="flex gap-4">
            <Select value={preset} onValueChange={setPreset}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select preset" />
              </SelectTrigger>
              <SelectContent>
                {PRESETS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button onClick={handleAnalyze} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <BarChart className="h-4 w-4 mr-2" />}
              Analyze
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-destructive" />
            <p className="text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Analysis */}
          <Card>
            <CardHeader>
              <h3 className="font-semibold">Analysis</h3>
              <Badge>{PRESETS.find(p => p.value === result.preset)?.label}</Badge>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <pre className="whitespace-pre-wrap text-sm">{result.analysis}</pre>
              </div>
            </CardContent>
          </Card>

          {/* Artifacts */}
          {Object.keys(groupedArtifacts).length > 0 && (
            <Card>
              <CardHeader>
                <h3 className="font-semibold">Extracted Artifacts</h3>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries(groupedArtifacts).map(([type, artifacts]) => (
                    <div key={type}>
                      <h4 className="text-sm font-medium mb-2 capitalize">
                        {type.replace('_', ' ')} ({artifacts.length})
                      </h4>
                      <div className="space-y-1">
                        {artifacts.slice(0, 10).map((artifact, i) => (
                          <div key={i} className="flex items-center gap-2 text-sm">
                            <code className="bg-muted px-2 py-0.5 rounded text-xs">
                              {artifact.value}
                            </code>
                            {artifact.confidence < 0.8 && (
                              <Badge variant="outline" className="text-xs">
                                {Math.round(artifact.confidence * 100)}%
                              </Badge>
                            )}
                          </div>
                        ))}
                        {artifacts.length > 10 && (
                          <p className="text-xs text-muted-foreground">
                            +{artifacts.length - 10} more
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Report */}
          {result.report_markdown && (
            <Card>
              <CardHeader>
                <h3 className="font-semibold">Full Report</h3>
              </CardHeader>
              <CardContent>
                <pre className="whitespace-pre-wrap text-sm max-h-[400px] overflow-auto">
                  {result.report_markdown}
                </pre>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
"""


def get_react_components() -> dict[str, str]:
    """Get React component code for the frontend."""
    return {
        "DiscoveryPanel": DISCOVERY_PANEL_COMPONENT,
        "ExtractionPanel": EXTRACTION_PANEL_COMPONENT,
        "AnalysisPanel": ANALYSIS_PANEL_COMPONENT,
    }


def generate_typescript_types() -> str:
    """Generate TypeScript type definitions for the frontend."""
    return """
// Auto-generated types for Dark Web OSINT addon

export interface SearchResult {
  url: string;
  title: string;
  description: string;
  engine: string;
  rank: number;
  is_onion: boolean;
  timestamp: string;
}

export interface DiscoverResponse {
  success: boolean;
  query: string;
  refined_query?: string;
  alternatives: string[];
  results: SearchResult[];
  total_results: number;
  engines_used: string[];
  dedup_stats?: {
    total_input: number;
    duplicates_found: number;
    unique_output: number;
    sources: Record<string, number>;
  };
  timestamp: string;
}

export interface EngineInfo {
  name: string;
  display_name: string;
  status: 'available' | 'unavailable' | 'rate_limited' | 'error';
  requires_onion: boolean;
}

export interface ExtractedContent {
  title: string;
  content: string;
  markdown: string;
  links: string[];
  metadata: Record<string, any>;
}

export interface ExtractResponse {
  success: boolean;
  url: string;
  content?: ExtractedContent;
  error?: string;
  extraction_time: number;
  timestamp: string;
}

export interface Artifact {
  type: string;
  value: string;
  context?: string;
  confidence: number;
}

export interface AnalyzeResponse {
  success: boolean;
  analysis_id: string;
  preset: string;
  analysis: string;
  artifacts: Artifact[];
  report_markdown?: string;
  timestamp: string;
}

export type AnalysisPreset =
  | 'threat_intel'
  | 'ransomware_malware'
  | 'personal_identity'
  | 'corporate_espionage';
"""


# CLI entry point
if __name__ == "__main__":
    import argparse
    from pathlib import Path

    parser = argparse.ArgumentParser(description="Dashboard UI utilities")
    parser.add_argument("--components", action="store_true", help="Output React components")
    parser.add_argument("--types", action="store_true", help="Generate TypeScript types")
    parser.add_argument("--config", action="store_true", help="Output dashboard config")
    parser.add_argument("--output", type=str, help="Output directory")

    args = parser.parse_args()

    if args.output:
        output_dir = Path(args.output)
        output_dir.mkdir(parents=True, exist_ok=True)

    if args.components:
        components = get_react_components()
        if args.output:
            for name, code in components.items():
                (output_dir / f"{name}.tsx").write_text(code.strip())
                print(f"Generated: {output_dir / name}.tsx")
        else:
            for name, code in components.items():
                print(f"\n=== {name} ===\n")
                print(code)

    if args.types:
        types = generate_typescript_types()
        if args.output:
            (output_dir / "types.ts").write_text(types.strip())
            print(f"Generated: {output_dir / 'types.ts'}")
        else:
            print(types)

    if args.config:
        import json

        config = get_dashboard_config()
        print(json.dumps(config, indent=2))

    if not (args.components or args.types or args.config):
        parser.print_help()
