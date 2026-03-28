'use client';

import { useVirtualizer } from '@tanstack/react-virtual';
import {
  Activity,
  AlertCircle,
  CheckCircle,
  Clock,
  Loader2,
  Pause,
  Play,
  Terminal,
  X,
  Zap,
} from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { cn } from '@/src/lib/utils';

interface AgentTask {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  result?: Record<string, unknown>;
}

interface AgentConsoleProps {
  className?: string;
  tasks?: AgentTask[];
  onTaskStart?: (taskId: string) => void;
  onTaskPause?: (taskId: string) => void;
  onTaskCancel?: (taskId: string) => void;
}

const statusConfig: Record<
  AgentTask['status'],
  {
    icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
    color: string;
    label: string;
  }
> = {
  pending: { icon: Clock, color: 'var(--color-neutral)', label: 'PENDING' },
  running: { icon: Loader2, color: 'var(--color-active)', label: 'RUNNING' },
  completed: { icon: CheckCircle, color: 'var(--color-success)', label: 'COMPLETED' },
  failed: { icon: AlertCircle, color: 'var(--color-critical)', label: 'FAILED' },
};

interface TaskItemProps {
  task: AgentTask;
  style?: React.CSSProperties;
  onTaskStart?: (taskId: string) => void;
  onTaskPause?: (taskId: string) => void;
  onTaskCancel?: (taskId: string) => void;
}

function TaskItem({ task, style, onTaskStart, onTaskPause, onTaskCancel }: TaskItemProps) {
  const status = statusConfig[task.status];
  const Icon = status.icon;

  const duration = task.startedAt
    ? task.completedAt
      ? task.completedAt.getTime() - task.startedAt.getTime()
      : Date.now() - task.startedAt.getTime()
    : null;

  const formatDuration = (ms: number) => {
    if (!ms) return '--';
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    return `${Math.floor(seconds / 3600)}h`;
  };

  return (
    <div style={style} className="px-1 pb-1.5">
      <div
        className={cn(
          'flex items-center gap-3 p-3 rounded-lg',
          'bg-[var(--color-void)] border',
          task.status === 'running' && 'border-[var(--color-active)]/20',
          task.status === 'completed' && 'border-[var(--color-success)]/20',
          task.status === 'failed' && 'border-[var(--color-critical)]/20',
          task.status === 'pending' && 'border-white/5',
        )}
      >
        <div
          className={cn(
            'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
            'bg-[color-mix(in_srgb,var(--color-panel)_80%,transparent)]',
          )}
        >
          <Icon
            className={cn('w-4 h-4', task.status === 'running' && 'animate-spin')}
            style={{ color: status.color }}
          />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Terminal className="w-3 h-3 text-[var(--color-text-muted)]" />
            <span className="text-xs font-medium text-[var(--color-text-primary)] truncate">
              {task.name}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={cn(
                'text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded',
                task.status === 'running' &&
                  'bg-[var(--color-active)]/10 text-[var(--color-active)]',
                task.status === 'completed' &&
                  'bg-[var(--color-success)]/10 text-[var(--color-success)]',
                task.status === 'failed' &&
                  'bg-[var(--color-critical)]/10 text-[var(--color-critical)]',
                task.status === 'pending' && 'bg-white/5 text-[var(--color-neutral)]',
              )}
            >
              {status.label}
            </span>

            {task.status === 'running' && (
              <div className="flex items-center gap-1.5 flex-1">
                <div className="h-1 flex-1 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[var(--color-active)] transition-all duration-300"
                    style={{ width: `${task.progress}%` }}
                  />
                </div>
                <span className="text-[9px] font-mono text-[var(--color-neutral)]">
                  {task.progress}%
                </span>
              </div>
            )}

            {duration !== null && (
              <span className="text-[9px] font-mono text-[var(--color-neutral)]">
                {formatDuration(duration)}
              </span>
            )}
          </div>

          {task.error && (
            <div className="mt-2 text-[10px] text-[var(--color-critical)] font-mono">
              {task.error}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {task.status === 'pending' && (
            <button
              type="button"
              onClick={() => onTaskStart?.(task.id)}
              className="p-1.5 text-[var(--color-success)] hover:bg-[var(--color-success)]/10 rounded transition-colors"
              aria-label="Start task"
            >
              <Play className="w-3 h-3" />
            </button>
          )}

          {task.status === 'running' && (
            <>
              <button
                type="button"
                onClick={() => onTaskPause?.(task.id)}
                className="p-1.5 text-[var(--color-anomaly)] hover:bg-[var(--color-anomaly)]/10 rounded transition-colors"
                aria-label="Pause task"
              >
                <Pause className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => onTaskCancel?.(task.id)}
                className="p-1.5 text-[var(--color-critical)] hover:bg-[var(--color-critical)]/10 rounded transition-colors"
                aria-label="Cancel task"
              >
                <X className="w-3 h-3" />
              </button>
            </>
          )}

          {task.status === 'completed' && task.result && (
            <button
              type="button"
              className="p-1.5 text-[var(--color-intelligence)] hover:bg-[var(--color-intelligence)]/10 rounded transition-colors"
              aria-label="View result"
            >
              <Zap className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

interface VirtualizedTaskListProps {
  tasks: AgentTask[];
  scrollRef: React.RefObject<HTMLDivElement | null>;
  onTaskStart?: (taskId: string) => void;
  onTaskPause?: (taskId: string) => void;
  onTaskCancel?: (taskId: string) => void;
}

function VirtualizedTaskList({
  tasks,
  scrollRef,
  onTaskStart,
  onTaskPause,
  onTaskCancel,
}: VirtualizedTaskListProps) {
  const virtualizer = useVirtualizer({
    count: tasks.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 88,
    overscan: 3,
  });

  return (
    <div className="relative w-full" style={{ height: `${virtualizer.getTotalSize()}px` }}>
      {virtualizer.getVirtualItems().map((virtualRow) => {
        const task = tasks[virtualRow.index];
        return (
          <TaskItem
            key={task.id}
            task={task}
            onTaskStart={onTaskStart}
            onTaskPause={onTaskPause}
            onTaskCancel={onTaskCancel}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${virtualRow.size}px`,
              transform: `translateY(${virtualRow.start}px)`,
            }}
          />
        );
      })}
    </div>
  );
}

export function AgentConsole({
  className,
  tasks = [],
  onTaskStart,
  onTaskPause,
  onTaskCancel,
}: AgentConsoleProps) {
  const [filter, setFilter] = useState<AgentTask['status'] | 'all'>('all');
  const scrollRef = useRef<HTMLDivElement>(null);

  const filteredTasks = useMemo(
    () => tasks.filter((task) => filter === 'all' || task.status === filter),
    [tasks, filter],
  );

  const runningCount = useMemo(() => tasks.filter((t) => t.status === 'running').length, [tasks]);
  const completedCount = useMemo(
    () => tasks.filter((t) => t.status === 'completed').length,
    [tasks],
  );
  const failedCount = useMemo(() => tasks.filter((t) => t.status === 'failed').length, [tasks]);

  const showVirtualList = filteredTasks.length > 25;

  return (
    <div className={cn('flex flex-col h-full', className)}>
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/5 shrink-0">
        <div className="flex items-center gap-2">
          <Activity className="w-3.5 h-3.5 text-[var(--color-active)]" />
          <span className="text-[10px] font-mono font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
            AGENTS
          </span>
        </div>

        <div className="flex items-center gap-3">
          {runningCount > 0 && (
            <div className="flex items-center gap-1">
              <Loader2 className="w-3 h-3 text-[var(--color-active)] animate-spin" />
              <span className="text-[9px] font-mono text-[var(--color-active)]">
                {runningCount}
              </span>
            </div>
          )}
          {completedCount > 0 && (
            <div className="flex items-center gap-1">
              <CheckCircle className="w-3 h-3 text-[var(--color-success)]" />
              <span className="text-[9px] font-mono text-[var(--color-success)]">
                {completedCount}
              </span>
            </div>
          )}
          {failedCount > 0 && (
            <div className="flex items-center gap-1">
              <AlertCircle className="w-3 h-3 text-[var(--color-critical)]" />
              <span className="text-[9px] font-mono text-[var(--color-critical)]">
                {failedCount}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 px-3 py-1.5 border-b border-white/5 shrink-0">
        {(['all', 'pending', 'running', 'completed', 'failed'] as const).map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setFilter(status)}
            className={cn(
              'px-2 py-1 text-[9px] font-mono font-semibold rounded transition-colors',
              filter === status
                ? 'bg-white/10 text-[var(--color-text-primary)]'
                : 'text-[var(--color-neutral)] hover:text-[var(--color-text-muted)]',
            )}
          >
            {status.toUpperCase()}
          </button>
        ))}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-2 min-h-0">
        {filteredTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            <Terminal className="w-8 h-8 text-[var(--color-neutral)] mb-3 opacity-50" />
            <div className="text-xs text-[var(--color-neutral)] font-mono">No agent tasks</div>
            <div className="text-[10px] text-[var(--color-neutral)] mt-1">
              Start an agent from the stream
            </div>
          </div>
        ) : showVirtualList ? (
          <VirtualizedTaskList
            tasks={filteredTasks}
            scrollRef={scrollRef}
            onTaskStart={onTaskStart}
            onTaskPause={onTaskPause}
            onTaskCancel={onTaskCancel}
          />
        ) : (
          <div className="space-y-1.5">
            {filteredTasks.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                onTaskStart={onTaskStart}
                onTaskPause={onTaskPause}
                onTaskCancel={onTaskCancel}
              />
            ))}
          </div>
        )}
      </div>

      <div className="px-3 py-2 border-t border-white/5 shrink-0">
        <div className="flex items-center justify-between text-[9px] font-mono text-[var(--color-neutral)]">
          <span>{tasks.length} total tasks</span>
          <span>Queue: {tasks.filter((t) => t.status === 'pending').length}</span>
        </div>
      </div>
    </div>
  );
}

export type { AgentTask, AgentConsoleProps };
