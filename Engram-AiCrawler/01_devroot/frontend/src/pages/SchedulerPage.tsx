import { useState, useEffect, useCallback } from'react';
import { Plus, RefreshCw } from'lucide-react';
import { useToast } from'../components/Toast';
import { Button, Card, CardBody } from '@/components/ui';
import { cn } from'@/lib/utils';
import { ScheduleList } from'../components/scheduler/ScheduleList';
import { CreateScheduleDialog } from'../components/scheduler/CreateScheduleDialog';
import { api } from'../lib/api';
import type { Schedule, CreateSchedule } from'../lib/schemas';

export default function SchedulerPage() {
 const toast = useToast();
 const [schedules, setSchedules] = useState<Schedule[]>([]);
 const [isLoading, setIsLoading] = useState(true);
 const [dialogOpen, setDialogOpen] = useState(false);
 const [isCreating, setIsCreating] = useState(false);

 const fetchSchedules = useCallback(async () => {
 setIsLoading(true);
 try {
 const response = await api.get<Schedule[]>('/scheduler/schedules');
 setSchedules(Array.isArray(response.data) ? response.data : []);
 } catch {
 toast.error('Failed to load schedules');
 } finally {
 setIsLoading(false);
 }
 }, [toast]);

 useEffect(() => {
 fetchSchedules();
 }, [fetchSchedules]);

 const handleCreate = async (data: CreateSchedule) => {
 setIsCreating(true);
 try {
 const response = await api.post<Schedule>('/scheduler/schedules', data);
 setSchedules((prev) => [...prev, response.data]);
 toast.success(`Schedule"${data.name}" created`);
 setDialogOpen(false);
 } catch {
 toast.error('Failed to create schedule');
 } finally {
 setIsCreating(false);
 }
 };

 const handleToggle = async (schedule: Schedule) => {
 try {
 const response = await api.post<Schedule>(
 `/scheduler/schedules/${schedule.id}/toggle`
 );
 setSchedules((prev) =>
 prev.map((s) => (s.id === schedule.id ? response.data : s))
 );
 toast.success(
 `Schedule"${schedule.name}" ${response.data.enabled ?'enabled' :'disabled'}`
 );
 } catch {
 toast.error('Failed to toggle schedule');
 }
 };

 const handleEdit = (schedule: Schedule) => {
 toast.info(`Edit for"${schedule.name}" coming soon`);
 };

 const handleDelete = async (id: string) => {
 try {
 await api.delete(`/scheduler/schedules/${id}`);
 setSchedules((prev) => prev.filter((s) => s.id !== id));
 toast.success('Schedule deleted');
 } catch {
 toast.error('Failed to delete schedule');
 }
 };

  return (
  <div className="min-h-screen bg-void text-text">
  <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
  <div className="flex justify-between items-center">
 <h1 className="text-2xl font-bold text-text">
 Scheduled Crawls
 </h1>
 <div className="flex items-center gap-3">
 <Button
 variant="secondary"
 onClick={fetchSchedules}
 disabled={isLoading}
 leftIcon={<RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />}
 >
 Refresh
 </Button>
 <Button
 onClick={() => setDialogOpen(true)}
 leftIcon={<Plus className="w-4 h-4" />}
 >
 New Schedule
 </Button>
 </div>
 </div>

  {isLoading && schedules.length === 0 ? (
  <Card className="animate-pulse">
    <CardBody className="space-y-4">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="flex items-center gap-4 py-3">
          <div className="h-4 w-4 rounded bg-abyss/50" />
          <div className="flex-1 h-5 bg-abyss/50 rounded" />
          <div className="w-20 h-8 bg-abyss/50 rounded" />
        </div>
      ))}
    </CardBody>
  </Card>
  ) : (
  <Card>
  <ScheduleList
  schedules={schedules}
  loading={isLoading}
  onToggle={handleToggle}
  onEdit={handleEdit}
  onDelete={handleDelete}
  onRefresh={fetchSchedules}
  />
  </Card>
  )}

  <CreateScheduleDialog
  open={dialogOpen}
  loading={isCreating}
  onSubmit={handleCreate}
  onClose={() => setDialogOpen(false)}
  />
  </div>
  </div>
  );
}
