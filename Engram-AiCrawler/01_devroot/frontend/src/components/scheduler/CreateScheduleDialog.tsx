import { useState, useCallback } from'react';
import { X, Loader2 } from'lucide-react';
import { CronBuilder } from'./CronBuilder';
import type { ScheduleFrequency, CreateSchedule } from'../../lib/schemas';

interface CreateScheduleDialogProps {
 open: boolean;
 loading: boolean;
 onSubmit: (data: CreateSchedule) => void;
 onClose: () => void;
}

const INITIAL_CRAWL_CONFIG = JSON.stringify(
 {
 url:'https://example.com',
 extraction_type:'llm',
 word_count_threshold: 50,
 },
 null,
 2
);

export function CreateScheduleDialog({
 open,
 loading,
 onSubmit,
 onClose,
}: CreateScheduleDialogProps) {
 const [name, setName] = useState('');
 const [crawlConfigText, setCrawlConfigText] = useState(INITIAL_CRAWL_CONFIG);
 const [frequency, setFrequency] = useState<ScheduleFrequency>('daily');
 const [cronExpression, setCronExpression] = useState('0 9 * * *');
 const [configError, setConfigError] = useState('');

 const resetForm = useCallback(() => {
 setName('');
 setCrawlConfigText(INITIAL_CRAWL_CONFIG);
 setFrequency('daily');
 setCronExpression('0 9 * * *');
 setConfigError('');
 }, []);

 const handleClose = () => {
 if (!loading) {
 resetForm();
 onClose();
 }
 };

 const handleSubmit = () => {
 let crawlConfig: Record<string, unknown>;
 try {
 crawlConfig = JSON.parse(crawlConfigText);
 } catch {
 setConfigError('Invalid JSON');
 return;
 }
 setConfigError('');

 onSubmit({
 name: name.trim(),
 crawl_config: crawlConfig,
 frequency,
 cron_expression: cronExpression || undefined,
 enabled: true,
 });
 };

 const handleCronChange = useCallback((cron: string) => {
 setCronExpression(cron);
 }, []);

 const handleFrequencyChange = useCallback((freq: ScheduleFrequency) => {
 setFrequency(freq);
 }, []);

 const isValid = name.trim().length > 0 && crawlConfigText.trim().length > 0;

 if (!open) return null;

 return (
 <div
 className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
 role="dialog"
 aria-modal="true"
 aria-labelledby="create-schedule-title"
 >
 <div
 className="absolute inset-0 bg-black/50 backdrop-blur-sm"
 onClick={handleClose}
 aria-hidden="true"
 />

 <div className="relative z-10 w-full max-w-lg max-h-[90vh] overflow-y-auto bg-surface ring-1 ring-black/5 animate-toast-in">
 <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border">
 <h2
 id="create-schedule-title"
 className="text-lg font-semibold text-text"
 >
 New Schedule
 </h2>
 <button
 type="button"
 onClick={handleClose}
 disabled={loading}
 className="p-1.5 hover:bg-raised text-text-mute hover:text-text-dim transition-colors"
 aria-label="Close dialog"
 >
 <X className="w-5 h-5" />
 </button>
 </div>

 <div className="px-6 py-5 space-y-5">
 <div>
 <label
 htmlFor="schedule-name"
 className="block text-sm font-medium text-text mb-1"
 >
 Name
 </label>
 <input
 id="schedule-name"
 type="text"
 value={name}
 onChange={(e) => setName(e.target.value)}
 placeholder="e.g. Daily News Scrape"
 maxLength={100}
 className="w-full px-3 py-2 bg-void border border-border text-text placeholder-text-mute focus:outline-none focus:border-cyan text-sm"
 />
 </div>

 <div>
 <label
 htmlFor="crawl-config"
 className="block text-sm font-medium text-text mb-1"
 >
 Crawl Configuration (JSON)
 </label>
 <textarea
 id="crawl-config"
 value={crawlConfigText}
 onChange={(e) => {
 setCrawlConfigText(e.target.value);
 setConfigError('');
 }}
 rows={6}
 className={`w-full px-3 py-2 bg-void border text-text placeholder-text-mute focus:outline-none font-mono text-xs leading-relaxed resize-y ${
 configError
 ?'border-neon-r focus:border-neon-r'
 :'border-border focus:border-cyan'
 }`}
 />
 {configError && (
 <p className="mt-1 text-xs text-neon-r">{configError}</p>
 )}
 </div>

 <CronBuilder
 frequency={frequency}
 cronExpression={cronExpression}
 onFrequencyChange={handleFrequencyChange}
 onCronChange={handleCronChange}
 />
 </div>

 <div className="flex gap-3 justify-end px-6 pb-6 pt-2">
 <button
 type="button"
 onClick={handleClose}
 disabled={loading}
 className="px-4 py-2 text-sm font-medium text-text bg-abyss hover:bg-border disabled:opacity-50 transition-colors"
 >
 Cancel
 </button>
 <button
 type="button"
 onClick={handleSubmit}
 disabled={loading || !isValid}
 className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-cyan hover:bg-cyan-dim text-text disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-cyan transition-colors"
 >
 {loading && <Loader2 className="w-4 h-4 animate-spin" />}
 Create Schedule
 </button>
 </div>
 </div>
 </div>
 );
}
