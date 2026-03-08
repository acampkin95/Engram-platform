import {
	AlertCircle,
	ArrowLeft,
	BarChart3,
	ChevronRight,
	FileText,
	Globe,
	type LucideIcon,
	StickyNote,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Badge, Card } from "@/components/ui";
import InvestigationHeader from "../components/investigations/InvestigationHeader";
import { Skeleton } from "../components/Skeleton";
import type { Investigation } from "../stores/investigationStore";
import { useInvestigationStore } from "../stores/investigationStore";

type Tab = "overview" | "crawls" | "results" | "notes";

const TABS: { id: Tab; label: string; icon: LucideIcon }[] = [
	{ id: "overview", label: "Overview", icon: BarChart3 },
	{ id: "crawls", label: "Crawls", icon: Globe },
	{ id: "results", label: "Results", icon: FileText },
	{ id: "notes", label: "Notes", icon: StickyNote },
];

function OverviewTab({ investigation }: { investigation: Investigation }) {
	const stats = [
		{
			label: "Associated Crawls",
			value: investigation.associated_crawl_ids.length,
		},
		{ label: "Tags", value: investigation.tags.length },
		{
			label: "Status",
			value: investigation.status === "active" ? "Active" : "Archived",
		},
	];

	return (
		<div className="space-y-6 p-6">
			<div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
				{stats.map((stat) => (
					<div key={stat.label} className="bg-void p-4 border border-border">
						<div className="text-2xl font-bold text-text">{stat.value}</div>
						<div className="text-sm text-text-dim mt-0.5">{stat.label}</div>
					</div>
				))}
			</div>

			{investigation.description && (
				<div>
					<h3 className="text-sm font-semibold text-text mb-2">Description</h3>
					<p className="text-sm text-text-dim leading-relaxed whitespace-pre-wrap">
						{investigation.description}
					</p>
				</div>
			)}

			<div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
				<div>
					<span className="text-text-dim">Created</span>
					<span className="ml-2 text-text">
						{new Date(investigation.created_at).toLocaleString()}
					</span>
				</div>
				<div>
					<span className="text-text-dim">Last updated</span>
					<span className="ml-2 text-text">
						{new Date(investigation.updated_at).toLocaleString()}
					</span>
				</div>
			</div>
		</div>
	);
}

function CrawlsTab({ investigation }: { investigation: Investigation }) {
	if (investigation.associated_crawl_ids.length === 0) {
		return (
			<div className="flex flex-col items-center justify-center py-16 text-center px-6">
				<Globe size={40} className="text-text-mute mb-3" />
				<h3 className="text-base font-semibold text-text mb-1">
					No crawls linked
				</h3>
				<p className="text-sm text-text-dim max-w-xs">
					Crawls associated with this investigation will appear here.
				</p>
			</div>
		);
	}

	return (
		<div className="p-6">
			<ul className="space-y-2">
				{investigation.associated_crawl_ids.map((crawlId) => (
					<li key={crawlId} className="border border-border bg-void">
						<Link
							to={`/crawl/${crawlId}/monitor`}
							className="flex items-center justify-between px-4 py-3 hover:bg-border/20 transition-colors"
						>
							<div className="flex items-center gap-2 min-w-0">
								<Globe size={15} className="text-text-mute shrink-0" />
								<span className="text-sm font-mono text-text-dim truncate">
									{crawlId}
								</span>
							</div>
							<ChevronRight size={15} className="text-text-mute shrink-0" />
						</Link>
					</li>
				))}
			</ul>
		</div>
	);
}

interface CrawlSummary {
	crawl_id: string;
	url: string;
	status: "completed" | "failed" | "running" | "pending";
	created_at: string;
}

function ResultsTab({ investigation }: { investigation: Investigation }) {
	const [crawls, setCrawls] = useState<CrawlSummary[]>([]);
	const [loading, setLoading] = useState(false);
	const [fetchError, setFetchError] = useState<string | null>(null);

	const fetchCrawls = useCallback(async () => {
		if (investigation.associated_crawl_ids.length === 0) return;
		setLoading(true);
		setFetchError(null);
		try {
			const { api } = await import("../lib/api");
			const response = await api.get<CrawlSummary[]>("/crawl/list");
			const filtered = response.data.filter((c) =>
				investigation.associated_crawl_ids.includes(c.crawl_id),
			);
			setCrawls(filtered);
		} catch (err) {
			setFetchError(
				err instanceof Error ? err.message : "Failed to load crawl results",
			);
		} finally {
			setLoading(false);
		}
	}, [investigation.associated_crawl_ids]);

	useEffect(() => {
		fetchCrawls();
	}, [fetchCrawls]);

	if (investigation.associated_crawl_ids.length === 0) {
		return (
			<div className="flex flex-col items-center justify-center py-16 text-center px-6">
				<FileText size={40} className="text-text-mute mb-3" />
				<h3 className="text-base font-semibold text-text mb-1">
					No results yet
				</h3>
				<p className="text-sm text-text-dim max-w-xs">
					Crawl results from linked crawls will appear here.
				</p>
			</div>
		);
	}

	if (loading) {
		return (
			<div className="p-6 space-y-3">
				{investigation.associated_crawl_ids.map((id) => (
					<div key={id} className="bg-void border border-border p-4 space-y-2">
						<Skeleton className="h-4 w-3/4" />
						<Skeleton className="h-3 w-1/2" />
					</div>
				))}
			</div>
		);
	}

	if (fetchError) {
		return (
			<div className="flex flex-col items-center justify-center py-16 text-center px-6">
				<AlertCircle size={40} className="text-neon-r mb-3" />
				<h3 className="text-base font-semibold text-text mb-1">
					Failed to load results
				</h3>
				<p className="text-sm text-text-dim mb-4">{fetchError}</p>
				<button
					type="button"
					onClick={fetchCrawls}
					className="text-sm text-cyan hover:underline"
				>
					Retry
				</button>
			</div>
		);
	}

	const statusVariant: Record<CrawlSummary["status"], string> = {
		completed: "text-neon-g",
		failed: "text-neon-r",
		running: "text-cyan",
		pending: "text-text-dim",
	};

	return (
		<div className="p-6 space-y-3">
			{crawls.map((crawl) => (
				<div key={crawl.crawl_id} className="bg-void border border-border p-4">
					<div className="flex items-start justify-between gap-4">
						<div className="min-w-0 space-y-1">
							<div className="flex items-center gap-2">
								<Globe size={14} className="text-text-mute shrink-0" />
								<span className="text-sm text-text truncate">{crawl.url}</span>
							</div>
							<div className="text-xs font-mono text-text-dim truncate">
								{crawl.crawl_id}
							</div>
						</div>
						<div className="flex items-center gap-3 shrink-0">
							<span
								className={`text-xs font-medium capitalize ${statusVariant[crawl.status]}`}
							>
								{crawl.status}
							</span>
							<Link
								to={`/crawl/${crawl.crawl_id}/results`}
								className="text-xs text-cyan hover:underline whitespace-nowrap"
							>
								View Results
							</Link>
						</div>
					</div>
				</div>
			))}
		</div>
	);
}

function NotesTab({ investigation }: { investigation: Investigation }) {
	return (
		<div className="p-6">
			<h3 className="text-sm font-semibold text-text mb-3">Notes</h3>
			{investigation.description ? (
				<div className="bg-volt/10 border border-volt/30 p-4">
					<p className="text-sm text-text whitespace-pre-wrap leading-relaxed">
						{investigation.description}
					</p>
				</div>
			) : (
				<div className="flex flex-col items-center justify-center py-12 text-center">
					<StickyNote size={36} className="text-text-mute mb-3" />
					<p className="text-sm text-text-dim">No notes added yet.</p>
				</div>
			)}
		</div>
	);
}

export default function InvestigationDetailPage() {
	const { id } = useParams<{ id: string }>();
	const navigate = useNavigate();
	const { fetchInvestigation, investigations, loading, error } =
		useInvestigationStore();
	const [activeTab, setActiveTab] = useState<Tab>("overview");

	const investigation: Investigation | undefined = investigations.find(
		(i) => i.id === id,
	);

	useEffect(() => {
		if (id) {
			fetchInvestigation(id);
		}
	}, [id, fetchInvestigation]);

	if (loading && !investigation) {
		return (
			<div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
				<Skeleton className="h-5 w-40 mb-4" />
				<Card>
					<div className="p-6 space-y-4">
						<Skeleton className="h-8 w-2/3" />
						<Skeleton className="h-4 w-1/3" />
						<div className="flex gap-2 mt-4">
							{(["t1", "t2", "t3", "t4"] as const).map((k) => (
								<Skeleton key={k} className="h-10 w-24" />
							))}
						</div>
						<Skeleton className="h-48 w-full" />
					</div>
				</Card>
			</div>
		);
	}

	if (error && !investigation) {
		return (
			<div className="max-w-2xl mx-auto px-6 py-16 text-center">
				<AlertCircle size={40} className="text-neon-r mx-auto mb-3" />
				<h2 className="text-lg font-semibold text-text mb-1">
					Failed to load investigation
				</h2>
				<p className="text-sm text-text-dim mb-4">{error}</p>
				<Link
					to="/investigations"
					className="inline-flex items-center gap-2 text-sm text-cyan hover:underline"
				>
					<ArrowLeft size={14} />
					Back to Investigations
				</Link>
			</div>
		);
	}

	if (!investigation) {
		return (
			<div className="max-w-2xl mx-auto px-6 py-16 text-center">
				<AlertCircle size={40} className="text-text-mute mx-auto mb-3" />
				<h2 className="text-lg font-semibold text-text mb-1">
					Investigation not found
				</h2>
				<Link
					to="/investigations"
					className="inline-flex items-center gap-2 text-sm text-cyan hover:underline"
				>
					<ArrowLeft size={14} />
					Back to Investigations
				</Link>
			</div>
		);
	}

	return (
		<div>
			<div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
				<Link
					to="/investigations"
					className="inline-flex items-center gap-1.5 text-sm text-text-dim hover:text-text transition-colors mb-4"
				>
					<ArrowLeft size={14} />
					All Investigations
				</Link>
			</div>

			<div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
				<Card>
					<InvestigationHeader
						investigation={investigation}
						onArchived={() => navigate("/investigations")}
					/>

					<div className="border-b border-border">
						<div
							className="flex px-4 -mb-px overflow-x-auto"
							role="tablist"
							aria-label="Investigation tabs"
						>
							{TABS.map((tab) => {
								const Icon = tab.icon;
								const isActive = activeTab === tab.id;
								return (
									<button
										key={tab.id}
										id={`inv-tab-${tab.id}`}
										type="button"
										role="tab"
										aria-selected={isActive}
										aria-controls="inv-tabpanel"
										onClick={() => setActiveTab(tab.id)}
										className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
											isActive
												? "border-cyan text-cyan"
												: "border-transparent text-text-dim hover:text-text hover:border-border"
										}`}
									>
										<Icon size={15} />
										{tab.label}
										{tab.id === "crawls" &&
											investigation.associated_crawl_ids.length > 0 && (
												<Badge variant="cyan" size="sm" className="ml-1">
													{investigation.associated_crawl_ids.length}
												</Badge>
											)}
									</button>
								);
							})}
						</div>
					</div>

					<div
						id="inv-tabpanel"
						role="tabpanel"
						aria-labelledby={`inv-tab-${activeTab}`}
					>
						{activeTab === "overview" && (
							<OverviewTab investigation={investigation} />
						)}
						{activeTab === "crawls" && (
							<CrawlsTab investigation={investigation} />
						)}
						{activeTab === "results" && (
							<ResultsTab investigation={investigation} />
						)}
						{activeTab === "notes" && (
							<NotesTab investigation={investigation} />
						)}
					</div>
				</Card>
			</div>
		</div>
	);
}
