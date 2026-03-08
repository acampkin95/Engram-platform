import { motion } from"framer-motion";
import { Check } from"lucide-react";
import type { ReactNode } from"react";

interface OnboardingStepProps {
	title: string;
	description?: string;
	stepNumber: number;
	totalSteps: number;
	isComplete?: boolean;
	isActive?: boolean;
	children: ReactNode;
}

export function OnboardingStep({
	title,
	description,
	stepNumber,
	totalSteps,
	isComplete,
	isActive,
	children,
}: OnboardingStepProps) {
	return (
		<motion.div
			initial={{ opacity: 0, x: 20 }}
			animate={{ opacity: 1, x: 0 }}
			exit={{ opacity: 0, x: -20 }}
			transition={{ duration: 0.3 }}
			className="space-y-6"
		>
			<div className="flex items-center gap-4">
				<div className="flex items-center gap-2">
					{Array.from({ length: totalSteps }).map((_, i) => (
						<div
							key={`step-${i + 1}`}
							className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
								i + 1 < stepNumber || isComplete
									?"bg-plasma text-text"
									: i + 1 === stepNumber && isActive
										?"bg-cyan text-text"
										:"bg-surface text-text-dim"
							}`}
						>
							{i + 1 < stepNumber || isComplete ? (
								<Check className="w-4 h-4" />
							) : (
								i + 1
							)}
						</div>
					))}
				</div>
			</div>

			<div className="space-y-2">
				<h2 className="text-2xl font-bold text-text">
					{title}
				</h2>
				{description && (
					<p className="text-text-dim">{description}</p>
				)}
			</div>

			<div className="py-4">{children}</div>
		</motion.div>
	);
}
