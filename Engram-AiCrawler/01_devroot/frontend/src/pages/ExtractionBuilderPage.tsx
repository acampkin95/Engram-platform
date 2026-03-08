import { ChevronDown, FolderOpen, RefreshCw, Save } from "lucide-react";
import { Alert, Button, Card, CardBody, Input } from "@/components/ui";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "../components/Toast";
import HTMLTreeSelector, {
	type HtmlTreeNode,
} from "../components/extraction/HTMLTreeSelector";
import RegexTester from "../components/extraction/RegexTester";
import SchemaDesigner, {
	type ExtractionSchema,
} from "../components/extraction/SchemaDesigner";
import ScreenshotPreview from "../components/extraction/ScreenshotPreview";
import TemplateLoadDialog from "../components/extraction/TemplateLoadDialog";
import TemplateSaveDialog from "../components/extraction/TemplateSaveDialog";
import type { ExtractionTemplate, StrategyType } from "../lib/schemas";

type Strategy = "css" | "regex" | "llm" | "cosine";

const STRATEGIES: { value: Strategy; label: string }[] = [
	{ value: "css", label: "CSS" },
	{ value: "regex", label: "Regex" },
	{ value: "llm", label: "LLM" },
	{ value: "cosine", label: "Cosine" },
];

const DEFAULT_SCHEMA: ExtractionSchema = {
	name: "",
	baseSelector: "",
	fields: [],
};

const MIN_LEFT_PX = 280;
const MIN_RIGHT_PX = 280;

export default function ExtractionBuilderPage() {
	const toast = useToast();
	const [url, setUrl] = useState("");
	const [strategy, setStrategy] = useState<Strategy>("css");
	const [screenshot, setScreenshot] = useState<string | null>(null);
	const [htmlTree, setHtmlTree] = useState<HtmlTreeNode[]>([]);
	const [schema, setSchema] = useState<ExtractionSchema>(DEFAULT_SCHEMA);
	const [selectedSelector, setSelectedSelector] = useState<string | null>(null);
	const [isFetchLoading, setIsFetchLoading] = useState(false);
	const [isTestLoading, setIsTestLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [testResults, setTestResults] = useState<unknown[] | null>(null);
	const [regexPattern, setRegexPattern] = useState("");
	const [saveDialogOpen, setSaveDialogOpen] = useState(false);
	const [loadDialogOpen, setLoadDialogOpen] = useState(false);

	const [leftWidthPct, setLeftWidthPct] = useState(50);
	const [isMobile, setIsMobile] = useState(false);
	const isDragging = useRef(false);
	const containerRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const mq = window.matchMedia("(max-width: 767px)");
		setIsMobile(mq.matches);
		const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
		mq.addEventListener("change", handler);
		return () => mq.removeEventListener("change", handler);
	}, []);

	const handleMouseDown = useCallback((e: React.MouseEvent) => {
		e.preventDefault();
		isDragging.current = true;

		const onMove = (moveEvent: MouseEvent) => {
			if (!isDragging.current || !containerRef.current) return;
			const rect = containerRef.current.getBoundingClientRect();
			const totalWidth = rect.width;
			const offsetX = moveEvent.clientX - rect.left;
			const leftPx = Math.max(
				MIN_LEFT_PX,
				Math.min(offsetX, totalWidth - MIN_RIGHT_PX),
			);
			setLeftWidthPct((leftPx / totalWidth) * 100);
		};

		const onUp = () => {
			isDragging.current = false;
			document.removeEventListener("mousemove", onMove);
			document.removeEventListener("mouseup", onUp);
		};

		document.addEventListener("mousemove", onMove);
		document.addEventListener("mouseup", onUp);
	}, []);

	const handleFetch = useCallback(async () => {
		if (!url.trim()) return;
		setIsFetchLoading(true);
		setError(null);
		setScreenshot(null);
		setHtmlTree([]);
		setSelectedSelector(null);
		try {
			const res = await fetch("/api/extraction/fetch-page", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ url: url.trim() }),
			});
			if (!res.ok) {
				const body = await res.json().catch(() => ({}));
				throw new Error(
					(body as { detail?: string }).detail ?? `HTTP ${res.status}`,
				);
			}
			const data = (await res.json()) as {
				screenshot: string;
				html_tree: HtmlTreeNode[];
			};
			setScreenshot(data.screenshot);
			setHtmlTree(data.html_tree);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to fetch page");
		} finally {
			setIsFetchLoading(false);
		}
	}, [url]);

	const handleTest = useCallback(async () => {
		if (!url.trim() || schema.fields.length === 0) return;
		setIsTestLoading(true);
		setError(null);
		setTestResults(null);
		try {
			const res = await fetch("/api/extraction/preview", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ url: url.trim(), strategy, schema }),
			});
			if (!res.ok) {
				const body = await res.json().catch(() => ({}));
				throw new Error(
					(body as { detail?: string }).detail ?? `HTTP ${res.status}`,
				);
			}
			const data = (await res.json()) as { preview: unknown[] };
			setTestResults(data.preview);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Extraction test failed");
		} finally {
			setIsTestLoading(false);
		}
	}, [url, strategy, schema]);

	const handleExport = useCallback(() => {
		const json = JSON.stringify(schema, null, 2);
		const blob = new Blob([json], { type: "application/json" });
		const href = URL.createObjectURL(blob);
		const link = document.createElement("a");
		link.href = href;
		link.download = `${schema.name || "schema"}.json`;
		link.click();
		URL.revokeObjectURL(href);
	}, [schema]);

	const handleUrlKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLInputElement>) => {
			if (e.key === "Enter") handleFetch();
		},
		[handleFetch],
	);

	const handleRegexPatternSelect = useCallback((pattern: string) => {
		setRegexPattern(pattern);
	}, []);

	const currentConfig = useMemo<Record<string, unknown>>(() => {
		if (strategy === "css") return { schema };
		if (strategy === "regex") return { pattern: regexPattern };
		return {};
	}, [strategy, schema, regexPattern]);

	const handleTemplateLoad = useCallback((template: ExtractionTemplate) => {
		const st = template.strategy_type as Strategy;
		setStrategy(st);
		const cfg = template.config;
		if (st === "css" && cfg.schema) {
			setSchema(cfg.schema as ExtractionSchema);
		}
		if (st === "regex" && typeof cfg.pattern === "string") {
			setRegexPattern(cfg.pattern);
		}
	}, []);

	return (
		<div className="flex flex-col h-full bg-void">
			<div className="shrink-0 border-b border-border bg-void px-4 sm:px-6 lg:px-8 py-3 space-y-3">
				<div className="flex items-center justify-between">
					<h1 className="text-lg font-semibold text-text">
						Extraction Builder
					</h1>
					<div className="flex items-center gap-2">
						{testResults && (
							<span className="text-xs text-plasma font-medium">
								{testResults.length} result{testResults.length !== 1 ? "s" : ""}{" "}
								found
							</span>
						)}
						<Button
							variant="secondary"
							size="sm"
							onClick={() => setLoadDialogOpen(true)}
							leftIcon={<FolderOpen size={14} />}
						>
							Load
						</Button>
						<Button
							variant="primary"
							size="sm"
							onClick={() => setSaveDialogOpen(true)}
							leftIcon={<Save size={14} />}
						>
							Save
						</Button>
					</div>
				</div>

				<div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
					<div className="flex flex-1 items-center gap-2">
						<label htmlFor="extraction-url" className="sr-only">
							URL
						</label>
						<div className="flex-1">
							<Input
								id="extraction-url"
								type="url"
								value={url}
								onChange={(e) => setUrl(e.target.value)}
								onKeyDown={handleUrlKeyDown}
								placeholder="https://example.com"
							/>
						</div>
						<Button
							variant="primary"
							onClick={handleFetch}
							disabled={!url.trim()}
							loading={isFetchLoading}
							leftIcon={<RefreshCw size={15} />}
							className="shrink-0"
						>
							Fetch Page
						</Button>
					</div>

					<div className="flex items-center gap-1 border border-border bg-abyss p-1">
						{STRATEGIES.map((s) => (
							<button
								key={s.value}
								type="button"
								onClick={() => setStrategy(s.value)}
								aria-pressed={strategy === s.value}
								className={[
									" px-3 py-1 text-xs font-medium transition-colors",
									strategy === s.value
										? "bg-surface text-cyan"
										: "text-text-dim hover:text-text",
								].join("")}
							>
								{s.label}
							</button>
						))}
					</div>
				</div>

				{error && <Alert variant="danger">{error}</Alert>}
			</div>

			<div
				ref={containerRef}
				className="flex flex-col md:flex-row flex-1 overflow-auto md:overflow-hidden min-h-0"
			>
				<div
					className="flex flex-col overflow-hidden min-w-0 border-b md:border-b-0 md:border-r border-border"
					style={isMobile ? undefined : { width: `${leftWidthPct}%` }}
				>
					<div className="flex flex-col h-1/2 min-h-0 border-b border-border bg-void">
						<ScreenshotPreview
							screenshot={screenshot}
							isLoading={isFetchLoading}
						/>
					</div>

					<div className="flex flex-col flex-1 min-h-0 bg-void">
						<HTMLTreeSelector
							htmlTree={htmlTree}
							isLoading={isFetchLoading}
							selectedSelector={selectedSelector}
							onElementSelect={setSelectedSelector}
						/>
					</div>
				</div>

				<button
					type="button"
					aria-label="Resize panels"
					onMouseDown={handleMouseDown}
					className="hidden md:flex w-1.5 cursor-col-resize bg-surface hover:bg-cyan transition-colors shrink-0 active:bg-cyan"
				/>

				<div className="flex flex-col overflow-hidden min-w-0 flex-1 bg-void min-h-72 md:min-h-0">
					{isFetchLoading && !screenshot && (
						<Card className="m-3 animate-pulse">
							<CardBody className="space-y-3">
								<div className="h-5 bg-abyss/50 rounded w-1/3" />
								<div className="h-4 bg-abyss/50 rounded w-full" />
								<div className="h-4 bg-abyss/50 rounded w-3/4" />
								<div className="h-4 bg-abyss/50 rounded w-1/2" />
								<div className="h-8 bg-abyss/50 rounded w-full mt-4" />
							</CardBody>
						</Card>
					)}

					{strategy === "css" && (
						<SchemaDesigner
							schema={schema}
							selectedSelector={selectedSelector}
							isTestLoading={isTestLoading}
							onChange={setSchema}
							onExport={handleExport}
							onTest={handleTest}
						/>
					)}

					{strategy === "regex" && (
						<div className="flex flex-col h-full overflow-auto p-3">
							<RegexTester
								initialPattern={regexPattern}
								onPatternSelect={handleRegexPatternSelect}
							/>
						</div>
					)}

					{(strategy === "llm" || strategy === "cosine") && (
						<Card className="m-3 flex-1">
							<CardBody className="flex flex-col items-center justify-center h-full gap-3 text-text-mute">
								<ChevronDown size={28} className="opacity-30" />
								<div className="text-center max-w-xs">
									<p className="text-sm font-medium text-text-dim mb-1">
										{strategy === "llm"
											? "LLM Extraction"
											: "Cosine Similarity"}
									</p>
									<p className="text-xs leading-relaxed">
										Configure this strategy via the settings panel. The backend
										handles all{""}
										{strategy === "llm" ? "LLM prompting" : "semantic matching"}{" "}
										automatically.
									</p>
								</div>
							</CardBody>
						</Card>
					)}

					{testResults && testResults.length > 0 && (
						<Card className="border-t border-border mx-3 mb-3">
							<CardBody>
								<p className="text-xs font-semibold text-text-dim mb-2 uppercase tracking-wider">
									Extraction Preview
								</p>
								<div className="max-h-48 overflow-auto border border-border">
									<pre className="p-3 text-xs text-text font-mono whitespace-pre-wrap">
										{JSON.stringify(testResults.slice(0, 5), null, 2)}
									</pre>
								</div>
							</CardBody>
						</Card>
					)}
				</div>
			</div>

			<TemplateSaveDialog
				open={saveDialogOpen}
				strategyType={strategy as StrategyType}
				config={currentConfig}
				onClose={() => setSaveDialogOpen(false)}
				onSaved={() => {
					setSaveDialogOpen(false);
					toast.success("Template saved successfully");
				}}
			/>

			<TemplateLoadDialog
				open={loadDialogOpen}
				onClose={() => setLoadDialogOpen(false)}
				onLoad={handleTemplateLoad}
			/>
		</div>
	);
}
