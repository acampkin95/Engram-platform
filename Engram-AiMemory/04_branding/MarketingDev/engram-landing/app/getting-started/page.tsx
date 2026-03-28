'use client';

import { useState } from 'react';
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
        <p className="text-[var(--text-secondary)]">
          Before setting up Engram, make sure you have the following installed:
        </p>

        <div className="space-y-4">
          {[
            { tool: 'Docker Desktop', version: '24+', description: 'Container runtime' },
            { tool: 'Node.js', version: '20+', description: 'JavaScript runtime (for MCP)' },
            { tool: 'Python', version: '3.11+', description: 'Python interpreter (for local dev)' },
            { tool: 'Git', version: 'latest', description: 'Version control' },
          ].map((item) => (
            <div
              key={item.tool}
              className="rounded-lg border border-[var(--border)] bg-[var(--surface-1)] p-4 flex items-start justify-between"
            >
              <div>
                <h4 className="font-[var(--font-display)] font-semibold text-[var(--text-primary)]">
                  {item.tool}
                </h4>
                <p className="text-sm text-[var(--text-secondary)]">{item.description}</p>
              </div>
              <span className="px-3 py-1 rounded text-xs font-[var(--font-mono)] bg-[var(--layer-1)] text-[var(--engram-teal)]">
                {item.version}
              </span>
            </div>
          ))}
        </div>

        <div className="rounded-lg border border-[var(--engram-amber)] bg-[var(--engram-amber-glow)] p-4">
          <p className="text-sm text-[var(--text-primary)]">
            <strong>Tip:</strong> Use{' '}
            <code className="font-[var(--font-mono)]">brew --version</code> or{' '}
            <code className="font-[var(--font-mono)]">docker --version</code> to check installed
            versions.
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
        <p className="text-[var(--text-secondary)]">
          Clone the Engram repository and prepare your environment:
        </p>

        <div className="space-y-4">
          <div>
            <h4 className="font-[var(--font-display)] font-semibold text-[var(--text-primary)] mb-3">
              Clone the repository
            </h4>

            <div className="rounded-lg p-6 font-[var(--font-mono)] text-sm bg-[var(--layer-2)] border-l-2 border-[var(--engram-amber)] overflow-x-auto">
              <div className="text-[var(--engram-amber)]">$</div>
              <div className="text-[var(--text-primary)]">
                git clone https://github.com/engram/engram-platform.git
              </div>
              <div className="text-[var(--engram-amber)] mt-2">$</div>
              <div className="text-[var(--text-primary)]">cd engram-platform</div>
            </div>
          </div>

          <div>
            <h4 className="font-[var(--font-display)] font-semibold text-[var(--text-primary)] mb-3">
              Copy and configure .env
            </h4>

            <div className="rounded-lg p-6 font-[var(--font-mono)] text-sm bg-[var(--layer-2)] border-l-2 border-[var(--engram-violet)] overflow-x-auto mb-4">
              <div className="text-[var(--engram-violet)]">$</div>
              <div className="text-[var(--text-primary)]">cp .env.example .env</div>
            </div>

            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-1)] p-4 space-y-3">
              <p className="text-sm font-[var(--font-display)] font-semibold text-[var(--text-primary)]">
                Key environment variables to set:
              </p>

              <div className="space-y-2 text-sm">
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
                  <div key={env.key} className="font-[var(--font-mono)]">
                    <span className="text-[var(--engram-amber)]">{env.key}</span>
                    <span className="text-[var(--text-muted)]"> = {env.values}</span>
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
        <p className="text-[var(--text-secondary)]">
          Deploy the entire platform with a single command:
        </p>

        <div className="rounded-lg p-6 font-[var(--font-mono)] text-sm bg-[var(--layer-2)] border-l-2 border-[var(--engram-teal)] overflow-x-auto">
          <div className="text-[var(--engram-teal)]">$</div>
          <div className="text-[var(--text-primary)]">docker compose up -d</div>
        </div>

        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-1)] p-4">
          <h4 className="font-[var(--font-display)] font-semibold text-[var(--text-primary)] mb-4">
            Service startup order (automatic):
          </h4>

          <div className="space-y-2">
            {[
              { service: 'Weaviate', port: '8080', desc: 'Vector database' },
              { service: 'Redis (Crawler)', port: '6379', desc: 'Cache layer' },
              { service: 'Redis (Memory)', port: '6379', desc: 'Cache layer' },
              { service: 'Memory API', port: '8000', desc: 'Vector memory service' },
              { service: 'Crawler API', port: '11235', desc: 'OSINT engine' },
              { service: 'Platform Frontend', port: '3002', desc: 'Dashboard UI' },
              { service: 'MCP Server', port: '3000', desc: 'Protocol bridge' },
            ].map((s) => (
              <div key={s.service} className="flex items-start gap-3 text-sm">
                <Icons.CheckCircle2
                  size={16}
                  className="text-[var(--engram-teal)] flex-shrink-0 mt-1"
                />
                <div>
                  <span className="font-[var(--font-mono)] text-[var(--text-primary)]">
                    {s.service}
                  </span>
                  <span className="text-[var(--text-muted)]"> ({s.port}) — {s.desc}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="text-sm text-[var(--text-secondary)]">
          Monitor logs with:{' '}
          <code className="font-[var(--font-mono)] text-[var(--text-primary)]">
            docker compose logs -f
          </code>
        </p>
      </div>
    ),
  },
  {
    number: 4,
    title: 'Verify Health',
    description: 'Check that all services are running correctly',
    content: (
      <div className="space-y-6">
        <p className="text-[var(--text-secondary)]">
          Test each service with health check endpoints:
        </p>

        <div className="space-y-4">
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
              <h4 className="font-[var(--font-display)] font-semibold text-[var(--text-primary)] mb-2">
                {check.service}
              </h4>

              <div
                className="rounded-lg p-6 font-[var(--font-mono)] text-sm bg-[var(--layer-2)] overflow-x-auto"
                style={{
                  borderLeft: `2px solid var(--engram-${check.color})`,
                }}
              >
                <div style={{ color: `var(--engram-${check.color})` }}>$</div>
                <div className="text-[var(--text-primary)]">{check.curl}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-lg border border-[var(--engram-teal)] bg-[var(--engram-teal-glow)] p-4">
          <p className="text-sm text-[var(--text-primary)]">
            <strong>Success:</strong> All services return HTTP 200 with status {"{ healthy: true }"}
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
        <p className="text-[var(--text-secondary)]">
          Install and configure the MCP server for Claude Desktop and Claude Code:
        </p>

        <div>
          <h4 className="font-[var(--font-display)] font-semibold text-[var(--text-primary)] mb-3">
            Install globally
          </h4>

          <div className="rounded-lg p-6 font-[var(--font-mono)] text-sm bg-[var(--layer-2)] border-l-2 border-[var(--engram-teal)] overflow-x-auto">
            <div className="text-[var(--engram-teal)]">$</div>
            <div className="text-[var(--text-primary)]">npx @engram/mcp init</div>
          </div>
        </div>

        <div>
          <h4 className="font-[var(--font-display)] font-semibold text-[var(--text-primary)] mb-3">
            Claude Desktop config
          </h4>

          <p className="text-sm text-[var(--text-secondary)] mb-3">
            Edit <code className="font-[var(--font-mono)]">~/.claude/config.json</code>:
          </p>

          <div className="rounded-lg p-4 font-[var(--font-mono)] text-sm bg-[var(--layer-2)] border-l-2 border-[var(--engram-amber)] overflow-x-auto">
            <pre className="text-[var(--text-primary)]">{`{
  "mcpServers": {
    "engram": {
      "command": "node",
      "args": [
        ".../engram-mcp/dist/server.js"
      ]
    }
  }
}`}</pre>
          </div>
        </div>

        <div>
          <h4 className="font-[var(--font-display)] font-semibold text-[var(--text-primary)] mb-3">
            Claude Code config
          </h4>

          <p className="text-sm text-[var(--text-secondary)] mb-3">
            Add MCP server URL to your development environment:
          </p>

          <div className="rounded-lg p-4 font-[var(--font-mono)] text-sm bg-[var(--layer-2)] border-l-2 border-[var(--engram-violet)] overflow-x-auto">
            <div className="text-[var(--engram-violet)]">$</div>
            <div className="text-[var(--text-primary)]">
              export MCP_URL="http://localhost:3000"
            </div>
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
        <p className="text-[var(--text-secondary)]">
          Create and retrieve a memory to verify the platform is working:
        </p>

        <div className="rounded-lg p-6 font-[var(--font-mono)] text-sm bg-[var(--layer-2)] border-l-2 border-[var(--engram-rose)] overflow-x-auto">
          <pre className="text-[var(--text-primary)]">{`import httpx

# Create HTTP client
client = httpx.AsyncClient(base_url="http://localhost:8000")

# Store a memory
memory = await client.post(
  "/memories",
  json={
    "content": "Engram is running!",
    "tier": "project",
    "metadata": {
      "source": "getting-started",
      "importance": "high"
    }
  }
)

memory_data = memory.json()
print(f"✓ Stored: {memory_data['id']}")

# Search memories
results = await client.post(
  "/rag/query",
  json={
    "query": "What is Engram?",
    "top_k": 3
  }
)

for result in results.json()["results"]:
  print(f"- {result['content']}")
  print(f"  (Score: {result['score']})")`}</pre>
        </div>

        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-1)] p-4">
          <h4 className="font-[var(--font-display)] font-semibold text-[var(--text-primary)] mb-3">
            Next steps:
          </h4>

          <ul className="space-y-2 text-sm">
            {[
              'Browse stored memories in the Dashboard',
              'Run your first OSINT scan via Crawler API',
              'Explore knowledge graph in Platform UI',
              'Read the full documentation',
            ].map((step) => (
              <li key={step} className="flex items-start gap-2">
                <Icons.ArrowRight
                  size={16}
                  className="text-[var(--engram-teal)] flex-shrink-0 mt-0.5"
                />
                <span className="text-[var(--text-secondary)]">{step}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    ),
  },
];

export default function GettingStartedPage() {
  const [activeStep, setActiveStep] = useState(1);
  const currentStep = steps.find((s) => s.number === activeStep);

  return (
    <div className="min-h-screen bg-[var(--void)]">
      {/* Progress Bar */}
      <div className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--void)]/95 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="font-[var(--font-display)] font-bold text-2xl">Getting Started</h1>
            <span className="font-[var(--font-mono)] text-sm text-[var(--text-secondary)]">
              Step {activeStep} of {steps.length}
            </span>
          </div>

          {/* Progress bar */}
          <div className="w-full h-1 rounded-full bg-[var(--layer-1)]">
            <div
              className="h-full rounded-full bg-[var(--engram-amber)] transition-all duration-300"
              style={{ width: `${(activeStep / steps.length) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-12">
          {/* Stepper (left) */}
          <div className="lg:col-span-1">
            <div className="space-y-4 sticky top-32">
              {steps.map((step, idx) => {
                const isActive = step.number === activeStep;
                const isCompleted = step.number < activeStep;

                return (
                  <button
                    key={step.number}
                    onClick={() => setActiveStep(step.number)}
                    className="w-full text-left group"
                  >
                    <div className="flex items-start gap-4">
                      {/* Circle */}
                      <div
                        className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 border"
                        style={{
                          background: isActive
                            ? 'var(--engram-amber)'
                            : isCompleted
                              ? 'var(--engram-teal)'
                              : 'var(--layer-1)',
                          borderColor: isActive ? 'var(--engram-amber)' : 'var(--border)',
                          color: isActive || isCompleted ? 'var(--void)' : 'var(--text-secondary)',
                        }}
                      >
                        {isCompleted ? (
                          <Icons.Check size={16} strokeWidth={3} />
                        ) : (
                          <span className="font-[var(--font-mono)] font-semibold text-sm">
                            {step.number}
                          </span>
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1">
                        <h3
                          className="font-[var(--font-display)] font-semibold text-sm transition-colors"
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

                        <p className="text-xs text-[var(--text-muted)] mt-1">
                          {step.description}
                        </p>
                      </div>

                      {/* Connector Line */}
                      {idx < steps.length - 1 && (
                        <div
                          className="absolute left-3.5 w-0.5 h-12 ml-0.5"
                          style={{
                            background: isCompleted
                              ? 'var(--engram-teal)'
                              : 'var(--border)',
                            top: '100%',
                            marginTop: '16px',
                          }}
                        />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Content (right) */}
          <div className="lg:col-span-3">
            {currentStep && (
              <div className="space-y-8">
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <span
                      className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center font-[var(--font-mono)] font-bold text-lg"
                      style={{
                        background: 'var(--engram-amber)',
                        color: 'var(--void)',
                      }}
                    >
                      {currentStep.number}
                    </span>

                    <div>
                      <h2 className="font-[var(--font-display)] font-bold text-3xl">
                        {currentStep.title}
                      </h2>
                      <p className="text-[var(--text-secondary)]">
                        {currentStep.description}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Step Content */}
                <div className="space-y-6">{currentStep.content}</div>

                {/* Navigation */}
                <div className="flex items-center justify-between pt-8 border-t border-[var(--border)]">
                  <Button
                    variant="secondary"
                    disabled={activeStep === 1}
                    onClick={() => setActiveStep(Math.max(1, activeStep - 1))}
                  >
                    {activeStep > 1 && '← '}Previous
                  </Button>

                  {activeStep < steps.length ? (
                    <Button onClick={() => setActiveStep(activeStep + 1)}>
                      Next →
                    </Button>
                  ) : (
                    <div className="text-center">
                      <p className="text-[var(--text-secondary)] text-sm mb-2">
                        You&apos;re all set!
                      </p>
                      <p className="font-[var(--font-mono)] text-sm text-[var(--engram-teal)]">
                        → Visit the Dashboard at localhost:3002
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
