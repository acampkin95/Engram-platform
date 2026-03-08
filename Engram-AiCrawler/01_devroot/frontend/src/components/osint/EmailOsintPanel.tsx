import { AnimatePresence, motion } from "framer-motion";
import {
	AtSign,
	Calendar,
	CheckCircle,
	ChevronDown,
	ChevronRight,
	Database,
	Mail,
	Search,
	ShieldAlert,
	UserCheck,
	Users,
	} from "lucide-react";

import { useCallback, useState } from "react";
import { useEmailOsint } from "../../hooks/useOsintServices";
import { useReducedMotion } from "../../lib/motion";
import {
	Button,
	Card,
	CardBody,
	CardHeader,
	FieldHint,
	HelpTooltip,
	Input,
	StatCard,
	Textarea,
	Badge,
} from '../ui';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function FallbackBadge() {
	return <Badge variant="warning" dot>Fallback</Badge>;
}

function BooleanIndicator({
	value,
	trueLabel,
	falseLabel,
}: {
	value?: boolean;
	trueLabel: string;
	falseLabel: string;
}) {
	if (value === undefined || value === null) return null;
	return value ? (
		<Badge variant="danger">{trueLabel}</Badge>
	) : (
		<Badge variant="success">{falseLabel}</Badge>
	);
}

// ---------------------------------------------------------------------------
// Breach Card
// ---------------------------------------------------------------------------

interface BreachInfo {
	name: string;
	title?: string | null;
	domain?: string | null;
	breach_date?: string | null;
	pwn_count?: number | null;
	data_classes?: string[];
	is_verified?: boolean;
}

function BreachCard({ breach, delay }: { breach: BreachInfo; delay: number }) {
	const [expanded, setExpanded] = useState(false);

	return (
		<motion.div
			initial={{ opacity: 0, y: 4 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ delay, duration: 0.2 }}
			className="border border-border rounded overflow-hidden"
		>
			<button
				type="button"
				onClick={() => setExpanded(!expanded)}
				className="w-full flex items-center justify-between p-3 bg-surface hover:bg-raised transition-colors"
			>
				<div className="flex items-center gap-3 min-w-0">
					<Database size={14} className="text-neon-r flex-shrink-0" />
					<span className="text-sm font-medium text-text truncate">
						{breach.title || breach.name}
					</span>
					{breach.breach_date && (
						<span className="text-[10px] text-text-mute flex items-center gap-1 flex-shrink-0">
							<Calendar size={10} />
							{breach.breach_date}
						</span>
					)}
					{breach.is_verified && (
						<span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-neon-r/10 text-neon-r flex-shrink-0">
							Verified
						</span>
					)}
				</div>
				{expanded ? (
					<ChevronDown size={14} className="text-text-mute" />
				) : (
					<ChevronRight size={14} className="text-text-mute" />
				)}
			</button>
			<AnimatePresence>
				{expanded && (
					<motion.div
						initial={{ height: 0, opacity: 0 }}
						animate={{ height: "auto", opacity: 1 }}
						exit={{ height: 0, opacity: 0 }}
						className="px-4 py-3 border-t border-border/30 space-y-2"
					>
						{breach.domain && (
							<div className="text-xs">
								<span className="text-text-mute">Domain: </span>
								<span className="text-text font-mono">{breach.domain}</span>
							</div>
						)}
						{breach.pwn_count != null && (
							<div className="text-xs">
								<span className="text-text-mute">Records exposed: </span>
								<span className="text-neon-r font-mono font-bold">
									{breach.pwn_count.toLocaleString()}
								</span>
							</div>
						)}
						{breach.data_classes && breach.data_classes.length > 0 && (
							<div>
								<span className="text-[10px] text-text-mute block mb-1">
									Compromised Data
								</span>
								<div className="flex flex-wrap gap-1">
									{breach.data_classes.map((dc) => (
										<span
											key={dc}
											className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-fuchsia/10 text-fuchsia"
										>
											{dc}
										</span>
									))}
								</div>
							</div>
						)}
					</motion.div>
				)}
			</AnimatePresence>
		</motion.div>
	);
}

// ---------------------------------------------------------------------------
// Collapsible section
// ---------------------------------------------------------------------------

function CollapsibleSection({
	id,
	icon,
	iconColor,
	title,
	badge,
	expanded,
	onToggle,
	children,
	prefersReduced,
}: {
	id: string;
	icon: React.ReactNode;
	iconColor: string;
	title: string;
	badge?: React.ReactNode;
	expanded: boolean;
	onToggle: () => void;
	children: React.ReactNode;
	prefersReduced: boolean;
}) {
	return (
		<div className="border border-border rounded overflow-hidden">
			<button
				type="button"
				onClick={onToggle}
				className="w-full flex items-center justify-between p-3 bg-surface hover:bg-raised transition-colors"
				aria-expanded={expanded}
				aria-controls={`section-${id}`}
			>
				<span className="flex items-center gap-2 text-sm font-medium text-text">
					<span className={iconColor}>{icon}</span>
					{title}
					{badge}
				</span>
				{expanded ? (
					<ChevronDown size={16} className="text-text-mute" />
				) : (
					<ChevronRight size={16} className="text-text-mute" />
				)}
			</button>
			<AnimatePresence>
				{expanded && (
					<motion.div
						id={`section-${id}`}
						initial={prefersReduced ? undefined : { height: 0, opacity: 0 }}
						animate={prefersReduced ? undefined : { height: "auto", opacity: 1 }}
						exit={prefersReduced ? undefined : { height: 0, opacity: 0 }}
						transition={{ duration: 0.2 }}
					>
						{children}
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Main Panel
// ---------------------------------------------------------------------------

interface EmailOsintPanelProps {
	className?: string;
}

export function EmailOsintPanel({ className = "" }: EmailOsintPanelProps) {
	const {
		breachResult,
		emailVerifyResult,
		emailReverseResult,
		bulkEmailResult,
		isLoading,
		error,
		fullEmailCheck,
		bulkCheck,
		clearError,
	} = useEmailOsint();

	const prefersReduced = useReducedMotion();
	const [email, setEmail] = useState("");
	const [bulkEmails, setBulkEmails] = useState("");
	const [mode, setMode] = useState<"single" | "bulk">("single");
	const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
		breach: true,
		verify: true,
		reverse: true,
	});

	const parseBulkEmails = useCallback(
		() =>
			bulkEmails
				.split(/[,\n]/)
				.map((e) => e.trim())
				.filter(Boolean),
		[bulkEmails],
	);

	const toggleSection = (key: string) => {
		setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
	};

	const handleSingleCheck = useCallback(() => {
		if (email.trim()) {
			clearError();
			fullEmailCheck(email.trim());
		}
	}, [email, fullEmailCheck, clearError]);

	const handleBulkCheck = useCallback(() => {
		const emails = parseBulkEmails();
		if (emails.length > 0) {
			clearError();
			bulkCheck(emails);
		}
	}, [bulkCheck, clearError, parseBulkEmails]);

	const handleRetry = useCallback(() => {
		if (mode === "single") { handleSingleCheck(); return; }
		handleBulkCheck();
	}, [mode, handleSingleCheck, handleBulkCheck]);

	const bulkCount = bulkEmails.split(/[,\n]/).filter((e) => e.trim()).length;
	const breachCount = breachResult?.breach_count ?? 0;
	const bulkBreached = bulkEmailResult?.breached_count ?? 0;
	const bulkTotal = bulkEmailResult?.total ?? 0;

	return (
		<motion.div
			initial={prefersReduced ? undefined : { opacity: 0, y: 8 }}
			animate={prefersReduced ? undefined : { opacity: 1, y: 0 }}
			transition={{ duration: 0.3 }}
			className={className}
		>
			<Card>
				<CardHeader>
					<h2 className="text-lg font-display font-semibold flex items-center gap-2">
						<Mail className="w-5 h-5 text-fuchsia" />
						Email Intelligence
					</h2>
				</CardHeader>
				<CardBody>
					{/* Mode tabs */}
					<div className="flex gap-1 mb-4 p-1 bg-abyss rounded w-fit">
						<button
							type="button"
							onClick={() => setMode("single")}
							className={`px-4 py-1.5 text-xs font-medium rounded transition-colors flex items-center gap-1.5 ${
								mode === "single"
									? "bg-surface text-fuchsia border border-fuchsia/20"
									: "text-text-mute hover:text-text"
							}`}
						>
							<Mail size={12} />
							Single Check
							<HelpTooltip
								content="Check a single email for breaches, verify deliverability, and look up identity information."
								side="top"
							/>
						</button>
						<button
							type="button"
							onClick={() => setMode("bulk")}
							className={`px-4 py-1.5 text-xs font-medium rounded transition-colors flex items-center gap-1.5 ${
								mode === "bulk"
									? "bg-surface text-fuchsia border border-fuchsia/20"
									: "text-text-mute hover:text-text"
							}`}
						>
							<Users size={12} />
							Bulk Check
							<HelpTooltip
								content="Check up to 100 emails at once for breach exposure. One email per line or comma-separated."
								side="top"
							/>
						</button>
					</div>

					{/* Single mode input */}
					<AnimatePresence mode="wait">
						{mode === "single" && (
							<motion.div
								key="single"
								initial={prefersReduced ? undefined : { opacity: 0, y: 4 }}
								animate={prefersReduced ? undefined : { opacity: 1, y: 0 }}
								exit={prefersReduced ? undefined : { opacity: 0, y: -4 }}
								transition={{ duration: 0.15 }}
								className="mb-5"
							>
								<div className="flex items-center gap-2 mb-1.5">
									<label className="text-xs font-semibold uppercase tracking-wider text-text-dim">
										Email Address
									</label>
									<HelpTooltip
										content="Full email address to investigate. Results include breach history, deliverability, and identity lookup."
										side="right"
									/>
								</div>
								<div className="flex gap-2">
									<Input
										type="email"
										value={email}
										onChange={(e) => setEmail(e.target.value)}
										onKeyDown={(e) => e.key === "Enter" && handleSingleCheck()}
										placeholder="e.g. user@gmail.com"
										leftIcon={<AtSign className="w-3.5 h-3.5" />}
									/>
									<Button
										variant="ghost"
										size="sm"
										onClick={handleSingleCheck}
										disabled={isLoading || !email.trim()}
										loading={isLoading && mode === "single"}
										leftIcon={<Search className="w-3.5 h-3.5" />}
										className="border-fuchsia/30 text-fuchsia hover:bg-fuchsia/10 shrink-0"
									>
										Investigate
									</Button>
								</div>
								<FieldHint
									hint="Examples:"
									examples={["user@gmail.com", "john.doe@company.com", "test@proton.me"]}
									onExampleClick={(ex) => setEmail(ex)}
								/>
							</motion.div>
						)}

						{mode === "bulk" && (
							<motion.div
								key="bulk"
								initial={prefersReduced ? undefined : { opacity: 0, y: 4 }}
								animate={prefersReduced ? undefined : { opacity: 1, y: 0 }}
								exit={prefersReduced ? undefined : { opacity: 0, y: -4 }}
								transition={{ duration: 0.15 }}
								className="mb-5"
							>
								<div className="flex items-center gap-2 mb-1.5">
									<label className="text-xs font-semibold uppercase tracking-wider text-text-dim">
										Email List
									</label>
									<HelpTooltip
										content="Paste up to 100 emails, one per line or comma-separated. Results show breach exposure for each address."
										side="right"
									/>
								</div>
								<Textarea
									value={bulkEmails}
									onChange={(e) => setBulkEmails(e.target.value)}
									placeholder={"user1@gmail.com\nuser2@company.com\nuser3@proton.me"}
									rows={4}
									className="font-mono text-xs resize-none mb-2"
								/>
								<FieldHint hint="One email per line or comma-separated · max 100 addresses" />
								<Button
									variant="ghost"
									size="sm"
									onClick={handleBulkCheck}
									disabled={isLoading || !bulkEmails.trim()}
									loading={isLoading && mode === "bulk"}
									leftIcon={<Users className="w-3.5 h-3.5" />}
									className="border-fuchsia/30 text-fuchsia hover:bg-fuchsia/10 mt-1"
								>
									Bulk Check ({bulkCount} email{bulkCount !== 1 ? "s" : ""})
								</Button>
							</motion.div>
						)}
					</AnimatePresence>

					{/* Stat cards */}
					<AnimatePresence>
						{mode === "single" &&
							(breachResult || emailVerifyResult || emailReverseResult) &&
							!isLoading && (
								<motion.div
									initial={prefersReduced ? undefined : { opacity: 0, y: -6 }}
									animate={prefersReduced ? undefined : { opacity: 1, y: 0 }}
									exit={prefersReduced ? undefined : { opacity: 0 }}
									transition={{ duration: 0.25 }}
									className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4"
								>
									<StatCard
										label="Breaches"
										value={breachCount}
										icon={<ShieldAlert className="w-4 h-4" />}
										accent={breachCount > 0 ? "neon-r" : "plasma"}
									/>
									<StatCard
										label="Status"
										value={emailVerifyResult?.status === "valid" ? 1 : 0}
										icon={<UserCheck className="w-4 h-4" />}
										accent="acid"
										sub={emailVerifyResult?.status ?? undefined}
									/>
									<StatCard
										label="Confidence"
										value={emailVerifyResult?.score ?? 0}
										icon={<CheckCircle className="w-4 h-4" />}
										accent="plasma"
										suffix="%"
									/>
									<StatCard
										label="Identity"
										value={emailReverseResult?.first_name ? 1 : 0}
										icon={<AtSign className="w-4 h-4" />}
										accent="ghost"
										sub={
											emailReverseResult?.first_name
												? `${emailReverseResult.first_name} ${emailReverseResult.last_name ?? ""}`.trim()
												: undefined
										}
									/>
								</motion.div>
							)}

						{mode === "bulk" && bulkEmailResult && !isLoading && (
							<motion.div
								initial={prefersReduced ? undefined : { opacity: 0, y: -6 }}
								animate={prefersReduced ? undefined : { opacity: 1, y: 0 }}
								exit={prefersReduced ? undefined : { opacity: 0 }}
								transition={{ duration: 0.25 }}
								className="grid grid-cols-3 gap-3 mb-4"
							>
								<StatCard
									label="Checked"
									value={bulkTotal}
									icon={<Mail className="w-4 h-4" />}
									accent="fuchsia"
								/>
								<StatCard
									label="Breached"
									value={bulkBreached}
									icon={<ShieldAlert className="w-4 h-4" />}
									accent={bulkBreached > 0 ? "neon-r" : "plasma"}
								/>
								<StatCard
									label="Clean"
									value={bulkTotal - bulkBreached}
									icon={<CheckCircle className="w-4 h-4" />}
									accent="plasma"
								/>
							</motion.div>
						)}
					</AnimatePresence>

					{/* Error */}
					<AnimatePresence>
						{error && (
							<motion.div
								initial={{ opacity: 0, height: 0 }}
								animate={{ opacity: 1, height: "auto" }}
								exit={{ opacity: 0, height: 0 }}
								className="mb-4 p-3 bg-neon-r/10 border border-neon-r/30 rounded"
							>
								<div className="flex flex-wrap items-center justify-between gap-3">
									<p className="text-sm text-neon-r">{error}</p>
									<Button
										variant="danger"
										size="sm"
										onClick={handleRetry}
										disabled={
											isLoading ||
											(mode === "single" ? !email.trim() : parseBulkEmails().length === 0)
										}
									>
										Retry
									</Button>
								</div>
							</motion.div>
						)}
					</AnimatePresence>

					{/* Loading */}
					<AnimatePresence>
						{isLoading && (
							<motion.div
								initial={{ opacity: 0 }}
								animate={{ opacity: 1 }}
								exit={{ opacity: 0 }}
								className="flex items-center justify-center py-8"
							>
								<div className="animate-spin w-6 h-6 border-2 border-fuchsia/30 border-t-fuchsia rounded-full" />
								<span className="ml-3 text-sm text-text-mute">Investigating…</span>
							</motion.div>
						)}
					</AnimatePresence>

					{/* Single results */}
					{mode === "single" && !isLoading && (
						<div className="space-y-3">
							{breachResult && (
								<CollapsibleSection
									id="breach"
									icon={<ShieldAlert className="w-4 h-4" />}
									iconColor="text-neon-r"
									title="Breach History"
									badge={
										<>
											{breachResult.breached ? (
												<span className="text-[10px] font-bold px-1.5 py-0.5 bg-neon-r/10 text-neon-r rounded ml-1">
													{breachResult.breach_count || 0} breach
													{(breachResult.breach_count || 0) !== 1 ? "es" : ""}
												</span>
											) : (
												<span className="text-[10px] font-bold px-1.5 py-0.5 bg-plasma/10 text-plasma rounded ml-1">
													Clean
												</span>
											)}
											{breachResult.fallback_used && <FallbackBadge />}
										</>
									}
									expanded={expandedSections.breach}
									onToggle={() => toggleSection("breach")}
									prefersReduced={prefersReduced}
								>
									{breachResult.breaches && breachResult.breaches.length > 0 ? (
										<div className="p-3 space-y-2">
											{breachResult.breaches.map((b, i) => (
												<BreachCard
													key={b.name}
													breach={b}
													delay={prefersReduced ? 0 : i * 0.06}
												/>
											))}
										</div>
									) : (
										<div className="px-4 py-3 text-xs text-text-mute">
											No breach records found for this address.
										</div>
									)}
								</CollapsibleSection>
							)}

							{emailVerifyResult && (
								<CollapsibleSection
									id="verify"
									icon={<UserCheck className="w-4 h-4" />}
									iconColor="text-acid"
									title="Email Verification"
									badge={
										<>
											<span
												className={`text-[10px] font-bold px-1.5 py-0.5 rounded ml-1 ${
													emailVerifyResult.status === "valid"
														? "bg-plasma/10 text-plasma"
														: emailVerifyResult.status === "invalid"
															? "bg-neon-r/10 text-neon-r"
															: "bg-volt/10 text-volt"
												}`}
											>
												{emailVerifyResult.status}
											</span>
											{emailVerifyResult.fallback_used && <FallbackBadge />}
										</>
									}
									expanded={expandedSections.verify}
									onToggle={() => toggleSection("verify")}
									prefersReduced={prefersReduced}
								>
									<div className="px-4 py-3">
										<div className="flex flex-wrap gap-2 mb-3">
											<BooleanIndicator
												value={emailVerifyResult.disposable}
												trueLabel="Disposable"
												falseLabel="Not Disposable"
											/>
											<BooleanIndicator
												value={emailVerifyResult.role_based}
												trueLabel="Role-based"
												falseLabel="Personal"
											/>
											<BooleanIndicator
												value={emailVerifyResult.free_provider}
												trueLabel="Free Provider"
												falseLabel="Business"
											/>
								{emailVerifyResult.mx_found !== undefined &&
									(emailVerifyResult.mx_found ? (
										<Badge variant="success" dot>MX Found</Badge>
									) : (
										<Badge variant="danger" dot>No MX</Badge>
									))}
										</div>
										{emailVerifyResult.score != null && (
											<div>
												<div className="flex items-center justify-between mb-1">
													<span className="text-[10px] text-text-mute">
														Confidence Score
													</span>
													<span className="text-xs font-mono text-text-dim">
														{emailVerifyResult.score}%
													</span>
												</div>
												<div className="h-1.5 bg-abyss rounded-full overflow-hidden">
													<motion.div
														className={`h-full rounded-full ${
															emailVerifyResult.score >= 70
																? "bg-plasma"
																: emailVerifyResult.score >= 40
																	? "bg-volt"
																	: "bg-neon-r"
														}`}
														initial={{ width: 0 }}
														animate={{ width: `${emailVerifyResult.score}%` }}
														transition={{ duration: 0.6, ease: "easeOut" }}
													/>
												</div>
											</div>
										)}
									</div>
								</CollapsibleSection>
							)}

							{emailReverseResult && (
								<CollapsibleSection
									id="reverse"
									icon={<AtSign className="w-4 h-4" />}
									iconColor="text-cyan"
									title="Identity Lookup"
									badge={
										emailReverseResult.fallback_used ? <FallbackBadge /> : undefined
									}
									expanded={expandedSections.reverse}
									onToggle={() => toggleSection("reverse")}
									prefersReduced={prefersReduced}
								>
									<div className="px-4 py-3 space-y-1.5">
										{emailReverseResult.first_name && (
											<div className="flex items-start justify-between py-1.5 border-b border-border/30">
												<span className="text-xs text-text-mute w-28">Name</span>
												<span className="text-xs text-text">
													{emailReverseResult.first_name}{" "}
													{emailReverseResult.last_name || ""}
												</span>
											</div>
										)}
										{emailReverseResult.company && (
											<div className="flex items-start justify-between py-1.5 border-b border-border/30">
												<span className="text-xs text-text-mute w-28">Company</span>
												<span className="text-xs text-text">{emailReverseResult.company}</span>
											</div>
										)}
										{emailReverseResult.position && (
											<div className="flex items-start justify-between py-1.5 border-b border-border/30">
												<span className="text-xs text-text-mute w-28">Position</span>
												<span className="text-xs text-text">{emailReverseResult.position}</span>
											</div>
										)}
										{emailReverseResult.confidence != null && (
											<div className="flex items-start justify-between py-1.5">
												<span className="text-xs text-text-mute w-28">Confidence</span>
												<span className="text-xs font-mono text-text">
													{Math.round(emailReverseResult.confidence * 100)}%
												</span>
											</div>
										)}
									</div>
								</CollapsibleSection>
							)}
						</div>
					)}

					{/* Bulk results list */}
					{mode === "bulk" && bulkEmailResult && !isLoading && (
						<div className="space-y-1 mt-1">
							{bulkEmailResult.results.map((item, i) => (
								<motion.div
									key={item.email}
									initial={prefersReduced ? undefined : { opacity: 0, x: -6 }}
									animate={prefersReduced ? undefined : { opacity: 1, x: 0 }}
									transition={{ delay: prefersReduced ? 0 : i * 0.025 }}
									className="flex items-center justify-between p-2 bg-surface border border-border/30 rounded text-sm"
								>
									<span className="font-mono text-xs text-text truncate">{item.email}</span>
									{item.error ? (
										<span className="text-[10px] text-volt px-1.5 py-0.5 bg-volt/10 rounded flex-shrink-0">
											Error
										</span>
									) : item.breached ? (
										<span className="text-[10px] text-neon-r px-1.5 py-0.5 bg-neon-r/10 rounded font-bold flex-shrink-0">
											{item.breach_count} breach{(item.breach_count || 0) !== 1 ? "es" : ""}
										</span>
									) : (
										<span className="text-[10px] text-plasma px-1.5 py-0.5 bg-plasma/10 rounded flex-shrink-0">
											Clean
										</span>
									)}
								</motion.div>
							))}
						</div>
					)}

					{/* Empty state */}
					{!isLoading &&
						!breachResult &&
						!emailVerifyResult &&
						!emailReverseResult &&
						!bulkEmailResult &&
						!error && (
							<motion.div
								initial={prefersReduced ? undefined : { opacity: 0 }}
								animate={prefersReduced ? undefined : { opacity: 1 }}
								transition={{ delay: 0.1 }}
								className="py-12 text-center"
							>
								<Mail className="w-10 h-10 text-text-mute/30 mx-auto mb-3" />
								<p className="text-sm text-text-mute mb-1">
									Enter an email address to check breaches, verify, and identify
								</p>
								<p className="text-xs text-text-dim">
									Try{" "}
									<button
										type="button"
										className="text-fuchsia hover:underline font-mono"
										onClick={() => { setEmail("user@gmail.com"); setMode("single"); }}
									>
										user@gmail.com
									</button>{" "}
									or switch to{" "}
									<button
										type="button"
										className="text-fuchsia hover:underline"
										onClick={() => setMode("bulk")}
									>
										Bulk Check
									</button>{" "}
									for multiple addresses
								</p>
							</motion.div>
						)}
				</CardBody>
			</Card>
		</motion.div>
	);
}
