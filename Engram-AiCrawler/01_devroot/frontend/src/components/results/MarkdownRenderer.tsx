import { useState } from'react';
import ReactMarkdown from'react-markdown';
import { Copy, Check } from'lucide-react';

interface MarkdownRendererProps {
 content: string;
}

function CopyButton({ text }: { text: string }) {
 const [copied, setCopied] = useState(false);

 const handleCopy = async () => {
 await navigator.clipboard.writeText(text);
 setCopied(true);
 setTimeout(() => setCopied(false), 2000);
 };

 return (
 <button
 type="button"
 onClick={handleCopy}
 className="p-1.5 text-text-mute hover:text-text-mute hover:bg-border transition-colors"
 title="Copy code"
 >
 {copied ? <Check size={14} /> : <Copy size={14} />}
 </button>
 );
}

export default function MarkdownRenderer({ content }: MarkdownRendererProps) {
 return (
  <div className="prose prose-sm prose-invert max-w-none">
 <ReactMarkdown
 components={{
 h1: ({ children }) => (
 <h1 className="text-2xl font-bold text-text mt-8 mb-4 pb-2 border-b border-border">
 {children}
 </h1>
 ),
 h2: ({ children }) => (
 <h2 className="text-xl font-semibold text-text mt-6 mb-3">
 {children}
 </h2>
 ),
 h3: ({ children }) => (
 <h3 className="text-lg font-semibold text-text mt-5 mb-2">
 {children}
 </h3>
 ),
 h4: ({ children }) => (
 <h4 className="text-base font-semibold text-text mt-4 mb-2">
 {children}
 </h4>
 ),
 p: ({ children }) => (
 <p className="text-text mb-4 leading-relaxed">
 {children}
 </p>
 ),
 a: ({ href, children }) => (
 <a
 href={href}
 target="_blank"
 rel="noopener noreferrer"
 className="text-cyan hover:underline"
 >
 {children}
 </a>
 ),
 ul: ({ children }) => (
 <ul className="list-disc list-inside mb-4 space-y-1 text-text">
 {children}
 </ul>
 ),
 ol: ({ children }) => (
 <ol className="list-decimal list-inside mb-4 space-y-1 text-text">
 {children}
 </ol>
 ),
 li: ({ children }) => (
 <li className="text-text">{children}</li>
 ),
 blockquote: ({ children }) => (
 <blockquote className="border-l-4 border-cyan pl-4 my-4 italic text-text-dim">
 {children}
 </blockquote>
 ),
 code: ({ children, className }) => {
 const isBlock = className?.startsWith('language-');
 const codeText = String(children).replace(/\n$/,'');

 if (isBlock) {
 const lang = className?.replace('language-','') ??'';
 return (
 <div className="relative my-4 overflow-hidden">
  <div className="flex items-center justify-between bg-raised px-4 py-2">
 <span className="text-xs text-text-mute font-mono">{lang ||'code'}</span>
 <CopyButton text={codeText} />
 </div>
 <pre className="bg-void text-text p-4 overflow-x-auto text-sm font-mono leading-relaxed">
 <code>{codeText}</code>
 </pre>
 </div>
 );
 }

 return (
 <code className="bg-abyss text-text px-1.5 py-0.5 text-sm font-mono">
 {children}
 </code>
 );
 },
 pre: ({ children }) => <>{children}</>,
 table: ({ children }) => (
 <div className="overflow-x-auto my-4">
 <table className="min-w-full divide-y divide-border border border-border">
 {children}
 </table>
 </div>
 ),
 thead: ({ children }) => (
 <thead className="bg-void">{children}</thead>
 ),
 tbody: ({ children }) => (
  <tbody className="bg-surface divide-y divide-border">
 {children}
 </tbody>
 ),
 tr: ({ children }) => <tr>{children}</tr>,
 th: ({ children }) => (
  <th className="px-4 py-3 text-left text-xs font-medium text-text-mute uppercase tracking-wider">
 {children}
 </th>
 ),
 td: ({ children }) => (
 <td className="px-4 py-3 text-sm text-text">{children}</td>
 ),
 hr: () => (
 <hr className="my-6 border-border" />
 ),
 strong: ({ children }) => (
 <strong className="font-semibold text-text">{children}</strong>
 ),
 em: ({ children }) => (
 <em className="italic text-text">{children}</em>
 ),
 }}
 >
 {content}
 </ReactMarkdown>
 </div>
 );
}
