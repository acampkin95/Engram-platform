import { useState } from 'react';
import { Archive, Edit2, Tag } from 'lucide-react';
import type { Investigation } from '../../stores/investigationStore';
import { useInvestigationStore } from '../../stores/investigationStore';
import { Badge } from '../ui';

interface InvestigationHeaderProps {
 investigation: Investigation;
 onArchived?: () => void;
}


export default function InvestigationHeader({ investigation, onArchived }: InvestigationHeaderProps) {
 const { archiveInvestigation, loading } = useInvestigationStore();
 const [confirmArchive, setConfirmArchive] = useState(false);

 const handleArchive = async () => {
 if (!confirmArchive) {
 setConfirmArchive(true);
 return;
 }
 await archiveInvestigation(investigation.id);
 setConfirmArchive(false);
 onArchived?.();
 };

 return (
 <div className="bg-surface border-b border-border px-6 py-4">
 <div className="flex items-start justify-between gap-4 flex-wrap">
 <div className="min-w-0">
 <div className="flex items-center gap-3 flex-wrap">
 <h1 className="text-2xl font-bold text-text truncate">
 {investigation.name}
 </h1>
            <Badge variant={investigation.status === 'active' ? 'success' : 'ghost'} dot>
              {investigation.status === 'active' ? 'Active' : 'Archived'}
            </Badge>
 </div>

 {investigation.description && (
 <p className="mt-1 text-sm text-text-dim line-clamp-2">
 {investigation.description}
 </p>
 )}

 {investigation.tags.length > 0 && (
 <div className="mt-2 flex items-center gap-1.5 flex-wrap">
 <Tag size={13} className="text-text-mute shrink-0" />
 {investigation.tags.map((tag) => (
 <span
 key={tag}
 className="px-2 py-0.5 bg-cyan/10 text-cyan text-xs font-medium"
 >
 {tag}
 </span>
 ))}
 </div>
 )}
 </div>

 {investigation.status ==='active' && (
 <div className="flex items-center gap-2 shrink-0">
 <button
 type="button"
 className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-text hover:bg-raised transition-colors border border-border"
 >
 <Edit2 size={14} />
 Edit
 </button>

 <button
 type="button"
 disabled={loading}
 onClick={handleArchive}
 className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors border disabled:opacity-50 disabled:cursor-not-allowed ${
 confirmArchive
 ?'bg-neon-r hover:bg-neon-r text-text border-neon-r'
 :'text-neon-r border-neon-r/30 hover:bg-neon-r/10'
 }`}
 >
 <Archive size={14} />
 {confirmArchive ?'Confirm Archive?' :'Archive'}
 </button>

 {confirmArchive && (
 <button
 type="button"
 onClick={() => setConfirmArchive(false)}
 className="px-3 py-1.5 text-sm text-text-dim hover:bg-raised transition-colors"
 >
 Cancel
 </button>
 )}
 </div>
 )}
 </div>
 </div>
 );
}
