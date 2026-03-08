import { AnimatePresence, motion } from "framer-motion";
import {
	Bug,
	ChevronDown,
	ChevronRight,
	Eye,
	Search,
	Server,
	Shield,
	ShieldAlert,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useThreatIntel } from "../../hooks/useOsintServices";
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
	Badge,
} from '../ui';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function FallbackBadge() {
	return <Badge variant="warning" dot>Fallback</Badge>;
}

function RiskBadge({ level }: { level: string }) {
	const variant =
		level === 'clean' || level === 'low' ? 'success' :
		level === 'medium' ? 'warning' :
		level === 'high' || level === 'critical' ? 'danger' :
		'default';
	return (
		<Badge variant={variant as 'success' | 'warning' | 'danger' | 'default'}>
			{level.charAt(0).toUpperCase() + level.slice(1)}
		</Badge>
	);
}

function ThreatScoreRing({ score, size = 80 }: { score: number; size?: number }) {
	const r = (size - 8) / 2;
	const c = 2 * Math.PI * r;
	const pct = Math.min(Math.max(score, 0), 100);
	const offset = c * (1 - pct / 100);
	const color =
		pct >= 75 ? "#ff2d6b" : pct >= 50 ? "#ffc107" : pct >= 25 ? "#d4ff00" : "#0fbbaa";

	return (
		<div
			className="relative inline-flex items-center justify-center"
			style={{ width: size, height: size }}
		>
			<svg width={size} height={size} className="-rotate-90" aria-hidden="true">
				<circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1e1e3a" strokeWidth={6} />
				<circle
					cx={size / 2}
					cy={size / 2}
					r={r}
					fill="none"
					stroke={color}
					strokeWidth={6}
					strokeDasharray={c}
					strokeDashoffset={offset}
					strokeLinecap="round"
					className="transition-all duration-700"
				/>
			</svg>
			<span className="absolute text-lg font-bold font-mono" style={{ color }}>
				{pct}
			</span>
		</div>
	);
}

function PortBadge({ port }: { port: number }) {
	const wellKnown: Record<number, { label: string; variant: 'volt' | 'cyan' | 'ghost' | 'fuchsia' | 'acid' | 'danger' }> = {
		22:   { label: 'SSH',   variant: 'volt' },
		80:   { label: 'HTTP',  variant: 'cyan' },
		443:  { label: 'HTTPS', variant: 'ghost' },
		3306: { label: 'MySQL', variant: 'fuchsia' },
		5432: { label: 'PG',    variant: 'acid' },
		8080: { label: 'Proxy', variant: 'volt' },
		3389: { label: 'RDP',   variant: 'danger' },
	};
	const known = wellKnown[port];
	return (
		<Badge variant={known?.variant ?? 'default'} size="sm">
			{port}{known ? ` ${known.label}` : ''}
		</Badge>
	);
}

// Animated detection ratio bar
function DetectionBar({
	malicious,
	total,
	ratio,
}: {
	malicious: number;
	total: number;
	ratio: string;
}) {
	const pct = total > 0 ? (malicious / total) * 100 : 0;
	return (
		<div className="mb-3">
			<div className="flex items-center justify-between mb-1">
				<span className="text-xs text-text-mute">Detection Ratio</span>
				<span className="text-sm font-mono text-neon-r font-bold">{ratio}</span>
			</div>
			<div className="h-2 bg-abyss rounded-full overflow-hidden">
				<motion.div
					className="h-full bg-neon-r rounded-full"
					initial={{ width: 0 }}
					animate={{ width: `${pct}%` }}
					transition={{ duration: 0.7, ease: "easeOut" }}
				/>
			</div>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Tab hints
// ---------------------------------------------------------------------------

const TAB_HINTS: Record<
	"shodan" | "vt" | "reputation",
	{ placeholder: string; hint: string; examples: string[] }
> = {
	reputation: {
		placeholder: "Enter IP address…",
		hint: "IPv4 address to check:",
		examples: ["8.8.8.8", "1.1.1.1", "192.168.1.1"],
	},
	shodan: {
		placeholder: "IP or Shodan query…",
		hint: "IP or query:",
		examples: ["192.168.1.1", "apache port:80", "nginx country:US"],
	},
	vt: {
		placeholder: "IP, domain, or file hash…",
		hint: "Indicator type:",
		examples: ["8.8.8.8", "malware.com", "d41d8cd98f00b204e9800998ecf8427e"],
	},
};

// ---------------------------------------------------------------------------
// Main Panel
// ---------------------------------------------------------------------------

interface ThreatIntelPanelProps {
	className?: string;
}

export function ThreatIntelPanel({ className = "" }: ThreatIntelPanelProps) {
	const {
		shodanResult,
		vtResult,
		ipRepResult,
		isLoading,
		error,
		searchShodan,
		checkVirusTotal,
		checkIpReputation,
		clearError,
	} = useThreatIntel();

	const prefersReduced = useReducedMotion();
	const [query, setQuery] = useState("");
	const [activeTab, setActiveTab] = useState<"shodan" | "vt" | "reputation">("reputation");
	const [expandedHost, setExpandedHost] = useState<string | null>(null);
	const [persistentError, setPersistentError] = useState<string | null>(null);

	useEffect(() => {
		if (error) setPersistentError(error);
	}, [error]);

	const handleSearch = useCallback(() => {
		if (!query.trim()) return;
		clearError();
		const q = query.trim();
		if (activeTab === "shodan") searchShodan(q);
		else if (activeTab === "vt") checkVirusTotal(q);
		else checkIpReputation(q);
	}, [query, activeTab, searchShodan, checkVirusTotal, checkIpReputation, clearError]);

	const tabs = [
		{
			key: "reputation" as const,
			label: "IP Reputation",
			icon: Shield,
			tooltip: "Check an IP's aggregate threat reputation across multiple intelligence sources.",
		},
		{
			key: "shodan" as const,
			label: "Shodan",
			icon: Eye,
			tooltip: "Search Shodan for exposed services, open ports, and vulnerabilities.",
		},
		{
			key: "vt" as const,
			label: "VirusTotal",
			icon: Bug,
			tooltip: "Check an IP, domain, or file hash against 70+ antivirus engines.",
		},
	];

	const tabHint = TAB_HINTS[activeTab];

	// Derived stats
	const vtMalicious = vtResult?.malicious ?? 0;
	const vtTotal = vtResult?.total_vendors ?? 0;
	const shodanTotal = shodanResult?.total ?? 0;
	const threatScore = ipRepResult?.threat_score ?? 0;

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
						<ShieldAlert className="w-5 h-5 text-neon-r" />
						Threat Intelligence
					</h2>
				</CardHeader>
				<CardBody>
					{/* Tabs */}
					<div className="flex gap-1 mb-4 p-1 bg-abyss rounded">
						{tabs.map((tab) => {
							const Icon = tab.icon;
							const isActive = activeTab === tab.key;
							return (
								<button
									type="button"
									key={tab.key}
									onClick={() => setActiveTab(tab.key)}
									className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded transition-colors ${
										isActive
											? "bg-surface text-neon-r border border-neon-r/20"
											: "text-text-mute hover:text-text hover:bg-surface/50"
									}`}
								>
									<Icon size={14} />
									{tab.label}
									<HelpTooltip content={tab.tooltip} side="top" maxWidth={220} />
								</button>
							);
						})}
					</div>

					{/* Search */}
					<div className="mb-2">
						<div className="flex items-center gap-2 mb-1.5">
							<label className="text-xs font-semibold uppercase tracking-wider text-text-dim">
								{tabs.find((t) => t.key === activeTab)?.label} Query
							</label>
							<HelpTooltip
								content={tabs.find((t) => t.key === activeTab)?.tooltip ?? ""}
								side="right"
							/>
						</div>
						<div className="flex gap-2">
							<Input
								type="text"
								value={query}
								onChange={(e) => setQuery(e.target.value)}
								onKeyDown={(e) => e.key === "Enter" && handleSearch()}
								placeholder={tabHint.placeholder}
								leftIcon={<Search className="w-3.5 h-3.5" />}
							/>
							<Button
								variant="danger"
								size="sm"
								onClick={handleSearch}
								disabled={isLoading || !query.trim()}
								loading={isLoading}
								leftIcon={<Search className="w-3.5 h-3.5" />}
								className="shrink-0"
							>
								Scan
							</Button>
						</div>
						<FieldHint
							hint={tabHint.hint}
							examples={tabHint.examples}
							onExampleClick={(ex) => setQuery(ex)}
						/>
					</div>

					{/* Stat bar — shown when results exist */}
					<AnimatePresence>
						{(ipRepResult || shodanResult || vtResult) && !isLoading && (
							<motion.div
								initial={prefersReduced ? undefined : { opacity: 0, y: -6 }}
								animate={prefersReduced ? undefined : { opacity: 1, y: 0 }}
								exit={prefersReduced ? undefined : { opacity: 0 }}
								transition={{ duration: 0.25 }}
								className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-4"
							>
								<StatCard
									label="Threat Score"
									value={threatScore}
									icon={<ShieldAlert className="w-4 h-4" />}
									accent="neon-r"
									suffix="%"
								/>
								<StatCard
									label="Shodan Hosts"
									value={shodanTotal}
									icon={<Eye className="w-4 h-4" />}
									accent="cyan"
								/>
								<StatCard
									label="VT Malicious"
									value={vtMalicious}
									icon={<Bug className="w-4 h-4" />}
									accent="fuchsia"
								/>
								<StatCard
									label="VT Total"
									value={vtTotal}
									icon={<Shield className="w-4 h-4" />}
									accent="ghost"
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
								<div className="flex items-center justify-between gap-3">
									<p className="text-sm text-neon-r">{error}</p>
									<Button
										variant="danger"
										size="sm"
										onClick={handleSearch}
										disabled={isLoading || !query.trim()}
									>
										Retry
									</Button>
								</div>
							</motion.div>
						)}
					</AnimatePresence>

					{persistentError && (
						<div className="mb-4 px-3 py-2 border border-neon-r/20 bg-neon-r/5 text-xs text-text-dim flex items-center justify-between gap-3">
							<span>Previous error: {persistentError}</span>
							<button
								type="button"
								onClick={() => setPersistentError(null)}
								className="px-2 py-1 text-[11px] border border-border text-text-mute hover:text-text hover:border-neon-r/30 transition-colors"
							>
								Dismiss
							</button>
						</div>
					)}

					{/* Loading */}
					<AnimatePresence>
						{isLoading && (
							<motion.div
								initial={{ opacity: 0 }}
								animate={{ opacity: 1 }}
								exit={{ opacity: 0 }}
								className="flex items-center justify-center py-8"
							>
								<div className="animate-spin w-6 h-6 border-2 border-neon-r/30 border-t-neon-r rounded-full" />
								<span className="ml-3 text-sm text-text-mute">Scanning…</span>
							</motion.div>
						)}
					</AnimatePresence>

					{/* IP Reputation Result */}
					{activeTab === "reputation" && ipRepResult && !isLoading && (
						<motion.div
							initial={prefersReduced ? undefined : { opacity: 0 }}
							animate={prefersReduced ? undefined : { opacity: 1 }}
							className="space-y-4"
						>
							<div className="flex items-center gap-6 p-4 bg-surface border border-border rounded">
								<ThreatScoreRing score={ipRepResult.threat_score} size={90} />
								<div className="flex-1">
									<div className="flex items-center gap-3 mb-2">
										<span className="text-sm font-mono text-text">{ipRepResult.ip}</span>
										<RiskBadge level={ipRepResult.risk_level} />
										{ipRepResult.fallback_used && <FallbackBadge />}
									</div>
									<p className="text-xs text-text-mute">
										Composite threat score based on aggregated intelligence sources.
									</p>
								</div>
							</div>

							{ipRepResult.shodan_data && (
								<div className="p-3 border border-border rounded">
									<h4 className="text-xs font-semibold text-text-mute uppercase tracking-wider mb-2">
										Shodan Intelligence
									</h4>
									{ipRepResult.shodan_data.ports && ipRepResult.shodan_data.ports.length > 0 && (
										<div className="mb-2">
											<span className="text-[10px] text-text-mute block mb-1">
												Open Ports
											</span>
											<div className="flex flex-wrap gap-1">
												{ipRepResult.shodan_data.ports.map((p) => (
													<PortBadge key={p} port={p} />
												))}
											</div>
										</div>
									)}
									{ipRepResult.shodan_data.vulns && ipRepResult.shodan_data.vulns.length > 0 && (
										<div>
											<span className="text-[10px] text-text-mute block mb-1">
												Vulnerabilities
											</span>
											<div className="flex flex-wrap gap-1">
												{ipRepResult.shodan_data.vulns.map((v) => (
													<span
														key={v}
														className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-neon-r/10 text-neon-r"
													>
														{v}
													</span>
												))}
											</div>
										</div>
									)}
								</div>
							)}
						</motion.div>
					)}

					{/* Shodan Results */}
					{activeTab === "shodan" && shodanResult && !isLoading && (
						<motion.div
							initial={prefersReduced ? undefined : { opacity: 0 }}
							animate={prefersReduced ? undefined : { opacity: 1 }}
							className="space-y-2"
						>
							<div className="flex items-center justify-between mb-2">
								<span className="text-xs text-text-mute">
									{shodanResult.total} result{shodanResult.total !== 1 ? "s" : ""}
									{shodanResult.fallback_used && " (limited — no API key)"}
								</span>
							</div>
							{shodanResult.results.map((host, i) => (
								<motion.div
									key={host.ip}
									initial={prefersReduced ? undefined : { opacity: 0, y: 4 }}
									animate={prefersReduced ? undefined : { opacity: 1, y: 0 }}
									transition={{ delay: prefersReduced ? 0 : i * 0.05 }}
									className="border border-border rounded overflow-hidden"
								>
									<button
										type="button"
										onClick={() =>
											setExpandedHost(expandedHost === host.ip ? null : host.ip)
										}
										className="w-full flex items-center justify-between p-3 bg-surface hover:bg-raised transition-colors"
									>
										<div className="flex items-center gap-3">
											<Server size={14} className="text-cyan" />
											<span className="text-sm font-mono text-text">{host.ip}</span>
											{host.org && (
												<span className="text-xs text-text-mute">{host.org}</span>
											)}
											{host.vulns && host.vulns.length > 0 && (
												<span className="text-[10px] font-bold px-1.5 py-0.5 bg-neon-r/10 text-neon-r rounded">
													{host.vulns.length} CVE{host.vulns.length !== 1 ? "s" : ""}
												</span>
											)}
										</div>
										{expandedHost === host.ip ? (
											<ChevronDown size={14} className="text-text-mute" />
										) : (
											<ChevronRight size={14} className="text-text-mute" />
										)}
									</button>
									<AnimatePresence>
										{expandedHost === host.ip && (
											<motion.div
												initial={{ height: 0, opacity: 0 }}
												animate={{ height: "auto", opacity: 1 }}
												exit={{ height: 0, opacity: 0 }}
												className="px-4 py-3 border-t border-border/30 space-y-3"
											>
												{host.ports && host.ports.length > 0 && (
													<div>
														<span className="text-[10px] text-text-mute block mb-1">
															Open Ports
														</span>
														<div className="flex flex-wrap gap-1">
															{host.ports.map((p) => (
																<PortBadge key={p} port={p} />
															))}
														</div>
													</div>
												)}
												{host.hostnames && host.hostnames.length > 0 && (
													<div>
														<span className="text-[10px] text-text-mute block mb-1">
															Hostnames
														</span>
														<div className="flex flex-wrap gap-1">
															{host.hostnames.map((h) => (
																<span
																	key={h}
																	className="text-[11px] font-mono px-2 py-0.5 bg-abyss rounded text-text-dim"
																>
																	{h}
																</span>
															))}
														</div>
													</div>
												)}
												{host.os && (
													<div className="text-xs text-text-dim">
														<span className="text-text-mute">OS: </span>
														{host.os}
													</div>
												)}
											</motion.div>
										)}
									</AnimatePresence>
								</motion.div>
							))}
						</motion.div>
					)}

					{/* VirusTotal Results */}
					{activeTab === "vt" && vtResult && !isLoading && (
						<motion.div
							initial={prefersReduced ? undefined : { opacity: 0 }}
							animate={prefersReduced ? undefined : { opacity: 1 }}
							className="space-y-4"
						>
							<div className="p-4 bg-surface border border-border rounded">
								<div className="flex items-center gap-3 mb-3">
									<Bug className="w-5 h-5 text-fuchsia" />
									<span className="text-sm font-mono text-text">{vtResult.indicator}</span>
									<span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-fuchsia/10 text-fuchsia">
										{vtResult.indicator_type}
									</span>
									{vtResult.fallback_used && <FallbackBadge />}
								</div>

								{vtResult.detection_ratio && (
									<DetectionBar
										malicious={vtResult.malicious ?? 0}
										total={vtResult.total_vendors ?? 0}
										ratio={vtResult.detection_ratio}
									/>
								)}

								<div className="grid grid-cols-4 gap-3">
									{[
										{ label: "Malicious", value: vtResult.malicious, color: "text-neon-r" },
										{ label: "Suspicious", value: vtResult.suspicious, color: "text-volt" },
										{ label: "Harmless", value: vtResult.harmless, color: "text-plasma" },
										{ label: "Undetected", value: vtResult.undetected, color: "text-text-mute" },
									].map((stat) => (
										<div key={stat.label} className="text-center p-2 bg-abyss/50 rounded">
											<span className={`text-lg font-bold font-mono ${stat.color}`}>
												{stat.value ?? 0}
											</span>
											<span className="text-[10px] text-text-mute block mt-0.5">
												{stat.label}
											</span>
										</div>
									))}
								</div>

								{vtResult.threat_names && vtResult.threat_names.length > 0 && (
									<div className="mt-3">
										<span className="text-[10px] text-text-mute block mb-1">
											Threat Names
										</span>
										<div className="flex flex-wrap gap-1">
											{vtResult.threat_names.slice(0, 10).map((name) => (
												<span
													key={name}
													className="text-[10px] font-mono px-1.5 py-0.5 bg-neon-r/10 text-neon-r rounded"
												>
													{name}
												</span>
											))}
										</div>
									</div>
								)}
							</div>
						</motion.div>
					)}

					{/* Empty state */}
					{!isLoading && !ipRepResult && !shodanResult && !vtResult && !error && (
						<motion.div
							initial={prefersReduced ? undefined : { opacity: 0 }}
							animate={prefersReduced ? undefined : { opacity: 1 }}
							transition={{ delay: 0.1 }}
							className="py-12 text-center"
						>
							<ShieldAlert className="w-10 h-10 text-text-mute/30 mx-auto mb-3" />
							<p className="text-sm text-text-mute mb-1">
								Enter an IP, domain, or hash to check threat intelligence
							</p>
							<p className="text-xs text-text-dim">
								Try{" "}
								<button
									type="button"
									className="text-neon-r hover:underline font-mono"
									onClick={() => setQuery("8.8.8.8")}
								>
									8.8.8.8
								</button>{" "}
								for a quick reputation check
							</p>
						</motion.div>
					)}
				</CardBody>
			</Card>
		</motion.div>
	);
}
