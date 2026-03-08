import { useState } from'react';
import { Pencil, Trash2, RefreshCw, Calendar } from'lucide-react';
import { ConfirmDialog } from'../ConfirmDialog';
import type { Schedule } from'../../lib/schemas';

const FREQUENCY_LABELS: Record<string, string> = {
 once:'Once',
 hourly:'Hourly',
 daily:'Daily',
 weekly:'Weekly',
 monthly:'Monthly',
 custom:'Custom',
};

function formatNextRun(dateStr: string | null): string {
 if (!dateStr) return'—';
 try {
 const date = new Date(dateStr);
 if (isNaN(date.getTime())) return dateStr;
 return date.toLocaleString(undefined, {
 month:'short',
 day:'numeric',
 hour:'2-digit',
 minute:'2-digit',
 });
 } catch {
 return dateStr;
 }
}

interface ScheduleListProps {
 schedules: Schedule[];
 loading: boolean;
 onToggle: (schedule: Schedule) => void;
 onEdit: (schedule: Schedule) => void;
 onDelete: (id: string) => void;
 onRefresh: () => void;
}

export function ScheduleList({
 schedules,
 loading,
 onToggle,
 onEdit,
 onDelete,
 onRefresh: _onRefresh,
}: ScheduleListProps) {
 const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
 const [isDeleting, setIsDeleting] = useState(false);

 const handleDeleteConfirm = async () => {
 if (!deleteTarget) return;
 setIsDeleting(true);
 try {
 onDelete(deleteTarget);
 } finally {
 setIsDeleting(false);
 setDeleteTarget(null);
 }
 };

 if (loading) {
 return (
 <div className="text-center py-12 text-text-dim">
 <RefreshCw className="w-8 h-8 mx-auto mb-4 animate-spin" />
 <p>Loading schedules...</p>
 </div>
 );
 }

 if (schedules.length === 0) {
 return (
 <div className="text-center py-12 text-text-dim">
 <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
 <p>No scheduled crawls yet. Create one to get started.</p>
 </div>
 );
 }

 return (
 <>
 <div className="overflow-x-auto">
 <table className="w-full text-sm">
 <thead>
 <tr className="border-b border-border">
 <th className="text-left py-3 px-4 font-medium text-text-dim">
 Name
 </th>
 <th className="text-left py-3 px-4 font-medium text-text-dim">
 Frequency
 </th>
 <th className="text-left py-3 px-4 font-medium text-text-dim">
 Next Run
 </th>
 <th className="text-center py-3 px-4 font-medium text-text-dim">
 Status
 </th>
 <th className="text-right py-3 px-4 font-medium text-text-dim">
 Actions
 </th>
 </tr>
 </thead>
 <tbody>
 {schedules.map((schedule) => (
 <tr
 key={schedule.id}
 className="border-b border-border hover:bg-void transition-colors"
 >
 <td className="py-3 px-4">
 <div className="font-medium text-text">
 {schedule.name}
 </div>
 {schedule.cron_expression && (
 <code className="text-xs text-text-mute font-mono">
 {schedule.cron_expression}
 </code>
 )}
 </td>
 <td className="py-3 px-4 text-text-dim">
 {FREQUENCY_LABELS[schedule.frequency] ?? schedule.frequency}
 </td>
 <td className="py-3 px-4 text-text-dim">
 {formatNextRun(schedule.next_run)}
 </td>
 <td className="py-3 px-4 text-center">
 <button
 type="button"
 onClick={() => onToggle(schedule)}
 className="inline-flex items-center gap-1.5 text-xs font-medium"
 aria-label={`Toggle schedule ${schedule.name} ${schedule.enabled ?'off' :'on'}`}
 >
 <span
 className={`inline-block w-2.5 h-2.5 rounded-full ${
 schedule.enabled
 ?'bg-acid'
 :'bg-text-mute'
 }`}
 />
 <span
 className={
 schedule.enabled
 ?'text-acid'
 :'text-text-mute'
 }
 >
 {schedule.enabled ?'On' :'Off'}
 </span>
 </button>
 </td>
 <td className="py-3 px-4 text-right">
 <div className="flex items-center justify-end gap-1">
 <button
 type="button"
 onClick={() => onEdit(schedule)}
 className="p-1.5 text-text-mute hover:text-cyan hover:bg-raised transition-colors"
 aria-label={`Edit ${schedule.name}`}
 >
 <Pencil className="w-4 h-4" />
 </button>
 <button
 type="button"
 onClick={() => setDeleteTarget(schedule.id)}
 className="p-1.5 text-text-mute hover:text-neon-r hover:bg-raised transition-colors"
 aria-label={`Delete ${schedule.name}`}
 >
 <Trash2 className="w-4 h-4" />
 </button>
 </div>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>

 <ConfirmDialog
 open={deleteTarget !== null}
 title="Delete Schedule"
 message="This schedule will be permanently removed. This action cannot be undone."
 confirmLabel="Delete"
 variant="danger"
 loading={isDeleting}
 onConfirm={handleDeleteConfirm}
 onCancel={() => setDeleteTarget(null)}
 />
 </>
 );
}
