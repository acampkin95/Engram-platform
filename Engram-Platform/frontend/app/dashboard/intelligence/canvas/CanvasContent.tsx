'use client';

import { motion } from 'framer-motion';
import { Activity, Database, GitBranch, Layers, Radio } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AgentConsole } from '@/src/components/agents/AgentConsole';
import { Canvas } from '@/src/components/canvas/Canvas';
import { InspectorPanel } from '@/src/components/inspector/InspectorPanel';
import { CrawlStream } from '@/src/components/intelligence/CrawlStream';
import { EntityGraphWrapper } from '@/src/components/intelligence/EntityGraph';
import { IntelligenceLayerToggle } from '@/src/components/investigation/IntelligenceLayerToggle';
import { InvestigationMode } from '@/src/components/investigation/InvestigationMode';
import { crawlerClient, type JobResponse } from '@/src/lib/crawler-client';
import { type Entity, memoryClient, type Relation } from '@/src/lib/memory-client';
import { cn } from '@/src/lib/utils';
import {
  type EntityType,
  type RelationshipType,
  type StatusColor,
  type StreamItem,
  useIntelligenceStore,
  useStreamStore,
} from '@/src/stores/canvasStore';

const CRAWLER_WS_URL =
  typeof window !== 'undefined'
    ? `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.hostname}:11235/ws`
    : '';

interface CrawlUpdateMessage {
  type: 'crawl_update';
  crawl_id: string;
  status: string;
  data: Record<string, unknown>;
  timestamp: string;
}

function mapEntityType(rawType: string): EntityType {
  const t = rawType.toLowerCase();
  if (t.includes('person') || t.includes('people')) return 'person';
  if (t.includes('org') || t.includes('company')) return 'organization';
  if (t.includes('loc') || t.includes('place') || t.includes('geo')) return 'location';
  if (t.includes('doc') || t.includes('file') || t.includes('page')) return 'document';
  if (t.includes('event') || t.includes('incident')) return 'event';
  if (t.includes('artifact') || t.includes('tool')) return 'artifact';
  return 'unknown';
}

function mapStatus(rawStatus?: string): StatusColor {
  if (!rawStatus) return 'neutral';
  const s = rawStatus.toLowerCase();
  if (s === 'active' || s === 'running') return 'active';
  if (s === 'critical' || s === 'error' || s === 'failed') return 'critical';
  if (s === 'success' || s === 'completed') return 'success';
  if (s === 'anomaly' || s === 'warning') return 'anomaly';
  return 'neutral';
}

function jobToStreamItem(job: JobResponse): StreamItem {
  return {
    id: job.job_id,
    timestamp: new Date(job.created_at),
    source: 'crawler',
    type: mapEntityType(job.job_type || 'unknown'),
    status: mapStatus(job.status),
    title: job.metadata?.title || job.url || `Job ${job.job_id.slice(0, 8)}`,
    summary: job.error || `Status: ${job.status}`,
    metadata: {
      url: job.url || '',
      jobType: job.job_type || '',
    },
  };
}

function LoadingScreen() {
  return (
    <div className="flex items-center justify-center h-full bg-[var(--color-void)]">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center gap-4"
      >
        <div className="relative">
          <div className="w-12 h-12 rounded-xl bg-[var(--color-panel)] border border-white/10 flex items-center justify-center">
            <Layers className="w-6 h-6 text-[var(--color-intelligence)] animate-pulse" />
          </div>
          <div className="absolute -inset-1 rounded-xl bg-[var(--color-intelligence)]/20 blur-xl -z-10" />
        </div>
        <div className="flex flex-col items-center gap-1">
          <span className="text-sm font-mono text-[var(--color-text-primary)] tracking-wide">
            Initializing Canvas
          </span>
          <span className="text-[10px] font-mono text-[var(--color-neutral)]">
            Loading entities and streams...
          </span>
        </div>
        <div className="flex gap-1 mt-2">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-[var(--color-intelligence)]"
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }}
            />
          ))}
        </div>
      </motion.div>
    </div>
  );
}

function StatBadge({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/[0.03] border border-white/5">
      <div style={{ color }}>
        <Icon className="w-3 h-3" />
      </div>
      <span className="text-[10px] font-mono text-[var(--color-neutral)]">{value}</span>
      <span className="text-[9px] font-mono text-[var(--color-neutral)]/60 uppercase">{label}</span>
    </div>
  );
}

export default function CanvasContent() {
  const { selectedEntities } = useIntelligenceStore();
  const { addItem, items } = useStreamStore();

  const [entities, setEntities] = useState<Entity[]>([]);
  const [relationships, setRelationships] = useState<Relation[]>([]);
  const [jobs, setJobs] = useState<JobResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptRef = useRef(0);

  const handleWsMessage = useCallback(
    (msg: CrawlUpdateMessage) => {
      if (msg.type === 'crawl_update') {
        const streamItem: StreamItem = {
          id: `ws-${msg.crawl_id}-${Date.now()}`,
          timestamp: new Date(msg.timestamp || Date.now()),
          source: 'crawler',
          type: 'unknown',
          status: mapStatus(msg.status),
          title: `Job ${msg.crawl_id.slice(0, 8)}`,
          summary: `${msg.status.toUpperCase()}${msg.data?.url ? ` — ${msg.data.url}` : ''}`,
          metadata: msg.data as Record<string, string>,
        };
        addItem(streamItem);
      }
    },
    [addItem],
  );

  const connectWs = useCallback(() => {
    if (typeof window === 'undefined' || !CRAWLER_WS_URL) return;
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
    }
    const ws = new WebSocket(CRAWLER_WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      reconnectAttemptRef.current = 0;
      setWsConnected(true);
      ws.send(JSON.stringify({ type: 'subscribe', topic: 'crawl:*' }));
      ws.send(JSON.stringify({ type: 'subscribe', topic: 'osint_scan:*' }));
    };

    ws.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data as string) as CrawlUpdateMessage;
        handleWsMessage(parsed);
      } catch {
        // ignore non-JSON
      }
    };

    ws.onclose = () => {
      setWsConnected(false);
      if (reconnectAttemptRef.current < 3) {
        const delay = 1000 * 2 ** reconnectAttemptRef.current;
        reconnectAttemptRef.current += 1;
        reconnectTimerRef.current = setTimeout(connectWs, delay);
      }
    };
  }, [handleWsMessage]);

  useEffect(() => {
    connectWs();
    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
    };
  }, [connectWs]);

  const fetchEntities = useCallback(async () => {
    const result = await memoryClient.getKnowledgeGraph();
    if (result.data) {
      setEntities(result.data.entities || []);
      setRelationships(result.data.relations || result.data.relationships || []);
    }
  }, []);

  const fetchJobs = useCallback(async () => {
    const result = await crawlerClient.getJobs({ limit: 50 });
    if (result.data) {
      setJobs(result.data.jobs || []);
      for (const job of result.data.jobs) {
        addItem(jobToStreamItem(job));
      }
    }
  }, [addItem]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([fetchEntities(), fetchJobs()]);
      setLoading(false);
    };
    load();
  }, [fetchEntities, fetchJobs]);

  const selectedEntityData = useMemo(() => {
    const selectedId = [...selectedEntities][0];
    if (!selectedId) return null;
    const entity = entities.find((e) => (e.entity_id || e.id) === selectedId);
    if (!entity) return null;
    return {
      id: entity.entity_id || entity.id,
      name: entity.name,
      type: mapEntityType(entity.entity_type || entity.type),
      status: 'neutral' as StatusColor,
      metadata: entity as Record<string, string | number | boolean>,
    };
  }, [selectedEntities, entities]);

  const agentTasks = useMemo(
    () =>
      jobs
        .filter((j) => j.status === 'running' || j.status === 'pending')
        .map((j) => ({
          id: j.job_id,
          name: j.metadata?.title || j.url || `Job ${j.job_id.slice(0, 8)}`,
          status: (j.status === 'running' ? 'running' : 'pending') as
            | 'pending'
            | 'running'
            | 'completed'
            | 'failed',
          progress: j.status === 'running' ? 50 : 0,
          startedAt: j.created_at ? new Date(j.created_at) : undefined,
        })),
    [jobs],
  );

  const runningJobs = useMemo(() => jobs.filter((j) => j.status === 'running').length, [jobs]);
  const completedJobs = useMemo(() => jobs.filter((j) => j.status === 'completed').length, [jobs]);

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="h-full flex flex-col"
    >
      {/* Header Bar */}
      <div className="flex items-center justify-between px-4 h-11 border-b border-white/[0.06] bg-[var(--color-void)]/80 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-[var(--color-intelligence)]/10 border border-[var(--color-intelligence)]/20 flex items-center justify-center">
              <Layers className="w-3.5 h-3.5 text-[var(--color-intelligence)]" />
            </div>
            <h1 className="text-xs font-semibold text-[var(--color-text-primary)] font-mono tracking-wider">
              OSINT CANVAS
            </h1>
          </div>

          <div className="h-4 w-px bg-white/10" />

          <div className="flex items-center gap-2">
            <StatBadge
              icon={Database}
              label="entities"
              value={entities.length}
              color="var(--color-intelligence)"
            />
            <StatBadge
              icon={GitBranch}
              label="relations"
              value={relationships.length}
              color="var(--color-active)"
            />
            <StatBadge
              icon={Activity}
              label="jobs"
              value={jobs.length}
              color="var(--color-anomaly)"
            />
            <StatBadge
              icon={Radio}
              label="stream"
              value={items.length}
              color="var(--color-success)"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div
            className={cn(
              'w-1.5 h-1.5 rounded-full',
              wsConnected ? 'bg-[var(--color-success)] animate-pulse' : 'bg-[var(--color-neutral)]',
            )}
          />
          {runningJobs > 0 && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[var(--color-active)]/10 border border-[var(--color-active)]/20">
              <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-active)] animate-pulse" />
              <span className="text-[9px] font-mono text-[var(--color-active)]">
                {runningJobs} RUNNING
              </span>
            </div>
          )}
          {completedJobs > 0 && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[var(--color-success)]/10 border border-[var(--color-success)]/20">
              <span className="text-[9px] font-mono text-[var(--color-success)]">
                {completedJobs} DONE
              </span>
            </div>
          )}
          <div className="h-4 w-px bg-white/10" />
          <InvestigationMode />
          <IntelligenceLayerToggle compact />
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 min-h-0">
        <Canvas
          panelContent={{
            graph: (
              <div className="h-full relative">
                <EntityGraphWrapper
                  entities={entities.map((e) => ({
                    id: e.entity_id || e.id,
                    name: e.name,
                    type: mapEntityType(e.entity_type || e.type),
                    status: 'neutral' as StatusColor,
                    metadata: e,
                  }))}
                  relationships={relationships.map((r) => ({
                    id: r.relation_id || r.id,
                    sourceId: r.source_id || r.source,
                    targetId: r.target_id || r.target,
                    type: (r.relation_type || r.type || 'associated') as RelationshipType,
                  }))}
                />
                {entities.length === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center bg-[var(--color-void)]/80">
                    <div className="flex flex-col items-center gap-3 text-center">
                      <Database className="w-8 h-8 text-[var(--color-neutral)]/40" />
                      <div>
                        <div className="text-sm text-[var(--color-neutral)] font-mono">
                          No entities loaded
                        </div>
                        <div className="text-[10px] text-[var(--color-neutral)]/60 mt-1">
                          Connect to Memory API to view knowledge graph
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ),
            stream: <CrawlStream />,
            inspector: <InspectorPanel entity={selectedEntityData} />,
            'agent-console': <AgentConsole tasks={agentTasks} />,
            timeline: null,
            custom: null,
          }}
        />
      </div>
    </motion.div>
  );
}
