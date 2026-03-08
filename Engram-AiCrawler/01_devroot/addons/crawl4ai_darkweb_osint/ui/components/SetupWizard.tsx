import React, { useState } from 'react';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  Shield, Server, Brain, CheckCircle, XCircle,
  Loader2, ArrowRight, ArrowLeft, Settings
} from 'lucide-react';

interface WizardState {
  step: number;
  torHost: string;
  torPort: string;
  llmProvider: string;
  llmModel: string;
  llmBaseUrl: string;
  llmApiKey: string;
  torValid: boolean | null;
  llmValid: boolean | null;
  testing: boolean;
}

const LLM_PROVIDERS = [
  { value: 'lmstudio', label: 'LM Studio', defaultUrl: 'http://localhost:1234/v1', defaultModel: 'glm-5', requiresKey: false },
  { value: 'ollama', label: 'Ollama', defaultUrl: 'http://localhost:11434/v1', defaultModel: 'llama3', requiresKey: false },
  { value: 'openai', label: 'OpenAI', defaultUrl: 'https://api.openai.com/v1', defaultModel: 'gpt-4', requiresKey: true },
  { value: 'anthropic', label: 'Anthropic', defaultUrl: 'https://api.anthropic.com/v1', defaultModel: 'claude-3-opus', requiresKey: true },
  { value: 'minimax', label: 'Minimax', defaultUrl: 'https://api.minimax.chat/v1', defaultModel: 'minimax-m2.5-highspeed', requiresKey: true },
];

const STEPS = [
  { id: 1, title: 'Welcome', icon: Shield },
  { id: 2, title: 'Tor Proxy', icon: Server },
  { id: 3, title: 'LLM Provider', icon: Brain },
  { id: 4, title: 'Validation', icon: CheckCircle },
  { id: 5, title: 'Complete', icon: Settings },
];

export function SetupWizard({ onComplete }: { onComplete?: () => void }) {
  const [state, setState] = useState<WizardState>({
    step: 1,
    torHost: '127.0.0.1',
    torPort: '9050',
    llmProvider: 'lmstudio',
    llmModel: 'glm-5',
    llmBaseUrl: 'http://localhost:1234/v1',
    llmApiKey: '',
    torValid: null,
    llmValid: null,
    testing: false,
  });

  const currentProvider = LLM_PROVIDERS.find(p => p.value === state.llmProvider);

  const handleNext = () => {
    if (state.step < 5) {
      setState(s => ({ ...s, step: s.step + 1 }));
    }
  };

  const handleBack = () => {
    if (state.step > 1) {
      setState(s => ({ ...s, step: s.step - 1 }));
    }
  };

  const testTorConnection = async () => {
    setState(s => ({ ...s, testing: true }));
    try {
      const response = await fetch('/api/darkweb/config/validate-tor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ host: state.torHost, port: parseInt(state.torPort) }),
      });
      const data = await response.json();
      setState(s => ({ ...s, torValid: data.valid, testing: false }));
    } catch {
      setState(s => ({ ...s, torValid: false, testing: false }));
    }
  };

  const testLlmConnection = async () => {
    setState(s => ({ ...s, testing: true }));
    try {
      const response = await fetch('/api/darkweb/config/validate-llm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: state.llmProvider,
          model: state.llmModel,
          base_url: state.llmBaseUrl,
          api_key: state.llmApiKey || undefined,
        }),
      });
      const data = await response.json();
      setState(s => ({ ...s, llmValid: data.valid, testing: false }));
    } catch {
      setState(s => ({ ...s, llmValid: false, testing: false }));
    }
  };

  const saveConfig = async () => {
    try {
      await fetch('/api/darkweb/config/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tor_host: state.torHost,
          tor_port: parseInt(state.torPort),
          llm_provider: state.llmProvider,
          llm_model: state.llmModel,
          llm_base_url: state.llmBaseUrl,
          llm_api_key: state.llmApiKey || undefined,
        }),
      });
      onComplete?.();
    } catch (e) {
      console.error('Failed to save config:', e);
    }
  };

  const renderStep = () => {
    switch (state.step) {
      case 1:
        return (
          <div className="space-y-4 text-center">
            <Shield className="h-16 w-16 mx-auto text-primary" />
            <h2 className="text-2xl font-bold">Welcome to Dark Web OSINT</h2>
            <p className="text-muted-foreground">
              This wizard will help you configure the Dark Web OSINT addon for Crawl4AI.
              You'll need a Tor proxy and optionally an LLM provider for advanced analysis.
            </p>
            <div className="bg-muted p-4 rounded-lg text-left">
              <h3 className="font-semibold mb-2">What you'll need:</h3>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>Tor proxy (SOCKS5) - required for dark web access</li>
                <li>LLM provider (optional) - for query refinement and analysis</li>
              </ul>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Server className="h-5 w-5" />
              <h2 className="text-xl font-semibold">Tor Proxy Configuration</h2>
            </div>

            <div className="grid gap-4">
              <div>
                <Label htmlFor="torHost">Tor Proxy Host</Label>
                <Input
                  id="torHost"
                  value={state.torHost}
                  onChange={e => setState(s => ({ ...s, torHost: e.target.value }))}
                  placeholder="127.0.0.1"
                />
              </div>
              <div>
                <Label htmlFor="torPort">Tor SOCKS Port</Label>
                <Input
                  id="torPort"
                  type="number"
                  value={state.torPort}
                  onChange={e => setState(s => ({ ...s, torPort: e.target.value }))}
                  placeholder="9050"
                />
              </div>
            </div>

            <Button onClick={testTorConnection} disabled={state.testing} variant="outline">
              {state.testing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Test Connection
            </Button>

            {state.torValid !== null && (
              <div className={`flex items-center gap-2 ${state.torValid ? 'text-green-500' : 'text-red-500'}`}>
                {state.torValid ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                <span>{state.torValid ? 'Tor connection successful!' : 'Tor connection failed'}</span>
              </div>
            )}
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5" />
              <h2 className="text-xl font-semibold">LLM Provider</h2>
            </div>

            <div>
              <Label>Provider</Label>
              <Select
                value={state.llmProvider}
                onValueChange={val => {
                  const provider = LLM_PROVIDERS.find(p => p.value === val);
                  setState(s => ({
                    ...s,
                    llmProvider: val,
                    llmModel: provider?.defaultModel || '',
                    llmBaseUrl: provider?.defaultUrl || '',
                  }));
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LLM_PROVIDERS.map(p => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Model</Label>
              <Input
                value={state.llmModel}
                onChange={e => setState(s => ({ ...s, llmModel: e.target.value }))}
                placeholder={currentProvider?.defaultModel}
              />
            </div>

            <div>
              <Label>Base URL</Label>
              <Input
                value={state.llmBaseUrl}
                onChange={e => setState(s => ({ ...s, llmBaseUrl: e.target.value }))}
                placeholder={currentProvider?.defaultUrl}
              />
            </div>

            {currentProvider?.requiresKey && (
              <div>
                <Label>API Key</Label>
                <Input
                  type="password"
                  value={state.llmApiKey}
                  onChange={e => setState(s => ({ ...s, llmApiKey: e.target.value }))}
                  placeholder="Enter API key..."
                />
              </div>
            )}

            <Button onClick={testLlmConnection} disabled={state.testing} variant="outline">
              {state.testing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Test Connection
            </Button>

            {state.llmValid !== null && (
              <div className={`flex items-center gap-2 ${state.llmValid ? 'text-green-500' : 'text-red-500'}`}>
                {state.llmValid ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                <span>{state.llmValid ? 'LLM connection successful!' : 'LLM connection failed'}</span>
              </div>
            )}
          </div>
        );

      case 4:
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              <h2 className="text-xl font-semibold">Review Configuration</h2>
            </div>

            <Card>
              <CardContent className="pt-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tor Proxy:</span>
                  <span>{state.torHost}:{state.torPort}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">LLM Provider:</span>
                  <span>{currentProvider?.label}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Model:</span>
                  <span>{state.llmModel}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Base URL:</span>
                  <span className="text-xs">{state.llmBaseUrl}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case 5:
        return (
          <div className="space-y-4 text-center">
            <CheckCircle className="h-16 w-16 mx-auto text-green-500" />
            <h2 className="text-2xl font-bold">Setup Complete!</h2>
            <p className="text-muted-foreground">
              Your Dark Web OSINT addon is now configured. You can start using the dashboard.
            </p>
            <Button onClick={saveConfig} className="w-full">
              Save & Start Using
            </Button>
          </div>
        );

      default:
        return null;
    }
  };

  const progress = ((state.step - 1) / (STEPS.length - 1)) * 100;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Progress */}
      <div className="space-y-2">
        <Progress value={progress} className="h-2" />
        <div className="flex justify-between">
          {STEPS.map(step => {
            const Icon = step.icon;
            return (
              <div
                key={step.id}
                className={`flex flex-col items-center text-xs ${
                  state.step >= step.id ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                <Icon className="h-4 w-4 mb-1" />
                {step.title}
              </div>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <Card>
        <CardContent className="pt-6">
          {renderStep()}
        </CardContent>
      </Card>

      {/* Navigation */}
      {state.step < 5 && (
        <div className="flex justify-between">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={state.step === 1}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <Button onClick={handleNext}>
            {state.step === 4 ? 'Save' : 'Next'}
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      )}
    </div>
  );
}

export default SetupWizard;
