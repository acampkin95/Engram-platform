import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AgentConsole } from '../AgentConsole';

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: { children: React.ReactNode }) => (
      <div {...props}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('AgentConsole', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render empty state when no tasks', () => {
    render(<AgentConsole />);
    expect(screen.getByText('No agent tasks')).toBeInTheDocument();
  });

  it('should render with custom className', () => {
    const { container } = render(<AgentConsole className="custom-class" />);
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('should render AGENTS header', () => {
    render(<AgentConsole />);
    expect(screen.getByText('AGENTS')).toBeInTheDocument();
  });

  it('should render filter buttons', () => {
    render(<AgentConsole />);
    expect(screen.getByText('ALL')).toBeInTheDocument();
    expect(screen.getByText('PENDING')).toBeInTheDocument();
    expect(screen.getByText('RUNNING')).toBeInTheDocument();
    expect(screen.getByText('COMPLETED')).toBeInTheDocument();
    expect(screen.getByText('FAILED')).toBeInTheDocument();
  });

  it('should render task name when tasks provided', () => {
    const tasks = [
      {
        id: '1',
        name: 'Test Task',
        status: 'pending' as const,
        progress: 0,
      },
    ];
    render(<AgentConsole tasks={tasks} />);
    expect(screen.getByText('Test Task')).toBeInTheDocument();
  });

  it('should render task status badge', () => {
    const tasks = [
      {
        id: '1',
        name: 'Test Task',
        status: 'running' as const,
        progress: 50,
        startedAt: new Date(),
      },
    ];
    render(<AgentConsole tasks={tasks} />);
    const runningBadges = screen.getAllByText('RUNNING');
    expect(runningBadges.length).toBeGreaterThan(0);
  });

  it('should show progress bar for running tasks', () => {
    const tasks = [
      {
        id: '1',
        name: 'Test Task',
        status: 'running' as const,
        progress: 75,
        startedAt: new Date(),
      },
    ];
    render(<AgentConsole tasks={tasks} />);
    expect(screen.getByText('75%')).toBeInTheDocument();
  });

  it('should display task count', () => {
    const tasks = [
      { id: '1', name: 'Task 1', status: 'pending' as const, progress: 0 },
      { id: '2', name: 'Task 2', status: 'completed' as const, progress: 100 },
    ];
    render(<AgentConsole tasks={tasks} />);
    expect(screen.getByText('2 total tasks')).toBeInTheDocument();
  });

  it('should filter tasks by status', () => {
    const tasks = [
      { id: '1', name: 'Pending Task', status: 'pending' as const, progress: 0 },
      { id: '2', name: 'Completed Task', status: 'completed' as const, progress: 100 },
    ];
    render(<AgentConsole tasks={tasks} />);

    const pendingFilter = screen.getAllByText('PENDING').find((el) => el.tagName === 'BUTTON');
    if (pendingFilter) fireEvent.click(pendingFilter);
    expect(screen.getByText('Pending Task')).toBeInTheDocument();
    expect(screen.queryByText('Completed Task')).not.toBeInTheDocument();
  });

  it('should call onTaskStart when start button clicked', () => {
    const onTaskStart = vi.fn();
    const tasks = [{ id: '1', name: 'Test Task', status: 'pending' as const, progress: 0 }];
    render(<AgentConsole tasks={tasks} onTaskStart={onTaskStart} />);
    fireEvent.click(screen.getByRole('button', { name: /start/i }));
    expect(onTaskStart).toHaveBeenCalledWith('1');
  });

  it('should show error message for failed tasks', () => {
    const tasks = [
      {
        id: '1',
        name: 'Failed Task',
        status: 'failed' as const,
        progress: 0,
        error: 'Connection timeout',
      },
    ];
    render(<AgentConsole tasks={tasks} />);
    expect(screen.getByText('Connection timeout')).toBeInTheDocument();
  });
});
