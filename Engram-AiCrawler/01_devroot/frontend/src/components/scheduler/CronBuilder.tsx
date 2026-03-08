import { useState, useEffect } from'react';
import type { ScheduleFrequency } from'../../lib/schemas';

interface CronPreset {
 label: string;
 frequency: ScheduleFrequency;
 cron: string;
}

const CRON_PRESETS: CronPreset[] = [
 { label:'Every hour', frequency:'hourly', cron:'0 * * * *' },
 { label:'Every day at 9 AM', frequency:'daily', cron:'0 9 * * *' },
 { label:'Every Monday at 9 AM', frequency:'weekly', cron:'0 9 * * 1' },
 { label:'Every 1st of the month', frequency:'monthly', cron:'0 0 1 * *' },
];

const HOURS = Array.from({ length: 24 }, (_, i) => ({
 value: String(i),
 label: `${String(i).padStart(2,'0')}:00`,
}));

const DAYS_OF_WEEK = [
 { value:'0', label:'Sunday' },
 { value:'1', label:'Monday' },
 { value:'2', label:'Tuesday' },
 { value:'3', label:'Wednesday' },
 { value:'4', label:'Thursday' },
 { value:'5', label:'Friday' },
 { value:'6', label:'Saturday' },
];

interface CronBuilderProps {
 frequency: ScheduleFrequency;
 cronExpression: string;
 onFrequencyChange: (frequency: ScheduleFrequency) => void;
 onCronChange: (cron: string) => void;
}

export function CronBuilder({
 frequency,
 cronExpression,
 onFrequencyChange,
 onCronChange,
}: CronBuilderProps) {
 const [hour, setHour] = useState('9');
 const [dayOfWeek, setDayOfWeek] = useState('1');

 useEffect(() => {
 switch (frequency) {
 case'hourly':
 onCronChange('0 * * * *');
 break;
 case'daily':
 onCronChange(`0 ${hour} * * *`);
 break;
 case'weekly':
 onCronChange(`0 ${hour} * * ${dayOfWeek}`);
 break;
 case'monthly':
 onCronChange(`0 ${hour} 1 * *`);
 break;
 default:
 break;
 }
 }, [frequency, hour, dayOfWeek, onCronChange]);

 const handlePresetClick = (preset: CronPreset) => {
 onFrequencyChange(preset.frequency);
 onCronChange(preset.cron);
 };

 return (
 <div className="space-y-4">
 <fieldset>
 <legend className="block text-sm font-medium text-text mb-2">
 Quick Presets
 </legend>
 <div className="flex flex-wrap gap-2">
 {CRON_PRESETS.map((preset) => (
 <button
 key={preset.cron}
 type="button"
 onClick={() => handlePresetClick(preset)}
 className={`px-3 py-1.5 text-xs font-medium border transition-colors ${
 frequency === preset.frequency && cronExpression === preset.cron
 ?'bg-cyan/20 border-cyan text-cyan'
 :'bg-surface border-border text-text hover:bg-void'
 }`}
 >
 {preset.label}
 </button>
 ))}
 </div>
 </fieldset>

 <div>
 <label
 htmlFor="cron-frequency"
 className="block text-sm font-medium text-text mb-1"
 >
 Frequency
 </label>
 <select
 id="cron-frequency"
 value={frequency}
 onChange={(e) => onFrequencyChange(e.target.value as ScheduleFrequency)}
 className="w-full px-3 py-2 bg-void border border-border text-text focus:outline-none focus:border-cyan text-sm"
 >
 <option value="once">Once</option>
 <option value="hourly">Every hour</option>
 <option value="daily">Every day at…</option>
 <option value="weekly">Every week on…</option>
 <option value="monthly">Every month</option>
 <option value="custom">Custom cron</option>
 </select>
 </div>

 {(frequency ==='daily' || frequency ==='weekly' || frequency ==='monthly') && (
 <div className="flex gap-4">
 <div className="flex-1">
 <label
 htmlFor="cron-hour"
 className="block text-sm font-medium text-text mb-1"
 >
 At hour (0-23)
 </label>
 <select
 id="cron-hour"
 value={hour}
 onChange={(e) => setHour(e.target.value)}
 className="w-full px-3 py-2 bg-void border border-border text-text focus:outline-none focus:border-cyan text-sm"
 >
 {HOURS.map((h) => (
 <option key={h.value} value={h.value}>
 {h.label}
 </option>
 ))}
 </select>
 </div>

 {frequency ==='weekly' && (
 <div className="flex-1">
 <label
 htmlFor="cron-dow"
 className="block text-sm font-medium text-text mb-1"
 >
 Day of week
 </label>
 <select
 id="cron-dow"
 value={dayOfWeek}
 onChange={(e) => setDayOfWeek(e.target.value)}
 className="w-full px-3 py-2 bg-void border border-border text-text focus:outline-none focus:border-cyan text-sm"
 >
 {DAYS_OF_WEEK.map((d) => (
 <option key={d.value} value={d.value}>
 {d.label}
 </option>
 ))}
 </select>
 </div>
 )}
 </div>
 )}

 {frequency ==='custom' && (
 <div>
 <label
 htmlFor="cron-custom"
 className="block text-sm font-medium text-text mb-1"
 >
 Cron expression
 </label>
 <input
 id="cron-custom"
 type="text"
 value={cronExpression}
 onChange={(e) => onCronChange(e.target.value)}
 placeholder="0 * * * *"
 className="w-full px-3 py-2 bg-void border border-border text-text placeholder-text-mute focus:outline-none focus:border-cyan font-mono text-sm"
 />
 <p className="mt-1 text-xs text-text-dim">
 Format: minute hour day-of-month month day-of-week
 </p>
 </div>
 )}

 <div className="px-3 py-2 bg-abyss">
 <span className="text-xs font-medium text-text-dim">
 Cron expression:{''}
 </span>
 <code className="text-xs font-mono text-cyan">
 {cronExpression ||'—'}
 </code>
 </div>
 </div>
 );
}
