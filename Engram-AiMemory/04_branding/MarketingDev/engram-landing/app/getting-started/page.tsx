'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/app/components/ui/Button';
import * as Icons from 'lucide-react';

interface Step {
  number: number;
  title: string;
  description: string;
  content: React.ReactNode;
}

const steps: Step[] = [
  {
    number: 1,
    title: 'Prerequisites',
    description: 'Ensure you have all required tools installed',
    content: (
      <div className="space-y-6">
        <p className="text-[var(--text-secondary)] leading-relaxed">
          Before setting up Engram, make sure you have the following installed:
        </p>

        <div className="space-y-3">
          {[
            { tool: 'Docker Desktop', version: '24+', description: 'Container runtime' },
            { tool: 'Node.js', version: '20+', description: 'JavaScript runtime (for MCP)' },
            { tool: 'Python', version: '3.11+', description: 'Python interpreter (for local dev)' },
            { tool: 'Git', version: 'latest', description: 'Version control' },
          ].map((item) => (
            <div
              key={item.tool}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface-1)] p-4 flex items-start justify-between hover:border-[var(--engram-amber)] transition-colors duration-200"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[var(--engram-amber)]" />
                  <h4 className="font-[var(--font-display)] font-semibold text-[var(--text-primary)]">
                    {item.tool}
                  </h4>
                </div>
                <p className="text-sm text-[var(--text-secondary)] mt-1">{item.description}</p>
              </div>
              <span className="px-3 py-1.5 rounded-lg text-xs font-[var(--font-mono)] bg-[var(--layer-1)] text-[var(--engram-teal)] whitespace-nowrap ml-4">
                {item.version}
              </span>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-[var(--engram-amber)] border-opacity-30 bg-gradient-to-r from-[var(--engram-amber)] to-[var(--engram-amber)] bg-opacity-5 p-4">
          <p className="text-sm text-[var(--text-primary)] leading-relaxed">
            <strong className="text-[var(--engram-amber)]">Tip:</strong> Use{' '}
            <code className="font-[var(--font-mono)] bg-[var(--layer-1)] px-2 py-1 rounded">
              brew --version
            </code>{' '}
            or{' '}
            <code className="font-[var(--font-mono)] bg-[var(--layer-1)] px-2 py-1 rounded">
              docker --version
            </code>{' '}
            to check installed versions.
          </p>
        </div>
      </div>
    ),
  },
  {
    number: 2,
    title: 'Clone & Configure',
    description: 'Get the source code and set up environment variables',
    content: (
      <div className="space-y-6">
        <p className="text-[var(--text-secondary)] leading-relaxed">
          Clone the Engram repository and prepare your environment:
        </p>

        <div className="space-y-6">
          <div>
            <h4 className="font-[var(--font-display)] font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-[var(--engram-amber)]" />
              Clone the repository
            </h4>

            <CodeBlock
              language="bash"
              lines={[
                '$ git clone https://github.com/engram/engram-platform.git',
                '$ cd engram-platform',
              ]}
              color="amber"
            />
          </div>

          <div>
            <h4 className="font-[var(--font-display)] font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-[var(--engram-violet)]" />
              Copy and configure .env
            </h4>

            <CodeBlock language="bash" lines={['$ cp .env.example .env']} color="violet" />

            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-1)] p-5 space-y-3 mt-4">
              <p className="text-sm font-[var(--font-display)] font-semibold text-[var(--text-primary)]">
                Key environment variables to set:
              </p>

              <div className="space-y-2 text-sm font-[var(--font-mono)]">
                {[
                  {
                    key: 'EMBEDDING_PROVIDER',
                    values: 'openai, deepinfra, nomic, ollama, local',
                  },
                  {
                    key: 'WEAVIATE_URL',
                    values: 'http://localhost:8080 (or remote)',
                  },
                  { key: 'JWT_SECRET', values: 'Generate with: openssl rand -hex 32' },
                  {
                    key: 'CLERK_PUBLISHABLE_KEY',
                    values: 'From clerk.com dashboard',
                  },
                  {
                    key: 'CLERK_SECRET_KEY',
                    values: 'From clerk.com dashboard',
                  },
                ].map((env) => (
                  <div key={env.key} className="flex items-start gap-2">
                    <span className="text-[var(--engram-amber)] font-semibold">{env.key}</span>
                    <span className="text-[var(--text-muted)]">=</span>
                    <span className="text-[var(--text-secondary)]">{env.values}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
  },
  {
    number: 3,
    title: 'Launch Services',
    description: 'Start all Engram services with Docker Compose',
    content: (
      <div className="space-y-6">
        <p className="text-[var(--text-secondary)] leading-relaxed">
          Deploy the entire platform with a single command:
        </p>

        <CodeBlock
          language="bash"
          lines={['$ docker compose up -d']}
          color="teal"
          filename="Terminal"
        />

        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-1)] p-5">
          <h4 className="font-[var(--font-display)] font-semibold text-[var(--text-primary)] mb-4">
            Service startup order (automatic):
          </h4>

          <div className="space-y-2.5">
            {[
              { service: 'Weaviate', port: '8080', desc: 'Vector database' },
              { service: 'Redis (Crawler)', port: '6379', desc: 'Cache layer' },
              { service: 'Redis (Memory)', port: '6379', desc: 'Cache layer' },
              { service: 'Memory API', port: '8000', desc: 'Vector memory service' },
              { service: 'Crawler API', port: '11235', desc: 'OSINT engine' },
              { service: 'Platform Frontend', port: '3002', desc: 'Dashboard UI' },
              { service: 'MCP Server', port: '3000', desc: 'Protocol bridge' },
            ].map((s) => (
              <div key={s.service} className="flex items-start gap-3 text-sm group">
                <div className="flex-shrink-0 w-5 h-5 rounded-full bg-[var(--engram-teal)] bg-opacity-10 flex items-center justify-center mt-0.5 group-hover:bg-opacity-20 transition-colors">
                  <Icons.Check size={12} className="text-[var(--engram-teal)]" strokeWidth={3} />
                </div>
                <div className="flex-1">
                  <span className="font-[var(--font-mono)] text-[var(--text-primary)]">
                    {s.service}
                  </span>
                  <span className="text-[var(--text-muted)]"> ({s.port}) — {s.desc}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg bg-[var(--layer-1)] p-3 border border-[var(--border)]">
          <p className="text-sm text-[var(--text-secondary)] font-[var(--font-mono)]">
            Monitor logs with:{' '}
            <code className="text-[var(--engram-teal)] font-semibold">docker compose logs -f</code>
          </p>
        </div>
      </div>
    ),
  },
  {
    number: 4,
    title: 'Verify Health',
    description: 'Check that all services are running correctly',
    content: (
      <div className="space-y-6">
        <p className="text-[var(--text-secondary)] leading-relaxed">
          Test each service with health check endpoints:
        </p>

        <div className="space-y-5">
          {[
            {
              service: 'Memory API',
              curl: 'curl http://localhost:8000/health',
              color: 'amber',
            },
            {
              service: 'Crawler API',
              curl: 'curl http://localhost:11235/health',
              color: 'violet',
            },
            {
              service: 'Platform Dashboard',
              curl: 'curl http://localhost:3002',
              color: 'rose',
            },
          ].map((check) => (
            <div key={check.service}>
              <h4 className="font-[var(--font-display)] font-semibold text-[var(--text-primary)] mb-2 flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: `var(--engram-${check.color})` }} />
                {check.service}
              </h4>

              <CodeBlock
                language="bash"
                lines={[`$ ${check.curl}`]}
                color={check.color as any}
              />
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-[var(--engram-teal)] border-opacity-30 bg-gradient-to-r from-[var(--engram-teal)] to-[var(--engram-teal)] bg-opacity-5 p-4">
          <p className="text-sm text-[var(--text-primary)] leading-relaxed">
            <strong className="text-[var(--engram-teal)]">Success:</strong> All services return HTTP
            200 with status <code className="font-[var(--font-mono)] bg-[var(--layer-1)] px-2 py-1 rounded">
              {"{ healthy: true }"}
            </code>
          </p>
        </div>
      </div>
    ),
  },
  {
    number: 5,
    title: 'Connect MCP',
    description: 'Configure AI clients to use the MCP server',
    content: (
      <div className="space-y-6">
        <p className="text-[var(--text-secondary)] leading-relaxed">
          Install and configure the MCP server for Claude Desktop and Claude Code:
        </p>

        <div className="space-y-6">
          <div>
            <h4 className="font-[var(--font-display)] font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-[var(--engram-teal)]" />
              Install globally
            </h4>

            <CodeBlock
              language="bash"
              lines={['$ npx @engram/mcp init']}
              color="teal"
            />
          </div>

          <div>
            <h4 className="font-[var(--font-display)] font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-[var(--engram-amber)]" />
              Claude Desktop config
            </h4>

            <p className="text-sm text-[var(--text-secondary)] mb-3">
              Edit{' '}
              <code className="font-[var(--font-mono)] bg-[var(--layer-1)] px-2 py-1 rounded">
                ~/.claude/config.json
              </code>
              :
            </p>

            <CodeBlock
              language="json"
              filename="~/.claude/config.json"
              lines={[
                '{',
                '  "mcpServers": {',
                '    "engram": {',
                '      "command": "node",',
                '      "args": [',
                '        ".../engram-mcp/dist/server.js"',
                '      ]',
                '    }',
                '  }',
                '}',
              ]}
              color="amber"
            />
          </div>

          <div>
            <h4 className="font-[var(--font-display)] font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-[var(--engram-violet)]" />
              Claude Code config
            </h4>

            <p className="text-sm text-[var(--text-secondary)] mb-3">
              Add MCP server URL to your development environment:
            </p>

            <CodeBlock
              language="bash"
              lines={['$ export MCP_URL="http://localhost:3000"']}
              color="violet"
            />
          </div>
        </div>
      </div>
    ),
  },
  {
    number: 6,
    title: 'First Operation',
    description: 'Store your first memory and test the system',
    content: (
      <div className="space-y-6">
        <p className="text-[var(--text-secondary)] leading-relaxed">
          Create and retrieve a memory to verify the platform is working:
        </p>

        <CodeBlock
          language="python"
          filename="test_memory.py"
          lines={[
            'import httpx',
            '',
            '# Create HTTP client',
            'client = httpx.AsyncClient(base_url="http://localhost:8000")',
            '',
            '# Store a memory',
            'memory = await client.post(',
            '  "/memories",',
            '  json={',
            '    "content": "Engram is running!",',
            '    "tier": "project",',
            '    "metadata": {',
            '      "source": "getting-started",',
            '      "importance": "high"',
            '    }',
            '  }',
            ')',
            '',
            'memory_data = memory.json()',
            'print(f"✓ Stored: {memory_data[\'id\']}")',
            '',
            '# Search memories',
            'results = await client.post(',
            '  "/rag/query",',
            '  json={',
            '    "query": "What is Engram?",',
            '    "top_k": 3',
            '  }',
            ')',
            '',
            'for result in results.json()["results"]:',
            '  print(f"- {result[\'content\']}")',
            '  print(f"  (Score: {result[\'score\']})")',
          ]}
          color="rose"
        />

        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-1)] p-5">
          <h4 className="font-[var(--font-display)] font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-[var(--engram-teal)]" />
            Next steps:
          </h4>

          <ul className="space-y-2.5 text-sm">
            {[
              'Browse stored memories in the Dashboard',
              'Run your first OSINT scan via Crawler API',
              'Explore knowledge graph in Platform UI',
              'Read the full documentation',
            ].map((step) => (
              <li key={step} className="flex items-start gap-2 group">
                <div className="flex-shrink-0 w-5 h-5 rounded-full bg-[var(--engram-teal)] bg-opacity-10 flex items-center justify-center mt-0.5 group-hover:bg-opacity-20 transition-colors">
                  <Icons.ArrowRight size={12} className="text-[var(--engram-teal)]" strokeWidth={3} />
                </div>
                <span className="text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors">
                  {step}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    ),
  },
];

interface CodeBlockProps {
  language: string;
  lines: string[];
  color: 'amber' | 'violet' | 'teal' | 'rose';
  filename?: string;
}

function CodeBlock({ language, lines, color, filename }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const codeContent = lines.join('\n');

  const handleCopy = () => {
    navigator.clipboard.writeText(codeContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative">
      {filename && (
        <div
          className="text-xs font-[var(--font-mono)] text-[var(--text-muted)] px-5 py-2 bg-[var(--layer-1)] rounded-t-xl border-b border-[var(--border)]"
          style={{ borderBottomColor: `var(--engram-${color})` }}
        >
          {filename}
        </div>
      )}

      <div
        className={`rounded-${filename ? 'b' : ''}-xl p-5 font-[var(--font-mono)] text-sm bg-[var(--layer-2)] overflow-x-auto group`}
        style={{
          borderLeft: `3px solid var(--engram-${color})`,
        }}
      >
        <div className="space-y-1">
          {lines.map((line, idx) => (
            <div key={idx} className="flex items-start gap-3">
              <span className="text-[var(--text-muted)] select-none w-6 text-right flex-shrink-0 opacity-50">
                {idx + 1}
              </span>
              <span
                className="text-[var(--text-primary)]"
                style={{
                  color: line.startsWith('$')
                    ? `var(--engram-${color})`
                    : 'var(--text-primary)',
                }}
              >
                {line}
              </span>
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={handleCopy}
        className="absolute top-3 right-3 px-2.5 py-1.5 rounded-lg text-xs font-[var(--font-mono)] bg-[var(--layer-1)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-1)] border border-[var(--border)] hover:border-[var(--engram-amber)] transition-all duration-200 opacity-0 group-hover:opacity-100"
        title="Copy code"
      >
        {copied ? (
          <span className="text-[var(--engram-teal)]">✓ Copied</span>
        ) : (
          <Icons.Copy size={12} className="inline mr-1" />
        )}
        {!copied && 'Copy'}
      </button>
    </div>
  );
}

export default function GettingStartedPage() {
  const [activeStep, setActiveStep] = useState(1);
  const [mounted, setMounted] = useState(false);
  const currentStep = steps.find((s) => s.number === activeStep);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activeStep]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && activeStep > 1) {
        setActiveStep(activeStep - 1);
      } else if (e.key === 'ArrowRight' && activeStep < steps.length) {
        setActiveStep(activeStep + 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeStep]);

  if (!mounted) return null;

  const progressPercent = (activeStep / steps.length) * 100;

  return (
    <div className="min-h-screen bg-[var(--void)]">
      {/* Page H1 - for SEO and semantics */}
      <h1 className="sr-only">Getting Started with Engram</h1>

      {/* Progress Bar */}
      <div className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--void)]/95 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-[var(--font-display)] font-bold text-2xl text-[var(--text-primary)]">
              Getting Started
            </h2>
            <div className="flex items-center gap-4">
              <span className="font-[var(--font-mono)] text-sm text-[var(--text-secondary)]">
                {Math.round(progressPercent)}%
              </span>
              <span className="font-[var(--font-mono)] text-sm text-[var(--text-muted)]">
                Step {activeStep} of {steps.length}
              </span>
            </div>
          </div>

          {/* Progress bar with glow */}
          <div className="relative w-full h-2 rounded-full bg-[var(--layer-1)] overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[var(--engram-amber)] to-[var(--engram-amber)] transition-all duration-500 ease-out shadow-lg shadow-[var(--engram-amber)]/20"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-12 lg:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 lg:gap-12">
          {/* Stepper (left) - hidden on mobile */}
          <div className="hidden lg:block lg:col-span-1">
            <div className="space-y-2 sticky top-32">
              {steps.map((step, idx) => {
                const isActive = step.number === activeStep;
                const isCompleted = step.number < activeStep;
                const isFuture = step.number > activeStep;

                return (
                  <div key={step.number} className="relative">
                    <button
                      onClick={() => setActiveStep(step.number)}
                      className="w-full text-left group"
                      aria-current={isActive ? 'step' : undefined}
                    >
                      <div className="flex items-start gap-3">
                        {/* Circle with state */}
                        <div
                          className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 border-2 font-[var(--font-mono)] font-bold text-sm"
                          style={{
                            background: isActive
                              ? 'var(--engram-amber)'
                              : isCompleted
                                ? 'var(--engram-teal)'
                                : isFuture
                                  ? 'var(--surface-2)'
                                  : 'var(--layer-1)',
                            borderColor: isActive
                              ? 'var(--engram-amber)'
                              : isCompleted
                                ? 'var(--engram-teal)'
                                : 'var(--border)',
                            color: isActive || isCompleted ? 'var(--void)' : 'var(--text-muted)',
                            boxShadow: isActive
                              ? '0 0 20px rgba(242, 169, 59, 0.3)'
                              : 'none',
                          }}
                        >
                          {isCompleted ? (
                            <svg
                              width="18"
                              height="18"
                              viewBox="0 0 18 18"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <polyline points="16 5 7 14 2 9" />
                            </svg>
                          ) : (
                            step.number
                          )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 pt-1">
                          <h3
                            className="font-[var(--font-display)] font-semibold text-sm transition-all duration-300"
                            style={{
                              color: isActive
                                ? 'var(--engram-amber)'
                                : isCompleted
                                  ? 'var(--engram-teal)'
                                  : 'var(--text-secondary)',
                            }}
                          >
                            {step.title}
                          </h3>

                          <p className="text-xs text-[var(--text-muted)] mt-1 line-clamp-2">
                            {step.description}
                          </p>
                        </div>

                        {/* Connector Line */}
                        {idx < steps.length - 1 && (
                          <div
                            className="absolute left-4 w-0.5"
                            style={{
                              top: '100%',
                              height: '48px',
                              background:
                                isCompleted || isActive
                                  ? `linear-gradient(to bottom, ${isCompleted ? 'var(--engram-teal)' : 'var(--engram-amber)'}, ${steps[idx + 1].number < activeStep ? 'var(--engram-teal)' : 'var(--border)'})`
                                  : 'var(--border)',
                              marginTop: '8px',
                            }}
                          />
                        )}
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Content (right) */}
          <div className="lg:col-span-3">
            {currentStep && (
              <div className="space-y-8 animate-in fade-in duration-300">
                {/* Header */}
                <div className="space-y-3">
                  <div className="flex items-start gap-4">
                    <div
                      className="flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center font-[var(--font-display)] font-bold text-lg"
                      style={{
                        background: 'var(--engram-amber)',
                        color: 'var(--void)',
                        boxShadow: '0 0 24px rgba(242, 169, 59, 0.25)',
                      }}
                    >
                      {currentStep.number}
                    </div>

                    <div className="flex-1">
                      <h2 className="font-[var(--font-display)] font-bold text-2xl lg:text-3xl text-[var(--text-primary)]">
                        {currentStep.title}
                      </h2>
                      <p className="text-[var(--text-secondary)] text-sm lg:text-base mt-1">
                        {currentStep.description}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Step Content */}
                <div className="space-y-6">{currentStep.content}</div>

                {/* Navigation */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pt-8 border-t border-[var(--border)]">
                  <Button
                    variant="secondary"
                    disabled={activeStep === 1}
                    onClick={() => setActiveStep(Math.max(1, activeStep - 1))}
                    className="flex items-center justify-center gap-2 w-full sm:w-auto"
                  >
                    {activeStep > 1 && <Icons.ArrowLeft size={16} />}
                    Previous
                  </Button>

                  {activeStep < steps.length ? (
                    <Button
                      onClick={() => setActiveStep(activeStep + 1)}
                      className="flex items-center justify-center gap-2 w-full sm:w-auto bg-[var(--engram-amber)] hover:bg-[var(--engram-amber)]/90"
                    >
                      Next
                      <Icons.ArrowRight size={16} />
                    </Button>
                  ) : (
                    <div className="text-center sm:text-right w-full sm:w-auto">
                      <p className="text-[var(--text-secondary)] text-sm mb-1.5">
                        You're all set!
                      </p>
                      <p className="font-[var(--font-mono)] text-sm text-[var(--engram-teal)] font-semibold">
                        → Visit localhost:3002
                      </p>
                    </div>
                  )}
                </div>

                {/* Keyboard hint */}
                <div className="text-xs text-[var(--text-muted)] text-center mt-4">
                  Use arrow keys to navigate
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
