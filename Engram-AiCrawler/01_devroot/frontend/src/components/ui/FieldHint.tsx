/**
 * FieldHint — helper text shown below a form field.
 * Supports example chips and plain text hints.
 *
 * Usage:
 *   <FieldHint hint="Enter a username to search across platforms." />
 *   <FieldHint
 *     hint="Examples:"
 *     examples={["johndoe", "john_doe_1987", "jdoe"]}
 *     onExampleClick={(ex) => setValue(ex)}
 *   />
 */

interface FieldHintProps {
	hint?: string;
	examples?: string[];
	onExampleClick?: (example: string) => void;
	className?: string;
	error?: string;
}

export function FieldHint({
	hint,
	examples,
	onExampleClick,
	className = "",
	error,
}: FieldHintProps) {
	if (error) {
		return (
			<p className={`mt-1 text-[11px] text-neon-r flex items-center gap-1 ${className}`}>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth={2}
					strokeLinecap="round"
					strokeLinejoin="round"
					className="w-3 h-3 flex-shrink-0"
					aria-hidden="true"
				>
					<circle cx="12" cy="12" r="10" />
					<line x1="12" y1="8" x2="12" y2="12" />
					<line x1="12" y1="16" x2="12.01" y2="16" />
				</svg>
				{error}
			</p>
		);
	}

	if (!hint && (!examples || examples.length === 0)) return null;

	return (
		<div className={`mt-1.5 flex flex-wrap items-center gap-1.5 ${className}`}>
			{hint && (
				<span className="text-[11px] text-text-mute">{hint}</span>
			)}
			{examples && examples.length > 0 && (
				<>
					{!hint && (
						<span className="text-[11px] text-text-mute">e.g.</span>
					)}
					{examples.map((ex) => (
						<button
							key={ex}
							type="button"
							onClick={() => onExampleClick?.(ex)}
							className={`
								text-[11px] font-mono px-1.5 py-0.5 rounded
								border border-border/60 bg-abyss
								text-text-dim transition-colors
								${onExampleClick
									? "hover:border-cyan/40 hover:text-cyan cursor-pointer"
									: "cursor-default"
								}
							`}
						>
							{ex}
						</button>
					))}
				</>
			)}
		</div>
	);
}
