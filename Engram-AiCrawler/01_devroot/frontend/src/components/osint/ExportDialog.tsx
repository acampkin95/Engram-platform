import { Download, FileJson, FileText, Loader2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useToast } from "../Toast";

interface ScanProfileUrl {
	platform: string;
	url: string;
}

interface ScanCrawlResult {
	crawl_id: string;
	url: string;
	success: boolean;
	word_count: number;
}

interface ScanEntity {
	id: string;
	name: string;
	entity_type: string;
}

interface ScanRelationship {
	source_id: string;
	target_id: string;
	relation_type: string;
	confidence: number;
}

interface ScanResultExportData {
	scan_id: string;
	username: string;
	stage: string;
	profile_urls?: ScanProfileUrl[];
	crawl_results?: ScanCrawlResult[];
	review?: {
		kept: number;
		deranked: number;
		archived: number;
		average_relevance: number;
		total_reviewed: number;
	};
	knowledge_graph?: {
		entities?: ScanEntity[];
		relationships?: ScanRelationship[];
	};
	summary?: Record<string, unknown>;
	error?: string;
}

interface ExportDialogProps {
	open: boolean;
	scanName: string;
	scanResult: ScanResultExportData;
	onClose: () => void;
}

type ExportFormat = "json" | "csv" | "ndjson";

interface IncludeOptions {
	scanResults: boolean;
	profileUrls: boolean;
	entities: boolean;
	relationships: boolean;
	review: boolean;
	metadata: boolean;
}

type FlatExportRecord = Record<string, string | number | boolean | null>;

const INCLUDE_ITEMS: {
	key: keyof IncludeOptions;
	label: string;
	desc: string;
}[] = [
	{
		key: "scanResults",
		label: "Scan Results",
		desc: "Crawl URLs, success flags, and word counts",
	},
	{
		key: "profileUrls",
		label: "Profile URLs",
		desc: "Discovered profile links by platform",
	},
	{
		key: "entities",
		label: "Entities",
		desc: "Knowledge graph entities extracted from content",
	},
	{
		key: "relationships",
		label: "Relationships",
		desc: "Knowledge graph relationship edges",
	},
	{
		key: "review",
		label: "Review Summary",
		desc: "Kept/deranked/archived relevance metrics",
	},
	{
		key: "metadata",
		label: "Metadata",
		desc: "Scan identifiers, stage, summary, and errors",
	},
];

function csvEscape(value: string | number | boolean | null): string {
	if (value === null) return "";
	const asString = String(value);
	if (
		asString.includes(",") ||
		asString.includes('"') ||
		asString.includes("\n")
	) {
		return `"${asString.replace(/"/g, '""')}"`;
	}
	return asString;
}

function formatTimestampForFilename(date = new Date()): string {
	const yyyy = date.getFullYear();
	const mm = String(date.getMonth() + 1).padStart(2, "0");
	const dd = String(date.getDate()).padStart(2, "0");
	const hh = String(date.getHours()).padStart(2, "0");
	const min = String(date.getMinutes()).padStart(2, "0");
	return `${yyyy}-${mm}-${dd}-${hh}${min}`;
}

export function ExportDialog({
	open,
	scanName,
	scanResult,
	onClose,
}: ExportDialogProps) {
	const toast = useToast();
	const [selectedFormat, setSelectedFormat] = useState<ExportFormat>("json");
	const [includes, setIncludes] = useState<IncludeOptions>({
		scanResults: true,
		profileUrls: true,
		entities: true,
		relationships: true,
		review: true,
		metadata: true,
	});
	const [isExporting, setIsExporting] = useState(false);
	const [downloadedFilename, setDownloadedFilename] = useState<string | null>(
		null,
	);

	const selectedTopLevelCount = useMemo(
		() => Object.values(includes).filter(Boolean).length,
		[includes],
	);

	const flatRecords = useMemo<FlatExportRecord[]>(() => {
		const records: FlatExportRecord[] = [];

		if (includes.scanResults) {
			(scanResult.crawl_results ?? []).forEach((crawl, idx) => {
				records.push({
					record_type: "scan_result",
					index: idx,
					crawl_id: crawl.crawl_id,
					url: crawl.url,
					success: crawl.success,
					word_count: crawl.word_count,
				});
			});
		}

		if (includes.profileUrls) {
			(scanResult.profile_urls ?? []).forEach((profile, idx) => {
				records.push({
					record_type: "profile_url",
					index: idx,
					platform: profile.platform,
					url: profile.url,
				});
			});
		}

		if (includes.entities) {
			(scanResult.knowledge_graph?.entities ?? []).forEach((entity, idx) => {
				records.push({
					record_type: "entity",
					index: idx,
					entity_id: entity.id,
					name: entity.name,
					entity_type: entity.entity_type,
				});
			});
		}

		if (includes.relationships) {
			(scanResult.knowledge_graph?.relationships ?? []).forEach(
				(relationship, idx) => {
					records.push({
						record_type: "relationship",
						index: idx,
						source_id: relationship.source_id,
						target_id: relationship.target_id,
						relation_type: relationship.relation_type,
						confidence: relationship.confidence,
					});
				},
			);
		}

		if (includes.review && scanResult.review) {
			records.push({
				record_type: "review_summary",
				kept: scanResult.review.kept,
				deranked: scanResult.review.deranked,
				archived: scanResult.review.archived,
				average_relevance: scanResult.review.average_relevance,
				total_reviewed: scanResult.review.total_reviewed,
			});
		}

		if (includes.metadata) {
			records.push({
				record_type: "metadata",
				scan_id: scanResult.scan_id,
				username: scanResult.username,
				stage: scanResult.stage,
				has_error: Boolean(scanResult.error),
			});
		}

		return records;
	}, [includes, scanResult]);

	const structuredExportData = useMemo<Record<string, unknown>>(() => {
		const output: Record<string, unknown> = {};

		if (includes.metadata) {
			output.metadata = {
				scan_id: scanResult.scan_id,
				username: scanResult.username,
				stage: scanResult.stage,
				summary: scanResult.summary ?? {},
				error: scanResult.error ?? null,
			};
		}

		if (includes.scanResults)
			output.scan_results = scanResult.crawl_results ?? [];
		if (includes.profileUrls)
			output.profile_urls = scanResult.profile_urls ?? [];
		if (includes.entities)
			output.entities = scanResult.knowledge_graph?.entities ?? [];
		if (includes.relationships)
			output.relationships = scanResult.knowledge_graph?.relationships ?? [];
		if (includes.review) output.review = scanResult.review ?? null;

		return output;
	}, [includes, scanResult]);

	const previewRecords = useMemo(() => flatRecords.slice(0, 3), [flatRecords]);

	if (!open) return null;

	const toggleInclude = (key: keyof IncludeOptions) => {
		setDownloadedFilename(null);
		setIncludes((prev) => ({ ...prev, [key]: !prev[key] }));
	};

	const convertToCsv = (records: FlatExportRecord[]): string => {
		if (records.length === 0) return "";

		const headerSet = new Set<string>();
		records.forEach((row) => {
			Object.keys(row).forEach((key) => {
				headerSet.add(key);
			});
		});

		const headers = Array.from(headerSet);
		const lines = [headers.join(",")];

		records.forEach((row) => {
			const line = headers
				.map((header) => csvEscape(row[header] ?? null))
				.join(",");
			lines.push(line);
		});

		return lines.join("\n");
	};

	const convertToNdjson = (records: FlatExportRecord[]): string =>
		records.map((row) => JSON.stringify(row)).join("\n");

	const getExportPayload = (): {
		body: string;
		mimeType: string;
		ext: ExportFormat;
	} => {
		if (selectedFormat === "json") {
			return {
				body: JSON.stringify(structuredExportData, null, 2),
				mimeType: "application/json",
				ext: "json",
			};
		}

		if (selectedFormat === "csv") {
			return {
				body: convertToCsv(flatRecords),
				mimeType: "text/csv;charset=utf-8",
				ext: "csv",
			};
		}

		return {
			body: convertToNdjson(flatRecords),
			mimeType: "application/x-ndjson;charset=utf-8",
			ext: "ndjson",
		};
	};

	const handleExport = async () => {
		if (selectedTopLevelCount === 0) {
			toast.warning("Select at least one data section to export.");
			return;
		}

		if (flatRecords.length === 0) {
			toast.warning("No records available for the selected fields.");
			return;
		}

		setIsExporting(true);
		setDownloadedFilename(null);

		try {
			const payload = getExportPayload();
			const filename = `osint-export-${formatTimestampForFilename()}.${payload.ext}`;
			const blob = new Blob([payload.body], { type: payload.mimeType });
			const objectUrl = URL.createObjectURL(blob);

			const link = document.createElement("a");
			link.href = objectUrl;
			link.download = filename;
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);

			window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);

			setDownloadedFilename(filename);
			toast.success(`Downloaded: ${filename}`);
		} catch {
			toast.error("Export failed. Please try again.");
		} finally {
			setIsExporting(false);
		}
	};

	return (
		<div
			className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
			role="dialog"
			aria-modal="true"
			aria-labelledby="export-dialog-title"
		>
			<div
				className="absolute inset-0 bg-black/50 backdrop-blur-sm"
				onClick={isExporting ? undefined : onClose}
				aria-hidden="true"
			/>

			<div className="relative z-10 w-full max-w-3xl bg-surface ring-1 ring-black/5 animate-toast-in max-h-[90vh] overflow-hidden">
				<div className="flex items-center justify-between p-6 border-b border-border">
					<div className="flex items-center gap-3">
						<div className="flex-shrink-0 rounded-full p-2 bg-cyan/20">
							<Download className="w-5 h-5 text-cyan" aria-hidden="true" />
						</div>
						<div>
							<h3
								id="export-dialog-title"
								className="text-base font-semibold text-text"
							>
								Export Scan Results
							</h3>
							<p className="text-sm text-text-dim">{scanName}</p>
						</div>
					</div>
					<button
						type="button"
						onClick={onClose}
						disabled={isExporting}
						className="p-1.5 text-text-mute hover:text-text-dim hover:bg-raised transition-colors disabled:opacity-50"
						aria-label="Close dialog"
					>
						<X className="w-4 h-4" />
					</button>
				</div>

				<div className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-148px)]">
					<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
						<div className="space-y-6">
							<div>
								<p className="text-sm font-medium text-text mb-3">Format</p>
								<div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
									{(["json", "csv", "ndjson"] as ExportFormat[]).map((fmt) => {
										const Icon = fmt === "json" ? FileJson : FileText;
										const isSelected = selectedFormat === fmt;
										return (
											<label
												key={fmt}
												className={`flex items-center gap-3 p-3 border cursor-pointer transition-colors ${
													isSelected
														? "border-cyan bg-cyan/10"
														: "border-border hover:border-border"
												}`}
											>
												<input
													type="radio"
													name="export-format"
													value={fmt}
													checked={isSelected}
													onChange={() => {
														setDownloadedFilename(null);
														setSelectedFormat(fmt);
													}}
													className="accent-cyan"
												/>
												<Icon
													className={`w-4 h-4 ${isSelected ? "text-cyan" : "text-text-mute"}`}
													aria-hidden="true"
												/>
												<span
													className={`text-sm font-medium ${isSelected ? "text-cyan" : "text-text"}`}
												>
													{fmt.toUpperCase()}
												</span>
											</label>
										);
									})}
								</div>
							</div>

							<div>
								<p className="text-sm font-medium text-text mb-3">
									Data Included
								</p>
								<div className="space-y-2">
									{INCLUDE_ITEMS.map(({ key, label, desc }) => (
										<label
											key={key}
											className="flex items-start gap-3 p-3 hover:bg-void cursor-pointer transition-colors border border-border/50"
										>
											<input
												type="checkbox"
												checked={includes[key]}
												onChange={() => toggleInclude(key)}
												className="mt-0.5 accent-cyan"
											/>
											<div>
												<p className="text-sm font-medium text-text">{label}</p>
												<p className="text-xs text-text-dim">{desc}</p>
											</div>
										</label>
									))}
								</div>
							</div>
						</div>

						<div className="space-y-4">
							<div className="bg-abyss/60 border border-border p-4">
								<p className="text-xs uppercase tracking-wide text-text-mute mb-2">
									Export Summary
								</p>
								<div className="space-y-1 text-sm text-text-dim">
									<p>
										Sections selected:{" "}
										<span className="text-text font-medium">
											{selectedTopLevelCount}
										</span>
									</p>
									<p>
										Record count:{" "}
										<span className="text-text font-medium">
											{flatRecords.length}
										</span>
									</p>
									<p>
										Format:{" "}
										<span className="text-cyan font-medium">
											{selectedFormat.toUpperCase()}
										</span>
									</p>
								</div>
							</div>

							<div className="border border-border p-4">
								<p className="text-sm font-medium text-text mb-3">
									Preview (first 3 rows)
								</p>
								{previewRecords.length === 0 ? (
									<p className="text-xs text-text-dim">
										No rows to preview for the selected fields.
									</p>
								) : (
									<div className="space-y-2">
										{previewRecords.map((row, idx) => (
											<pre
												key={`${row.record_type ?? "row"}-${idx}`}
												className="text-[11px] leading-5 text-text-dim bg-abyss/60 border border-border/50 p-2 overflow-x-auto"
											>
												{JSON.stringify(row, null, 2)}
											</pre>
										))}
									</div>
								)}
							</div>

							{downloadedFilename && (
								<div className="p-3 border border-plasma/30 bg-plasma/10 text-sm text-plasma">
									Downloaded: {downloadedFilename}
								</div>
							)}
						</div>
					</div>
				</div>

				<div className="flex gap-3 justify-end px-6 py-4 border-t border-border bg-surface">
					<button
						type="button"
						onClick={onClose}
						disabled={isExporting}
						className="px-4 py-2 text-sm font-medium text-text bg-abyss hover:bg-border disabled:opacity-50 transition-colors"
					>
						Cancel
					</button>
					<button
						type="button"
						onClick={handleExport}
						disabled={isExporting || selectedTopLevelCount === 0}
						className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-cyan hover:bg-cyan-dim text-text disabled:opacity-60 transition-colors"
					>
						{isExporting ? (
							<>
								<Loader2 className="w-4 h-4 animate-spin" />
								Exporting...
							</>
						) : (
							<>
								<Download className="w-4 h-4" />
								Export ({flatRecords.length})
							</>
						)}
					</button>
				</div>
			</div>
		</div>
	);
}
