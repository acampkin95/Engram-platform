/**
 * StatCard — a compact metric card for dashboards.
 *
 * Usage:
 *   <StatCard
 *     label="Profile URLs"
 *     value={42}
 *     icon={<Link className="w-4 h-4" />}
 *     accent="cyan"
 *   />
 */
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { type ReactNode, useEffect } from "react";

type Accent = "cyan" | "plasma" | "volt" | "fuchsia" | "acid" | "neon-r" | "ghost";

interface StatCardProps {
	label: string;
	value: number | string;
	icon?: ReactNode;
	accent?: Accent;
	suffix?: string;
	/** Optional sub-label shown below value */
	sub?: string;
	className?: string;
	animate?: boolean;
}

const ACCENT_CLASSES: Record<Accent, { text: string; bg: string; border: string }> = {
	cyan:    { text: "text-cyan",    bg: "bg-cyan/5",    border: "border-cyan/20" },
	plasma:  { text: "text-plasma",  bg: "bg-plasma/5",  border: "border-plasma/20" },
	volt:    { text: "text-volt",    bg: "bg-volt/5",    border: "border-volt/20" },
	fuchsia: { text: "text-fuchsia", bg: "bg-fuchsia/5", border: "border-fuchsia/20" },
	acid:    { text: "text-acid",    bg: "bg-acid/5",    border: "border-acid/20" },
	"neon-r":{ text: "text-neon-r",  bg: "bg-neon-r/5",  border: "border-neon-r/20" },
	ghost:   { text: "text-ghost",   bg: "bg-ghost/5",   border: "border-ghost/20" },
};

function AnimatedNumber({ value }: { value: number }) {
	const motionVal = useMotionValue(0);
	const rounded = useTransform(motionVal, (v) => Math.round(v).toLocaleString());

	useEffect(() => {
		const ctrl = animate(motionVal, value, { duration: 0.8, ease: "easeOut" });
		return ctrl.stop;
	}, [value, motionVal]);

	return <motion.span>{rounded}</motion.span>;
}

export function StatCard({
	label,
	value,
	icon,
	accent = "cyan",
	suffix,
	sub,
	className = "",
	animate: shouldAnimate = true,
}: StatCardProps) {
	const { text, bg, border } = ACCENT_CLASSES[accent];
	const isNumeric = typeof value === "number";

	return (
		<div
			className={`
				relative p-4 bg-abyss border ${border} rounded
				flex flex-col gap-1 overflow-hidden
				${className}
			`}
		>
			{/* top accent line */}
			<div className={`absolute inset-x-0 top-0 h-px ${bg.replace("/5", "/40")}`} />

			<div className="flex items-center justify-between mb-1">
				<span className="text-[10px] font-semibold uppercase tracking-widest text-text-mute">
					{label}
				</span>
				{icon && (
					<span className={`${text} opacity-60`}>{icon}</span>
				)}
			</div>

			<div className={`text-2xl font-bold font-mono ${text}`}>
				{isNumeric && shouldAnimate ? (
					<AnimatedNumber value={value} />
				) : (
					<span>{isNumeric ? value.toLocaleString() : value}</span>
				)}
				{suffix && (
					<span className="text-sm font-normal text-text-mute ml-1">{suffix}</span>
				)}
			</div>

			{sub && (
				<span className="text-[10px] text-text-mute">{sub}</span>
			)}
		</div>
	);
}
