import { useId, type InputHTMLAttributes } from'react';

type InputType ='text' |'number' |'url' |'email' |'password';

interface FormInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>,'type' |'id'> {
 label: string;
 type?: InputType;
 error?: string;
 description?: string;
 required?: boolean;
 disabled?: boolean;
}

export default function FormInput({
 label,
 type ='text',
 error,
 description,
 required = false,
 disabled = false,
 className ='',
 ...inputProps
}: FormInputProps) {
 const id = useId();

 return (
 <div className="flex flex-col gap-1.5">
 <label
 htmlFor={id}
 className={`text-sm font-medium ${
 disabled
 ?'text-text-mute'
 :'text-text'
 }`}
 >
 {label}
 {required && (
 <span className="ml-1 text-neon-r" aria-hidden="true">*</span>
 )}
 </label>

 {description && (
 <p className="text-xs text-text-dim">{description}</p>
 )}

 <input
 id={id}
 type={type}
 disabled={disabled}
 aria-required={required}
 aria-invalid={!!error}
 aria-describedby={error ? `${id}-error`: description ? `${id}-desc`: undefined}
 className={`w-full border px-3 py-2 text-sm transition-colors
 ${error
 ?'border-neon-r focus:border-neon-r focus:ring-neon-r'
 :'border-border focus:border-cyan focus:ring-cyan'
 }
 bg-surface
 text-text
 placeholder-text-mute
 focus:outline-none focus:ring-2 focus:ring-opacity-50
 disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-void
 ${className}`}
 {...inputProps}
 />

 {error && (
 <p id={`${id}-error`} role="alert" className="text-xs text-neon-r">
 {error}
 </p>
 )}
 </div>
 );
}

// Select variant for dropdowns
interface FormSelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>,'id'> {
 label: string;
 error?: string;
 description?: string;
 required?: boolean;
 disabled?: boolean;
 children: React.ReactNode;
}

export function FormSelect({
 label,
 error,
 description,
 required = false,
 disabled = false,
 className ='',
 children,
 ...selectProps
}: FormSelectProps) {
 const id = useId();

 return (
 <div className="flex flex-col gap-1.5">
 <label
 htmlFor={id}
 className={`text-sm font-medium ${
 disabled
 ?'text-text-mute'
 :'text-text'
 }`}
 >
 {label}
 {required && (
 <span className="ml-1 text-neon-r" aria-hidden="true">*</span>
 )}
 </label>

 {description && (
 <p className="text-xs text-text-dim">{description}</p>
 )}

 <select
 id={id}
 disabled={disabled}
 aria-required={required}
 aria-invalid={!!error}
 aria-describedby={error ? `${id}-error`: undefined}
 className={`w-full border px-3 py-2 text-sm transition-colors
 ${error
 ?'border-neon-r focus:border-neon-r focus:ring-neon-r'
 :'border-border focus:border-cyan focus:ring-cyan'
 }
 bg-surface
 text-text
 focus:outline-none focus:ring-2 focus:ring-opacity-50
 disabled:cursor-not-allowed disabled:opacity-50
 ${className}`}
 {...selectProps}
 >
 {children}
 </select>

 {error && (
 <p id={`${id}-error`} role="alert" className="text-xs text-neon-r">
 {error}
 </p>
 )}
 </div>
 );
}
