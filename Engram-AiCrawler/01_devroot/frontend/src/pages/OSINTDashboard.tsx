import { AnimatePresence, motion } from "framer-motion";
import {
	AlertCircle,
	AtSign,
	CheckCircle,
	ChevronDown,
	ChevronUp,
	Clock,
	Download,
	ExternalLink,
	Filter,
	Globe,
	Image as ImageIcon,
	Link2,
	Scan,
	Search,
	Shield,
	Upload,
	Users,
	Zap,
} from "lucide-react";
import {
	lazy,
	Suspense,
	useCallback,
	useEffect,
	useMemo,
	useState,
} from "react";
import {
	Alert,
	Badge,
	Button,
	Card,
	CardBody,
	CardHeader,
	FieldHint,
	HelpTooltip,
	Input,
	Select,
	StatCard,
	Tooltip,
} from "@/components/ui";
import AliasCard from "../components/AliasCard";
import ImageMatchGrid from "../components/ImageMatchGrid";
import NetworkGraph from "../components/NetworkGraph";
import BatchAliasScan from "../components/osint/BatchAliasScan";
import {
	EntityList,
	type ExtractedEntity,
} from "../components/osint/EntityExtractionCard";
import { ExportDialog } from "../components/osint/ExportDialog";
import { OSINTStatusDonut } from "../components/osint/OSINTStatusDonut";
import { OsintErrorBoundary } from "../components/osint/OsintErrorBoundary";
import { ProviderStatusBar } from "../components/osint/ProviderStatusBar";
import { useToast } from "../components/Toast";
import { api } from "../lib/api";
import {
	AliasDiscoveryRequestSchema,
	type AliasResult,
	type ImageMatch,
	ReverseImageRequestSchema,
} from "../lib/schemas";

const WhoisDnsPanel = lazy(() =>
	import("../components/osint/WhoisDnsPanel").then((m) => ({
		default: m.WhoisDnsPanel,
	})),
);
const ThreatIntelPanel = lazy(() =>
	import("../components/osint/ThreatIntelPanel").then((m) => ({
		default: m.ThreatIntelPanel,
	})),
);
const EmailOsintPanel = lazy(() =>
	import("../components/osint/EmailOsintPanel").then((m) => ({
		default: m.EmailOsintPanel,
	})),
);

// ─── Types ───────────────────────────────────────────────────────────────────

type SearchType = "alias" | "image" | "scan" | "batch" | "whois" | "threat" | "email";

interface ScanSummary {
	scan_id: string;
	username: string;
	stage: string;
	started_at: string;
	completed_at: string;
	summary: Record<string, unknown>;
}

interface ScanResultData {
	scan_id: string;
	username: string;
	stage: string;
	profile_urls: { platform: string; url: string }[];
	crawl_results: {
		crawl_id: string;
		url: string;
		success: boolean;
		word_count: number;
	}[];
	review?: {
		kept: number;
		deranked: number;
		archived: number;
		average_relevance: number;
		total_reviewed: number;
	};
	knowledge_graph?: {
		entities: { id: string; name: string; entity_type: string }[];
		relationships: {
			source_id: string;
			target_id: string;
			relation_type: string;
			confidence: number;
		}[];
	};
	summary: Record<string, unknown>;
	error?: string;
}

const ALL_PLATFORMS = [
	"twitter",
	"github",
	"linkedin",
	"instagram",
	"facebook",
	"reddit",
	"tiktok",
	"mastodon",
];

// ─── Tab definitions ──────────────────────────────────────────────────────────

interface TabDef {
	key: SearchType;
	label: string;
	shortLabel: string;
	icon: typeof Search;
	accent: string;          // Tailwind text-* colour token
	accentBg: string;        // Tailwind bg-*/10 token
	accentBorder: string;    // Tailwind border-*/30 token
	tooltip: string;
	group: "core" | "intel";
}

const TABS: TabDef[] = [
	{
		key: "alias",
		label: "Alias Discovery",
		shortLabel: "Alias",
		icon: Search,
		accent: "text-cyan",
		accentBg: "bg-cyan/10",
		accentBorder: "border-cyan/30",
		tooltip: "Search a username across 8 social platforms and discover linked accounts.",
		group: "core",
	},
	{
		key: "image",
		label: "Reverse Image",
		shortLabel: "Image",
		icon: ImageIcon,
		accent: "text-acid",
		accentBg: "bg-acid/10",
		accentBorder: "border-acid/30",
		tooltip: "Upload a photo and find visually similar images across the web.",
		group: "core",
	},
	{
		key: "scan",
		label: "Full Scan",
		shortLabel: "Scan",
		icon: Scan,
		accent: "text-plasma",
		accentBg: "bg-plasma/10",
		accentBorder: "border-plasma/30",
		tooltip: "Run a 5-stage OSINT pipeline: alias discovery → crawl → review → store → knowledge graph.",
		group: "core",
	},
	{
		key: "batch",
		label: "Batch Scan",
		shortLabel: "Batch",
		icon: Users,
		accent: "text-volt",
		accentBg: "bg-volt/10",
		accentBorder: "border-volt/30",
		tooltip: "Scan multiple usernames simultaneously with configurable concurrency.",
		group: "core",
	},
	{
		key: "whois",
		label: "WHOIS / DNS",
		shortLabel: "WHOIS",
		icon: Globe,
		accent: "text-ghost",
		accentBg: "bg-ghost/10",
		accentBorder: "border-ghost/30",
		tooltip: "Look up domain registration, DNS records, and IP geolocation.",
		group: "intel",
	},
	{
		key: "threat",
		label: "Threat Intel",
		shortLabel: "Threat",
		icon: Shield,
		accent: "text-neon-r",
		accentBg: "bg-neon-r/10",
		accentBorder: "border-neon-r/30",
		tooltip: "Check IP reputation via Shodan and VirusTotal. Detects open ports, CVEs, and malware.",
		group: "intel",
	},
	{
		key: "email",
		label: "Email OSINT",
		shortLabel: "Email",
		icon: AtSign,
		accent: "text-fuchsia",
		accentBg: "bg-fuchsia/10",
		accentBorder: "border-fuchsia/30",
		tooltip: "Check breach history (HIBP), verify deliverability, and reverse-lookup email identity.",
		group: "intel",
	},
];

// ─── Skeletons ────────────────────────────────────────────────────────────────

function ResultsSkeleton() {
	return (
		<div className="space-y-3">
			{(["a", "b", "c"] as const).map((k) => (
				<Card key={k} className="animate-pulse">
					<CardBody className="flex items-center gap-4">
						<div className="w-10 h-10 bg-abyss/50 rounded-full flex-shrink-0" />
						<div className="flex-1 space-y-2">
							<div className="h-4 bg-abyss/50 w-1/3 rounded" />
							<div className="h-3 bg-abyss/50 w-2/3 rounded" />
						</div>
						<div className="h-6 w-16 bg-abyss/50 rounded-full" />
					</CardBody>
				</Card>
			))}
		</div>
	);
}

function ScanResultsSkeleton() {
	return (
		<Card className="animate-pulse">
			<CardBody className="space-y-6">
				<div className="h-5 bg-abyss/50 w-1/4 rounded" />
				<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
					{(["a", "b", "c", "d"] as const).map((k) => (
						<div key={k} className="bg-abyss/50 h-20 rounded" />
					))}
				</div>
				<div className="space-y-2">
					{(["x", "y", "z"] as const).map((k) => (
						<div key={k} className="h-4 bg-abyss/50 w-full rounded" />
					))}
				</div>
			</CardBody>
		</Card>
	);
}

// ─── Tab bar ──────────────────────────────────────────────────────────────────

function TabBar({
	active,
	onChange,
}: {
	active: SearchType;
	onChange: (t: SearchType) => void;
}) {
	const coreGroup = TABS.filter((t) => t.group === "core");
	const intelGroup = TABS.filter((t) => t.group === "intel");

	function renderTab(tab: TabDef) {
		const isActive = active === tab.key;
		const Icon = tab.icon;
		return (
			<Tooltip key={tab.key} content={tab.tooltip} side="bottom" maxWidth={260}>
				<button
					type="button"
					onClick={() => onChange(tab.key)}
					aria-current={isActive ? "page" : undefined}
					className={`
						relative flex items-center gap-2 px-3 py-2 text-xs font-semibold
						uppercase tracking-wider whitespace-nowrap rounded transition-all duration-200
						focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan/50
						${isActive
							? `${tab.accentBg} ${tab.accent} ${tab.accentBorder} border`
							: "text-text-mute border border-transparent hover:text-text hover:bg-raised/60"
						}
					`}
				>
					<Icon className="w-3.5 h-3.5 flex-shrink-0" />
					<span className="hidden sm:inline">{tab.shortLabel}</span>
					{isActive && (
						<motion.span
							layoutId="tab-indicator"
							className={`absolute inset-x-0 bottom-0 h-px ${tab.accentBg.replace("/10", "/60")}`}
						/>
					)}
				</button>
			</Tooltip>
		);
	}

	return (
		<div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-hide">
			{coreGroup.map(renderTab)}
			{/* Divider */}
			<div className="w-px h-5 bg-border mx-1 flex-shrink-0" />
			{intelGroup.map(renderTab)}
		</div>
	);
}

// ─── Platform toggle pills ────────────────────────────────────────────────────

const PLATFORM_ICONS: Record<string, string> = {
	twitter: "𝕏",
	github: "⌥",
	linkedin: "in",
	instagram: "ig",
	facebook: "fb",
	reddit: "re",
	tiktok: "tk",
	mastodon: "ms",
};

function PlatformPills({
	selected,
	onToggle,
}: {
	selected: string[];
	onToggle: (p: string) => void;
}) {
	return (
		<div className="flex flex-wrap gap-2">
			{ALL_PLATFORMS.map((platform) => {
				const active = selected.includes(platform);
				return (
					<button
						key={platform}
						type="button"
						onClick={() => onToggle(platform)}
						className={`
							flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full
							border transition-all duration-150
							${active
								? "bg-plasma/10 border-plasma/40 text-plasma"
								: "bg-abyss border-border text-text-mute hover:border-border-hi hover:text-text"
							}
						`}
					>
						<span className="font-mono text-[10px]">{PLATFORM_ICONS[platform]}</span>
						{platform}
					</button>
				);
			})}
		</div>
	);
}



// ─── Main page ────────────────────────────────────────────────────────────────

export default function OSINTDashboard() {
	const toast = useToast();
	const [searchType, setSearchType] = useState<SearchType>("alias");
	const [query, setQuery] = useState("");
	const [selectedImage, setSelectedImage] = useState<File | null>(null);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [isSearching, setIsSearching] = useState(false);
	const [aliases, setAliases] = useState<AliasResult[]>([]);
	const [imageMatches, setImageMatches] = useState<ImageMatch[]>([]);
	const [filterPlatform, setFilterPlatform] = useState<string>("all");
	const [minConfidence, setMinConfidence] = useState(0);

	// Full scan state
	const [scanUsername, setScanUsername] = useState("");
	const [scanPlatforms, setScanPlatforms] = useState<string[]>([]);
	const [scanContext, setScanContext] = useState("");
	const [isScanning, setIsScanning] = useState(false);
	const [scanResult, setScanResult] = useState<ScanResultData | null>(null);
	const [scanHistory, setScanHistory] = useState<ScanSummary[]>([]);
	const [showScanHistory, setShowScanHistory] = useState(false);
	const [exportDialogOpen, setExportDialogOpen] = useState(false);

	const fetchScanHistory = useCallback(async () => {
		try {
			const response = await api.get<{ scans: ScanSummary[]; count: number }>(
				"/osint/scan/list",
			);
			setScanHistory(response.data.scans || []);
		} catch {
			// Silently fail — history is optional
		}
	}, []);

	useEffect(() => {
		if (searchType === "scan") {
			fetchScanHistory();
		}
	}, [searchType, fetchScanHistory]);

	const handleFullScan = async () => {
		if (!scanUsername.trim()) {
			toast.warning("Enter a username to scan");
			return;
		}
		setIsScanning(true);
		setScanResult(null);
		try {
			const response = await api.post<ScanResultData>("/osint/scan/sync", {
				username: scanUsername.trim(),
				platforms: scanPlatforms.length > 0 ? scanPlatforms : undefined,
				query_context: scanContext.trim() || undefined,
				max_concurrent_crawls: 5,
			});
			setScanResult(response.data);
			toast.success(`Scan completed: ${response.data.stage}`);
			fetchScanHistory();
		} catch (error) {
			if (error instanceof Error) {
				toast.error(error.message);
			} else {
				toast.error("Scan failed. Check if LM Studio is running.");
			}
		} finally {
			setIsScanning(false);
		}
	};

	const togglePlatform = (platform: string) => {
		setScanPlatforms((prev) =>
			prev.includes(platform)
				? prev.filter((p) => p !== platform)
				: [...prev, platform],
		);
	};

	const filterPlatforms = ["all", "twitter", "linkedin", "github", "instagram", "facebook"];

	const handleSearch = async () => {
		if (!query.trim()) {
			toast.warning("Please enter a search query.");
			return;
		}
		if (searchType === "image" && !selectedImage) {
			toast.warning("Please upload an image before searching.");
			return;
		}

		setIsSearching(true);
		setErrorMessage(null);
		try {
			if (searchType === "alias") {
				const validatedData = AliasDiscoveryRequestSchema.parse({
					username: query,
				});
				const response = await api.post<{
					results?: AliasResult[];
				}>("/osint/alias/discover", validatedData);
				const results = response.data.results || [];
				setAliases(results);
				toast.success(
					`Found ${results.length} alias${results.length !== 1 ? "es" : ""}`,
				);
			} else {
				if (!selectedImage) {
					toast.warning("Please upload an image before searching.");
					return;
				}

				const validatedData = ReverseImageRequestSchema.parse({
					image: selectedImage,
				});
				const formData = new FormData();
				formData.append("image", validatedData.image);

				const response = await api.post<{
					matches?: ImageMatch[];
				}>("/osint/image/search", formData);
				const matches = response.data.matches || [];
				setImageMatches(matches);
				toast.success(
					`Found ${matches.length} image match${matches.length !== 1 ? "es" : ""}`,
				);
			}
		} catch (error) {
			if (error instanceof Error) {
				setErrorMessage(error.message);
				toast.error(error.message);
			} else {
				const message = "Search failed. Please try again.";
				setErrorMessage(message);
				toast.error(message);
			}
		} finally {
			setIsSearching(false);
		}
	};

	const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (file) {
			setSelectedImage(file);
			setQuery(file.name);
			setErrorMessage(null);
		}
	};

	const exportResults = (format: "json" | "csv") => {
		const data = searchType === "alias" ? aliases : imageMatches;

		if (data.length === 0) {
			toast.warning("No results to export");
			return;
		}

		let content: string;
		let mimeType: string;

		if (format === "json") {
			content = JSON.stringify(data, null, 2);
			mimeType = "application/json";
		} else {
			const headers = Object.keys(data[0]).join(",");
			const rows = data.map((item) =>
				Object.values(item)
					.map((val) =>
						typeof val === "string" && val.includes(",") ? `"${val}"` : val,
					)
					.join(","),
			);
			content = [headers, ...rows].join("\n");
			mimeType = "text/csv";
		}

		const blob = new Blob([content], { type: mimeType });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `osint-${searchType}-results-${Date.now()}.${format}`;
		a.click();
		URL.revokeObjectURL(url);

		toast.success(`Exported ${data.length} results as ${format.toUpperCase()}`);
	};

	const filteredAliases = aliases.filter(
		(alias) =>
			(filterPlatform === "all" || alias.platform === filterPlatform) &&
			alias.confidence >= minConfidence,
	);

	const filteredImageMatches = imageMatches.filter(
		(match) =>
			(filterPlatform === "all" || match.platform === filterPlatform) &&
			match.similarity >= minConfidence,
	);

	const scanStatusCounts = useMemo(() => {
		const counts = { completed: 0, running: 0, failed: 0, pending: 0 };
		for (const scan of scanHistory) {
			if (scan.stage === "completed") counts.completed++;
			else if (scan.stage === "running") counts.running++;
			else if (scan.stage === "failed") counts.failed++;
			else counts.pending++;
		}
		return counts;
	}, [scanHistory]);

	const knowledgeGraphEntities = useMemo((): ExtractedEntity[] => {
		if (!scanResult?.knowledge_graph?.entities) return [];
		return scanResult.knowledge_graph.entities.map((e) => ({
			id: e.id,
			name: e.name,
			entity_type:
				(e.entity_type as ExtractedEntity["entity_type"]) ?? "unknown",
		}));
	}, [scanResult]);


	const resultCount =
		searchType === "alias" ? filteredAliases.length : filteredImageMatches.length;

	return (
		<div className="space-y-5">
			{/* ── Page header ── */}
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
				<div>
					<h1 className="text-2xl font-display font-bold text-text flex items-center gap-2">
						<Zap className="w-6 h-6 text-cyan" />
						OSINT Operations
					</h1>
					<p className="text-sm text-text-mute mt-0.5">
						Open-source intelligence gathering across platforms, domains, and indicators.
					</p>
				</div>
				<div className="flex items-center gap-2">
					{(aliases.length > 0 || imageMatches.length > 0) && (
						<>
							<Button
								variant="ghost"
								size="sm"
								leftIcon={<Download className="w-4 h-4" />}
								onClick={() => exportResults("csv")}
							>
								CSV
							</Button>
							<Button
								variant="ghost"
								size="sm"
								leftIcon={<Download className="w-4 h-4" />}
								onClick={() => exportResults("json")}
							>
								JSON
							</Button>
						</>
					)}
				</div>
			</div>

			<ProviderStatusBar className="mb-1" />

			{/* ── Main tool card ── */}
			<Card>
				<CardBody className="space-y-5">
					{/* Tab bar */}
					<TabBar active={searchType} onChange={(t) => { setSearchType(t); setErrorMessage(null); }} />

					{/* Tab content */}
					<AnimatePresence mode="wait">
						<motion.div
							key={searchType}
							initial={{ opacity: 0, y: 6 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0, y: -6 }}
							transition={{ duration: 0.18 }}
						>
							{searchType === "whois" ? (
								<OsintErrorBoundary panelName="WHOIS/DNS">
									<Suspense fallback={<ResultsSkeleton />}>
										<WhoisDnsPanel />
									</Suspense>
								</OsintErrorBoundary>
							) : searchType === "threat" ? (
								<OsintErrorBoundary panelName="Threat Intel">
									<Suspense fallback={<ResultsSkeleton />}>
										<ThreatIntelPanel />
									</Suspense>
								</OsintErrorBoundary>
							) : searchType === "email" ? (
								<OsintErrorBoundary panelName="Email OSINT">
									<Suspense fallback={<ResultsSkeleton />}>
										<EmailOsintPanel />
									</Suspense>
								</OsintErrorBoundary>
							) : searchType === "batch" ? (
								<BatchAliasScan />
							) : searchType === "scan" ? (
								/* ── Full Scan form ── */
								<div className="space-y-5">
									{/* Username + launch */}
									<div>
										<div className="flex items-center gap-2 mb-1.5">
											<label className="text-xs font-semibold uppercase tracking-wider text-text-dim">
												Target Username
											</label>
											<HelpTooltip
												content="The primary username to investigate. The pipeline will search this across all selected platforms."
												side="right"
											/>
										</div>
										<div className="flex flex-col sm:flex-row gap-3">
											<div className="flex-1">
												<Input
													placeholder="e.g. johndoe123"
													value={scanUsername}
													onChange={(e) => setScanUsername(e.target.value)}
													onKeyDown={(e) => e.key === "Enter" && handleFullScan()}
													aria-label="Username to scan"
													leftIcon={<Search className="w-4 h-4" />}
												/>
												<FieldHint
													hint="Examples:"
													examples={["johndoe", "j_doe_1987", "john.doe"]}
													onExampleClick={setScanUsername}
												/>
											</div>
											<Button
												variant="primary"
												size="lg"
												loading={isScanning}
												disabled={!scanUsername.trim()}
												leftIcon={<Scan className="w-5 h-5" />}
												onClick={handleFullScan}
												className="sm:self-start"
											>
												{isScanning ? "Scanning…" : "Start Scan"}
											</Button>
										</div>
									</div>

									{/* Platform toggles */}
									<div>
										<div className="flex items-center gap-2 mb-2">
											<span className="text-xs font-semibold uppercase tracking-wider text-text-dim">
												Target Platforms
											</span>
											<HelpTooltip
												content="Select specific platforms to scan. Leave all unselected to scan all 8 supported platforms."
												side="right"
											/>
											{scanPlatforms.length > 0 && (
												<button
													type="button"
													onClick={() => setScanPlatforms([])}
													className="ml-auto text-[11px] text-text-mute hover:text-neon-r transition-colors"
												>
													Clear
												</button>
											)}
										</div>
										<PlatformPills selected={scanPlatforms} onToggle={togglePlatform} />
										{scanPlatforms.length === 0 && (
											<p className="mt-1.5 text-[11px] text-text-mute">
												All platforms selected by default
											</p>
										)}
									</div>

									{/* Query context */}
									<div>
										<div className="flex items-center gap-2 mb-1.5">
											<label className="text-xs font-semibold uppercase tracking-wider text-text-dim">
												Query Context
												<span className="ml-1 text-text-mute font-normal normal-case tracking-normal">(optional)</span>
											</label>
											<HelpTooltip
												content="Additional context fed to the LLM review stage. Improves relevance scoring for niche targets."
												side="right"
											/>
										</div>
										<Input
											placeholder="e.g. cybersecurity researcher, Berlin-based developer"
											value={scanContext}
											onChange={(e) => setScanContext(e.target.value)}
											aria-label="Query context (optional)"
										/>
										<FieldHint hint="Helps the AI review stage score content relevance more accurately." />
									</div>
								</div>
							) : (
								/* ── Alias / Image search form ── */
								<div>
									<div className="flex items-center gap-2 mb-1.5">
										<label className="text-xs font-semibold uppercase tracking-wider text-text-dim">
											{searchType === "alias" ? "Username" : "Image File"}
										</label>
										<HelpTooltip
											content={
												searchType === "alias"
													? "Enter any username or handle. The search checks Twitter, GitHub, LinkedIn, Instagram, Facebook, Reddit, TikTok, and Mastodon."
													: "Upload a JPEG, PNG, or WebP image. The system computes perceptual hashes and searches for visual matches."
											}
											side="right"
										/>
									</div>

									<div className="flex flex-col sm:flex-row gap-3">
										<div className="flex-1">
											{searchType === "alias" ? (
												<>
													<Input
														placeholder="e.g. johndoe123"
														value={query}
														onChange={(e) => setQuery(e.target.value)}
														onKeyDown={(e) => e.key === "Enter" && handleSearch()}
														leftIcon={<Search className="w-4 h-4" />}
														aria-label="Username to search"
													/>
													<FieldHint
														hint="Examples:"
														examples={["johndoe", "john_doe", "jdoe1987"]}
														onExampleClick={(ex) => setQuery(ex)}
													/>
												</>
											) : (
												<div className="relative group">
													<div className={`
														flex items-center gap-3 px-4 py-3
														bg-void border rounded cursor-pointer transition-all
														${selectedImage
															? "border-acid/40 bg-acid/5"
															: "border-border hover:border-acid/30"
														}
													`}>
														<Upload className={`w-5 h-5 flex-shrink-0 transition-colors ${selectedImage ? "text-acid" : "text-text-mute group-hover:text-acid"}`} />
														<div className="flex-1 min-w-0">
															<span className={`text-sm transition-colors truncate block ${selectedImage ? "text-acid" : "text-text-dim group-hover:text-text"}`}>
																{selectedImage ? selectedImage.name : "Click or drag an image here…"}
															</span>
															{selectedImage && (
																<span className="text-[11px] text-text-mute">
																	{(selectedImage.size / 1024).toFixed(0)} KB · {selectedImage.type}
																</span>
															)}
														</div>
														{selectedImage && (
															<button
																type="button"
																onClick={(e) => {
																	e.stopPropagation();
																	setSelectedImage(null);
																	setQuery("");
																}}
																className="text-text-mute hover:text-neon-r transition-colors flex-shrink-0"
																aria-label="Remove image"
															>
																✕
															</button>
														)}
													</div>
													<input
														type="file"
														accept="image/*"
														onChange={handleImageUpload}
														className="absolute inset-0 opacity-0 cursor-pointer"
														aria-label="Upload image for reverse image search"
													/>
													<FieldHint hint="Supported formats: JPEG, PNG, WebP, GIF · Max 10 MB" />
												</div>
											)}
										</div>

										<Button
											variant="primary"
											size="lg"
											loading={isSearching}
											disabled={!query.trim()}
											leftIcon={<Search className="w-5 h-5" />}
											onClick={handleSearch}
											className="sm:self-start"
										>
											{isSearching ? "Searching…" : "Search"}
										</Button>
									</div>
								</div>
							)}
						</motion.div>
					</AnimatePresence>
				</CardBody>
			</Card>

			{/* ── Error banner ── */}
			<AnimatePresence>
				{errorMessage && (
					<motion.div
						initial={{ opacity: 0, height: 0 }}
						animate={{ opacity: 1, height: "auto" }}
						exit={{ opacity: 0, height: 0 }}
						role="alert"
						className="bg-neon-r/10 border border-neon-r/30 text-neon-r px-4 py-3 flex items-center gap-3 rounded"
					>
						<AlertCircle className="w-5 h-5 flex-shrink-0" />
						<span className="flex-1 text-sm">{errorMessage}</span>
						<button
							type="button"
							onClick={() => setErrorMessage(null)}
							className="text-neon-r/60 hover:text-neon-r transition-colors text-lg leading-none"
							aria-label="Dismiss error"
						>
							✕
						</button>
					</motion.div>
				)}
			</AnimatePresence>

			{/* ── Filter bar (alias / image only) ── */}
			{(searchType === "alias" || searchType === "image") && (
				<Card>
					<CardBody>
						<div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
							<div className="flex items-center gap-3">
								<Filter className="w-4 h-4 text-text-mute hidden sm:block" />
								<div className="w-full sm:w-44">
									<Select
										value={filterPlatform}
										onChange={(e) => setFilterPlatform(e.target.value)}
										options={filterPlatforms.map((p) => ({
											value: p,
											label: p === "all" ? "All Platforms" : p.charAt(0).toUpperCase() + p.slice(1),
										}))}
									/>
								</div>
							</div>

							<div className="flex items-center gap-3 bg-void px-4 py-2 border border-border rounded">
								<label
									htmlFor="min-confidence"
									className="text-xs font-medium text-text-dim whitespace-nowrap"
								>
									Min Confidence
								</label>
								<input
									id="min-confidence"
									type="range"
									min="0"
									max="100"
									value={minConfidence * 100}
									onChange={(e) => setMinConfidence(Number(e.target.value) / 100)}
									className="w-28 accent-cyan"
								/>
								<span className="text-xs font-mono text-cyan w-9 text-right tabular-nums">
									{(minConfidence * 100).toFixed(0)}%
								</span>
							</div>

							<div className="sm:ml-auto flex items-center gap-2 text-sm">
								<div className="flex items-center gap-2 px-3 py-1 bg-plasma/10 text-plasma rounded-full border border-plasma/20">
									<CheckCircle className="w-3.5 h-3.5" />
									<span className="font-mono font-medium tabular-nums">
										{resultCount}
									</span>
									<span className="text-xs">results</span>
								</div>
							</div>
						</div>
					</CardBody>
				</Card>
			)}

			{/* ── Scan skeleton ── */}
			{searchType === "scan" && isScanning && !scanResult && (
				<ScanResultsSkeleton />
			)}

			{/* ── Scan results ── */}
			{searchType === "scan" && scanResult && (
				<motion.div
					initial={{ opacity: 0, y: 8 }}
					animate={{ opacity: 1, y: 0 }}
					className="space-y-4"
				>
					<Card>
						<CardHeader>
							<div className="flex items-center gap-2">
								<Scan className="w-5 h-5 text-plasma" />
								<h2 className="text-base font-display font-semibold">
									Scan Results — {scanResult.username}
								</h2>
							</div>
							<div className="flex items-center gap-3">
								<Button
									variant="ghost"
									size="sm"
									leftIcon={<Download className="w-4 h-4" />}
									onClick={() => setExportDialogOpen(true)}
								>
									Export
								</Button>
						<Badge variant={scanResult.stage === 'completed' ? 'success' : scanResult.stage === 'failed' ? 'danger' : 'volt'} size="sm">
							{scanResult.stage}
						</Badge>
							</div>
						</CardHeader>
						<CardBody className="space-y-6">
						{scanResult.error && (
							<Alert variant="danger">{scanResult.error}</Alert>
						)}

							{/* Stats grid */}
							<div className="grid grid-cols-2 md:grid-cols-4 gap-3">
								<StatCard
									label="Profile URLs"
									value={scanResult.profile_urls?.length ?? 0}
									icon={<Link2 className="w-4 h-4" />}
									accent="cyan"
								/>
								<StatCard
									label="Crawls OK"
									value={scanResult.crawl_results?.filter((c) => c.success).length ?? 0}
									icon={<CheckCircle className="w-4 h-4" />}
									accent="plasma"
								/>
								<StatCard
									label="Crawls Failed"
									value={scanResult.crawl_results?.filter((c) => !c.success).length ?? 0}
									icon={<AlertCircle className="w-4 h-4" />}
									accent="neon-r"
								/>
								<StatCard
									label="Entities"
									value={scanResult.knowledge_graph?.entities?.length ?? 0}
									icon={<Users className="w-4 h-4" />}
									accent="fuchsia"
								/>
							</div>

							{/* Review summary */}
							{scanResult.review && (
								<div>
									<h3 className="text-xs font-semibold uppercase tracking-wider text-text-mute mb-3">
										Review Summary
									</h3>
									<div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
										{[
											{ label: "Kept", value: scanResult.review.kept, color: "bg-plasma" },
											{ label: "Deranked", value: scanResult.review.deranked, color: "bg-volt" },
											{ label: "Archived", value: scanResult.review.archived, color: "bg-neon-r" },
											{
												label: "Avg Relevance",
												value: `${(scanResult.review.average_relevance * 100).toFixed(0)}%`,
												color: "bg-cyan",
											},
										].map((item) => (
											<div
												key={item.label}
												className="flex items-center gap-2.5 p-3 bg-abyss border border-border/40 rounded"
											>
												<span className={`w-2 h-2 rounded-full flex-shrink-0 ${item.color}`} />
												<div>
													<div className="text-sm font-mono font-bold text-text">
														{item.value}
													</div>
													<div className="text-[10px] text-text-mute">{item.label}</div>
												</div>
											</div>
										))}
									</div>
								</div>
							)}

							{/* Profile URLs */}
							{scanResult.profile_urls && scanResult.profile_urls.length > 0 && (
								<div>
									<h3 className="text-xs font-semibold uppercase tracking-wider text-text-mute mb-3">
										Profile URLs
									</h3>
									<div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
										{scanResult.profile_urls.map((p) => (
											<div
												key={`${p.platform}-${p.url}`}
												className="flex items-center gap-3 text-sm group"
											>
												<span className="px-2 py-0.5 bg-surface text-[10px] text-text-dim font-mono w-20 text-center rounded flex-shrink-0">
													{p.platform}
												</span>
												<a
													href={p.url}
													target="_blank"
													rel="noopener noreferrer"
													className="text-cyan hover:text-cyan/80 truncate flex-1 flex items-center gap-1 transition-colors"
												>
													{p.url}
													<ExternalLink className="w-3 h-3 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
												</a>
											</div>
										))}
									</div>
								</div>
							)}

							{/* Crawl results */}
							{scanResult.crawl_results && scanResult.crawl_results.length > 0 && (
								<div>
									<h3 className="text-xs font-semibold uppercase tracking-wider text-text-mute mb-3">
										Crawl Results
									</h3>
									<div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
										{scanResult.crawl_results.map((c) => (
											<div
												key={c.crawl_id || c.url}
												className="flex items-center gap-3 text-sm"
											>
												{c.success ? (
													<CheckCircle className="w-4 h-4 text-plasma flex-shrink-0" />
												) : (
													<AlertCircle className="w-4 h-4 text-neon-r/60 flex-shrink-0" />
												)}
												<span className="text-text-dim truncate flex-1 font-mono text-xs">
													{c.url}
												</span>
												{c.success && (
													<span className="text-[11px] text-text-mute tabular-nums flex-shrink-0">
														{c.word_count.toLocaleString()} w
													</span>
												)}
											</div>
										))}
									</div>
								</div>
							)}
						</CardBody>
					</Card>

					{/* Donut + entities */}
					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						<OSINTStatusDonut counts={scanStatusCounts} />
						{knowledgeGraphEntities.length > 0 && (
							<Card>
								<CardHeader>
									<h2 className="text-base font-display font-semibold">
										Extracted Entities
									</h2>
								</CardHeader>
								<CardBody>
									<EntityList entities={knowledgeGraphEntities} maxVisible={8} />
								</CardBody>
							</Card>
						)}
					</div>
				</motion.div>
			)}

			{/* ── Scan history ── */}
			{searchType === "scan" && (
				<Card>
					<CardBody>
						<button
							type="button"
							onClick={() => setShowScanHistory(!showScanHistory)}
							className="w-full flex items-center justify-between text-sm font-medium text-text hover:text-cyan transition-colors"
						>
							<span className="flex items-center gap-2">
								<Clock className="w-4 h-4 text-text-mute" />
								Scan History
								<span className="text-[11px] font-mono text-text-mute bg-abyss px-1.5 py-0.5 rounded">
									{scanHistory.length}
								</span>
							</span>
							{showScanHistory ? (
								<ChevronUp className="w-4 h-4 text-text-mute" />
							) : (
								<ChevronDown className="w-4 h-4 text-text-mute" />
							)}
						</button>

						<AnimatePresence>
							{showScanHistory && (
								<motion.div
									initial={{ height: 0, opacity: 0 }}
									animate={{ height: "auto", opacity: 1 }}
									exit={{ height: 0, opacity: 0 }}
									transition={{ duration: 0.2 }}
									className="overflow-hidden"
								>
									<div className="mt-4 space-y-2">
										{scanHistory.length === 0 ? (
											<div className="text-center py-8">
												<Clock className="w-8 h-8 mx-auto mb-3 text-text-mute opacity-30" />
												<p className="text-sm text-text-dim">No previous scans found.</p>
											</div>
										) : (
											scanHistory.map((scan) => (
												<div
													key={scan.scan_id}
													className="flex items-center justify-between p-3 bg-abyss border border-border/30 rounded text-sm hover:border-border/60 transition-colors"
												>
													<div className="flex items-center gap-3">
														<span className="font-medium text-text">{scan.username}</span>
										<Badge variant={scan.stage === 'completed' ? 'success' : scan.stage === 'failed' ? 'danger' : 'volt'} size="sm">
											{scan.stage}
										</Badge>
													</div>
													<span className="text-[11px] text-text-mute font-mono">
														{scan.scan_id.slice(0, 8)}…
													</span>
												</div>
											))
										)}
									</div>
								</motion.div>
							)}
						</AnimatePresence>
					</CardBody>
				</Card>
			)}

			{/* ── Alias results ── */}
			{searchType === "alias" && (
				<div className="space-y-3">
					<div className="flex items-center gap-2">
						<Search className="w-4 h-4 text-cyan" />
						<h2 className="text-base font-display font-semibold text-text">
							Alias Results
						</h2>
					</div>
					{isSearching && <ResultsSkeleton />}
					{!isSearching && filteredAliases.length === 0 && (
						<Card variant="bordered">
							<CardBody className="text-center py-14">
								<div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-cyan/5 border border-cyan/10 mb-4">
									<Search className="w-7 h-7 text-cyan/30" />
								</div>
								<p className="text-text-dim mb-1 font-medium">No results found</p>
								<p className="text-xs text-text-mute">
									Try a different username or lower the confidence threshold.
								</p>
							</CardBody>
						</Card>
					)}
					<AnimatePresence>
						{filteredAliases.map((alias, i) => (
							<motion.div
								key={`${alias.platform}-${alias.username}`}
								initial={{ opacity: 0, y: 8 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ delay: i * 0.04 }}
							>
								<AliasCard alias={alias} />
							</motion.div>
						))}
					</AnimatePresence>
				</div>
			)}

			{/* ── Image matches ── */}
			{searchType === "image" && (
				<div className="space-y-3">
					<div className="flex items-center gap-2">
						<ImageIcon className="w-4 h-4 text-acid" />
						<h2 className="text-base font-display font-semibold text-text">
							Image Matches
						</h2>
					</div>
					<ImageMatchGrid
						matches={filteredImageMatches}
						isLoading={isSearching}
						error={searchType === "image" ? errorMessage : null}
						onRetry={handleSearch}
					/>
				</div>
			)}

			{/* ── Network graph ── */}
			{aliases.length > 0 && (
				<Card>
					<CardHeader>
						<h2 className="text-base font-display font-semibold text-text flex items-center gap-2">
							<Globe className="w-4 h-4 text-cyan" />
							Network Graph
						</h2>
					</CardHeader>
					<CardBody>
						<NetworkGraph nodes={aliases} />
					</CardBody>
				</Card>
			)}

			{/* ── Export dialog ── */}
			{scanResult && (
				<ExportDialog
					open={exportDialogOpen}
					scanName={scanResult.username}
					scanResult={scanResult}
					onClose={() => setExportDialogOpen(false)}
				/>
			)}
		</div>
	);
}
