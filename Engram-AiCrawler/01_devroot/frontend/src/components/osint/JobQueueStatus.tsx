import { useState, useEffect } from 'react';
import { Clock, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { api } from '../../lib/api';
import { Card, CardHeader, CardBody } from '../ui';

interface JobStatus {
  job_id: string;
  job_type: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  created_at: string;
  progress?: number;
  progress_message?: string;
}

interface JobQueueStatusProps {
  refreshInterval?: number;
}

export function JobQueueStatus({ refreshInterval = 30000 }: JobQueueStatusProps) {
  const [jobs, setJobs] = useState<JobStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchJobs = async () => {
    try {
      const response = await api.get<{ jobs: JobStatus[] }>('/api/performance/jobs?limit=10');
      setJobs(response.data.jobs || []);
    } catch (err) {
      console.error('Failed to fetch jobs:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
    const interval = setInterval(fetchJobs, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval]);

  const statusIcon = (status: JobStatus['status']) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-3 h-3 text-gray-400" />;
      case 'running':
        return <Loader2 className="w-3 h-3 text-blue-500 animate-spin" />;
      case 'completed':
        return <CheckCircle className="w-3 h-3 text-green-500" />;
      case 'failed':
        return <XCircle className="w-3 h-3 text-red-500" />;
      case 'cancelled':
        return <XCircle className="w-3 h-3 text-yellow-500" />;
    }
  };

  const statusLabel = (status: JobStatus['status']) => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Job Queue
          </h3>
          <button
            onClick={fetchJobs}
            className="text-xs text-gray-500 hover:text-gray-700"
          >
            Refresh
          </button>
        </div>
      </CardHeader>
      <CardBody className="p-3">
        {isLoading ? (
          <div className="animate-pulse space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-8 bg-gray-200 rounded"></div>
            ))}
          </div>
        ) : jobs.length === 0 ? (
          <div className="text-sm text-gray-400 text-center py-4">
            No active jobs
          </div>
        ) : (
          <div className="space-y-2">
            {jobs.map(job => (
              <div
                key={job.job_id}
                className="flex items-center justify-between text-xs p-2 rounded bg-gray-50 dark:bg-gray-800"
              >
                <div className="flex items-center gap-2">
                  {statusIcon(job.status)}
                  <div>
                    <div className="font-medium capitalize">{job.job_type.replace('_', ' ')}</div>
                    <div className="text-gray-400">{formatTime(job.created_at)}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`px-2 py-0.5 rounded text-xs font-medium ${
                    job.status === 'completed' ? 'bg-green-100 text-green-700' :
                    job.status === 'failed' ? 'bg-red-100 text-red-700' :
                    job.status === 'running' ? 'bg-blue-100 text-blue-700' :
                    job.status === 'cancelled' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {statusLabel(job.status)}
                  </div>
                  {job.progress !== undefined && job.progress > 0 && job.progress < 100 && (
                    <div className="text-gray-400 mt-1">
                      {job.progress}%
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
