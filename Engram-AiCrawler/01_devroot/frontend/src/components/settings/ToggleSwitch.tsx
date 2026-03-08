import { useCallback, useId } from'react';

interface ToggleSwitchProps {
 checked: boolean;
 onChange: (checked: boolean) => void;
 label: string;
 description?: string;
 disabled?: boolean;
 id?: string;
}

export default function ToggleSwitch({
 checked,
 onChange,
 label,
 description,
 disabled = false,
 id: providedId,
}: ToggleSwitchProps) {
 const generatedId = useId();
 const id = providedId ?? generatedId;

 const handleKeyDown = useCallback(
 (e: React.KeyboardEvent) => {
 if (disabled) return;
 if (e.key ==='' || e.key ==='Enter') {
 e.preventDefault();
 onChange(!checked);
 }
 },
 [checked, disabled, onChange]
 );

 return (
 <div className="flex items-start justify-between gap-4">
 <div className="flex flex-col">
 <label
 htmlFor={id}
 className={`text-sm font-medium ${
 disabled
 ?'text-text-mute'
 :'text-text'
 } cursor-pointer`}
 >
 {label}
 </label>
 {description && (
 <p className="text-xs text-text-dim mt-0.5">{description}</p>
 )}
 </div>

 <button
 type="button"
 id={id}
 role="switch"
 aria-checked={checked}
 aria-label={label}
 disabled={disabled}
 onClick={() => !disabled && onChange(!checked)}
 onKeyDown={handleKeyDown}
 className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan focus-visible:ring-offset-2 ${
 disabled
 ?'cursor-not-allowed opacity-50'
 :'cursor-pointer'
 } ${
 checked
 ?'bg-cyan'
 :'bg-surface'
 }`}
 >
 <span
 aria-hidden="true"
 className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-surface shadow ring-0 transition duration-200 ease-in-out ${
 checked ?'translate-x-5' :'translate-x-0'
 }`}
 />
 </button>
 </div>
 );
}
