import { useState, useRef, useEffect } from'react';
import { Link } from'react-router-dom';
import { FolderOpen, ChevronDown, CheckCircle, Settings } from'lucide-react';
import { useInvestigationStore } from'../../stores/investigationStore';
import type { Investigation } from'../../stores/investigationStore';

export default function InvestigationSelector() {
 const { activeInvestigation, investigations, setActiveInvestigation, fetchInvestigations } =
 useInvestigationStore();
 const [open, setOpen] = useState(false);
 const containerRef = useRef<HTMLDivElement>(null);

 useEffect(() => {
 fetchInvestigations();
 }, [fetchInvestigations]);

 useEffect(() => {
 const handleOutsideClick = (e: MouseEvent) => {
 if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
 setOpen(false);
 }
 };
 if (open) document.addEventListener('mousedown', handleOutsideClick);
 return () => document.removeEventListener('mousedown', handleOutsideClick);
 }, [open]);

 const activeInvestigations = investigations.filter((i) => i.status ==='active');

 const selectInvestigation = (inv: Investigation) => {
 setActiveInvestigation(inv);
 setOpen(false);
 };

 const clearInvestigation = () => {
 setActiveInvestigation(null);
 setOpen(false);
 };

 return (
 <div ref={containerRef} className="relative">
 <button
 type="button"
 onClick={() => setOpen((prev) => !prev)}
 className="flex items-center gap-2 px-3 py-1.5 border border-border bg-surface text-sm text-text hover:bg-void transition-colors max-w-[200px]"
 aria-haspopup="listbox"
 aria-expanded={open}
 >
 <FolderOpen
 size={15}
 className={activeInvestigation ?'text-cyan' :'text-text-mute'}
 />
 <span className="truncate font-medium">
 {activeInvestigation ? activeInvestigation.name :'No Investigation'}
 </span>
 <ChevronDown
 size={14}
 className={`shrink-0 transition-transform text-text-mute ${open ?'rotate-180' :''}`}
 />
 </button>

 {open && (
 <div
 role="listbox"
 aria-label="Select investigation"
 className="absolute top-full right-0 mt-1.5 w-64 bg-surface border border-border z-50 overflow-hidden"
 >
 {activeInvestigations.length === 0 ? (
 <div className="px-4 py-3 text-sm text-text-dim text-center">
 No active investigations
 </div>
 ) : (
 <ul className="py-1 max-h-56 overflow-y-auto">
 <li>
 <button
 type="button"
 role="option"
 aria-selected={activeInvestigation === null}
 onClick={clearInvestigation}
 className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-dim hover:bg-void transition-colors text-left"
 >
 <span className="w-4" />
 <span className="italic">None</span>
 </button>
 </li>
 {activeInvestigations.map((inv) => {
 const isSelected = activeInvestigation?.id === inv.id;
 return (
 <li key={inv.id}>
 <button
 type="button"
 role="option"
 aria-selected={isSelected}
 onClick={() => selectInvestigation(inv)}
 className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text hover:bg-cyan/10 transition-colors text-left"
 >
 <CheckCircle
 size={14}
 className={isSelected ?'text-cyan' :'text-transparent'}
 />
 <span className="truncate">{inv.name}</span>
 </button>
 </li>
 );
 })}
 </ul>
 )}

 <div className="border-t border-border px-3 py-2">
 <Link
 to="/investigations"
 onClick={() => setOpen(false)}
 className="flex items-center gap-2 text-sm text-cyan hover:text-cyan font-medium transition-colors"
 >
 <Settings size={14} />
 Manage Investigations
 </Link>
 </div>
 </div>
 )}
 </div>
 );
}
