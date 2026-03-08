import { AnimatePresence, motion } from "framer-motion";
import {
	ChevronDown,
	ChevronRight,
	Clock,
	Copy,
	Globe,
	MapPin,
	Search,
	Server,
	Shield,
} from "lucide-react";
import { useCallback, useState } from "react";
import { useWhoisLookup } from "../../hooks/useOsintServices";
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
} from "../ui";
import { Badge } from '../ui';

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function CopyButton({ text }: { text: string }) {
	const [copied, setCopied] = useState(false);
	const handleCopy = useCallback(() => {
		navigator.clipboard.writeText(text);
		setCopied(true);
		setTimeout(() => setCopied(false), 1500);
	}, [text]);

	return (
		<button
			type="button"
			onClick={handleCopy}
			className="relative p-1 text-text-mute hover:text-cyan transition-colors"
			aria-label="Copy to clipboard"
		>
			<Copy size={12} />
			{copied && (
				<span className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] bg-raised px-1.5 py-0.5 rounded text-plasma whitespace-nowrap z-10">
					Copied
				</span>
			)}
		</button>
	);
}

function FallbackBadge() {
	return <Badge variant="warning" dot>Fallback</Badge>;
}

function DataRow({
	label,
	value,
	copyable = false,
}: {
	label: string;
	value: string | null | undefined;
	copyable?: boolean;
}) {
	if (!value) return null;
	return (
		<div className="flex items-start justify-between py-1.5 border-b border-border/30 last:border-0">
			<span className="text-xs text-text-mute flex-shrink-0 w-28">{label}</span>
			<div className="flex items-center gap-1.5 min-w-0">
				<span className="text-xs text-text font-mono truncate">{value}</span>
				{copyable && <CopyButton text={value} />}
			</div>
		</div>
	);
}

// ---------------------------------------------------------------------------
// DNS Records Table
// ---------------------------------------------------------------------------

interface DnsRecord {
	type: string;
	name: string;
	value: string;
	ttl?: number | null;
	priority?: number | null;
}

function DnsRecordRow({ record, delay }: { record: DnsRecord; delay: number }) {
	const typeVariant: Record<string, 'cyan' | 'fuchsia' | 'volt' | 'acid' | 'ghost' | 'danger'> = {
		A: 'cyan', AAAA: 'cyan',
		MX: 'fuchsia',
		NS: 'volt',
		TXT: 'acid',
		CNAME: 'ghost',
		SOA: 'danger',
	};
	const variant = typeVariant[record.type] ?? 'ghost';


	return (
		<motion.tr
			initial={{ opacity: 0, x: -8 }}
			animate={{ opacity: 1, x: 0 }}
			transition={{ delay, duration: 0.2 }}
			className="border-b border-border/20 hover:bg-raised/50 transition-colors"
		>
		<td className="py-1.5 px-2">
			<Badge variant={variant} size="sm">{record.type}</Badge>
		</td>
			<td className="py-1.5 px-2 text-xs text-text font-mono truncate max-w-[200px]">
				{record.name}
			</td>
			<td className="py-1.5 px-2 text-xs text-text-dim font-mono truncate max-w-[300px]">
				{record.value}
			</td>
			<td className="py-1.5 px-2 text-[11px] text-text-mute font-mono text-right">
				{record.ttl ?? "—"}
			</td>
		</motion.tr>
	);
}

// ---------------------------------------------------------------------------
// IP Geolocation Card
// ---------------------------------------------------------------------------

function IpGeoCard({ data }: { data: Record<string, unknown> }) {
	const ip = data as {
		ip?: string;
		country?: string;
		city?: string;
		region?: string;
		isp?: string;
		org?: string;
		asn?: string;
		latitude?: number;
		longitude?: number;
	};

	return (
		<div className="space-y-2">
			<div className="flex items-center gap-2 mb-3">
				<MapPin className="w-4 h-4 text-plasma" />
				<h4 className="text-sm font-display font-medium text-text">Geolocation</h4>
				{(data as { fallback_used?: boolean }).fallback_used && <FallbackBadge />}
			</div>
			<DataRow label="IP Address" value={ip.ip} copyable />
			<DataRow label="Country" value={ip.country} />
			<DataRow label="Region" value={ip.region} />
			<DataRow label="City" value={ip.city} />
			<DataRow label="ISP" value={ip.isp} />
			<DataRow label="Organization" value={ip.org} />
			<DataRow label="ASN" value={ip.asn} copyable />
			{ip.latitude && ip.longitude && (
				<DataRow
					label="Coordinates"
					value={`${ip.latitude}, ${ip.longitude}`}
					copyable
				/>
			)}
		</div>
	);
}

// ---------------------------------------------------------------------------
// Collapsible Section
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
				<span className={`flex items-center gap-2 text-sm font-medium text-text`}>
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

interface WhoisDnsPanelProps {
	className?: string;
}

export function WhoisDnsPanel({ className = "" }: WhoisDnsPanelProps) {
	const {
		whoisResult,
		dnsResult,
		ipResult,
		isLoading,
		error,
		lookupDomain,
		lookupIp,
		clearError,
	} = useWhoisLookup();

	const prefersReduced = useReducedMotion();
	const [domain, setDomain] = useState("");
	const [ip, setIp] = useState("");
	const [lastLookup, setLastLookup] = useState<"domain" | "ip" | null>(null);
	const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
		whois: true,
		dns: true,
		ip: true,
	});

	const toggleSection = (key: string) => {
		setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
	};

	const handleDomainLookup = useCallback(() => {
		if (domain.trim()) {
			setLastLookup("domain");
			clearError();
			lookupDomain(domain.trim());
		}
	}, [domain, lookupDomain, clearError]);

	const handleIpLookup = useCallback(() => {
		if (ip.trim()) {
			setLastLookup("ip");
			clearError();
			lookupIp(ip.trim());
		}
	}, [ip, lookupIp, clearError]);

	const handleRetry = useCallback(() => {
		if (lastLookup === "domain" && domain.trim()) { handleDomainLookup(); return; }
		if (lastLookup === "ip" && ip.trim()) { handleIpLookup(); return; }
		if (domain.trim()) { handleDomainLookup(); return; }
		if (ip.trim()) { handleIpLookup(); }
	}, [lastLookup, domain, ip, handleDomainLookup, handleIpLookup]);

	// Derived stat values
	const dnsCount = dnsResult?.records?.length ?? 0;
	const nsCount = dnsResult?.records?.filter((r) => r.type === "NS").length ?? 0;

	return (
		<motion.div
			initial={prefersReduced ? undefined : { opacity: 0, y: 8 }}
			animate={prefersReduced ? undefined : { opacity: 1, y: 0 }}
			transition={{ duration: 0.3 }}
			className={className}
		>
			<Card>
				<CardHeader>
					<div className="flex items-center justify-between">
						<h2 className="text-lg font-display font-semibold flex items-center gap-2">
							<Globe className="w-5 h-5 text-cyan" />
							WHOIS &amp; DNS Intelligence
						</h2>
					</div>
				</CardHeader>
				<CardBody>
					{/* Search inputs */}
					<div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
						{/* Domain lookup */}
						<div>
							<div className="flex items-center gap-2 mb-1.5">
								<label className="text-xs font-semibold uppercase tracking-wider text-text-dim">
									Domain Lookup
								</label>
								<HelpTooltip
									content="Enter a domain name to retrieve WHOIS registration data and DNS records."
									side="right"
								/>
							</div>
							<div className="flex gap-2">
								<Input
									type="text"
									value={domain}
									onChange={(e) => setDomain(e.target.value)}
									onKeyDown={(e) => e.key === "Enter" && handleDomainLookup()}
									placeholder="e.g. example.com"
									leftIcon={<Globe className="w-3.5 h-3.5" />}
								/>
								<Button
									variant="ghost"
									size="sm"
									onClick={handleDomainLookup}
									disabled={isLoading || !domain.trim()}
									loading={isLoading && lastLookup === "domain"}
									leftIcon={<Search className="w-3.5 h-3.5" />}
									className="border-cyan/30 text-cyan hover:bg-cyan/10 shrink-0"
								>
									WHOIS
								</Button>
							</div>
							<FieldHint
								hint="Examples:"
								examples={["example.com", "google.com", "github.com"]}
								onExampleClick={(ex) => setDomain(ex)}
							/>
						</div>

						{/* IP lookup */}
						<div>
							<div className="flex items-center gap-2 mb-1.5">
								<label className="text-xs font-semibold uppercase tracking-wider text-text-dim">
									IP Geolocation
								</label>
								<HelpTooltip
									content="Enter an IPv4 or IPv6 address to retrieve geolocation, ISP, and ASN information."
									side="right"
								/>
							</div>
							<div className="flex gap-2">
								<Input
									type="text"
									value={ip}
									onChange={(e) => setIp(e.target.value)}
									onKeyDown={(e) => e.key === "Enter" && handleIpLookup()}
									placeholder="e.g. 8.8.8.8"
									leftIcon={<MapPin className="w-3.5 h-3.5" />}
								/>
								<Button
									variant="ghost"
									size="sm"
									onClick={handleIpLookup}
									disabled={isLoading || !ip.trim()}
									loading={isLoading && lastLookup === "ip"}
									leftIcon={<MapPin className="w-3.5 h-3.5" />}
									className="border-plasma/30 text-plasma hover:bg-plasma/10 shrink-0"
								>
									Lookup
								</Button>
							</div>
							<FieldHint
								hint="Examples:"
								examples={["8.8.8.8", "1.1.1.1", "93.184.216.34"]}
								onExampleClick={(ex) => setIp(ex)}
							/>
						</div>
					</div>

					{/* Stat cards — shown when we have results */}
					<AnimatePresence>
						{(whoisResult || dnsResult || ipResult) && !isLoading && (
							<motion.div
								initial={prefersReduced ? undefined : { opacity: 0, y: -6 }}
								animate={prefersReduced ? undefined : { opacity: 1, y: 0 }}
								exit={prefersReduced ? undefined : { opacity: 0, y: -6 }}
								transition={{ duration: 0.25 }}
								className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5"
							>
								<StatCard
									label="DNS Records"
									value={dnsCount}
									icon={<Server className="w-4 h-4" />}
									accent="cyan"
								/>
								<StatCard
									label="Name Servers"
									value={nsCount}
									icon={<Globe className="w-4 h-4" />}
									accent="volt"
								/>
								<StatCard
									label="Registrar"
									value={whoisResult?.registrar ? 1 : 0}
									icon={<Shield className="w-4 h-4" />}
									accent="plasma"
									sub={whoisResult?.registrar ?? undefined}
								/>
								<StatCard
									label="Created"
									value={whoisResult?.creation_date ? 1 : 0}
									icon={<Clock className="w-4 h-4" />}
									accent="ghost"
									sub={whoisResult?.creation_date ?? undefined}
								/>
							</motion.div>
						)}
					</AnimatePresence>

					{/* Error display */}
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
										disabled={isLoading || (!domain.trim() && !ip.trim())}
									>
										Retry
									</Button>
								</div>
							</motion.div>
						)}
					</AnimatePresence>

					{/* Loading state */}
					<AnimatePresence>
						{isLoading && (
							<motion.div
								initial={{ opacity: 0 }}
								animate={{ opacity: 1 }}
								exit={{ opacity: 0 }}
								className="flex items-center justify-center py-8"
							>
								<div className="animate-spin w-6 h-6 border-2 border-cyan/30 border-t-cyan rounded-full" />
								<span className="ml-3 text-sm text-text-mute">Querying…</span>
							</motion.div>
						)}
					</AnimatePresence>

					{/* Results */}
					{!isLoading && (
						<div className="space-y-3">
							{/* WHOIS Section */}
							{whoisResult && (
								<CollapsibleSection
									id="whois"
									icon={<Shield className="w-4 h-4" />}
									iconColor="text-cyan"
									title="WHOIS Registration"
									badge={whoisResult.fallback_used ? <FallbackBadge /> : undefined}
									expanded={expandedSections.whois}
									onToggle={() => toggleSection("whois")}
									prefersReduced={prefersReduced}
								>
									<div className="px-4 py-3">
										<DataRow label="Domain" value={whoisResult.domain} copyable />
										<DataRow label="Registrar" value={whoisResult.registrar} />
										<DataRow label="Created" value={whoisResult.creation_date} />
										<DataRow label="Expires" value={whoisResult.expiration_date} />
										<DataRow label="Updated" value={whoisResult.updated_date} />
										{whoisResult.name_servers && whoisResult.name_servers.length > 0 && (
											<div className="py-1.5">
												<span className="text-xs text-text-mute block mb-1.5">
													Name Servers
												</span>
												<div className="flex flex-wrap gap-1.5">
													{whoisResult.name_servers.map((ns) => (
														<span
															key={ns}
															className="text-[11px] font-mono px-2 py-0.5 bg-abyss rounded text-text-dim"
														>
															{ns}
														</span>
													))}
												</div>
											</div>
										)}
										{whoisResult.status && whoisResult.status.length > 0 && (
											<div className="py-1.5">
												<span className="text-xs text-text-mute block mb-1.5">
													Status
												</span>
												<div className="flex flex-wrap gap-1.5">
													{whoisResult.status.map((s) => (
														<span
															key={s}
															className="text-[10px] font-mono px-2 py-0.5 bg-cyan/5 border border-cyan/20 rounded text-cyan"
														>
															{s}
														</span>
													))}
												</div>
											</div>
										)}
									</div>
								</CollapsibleSection>
							)}

							{/* DNS Section */}
							{dnsResult && dnsResult.records.length > 0 && (
								<CollapsibleSection
									id="dns"
									icon={<Server className="w-4 h-4" />}
									iconColor="text-volt"
									title="DNS Records"
									badge={
										<>
											<span className="text-[10px] font-mono text-text-mute bg-abyss px-1.5 py-0.5 rounded ml-1">
												{dnsResult.records.length}
											</span>
											{dnsResult.fallback_used && <FallbackBadge />}
										</>
									}
									expanded={expandedSections.dns}
									onToggle={() => toggleSection("dns")}
									prefersReduced={prefersReduced}
								>
									<div className="overflow-x-auto">
										<table className="w-full text-left">
											<thead>
												<tr className="border-b border-border bg-abyss/50">
													<th className="py-2 px-2 text-[10px] font-semibold text-text-mute uppercase tracking-wider w-16">
														Type
													</th>
													<th className="py-2 px-2 text-[10px] font-semibold text-text-mute uppercase tracking-wider">
														Name
													</th>
													<th className="py-2 px-2 text-[10px] font-semibold text-text-mute uppercase tracking-wider">
														Value
													</th>
													<th className="py-2 px-2 text-[10px] font-semibold text-text-mute uppercase tracking-wider text-right w-16">
														TTL
													</th>
												</tr>
											</thead>
											<tbody>
												{dnsResult.records.map((record, i) => (
													<DnsRecordRow
														key={`${record.type}-${record.name}-${i}`}
														record={record}
														delay={prefersReduced ? 0 : i * 0.03}
													/>
												))}
											</tbody>
										</table>
									</div>
								</CollapsibleSection>
							)}

							{/* IP Geolocation Section */}
							{ipResult && (
								<CollapsibleSection
									id="ip"
									icon={<MapPin className="w-4 h-4" />}
									iconColor="text-plasma"
									title="IP Geolocation"
									badge={
										(ipResult as { fallback_used?: boolean }).fallback_used ? (
											<FallbackBadge />
										) : undefined
									}
									expanded={expandedSections.ip}
									onToggle={() => toggleSection("ip")}
									prefersReduced={prefersReduced}
								>
									<div className="px-4 py-3">
										<IpGeoCard data={ipResult as unknown as Record<string, unknown>} />
									</div>
								</CollapsibleSection>
							)}
						</div>
					)}

					{/* Empty state */}
					{!isLoading && !whoisResult && !dnsResult && !ipResult && !error && (
						<motion.div
							initial={prefersReduced ? undefined : { opacity: 0 }}
							animate={prefersReduced ? undefined : { opacity: 1 }}
							transition={{ delay: 0.1 }}
							className="py-12 text-center"
						>
							<Globe className="w-10 h-10 text-text-mute/30 mx-auto mb-3" />
							<p className="text-sm text-text-mute mb-1">
								Enter a domain or IP address to begin intelligence gathering
							</p>
							<p className="text-xs text-text-dim">
								Try{" "}
								<button
									type="button"
									className="text-cyan hover:underline font-mono"
									onClick={() => { setDomain("example.com"); }}
								>
									example.com
								</button>{" "}
								or{" "}
								<button
									type="button"
									className="text-plasma hover:underline font-mono"
									onClick={() => { setIp("8.8.8.8"); }}
								>
									8.8.8.8
								</button>
							</p>
						</motion.div>
					)}
				</CardBody>
			</Card>
		</motion.div>
	);
}
