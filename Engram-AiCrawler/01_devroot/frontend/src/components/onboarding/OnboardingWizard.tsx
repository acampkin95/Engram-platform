import { AnimatePresence, motion } from"framer-motion";
import { ChevronLeft, ChevronRight, SkipForward, X } from"lucide-react";
import { type ReactNode, useCallback, useState } from"react";
import { api } from"../../lib/api";
import { useToast } from"../Toast";
import { OnboardingStep } from"./OnboardingStep";
import { markOnboardingComplete } from './storage';

interface StepConfig {
	title: string;
	description: string;
	content: ReactNode;
}

interface OnboardingWizardProps {
	isOpen: boolean;
	onClose: () => void;
	onComplete: () => void;
}

export function OnboardingWizard({
	isOpen,
	onClose,
	onComplete,
}: OnboardingWizardProps) {
	const [currentStep, setCurrentStep] = useState(0);
	const [isTestingConnection, setIsTestingConnection] = useState(false);
	const [connectionStatus, setConnectionStatus] = useState<
		"idle" |"success" |"error"
	>("idle");
	const toast = useToast();

	const handleTestConnection = useCallback(async () => {
		setIsTestingConnection(true);
		setConnectionStatus("idle");
		try {
			await api.get("/health");
			setConnectionStatus("success");
			toast.success("LM Studio connection successful!");
		} catch {
			setConnectionStatus("error");
			toast.error("Could not connect to LM Studio. Make sure it is running.");
		} finally {
			setIsTestingConnection(false);
		}
	}, [toast]);

	const handleSkip = useCallback(() => {
		markOnboardingComplete();
		onClose();
	}, [onClose]);

	const handleComplete = useCallback(() => {
		markOnboardingComplete();
		onComplete();
		onClose();
	}, [onComplete, onClose]);

	const steps: StepConfig[] = [
		{
			title:"Welcome to Crawl4AI",
			description:
				"Your OSINT-powered web crawling platform for intelligence gathering.",
			content: (
				<div className="space-y-4">
					<p className="text-text-dim leading-relaxed">
						Crawl4AI helps you extract, analyze, and correlate data from
						websites for Open Source Intelligence (OSINT) operations.
					</p>
					<ul className="space-y-2 text-text-dim">
						<li className="flex items-center gap-2">
							<span className="w-2 h-2 bg-cyan rounded-full" />
							Crawl websites with AI-powered extraction
						</li>
						<li className="flex items-center gap-2">
							<span className="w-2 h-2 bg-cyan rounded-full" />
							Discover aliases across social platforms
						</li>
						<li className="flex items-center gap-2">
							<span className="w-2 h-2 bg-cyan rounded-full" />
							Build knowledge graphs from crawled data
						</li>
						<li className="flex items-center gap-2">
							<span className="w-2 h-2 bg-cyan rounded-full" />
							Configure RAG pipelines for AI analysis
						</li>
					</ul>
				</div>
			),
		},
		{
			title:"Connect to LM Studio",
			description:
				"Crawl4AI uses LM Studio for AI-powered extraction and analysis.",
			content: (
				<div className="space-y-4">
					<p className="text-text-dim">
						Make sure LM Studio is running locally with a model loaded. The
						default URL is http://localhost:1234
					</p>
					<button
						type="button"
						onClick={() => void handleTestConnection()}
						disabled={isTestingConnection}
						className="flex items-center gap-2 px-6 py-3 bg-cyan hover:bg-cyan-dim disabled:bg-border text-text font-medium transition-colors"
					>
						{isTestingConnection ?"Testing..." :"Test Connection"}
					</button>
					{connectionStatus ==="success" && (
						<p className="text-plasma text-sm">
							✓ Connection successful! LM Studio is ready.
						</p>
					)}
					{connectionStatus ==="error" && (
						<p className="text-neon-r text-sm">
							✗ Connection failed. Please start LM Studio and try again.
						</p>
					)}
				</div>
			),
		},
		{
			title:"Configure Default Settings",
			description:
				"Set up your preferred crawl defaults (you can change these later).",
			content: (
				<div className="space-y-4">
					<div className="p-4 bg-void">
						<p className="text-text-dim text-sm mb-3">
							Default settings have been configured for optimal OSINT
							operations:
						</p>
						<ul className="space-y-1 text-sm text-text-dim">
							<li>• Headless browser mode enabled</li>
							<li>• JavaScript rendering enabled</li>
							<li>• Screenshot capture enabled</li>
							<li>• Evidence hashing (SHA-256) enabled</li>
						</ul>
					</div>
					<p className="text-text-dim text-sm">
						You can customize these in Settings later.
					</p>
				</div>
			),
		},
		{
			title:"Run a Sample Crawl",
			description:"Try crawling example.com to see how it works.",
			content: (
				<div className="space-y-4">
					<p className="text-text-dim">
						Ready to try it out? After completing this wizard, you can:
					</p>
					<ul className="space-y-2 text-text-dim">
						<li className="flex items-center gap-2">
							<kbd className="px-2 py-0.5 bg-abyss text-xs">
								N
							</kbd>
							Press N to start a new crawl
						</li>
						<li className="flex items-center gap-2">
							<kbd className="px-2 py-0.5 bg-abyss text-xs">
								⌘K
							</kbd>
							Press Cmd+K to open the command palette
						</li>
						<li className="flex items-center gap-2">
							<kbd className="px-2 py-0.5 bg-abyss text-xs">
								?
							</kbd>
							Press ? to see all keyboard shortcuts
						</li>
					</ul>
				</div>
			),
		},
		{
			title:"You are all set!",
			description:"Crawl4AI is ready for your OSINT operations.",
			content: (
				<div className="space-y-4">
					<div className="flex items-center justify-center py-6">
						<div className="w-20 h-20 bg-plasma/20 rounded-full flex items-center justify-center">
							<svg
								className="w-10 h-10 text-plasma"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								role="img"
								aria-label="Complete"
							>
								<title>Complete</title>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M5 13l4 4L19 7"
								/>
							</svg>
						</div>
					</div>
					<p className="text-center text-text-dim">
						Click"Get Started" to begin your first crawl.
					</p>
				</div>
			),
		},
	];

	const totalSteps = steps.length;
	const isLastStep = currentStep === totalSteps - 1;
	const isFirstStep = currentStep === 0;

	const goNext = () => setCurrentStep((s) => Math.min(s + 1, totalSteps - 1));
	const goBack = () => setCurrentStep((s) => Math.max(s - 1, 0));

	if (!isOpen) return null;

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center">
			<button
				type="button"
				className="fixed inset-0 bg-black/50 backdrop-blur-sm cursor-default"
				onClick={handleSkip}
				aria-label="Close onboarding"
			/>

			<motion.div
				initial={{ opacity: 0, scale: 0.95 }}
				animate={{ opacity: 1, scale: 1 }}
				exit={{ opacity: 0, scale: 0.95 }}
				className="relative bg-surface w-full max-w-lg mx-4 overflow-hidden"
			>
				<div className="flex items-center justify-between p-4 border-b border-border">
					<span className="text-sm text-text-dim">
						Step {currentStep + 1} of {totalSteps}
					</span>
					<button
						type="button"
						onClick={handleSkip}
						className="p-1.5 hover:bg-raised transition-colors"
						aria-label="Skip onboarding"
					>
						<X className="w-5 h-5 text-text-mute" />
					</button>
				</div>

				<div className="p-6 min-h-[300px]">
					<AnimatePresence mode="wait">
						<OnboardingStep
							key={currentStep}
							title={steps[currentStep].title}
							description={steps[currentStep].description}
							stepNumber={currentStep + 1}
							totalSteps={totalSteps}
							isActive
						>
							{steps[currentStep].content}
						</OnboardingStep>
					</AnimatePresence>
				</div>

				<div className="flex items-center justify-between p-4 border-t border-border bg-void">
					<button
						type="button"
						onClick={handleSkip}
						className="flex items-center gap-1.5 px-3 py-2 text-text-dim hover:text-text transition-colors"
					>
						<SkipForward className="w-4 h-4" />
						Skip
					</button>

					<div className="flex items-center gap-3">
						{!isFirstStep && (
							<button
								type="button"
								onClick={goBack}
								className="flex items-center gap-1.5 px-4 py-2 text-text-dim hover:bg-raised transition-colors"
							>
								<ChevronLeft className="w-4 h-4" />
								Back
							</button>
						)}
						{isLastStep ? (
							<button
								type="button"
								onClick={handleComplete}
								className="flex items-center gap-1.5 px-6 py-2 bg-cyan hover:bg-cyan-dim text-text font-medium transition-colors"
							>
								Get Started
							</button>
						) : (
							<button
								type="button"
								onClick={goNext}
								className="flex items-center gap-1.5 px-6 py-2 bg-cyan hover:bg-cyan-dim text-text font-medium transition-colors"
							>
								Next
								<ChevronRight className="w-4 h-4" />
							</button>
						)}
					</div>
				</div>
			</motion.div>
		</div>
	);
}
