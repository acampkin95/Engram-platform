import { useState, useCallback } from'react';
import { ChevronRight, ChevronDown, MousePointerClick, Loader2, TreePine } from'lucide-react';

export interface HtmlTreeNode {
 tag: string;
 id?: string;
 classes?: string[];
 children?: HtmlTreeNode[];
 text?: string;
 path?: string;
}

interface HTMLTreeSelectorProps {
 htmlTree: HtmlTreeNode[];
 isLoading: boolean;
 selectedSelector: string | null;
 onElementSelect: (selector: string) => void;
}

function buildSelector(node: HtmlTreeNode): string {
 let selector = node.tag;
 if (node.id) {
 selector += `#${node.id}`;
 } else if (node.classes && node.classes.length > 0) {
 selector += `.${node.classes[0]}`;
 }
 return selector;
}

interface TreeNodeProps {
 node: HtmlTreeNode;
 depth: number;
 selectedSelector: string | null;
 onSelect: (selector: string, node: HtmlTreeNode) => void;
}

function TreeNode({ node, depth, selectedSelector, onSelect }: TreeNodeProps) {
 const [expanded, setExpanded] = useState(depth < 2);
 const hasChildren = node.children && node.children.length > 0;
 const selector = buildSelector(node);
 const isSelected = selectedSelector === selector;

 const handleToggle = useCallback((e: React.MouseEvent) => {
 e.stopPropagation();
 setExpanded((prev) => !prev);
 }, []);

 const handleSelect = useCallback(() => {
 onSelect(selector, node);
 }, [selector, node, onSelect]);

 const labelParts: string[] = [node.tag];
 if (node.id) labelParts.push(`#${node.id}`);
 if (node.classes && node.classes.length > 0) {
 labelParts.push(`.${node.classes.slice(0, 2).join('.')}`);
 }
 const label = labelParts.join('');
 const preview = node.text ? `"${node.text.slice(0, 24)}${node.text.length > 24 ?'…' :''}"`:'';

 return (
 <li>
 <div className="flex items-center group" style={{ paddingLeft: `${depth * 12}px`}}>
 <button
 type="button"
 className={[
'p-0.5 shrink-0 transition-colors',
 hasChildren ?'visible text-text-mute hover:text-text-dim' :'invisible',
 ].join('')}
 onClick={handleToggle}
 aria-label={expanded ?'Collapse' :'Expand'}
 >
 {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
 </button>

 <button
 type="button"
 className={[
'flex-1 flex items-center gap-1 px-1 py-0.5 text-xs transition-colors text-left min-w-0',
 isSelected
 ?'bg-cyan/20 text-cyan'
 :'hover:bg-raised/60 text-text',
 ].join('')}
 onClick={handleSelect}
 >
 <span className="font-mono font-semibold text-cyan shrink-0">
 {node.tag}
 </span>

 {node.id && (
 <span className="font-mono text-volt shrink-0">#{node.id}</span>
 )}

 {node.classes && node.classes.length > 0 && (
 <span className="font-mono text-plasma truncate shrink-0">
 .{node.classes.slice(0, 2).join('.')}
 </span>
 )}

 {preview && (
 <span className="text-text-mute truncate italic">{preview}</span>
 )}
 </button>

 <button
 type="button"
 title={`Select: ${selector}`}
 onClick={(e) => { e.stopPropagation(); onSelect(selector, node); }}
 className="opacity-0 group-hover:opacity-100 p-0.5 text-cyan hover:text-cyan transition-opacity shrink-0"
 >
 <MousePointerClick size={11} />
 </button>
 </div>

 {hasChildren && expanded && (
 <ul>
 {node.children!.map((child, childIdx) => {
 const childKey = `${label}-${child.tag}${child.id ? `#${child.id}`:''}${child.classes?.[0] ? `.${child.classes[0]}`:''}-${childIdx}`;
 return (
 <TreeNode
 key={childKey}
 node={child}
 depth={depth + 1}
 selectedSelector={selectedSelector}
 onSelect={onSelect}
 />
 );
 })}
 </ul>
 )}
 </li>
 );
}

export default function HTMLTreeSelector({
 htmlTree,
 isLoading,
 selectedSelector,
 onElementSelect,
}: HTMLTreeSelectorProps) {
 const handleSelect = useCallback(
 (selector: string, _node: HtmlTreeNode) => {
 onElementSelect(selector);
 },
 [onElementSelect]
 );

 return (
 <div className="flex flex-col h-full">
 <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
 <span className="text-xs font-semibold text-text-dim uppercase tracking-wider">
 HTML Element Tree
 </span>
 {selectedSelector && (
 <span className="font-mono text-xs text-cyan truncate max-w-[160px]" title={selectedSelector}>
 {selectedSelector}
 </span>
 )}
 </div>

 <div className="flex-1 overflow-auto min-h-0 py-1">
 {isLoading ? (
 <div className="flex flex-col items-center justify-center h-full gap-2 text-text-mute">
 <Loader2 className="h-6 w-6 animate-spin text-cyan" />
 <span className="text-xs">Parsing HTML tree…</span>
 </div>
 ) : htmlTree.length === 0 ? (
 <div className="flex flex-col items-center justify-center h-full gap-2 text-text-mute">
 <TreePine className="h-8 w-8 opacity-40" />
 <div className="text-center">
 <p className="text-xs font-medium">No HTML tree loaded</p>
 <p className="text-xs mt-0.5 opacity-75">Fetch a page to explore its structure</p>
 </div>
 </div>
 ) : (
 <ul className="px-1">
 {htmlTree.map((node, rootIdx) => {
 const rootKey = `root-${node.tag}${node.id ? `#${node.id}`:''}-${rootIdx}`;
 return (
 <TreeNode
 key={rootKey}
 node={node}
 depth={0}
 selectedSelector={selectedSelector}
 onSelect={handleSelect}
 />
 );
 })}
 </ul>
 )}
 </div>
 </div>
 );
}
