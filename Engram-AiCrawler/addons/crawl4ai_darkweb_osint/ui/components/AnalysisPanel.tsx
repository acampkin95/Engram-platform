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

export default AnalysisPanel;
