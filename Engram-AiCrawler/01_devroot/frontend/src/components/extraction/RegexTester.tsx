import { useState, useEffect, useCallback, useRef } from'react';
import { Code, Copy, CheckCircle, AlertCircle, Plus } from'lucide-react';

interface RegexTesterProps {
 initialPattern?: string;
 initialContent?: string;
 onPatternSelect?: (pattern: string, name: string) => void;
}

interface MatchResult {
 match: string;
 index: number;
 groups: Record<string, string>;
}

const BUILTIN_TEMPLATES: Record<string, { pattern: string; name: string }> = {
 email: {
 pattern:'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}',
 name:'Email',
 },
 phone: {
 pattern:'\\(?\\d{3}\\)?[-. ]?\\d{3}[-. ]?\\d{4}',
 name:'Phone (US)',
 },
 url: {
 pattern:'https?://[\\w\\-]+(\\.[\\w\\-]+)+[/#?]?.*$',
 name:'URL',
 },
 currency: {
 pattern:'[\\$\\€\\£]\\s?\\d{1,3}(?:,\\d{3})*(?:\\.\\d{2})?',
 name:'Currency',
 },
 date: {
 pattern:'\\d{4}-\\d{2}-\\d{2}|\\d{2}/\\d{2}/\\d{4}',
 name:'Date (ISO/US)',
 },
 sku: {
 pattern:'[A-Z]{2,4}-\\d{4,6}',
 name:'SKU',
 },
};

const DEFAULT_TEST_CONTENT = `Product price: $1,299.99
Sale price: €849.00
Contact: support@example.com
Sales: sales@company.org
Phone: (555) 123-4567
Alt phone: 800-555-0199
Website: https://www.example.com/products
API: https://api.example.com/v1/items
Date: 2024-01-15 or 01/15/2024
Order ID: SKU-123456
Part: ABCD-9876`;

function runRegex(
 pattern: string,
 content: string
): { matches: MatchResult[]; error: string | null } {
 if (!pattern.trim()) return { matches: [], error: null };

 let regex: RegExp;
 try {
 regex = new RegExp(pattern,'gm');
 } catch (e) {
 return { matches: [], error: (e as Error).message };
 }

 const matches: MatchResult[] = [];
 // Cap iterations to guard against catastrophic backtracking on user-supplied patterns
 const cap = 10_000;
 let iterations = 0;
 let m = regex.exec(content);

 while (m !== null && iterations < cap) {
 iterations++;
 const groups: Record<string, string> = {};
 if (m.groups) {
 for (const [key, val] of Object.entries(m.groups)) {
 if (val !== undefined) groups[key] = val;
 }
 }
 matches.push({ match: m[0], index: m.index, groups });
 // Advance past zero-length matches to prevent an infinite loop
 if (m[0].length === 0) regex.lastIndex++;
 m = regex.exec(content);
 }

 return { matches, error: null };
}

function buildHighlightedSegments(
 text: string,
 matches: MatchResult[]
): { text: string; highlighted: boolean; id: string }[] {
 if (matches.length === 0) return [{ text, highlighted: false, id:'all' }];

 const segments: { text: string; highlighted: boolean; id: string }[] = [];
 let cursor = 0;

 for (const { match, index } of matches) {
 if (index > cursor) {
 segments.push({
 text: text.slice(cursor, index),
 highlighted: false,
 id: `pre-${index}`,
 });
 }
 segments.push({
 text: match,
 highlighted: true,
 id: `match-${index}-${match.length}`,
 });
 cursor = index + match.length;
 }

 if (cursor < text.length) {
 segments.push({ text: text.slice(cursor), highlighted: false, id: `tail-${cursor}`});
 }

 return segments;
}

export default function RegexTester({
 initialPattern ='',
 initialContent = DEFAULT_TEST_CONTENT,
 onPatternSelect,
}: RegexTesterProps) {
 const [pattern, setPattern] = useState(initialPattern);
 const [debouncedPattern, setDebouncedPattern] = useState(initialPattern);
 const [content, setContent] = useState(initialContent);
 const [copied, setCopied] = useState(false);
 const [activeTemplate, setActiveTemplate] = useState<string | null>(null);

 const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

 useEffect(() => {
 if (debounceTimer.current) clearTimeout(debounceTimer.current);
 debounceTimer.current = setTimeout(() => setDebouncedPattern(pattern), 300);
 return () => {
 if (debounceTimer.current) clearTimeout(debounceTimer.current);
 };
 }, [pattern]);

 const { matches, error } = runRegex(debouncedPattern, content);

 const namedGroups: Record<string, string[]> = {};
 for (const m of matches) {
 for (const [key, val] of Object.entries(m.groups)) {
 if (!namedGroups[key]) namedGroups[key] = [];
 namedGroups[key].push(val);
 }
 }
 const hasNamedGroups = Object.keys(namedGroups).length > 0;

 const highlightedSegments = buildHighlightedSegments(content, matches);

 const handleTemplateClick = useCallback((key: string) => {
 setPattern(BUILTIN_TEMPLATES[key].pattern);
 setActiveTemplate(key);
 }, []);

 const handleCopy = useCallback(async () => {
 if (!pattern) return;
 await navigator.clipboard.writeText(pattern).then(() => {
 setCopied(true);
 setTimeout(() => setCopied(false), 2000);
 }, () => undefined);
 }, [pattern]);

 const handleAddToSchema = useCallback(() => {
 if (!pattern || !onPatternSelect) return;
 const name =
 activeTemplate ? BUILTIN_TEMPLATES[activeTemplate].name :'Custom Pattern';
 onPatternSelect(pattern, name);
 }, [pattern, activeTemplate, onPatternSelect]);

 return (
 <div className="border border-border bg-surface">
 <div className="flex items-center gap-2 border-b border-border px-4 py-3">
 <Code className="h-4 w-4 text-cyan" />
 <h2 className="text-sm font-semibold text-text">
 Regex Pattern Tester
 </h2>
 </div>

 <div className="space-y-4 p-4">
 <div>
 <label
 htmlFor="regex-pattern"
 className="mb-1.5 block text-xs font-medium text-text-dim"
 >
 Pattern
 </label>
 <input
 id="regex-pattern"
 type="text"
 value={pattern}
 onChange={(e) => {
 setPattern(e.target.value);
 setActiveTemplate(null);
 }}
 spellCheck={false}
 placeholder="Enter a regex pattern…"
 className={[
'w-full border px-3 py-2 font-mono text-sm',
'bg-void text-text placeholder-text-mute',
'focus:outline-none focus:ring-2 focus:ring-cyan',
'',
 error
 ?'border-neon-r'
 :'border-border',
 ].join('')}
 />

 {error && (
 <div className="mt-1.5 flex items-start gap-1.5 text-xs text-neon-r">
 <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
 <span>{error}</span>
 </div>
 )}
 </div>

 <div>
 <p className="mb-2 text-xs font-medium text-text-dim">
 Built-in Templates
 </p>
 <div className="flex flex-wrap gap-2">
 {Object.entries(BUILTIN_TEMPLATES).map(([key, tpl]) => (
 <button
 key={key}
 type="button"
 onClick={() => handleTemplateClick(key)}
 className={[
' px-2.5 py-1 text-xs font-medium transition-colors',
'focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan',
 activeTemplate === key
 ?'bg-cyan text-text'
 :'border border-border bg-surface text-text hover:bg-void',
 ].join('')}
 >
 {tpl.name}
 </button>
 ))}
 </div>
 </div>

 <div>
 <label
 htmlFor="regex-content"
 className="mb-1.5 block text-xs font-medium text-text-dim"
 >
 Test Content
 </label>
 <textarea
 id="regex-content"
 value={content}
 onChange={(e) => setContent(e.target.value)}
 rows={6}
 spellCheck={false}
 placeholder="Paste content to test your pattern…"
 className={[
'w-full resize-y border px-3 py-2 font-mono text-sm',
'bg-void text-text placeholder-text-mute',
'focus:outline-none focus:ring-2 focus:ring-cyan',
'border-border',
'',
 ].join('')}
 />
 </div>

 {debouncedPattern && !error && (
 <div>
 <p className="mb-1.5 text-xs font-medium text-text-dim">
 Highlighted Preview
 </p>
 <div
 className={[
'min-h-[4rem] whitespace-pre-wrap border px-3 py-2 font-mono text-sm leading-relaxed',
'border-border bg-void text-text',
'',
 ].join('')}
 >
 {highlightedSegments.map((seg) =>
 seg.highlighted ? (
 <mark
 key={seg.id}
 className="bg-volt/20 px-0.5 font-semibold text-void"
 >
 {seg.text}
 </mark>
 ) : (
 <span key={seg.id}>{seg.text}</span>
 )
 )}
 </div>
 </div>
 )}

 <div>
 <div className="mb-1.5 flex items-center justify-between">
 <p className="text-xs font-medium text-text-dim">Matches</p>
 <span
 className={[
'rounded-full px-2 py-0.5 text-xs font-semibold',
 matches.length > 0
 ?'bg-plasma/20 text-plasma'
 :'bg-abyss text-text-dim',
 ].join('')}
 >
 {matches.length} found
 </span>
 </div>

 {matches.length > 0 ? (
 <ul className="max-h-40 divide-y divide-border overflow-y-auto border border-border">
 {matches.map((m, ordinal) => (
 <li
 key={`${m.index}-${m.match}`}
 className="flex items-center gap-2 px-3 py-1.5 hover:bg-void"
 >
 <span className="shrink-0 font-mono text-xs text-text-mute">
 {String(ordinal + 1).padStart(2,'0')}
 </span>
 <span className="flex-1 truncate font-mono text-sm font-medium text-text">
 {m.match}
 </span>
 <span className="shrink-0 text-xs text-text-mute">
 @{m.index}
 </span>
 </li>
 ))}
 </ul>
 ) : (
 <div className="border border-dashed border-border px-4 py-3 text-center text-xs text-text-mute">
 {debouncedPattern && !error ?'No matches found' :'Enter a pattern to see matches'}
 </div>
 )}
 </div>

 {hasNamedGroups && (
 <div>
 <p className="mb-1.5 text-xs font-medium text-text-dim">
 Named Groups
 </p>
 <ul className="space-y-1 border border-border px-3 py-2">
 {Object.entries(namedGroups).map(([name, values]) => (
 <li key={name} className="flex flex-wrap items-baseline gap-1.5 text-xs">
 <span className="font-mono font-semibold text-cyan">
 {name}:
 </span>
 {values.map((v) => (
 <span
 key={`${name}-${v}`}
 className="bg-abyss px-1.5 py-0.5 font-mono text-text"
 >
 {v}
 </span>
 ))}
 </li>
 ))}
 </ul>
 </div>
 )}

 <div className="flex flex-wrap gap-2 border-t border-border pt-4">
 <button
 type="button"
 onClick={handleCopy}
 disabled={!pattern}
 className={[
'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors',
'focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan',
'border border-border bg-surface text-text hover:bg-void',
'',
'disabled:cursor-not-allowed disabled:opacity-50',
 ].join('')}
 >
 {copied ? (
 <>
 <CheckCircle className="h-3.5 w-3.5 text-plasma" />
 Copied!
 </>
 ) : (
 <>
 <Copy className="h-3.5 w-3.5" />
 Copy Pattern
 </>
 )}
 </button>

 {onPatternSelect && (
 <button
 type="button"
 onClick={handleAddToSchema}
 disabled={!pattern || !!error}
 className={[
'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors',
'focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan',
'bg-cyan text-text hover:bg-cyan-dim',
'',
'disabled:cursor-not-allowed disabled:opacity-50',
 ].join('')}
 >
 <Plus className="h-3.5 w-3.5" />
 Add to Schema
 </button>
 )}
 </div>
 </div>
 </div>
 );
}
