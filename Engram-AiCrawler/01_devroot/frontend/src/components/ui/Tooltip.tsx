/**
 * Tooltip — lightweight CSS-only tooltip with optional framer-motion fade.
 *
 * Usage:
 *   <Tooltip content="Explain something">
 *     <Button>Hover me</Button>
 *   </Tooltip>
 *
 *   <Tooltip content="Long help text" side="bottom" maxWidth={280}>
 *     <HelpCircle className="w-4 h-4 text-text-mute" />
 *   </Tooltip>
 */
import { AnimatePresence, motion } from "framer-motion";
import {
	type ReactNode,
	useCallback,
	useRef,
	useState,
} from "react";

type Side = "top" | "bottom" | "left" | "right";

interface TooltipProps {
	content: ReactNode;
	children: ReactNode;
	side?: Side;
	maxWidth?: number;
	delay?: number;
	disabled?: boolean;
	className?: string;
}

const SIDE_CLASSES: Record<Side, string> = {
	top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
	bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
	left: "right-full top-1/2 -translate-y-1/2 mr-2",
	right: "left-full top-1/2 -translate-y-1/2 ml-2",
};

const SIDE_INITIAL: Record<Side, { opacity: number; y?: number; x?: number }> = {
	top: { opacity: 0, y: 4 },
	bottom: { opacity: 0, y: -4 },
	left: { opacity: 0, x: 4 },
	right: { opacity: 0, x: -4 },
};

export function Tooltip({
	content,
	children,
	side = "top",
	maxWidth = 220,
	delay = 400,
	disabled = false,
	className = "",
}: TooltipProps) {
	const [visible, setVisible] = useState(false);
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const show = useCallback(() => {
		if (disabled) return;
		timerRef.current = setTimeout(() => setVisible(true), delay);
	}, [disabled, delay]);

	const hide = useCallback(() => {
		if (timerRef.current) clearTimeout(timerRef.current);
		setVisible(false);
	}, []);

	return (
		<span
			className={`relative inline-flex ${className}`}
			onMouseEnter={show}
			onMouseLeave={hide}
			onFocus={show}
			onBlur={hide}
		>
			{children}
			<AnimatePresence>
				{visible && (
					<motion.span
						role="tooltip"
						initial={SIDE_INITIAL[side]}
						animate={{ opacity: 1, y: 0, x: 0 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.15 }}
						style={{ maxWidth }}
						className={`
							pointer-events-none absolute z-50 whitespace-normal
							px-2.5 py-1.5 rounded
							bg-raised border border-border
							text-[11px] leading-relaxed text-text
							shadow-lg
							${SIDE_CLASSES[side]}
						`}
					>
						{content}
					</motion.span>
				)}
			</AnimatePresence>
		</span>
	);
}

/** Inline help icon with a tooltip — drop next to any label */
export function HelpTooltip({
	content,
	side = "top",
	maxWidth = 240,
}: {
	content: ReactNode;
	side?: Side;
	maxWidth?: number;
}) {
	return (
		<Tooltip content={content} side={side} maxWidth={maxWidth}>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth={2}
				strokeLinecap="round"
				strokeLinejoin="round"
				className="w-3.5 h-3.5 text-text-mute hover:text-text-dim cursor-help transition-colors flex-shrink-0"
				aria-hidden="true"
			>
				<circle cx="12" cy="12" r="10" />
				<path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
				<path d="M12 17h.01" />
			</svg>
		</Tooltip>
	);
}
