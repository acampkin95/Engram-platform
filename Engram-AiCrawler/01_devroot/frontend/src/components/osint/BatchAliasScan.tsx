import { useState, useEffect, useMemo } from'react';
import { Loader2, Download, ArrowUpDown, Users } from'lucide-react';
import { useToast } from'../Toast';
import { api } from'../../lib/api';

interface PlatformInfo {
 name: string;
 base_url: string;
 profile_url_template: string;
}

interface PlatformResult {
 found: boolean;
 url: string;
 confidence: number;
}

interface BatchResponse {
 results: Record<string, Record<string, PlatformResult>>;
 summary: {
 total_usernames: number;
 total_found: number;
 total_errors: number;
 };
 errors: { username: string; error: string }[];
}

interface FlatRow {
 username: string;
 platform: string;
 found: boolean;
 url: string;
 confidence: number;
}

type SortKey ='username' |'platform' |'found' |'confidence';
type SortDir ='asc' |'desc';

export default function BatchAliasScan() {
 const toast = useToast();
 const [input, setInput] = useState('');
 const [platforms, setPlatforms] = useState<PlatformInfo[]>([]);
 const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
 const [isScanning, setIsScanning] = useState(false);
 const [progress, setProgress] = useState({ current: 0, total: 0 });
 const [rows, setRows] = useState<FlatRow[]>([]);
 const [sortKey, setSortKey] = useState<SortKey>('username');
 const [sortDir, setSortDir] = useState<SortDir>('asc');

 useEffect(() => {
 api
 .get<{ platforms: PlatformInfo[]; count: number }>('/osint/platforms')
 .then((res) => setPlatforms(res.data.platforms))
 .catch(() => {});
 }, []);

 const usernames = useMemo(
 () =>
 input
 .split('\n')
 .map((l) => l.trim())
 .filter(Boolean),
 [input]
 );

 const togglePlatform = (name: string) => {
 setSelectedPlatforms((prev) =>
 prev.includes(name) ? prev.filter((p) => p !== name) : [...prev, name]
 );
 };

 const handleScan = async () => {
 if (usernames.length === 0) {
 toast.warning('Enter at least one username');
 return;
 }

 setIsScanning(true);
 setRows([]);
 setProgress({ current: 0, total: usernames.length });

 try {
 const chunkSize = 10;
 const allRows: FlatRow[] = [];
 let processed = 0;

 for (let i = 0; i < usernames.length; i += chunkSize) {
 const chunk = usernames.slice(i, i + chunkSize);
 const response = await api.post<BatchResponse>('/osint/alias/batch-discover', {
 usernames: chunk,
 platforms: selectedPlatforms.length > 0 ? selectedPlatforms : undefined,
 });

 const data = response.data;
 for (const [username, platformMap] of Object.entries(data.results)) {
 for (const [platform, result] of Object.entries(platformMap)) {
 allRows.push({
 username,
 platform,
 found: result.found,
 url: result.url,
 confidence: result.confidence,
 });
 }
 }

 if (data.errors.length > 0) {
 for (const err of data.errors) {
 toast.error(`Failed: ${err.username}`, { detail: err.error });
 }
 }

 processed += chunk.length;
 setProgress({ current: processed, total: usernames.length });
 setRows([...allRows]);
 }

 toast.success(
 `Batch scan complete: ${allRows.filter((r) => r.found).length} aliases found across ${usernames.length} usernames`
 );
 } catch (error) {
 if (error instanceof Error) {
 toast.error(error.message);
 } else {
 toast.error('Batch scan failed');
 }
 } finally {
 setIsScanning(false);
 }
 };

 const handleSort = (key: SortKey) => {
 if (sortKey === key) {
 setSortDir((prev) => (prev ==='asc' ?'desc' :'asc'));
 } else {
 setSortKey(key);
 setSortDir('asc');
 }
 };

 const sortedRows = useMemo(() => {
 const sorted = [...rows];
 sorted.sort((a, b) => {
 let cmp = 0;
 switch (sortKey) {
 case'username':
 cmp = a.username.localeCompare(b.username);
 break;
 case'platform':
 cmp = a.platform.localeCompare(b.platform);
 break;
 case'found':
 cmp = Number(a.found) - Number(b.found);
 break;
 case'confidence':
 cmp = a.confidence - b.confidence;
 break;
 }
 return sortDir ==='asc' ? cmp : -cmp;
 });
 return sorted;
 }, [rows, sortKey, sortDir]);

 const exportCsv = () => {
 if (rows.length === 0) {
 toast.warning('No results to export');
 return;
 }

 const header ='Username,Platform,Found,URL,Confidence';
 const csvRows = rows.map(
 (r) =>
 `${r.username},${r.platform},${r.found},"${r.url}",${r.confidence.toFixed(2)}`
 );
 const content = [header, ...csvRows].join('\n');
 const blob = new Blob([content], { type:'text/csv' });
 const url = URL.createObjectURL(blob);
 const a = document.createElement('a');
 a.href = url;
 a.download = `batch-alias-scan-${Date.now()}.csv`;
 a.click();
 URL.revokeObjectURL(url);
 toast.success(`Exported ${rows.length} rows as CSV`);
 };

 const progressPct =
 progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

 const SortHeader = ({ label, field }: { label: string; field: SortKey }) => (
 <button
 type="button"
 onClick={() => handleSort(field)}
 className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-text-dim hover:text-text transition-colors"
 >
 {label}
 <ArrowUpDown
 className={`w-3 h-3 ${sortKey === field ?'text-cyan' :'opacity-40'}`}
 />
 </button>
 );

 return (
 <div className="space-y-6">
 <div className="bg-surface p-6 border border-border space-y-5">
 <textarea
 value={input}
 onChange={(e) => setInput(e.target.value)}
 placeholder="Enter usernames, one per line"
 rows={6}
 className="w-full px-4 py-3 bg-void border border-border focus:outline-none focus:border-cyan focus:ring-2 focus:ring-cyan/10 transition-all text-text placeholder-text-mute resize-y font-mono text-sm"
 />

 {platforms.length > 0 && (
 <div>
 <span className="block text-sm font-medium text-text mb-3">
 Filter Platforms
 </span>
 <div className="flex flex-wrap gap-2">
 {platforms.map((p) => (
 <button
 key={p.name}
 type="button"
 onClick={() => togglePlatform(p.name)}
 className={`px-4 py-2 text-sm font-medium rounded-full border transition-all ${
 selectedPlatforms.includes(p.name)
 ?'bg-cyan/10 text-cyan border-cyan/30'
 :'bg-surface text-text-dim border-border hover:border-cyan/30'
 }`}
 >
 {p.name}
 </button>
 ))}
 </div>
 </div>
 )}

 <div className="flex items-center gap-4">
 <button
 type="button"
 onClick={handleScan}
 disabled={usernames.length === 0 || isScanning}
 className="flex items-center gap-2 px-8 py-3 bg-cyan hover:bg-cyan-dim disabled:bg-border text-text font-medium transition-all shadow-cyan/25 disabled:shadow-none disabled:cursor-not-allowed"
 >
 {isScanning ? (
 <>
 <Loader2 className="w-5 h-5 animate-spin" />
 Scanning...
 </>
 ) : (
 <>
 <Users className="w-5 h-5" />
 Scan All
 </>
 )}
 </button>

 {usernames.length > 0 && !isScanning && (
 <span className="text-sm text-text-dim">
 {usernames.length} username{usernames.length !== 1 ?'s' :''} queued
 </span>
 )}
 </div>

 {isScanning && (
 <div className="space-y-2">
 <div className="flex items-center justify-between text-sm text-text-dim">
 <span>
 Scanning {progress.current}/{progress.total} usernames...
 </span>
 <span className="font-medium">{progressPct}%</span>
 </div>
 <div className="h-2 bg-abyss rounded-full overflow-hidden">
 <div
 className="h-full bg-cyan rounded-full transition-all duration-300"
 style={{ width: `${progressPct}%`}}
 />
 </div>
 </div>
 )}
 </div>

 {rows.length > 0 && (
 <div className="bg-surface border border-border overflow-hidden">
 <div className="flex items-center justify-between px-6 py-4 border-b border-border">
 <h3 className="text-sm font-semibold text-text">
 Results ({rows.length} rows)
 </h3>
 <button
 type="button"
 onClick={exportCsv}
 className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-void hover:bg-abyss text-text border border-border transition-colors"
 >
 <Download className="w-4 h-4" />
 Export CSV
 </button>
 </div>

 <div className="overflow-x-auto">
 <table className="w-full text-sm">
 <thead>
 <tr className="border-b border-border bg-void">
 <th className="px-6 py-3 text-left">
 <SortHeader label="Username" field="username" />
 </th>
 <th className="px-6 py-3 text-left">
 <SortHeader label="Platform" field="platform" />
 </th>
 <th className="px-6 py-3 text-left">
 <SortHeader label="Found" field="found" />
 </th>
 <th className="px-6 py-3 text-left">URL</th>
 <th className="px-6 py-3 text-left">
 <SortHeader label="Confidence" field="confidence" />
 </th>
 </tr>
 </thead>
 <tbody className="divide-y divide-border">
 {sortedRows.map((row, i) => (
 <tr
 key={`${row.username}-${row.platform}-${i}`}
 className="hover:bg-void transition-colors"
 >
 <td className="px-6 py-3 font-medium text-text">
 {row.username}
 </td>
 <td className="px-6 py-3">
 <span className="px-2.5 py-0.5 bg-abyss text-text text-xs font-medium rounded-full">
 {row.platform}
 </span>
 </td>
 <td className="px-6 py-3">
 {row.found ? (
 <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-plasma/10 text-plasma text-xs font-medium rounded-full">
 Yes
 </span>
 ) : (
 <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-abyss text-text-dim text-xs font-medium rounded-full">
 No
 </span>
 )}
 </td>
 <td className="px-6 py-3 max-w-xs truncate">
 {row.url ? (
 <a
 href={row.url}
 target="_blank"
 rel="noopener noreferrer"
 className="text-cyan hover:text-cyan hover:underline"
 >
 {row.url}
 </a>
 ) : (
 <span className="text-text-mute">—</span>
 )}
 </td>
 <td className="px-6 py-3">
 <div className="flex items-center gap-2">
 <div className="w-16 h-1.5 bg-abyss rounded-full overflow-hidden">
 <div
 className={`h-full rounded-full ${
 row.confidence >= 0.7
 ?'bg-plasma'
 : row.confidence >= 0.4
 ?'bg-volt'
 :'bg-neon-r'
 }`}
 style={{ width: `${row.confidence * 100}%`}}
 />
 </div>
 <span className="text-xs font-medium text-text-dim w-10 text-right">
 {(row.confidence * 100).toFixed(0)}%
 </span>
 </div>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </div>
 )}
 </div>
 );
}
