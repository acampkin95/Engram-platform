import { useEffect, useRef } from'react';
import { Network, type Node, type Edge, type Options } from'vis-network';
import { DataSet } from'vis-data';

interface NetworkGraphProps {
 nodes: {
 platform: string;
 username: string;
 url: string;
 confidence: number;
 }[];
}

const PlatformColors: Record<string, string> = {
 twitter:'#1DA1F2',
 linkedin:'#0077B5',
 github:'#333333',
 instagram:'#C13584',
 facebook:'#1877F2',
};

export default function NetworkGraph({ nodes: aliasNodes }: NetworkGraphProps) {
 const containerRef = useRef<HTMLDivElement>(null);
 const networkRef = useRef<Network | null>(null);

 useEffect(() => {
 if (!containerRef.current || aliasNodes.length === 0) return;

 const visNodes: Node[] = aliasNodes.map((node) => ({
 id: `${node.platform}-${node.username}`,
 label: `@${node.username}`,
 title: `${node.platform}: ${node.username}\nConfidence: ${(node.confidence * 100).toFixed(0)}%`,
 color: PlatformColors[node.platform] ||'#888888',
 size: 20 + node.confidence * 30,
 }));

 const centerNodeId = `center-${aliasNodes.length}`;
 visNodes.push({
 id: centerNodeId,
 label:'Search',
 title:'Original search target',
 color:'#50ffff',
 size: 30,
 });

 const visEdges: Edge[] = aliasNodes.map((node) => ({
 from: centerNodeId,
 to: `${node.platform}-${node.username}`,
 width: node.confidence * 5,
 color: {
 color: node.confidence >= 0.8 ?'#b4ff3c' : node.confidence >= 0.5 ?'#50ffff' :'#ff3c5f',
 opacity: node.confidence * 0.8,
 },
 }));

 const nodesData = new DataSet<Node>(visNodes);
 const edgesData = new DataSet<Edge>(visEdges);

 const data = {
 nodes: nodesData,
 edges: edgesData,
 };

 const options: Options = {
 nodes: {
 shape:'dot',
 font: {
 color:'#ffffff',
 size: 14,
 },
 borderWidth: 2,
 shadow: {
 enabled: true,
 color:'rgba(0,0,0,0.5)',
 size: 10,
 x: 5,
 y: 5,
 },
 },
 edges: {
 smooth: {
 enabled: true,
 type:'continuous',
 roundness: 0.5,
 },
 color: {
 highlight:'#b4ff3c',
 },
 },
 physics: {
 stabilization: true,
 barnesHut: {
 gravitationalConstant: -3000,
 centralGravity: 0.3,
 springLength: 200,
 springConstant: 0.04,
 },
 },
 interaction: {
 hover: true,
 tooltipDelay: 200,
 zoomView: true,
 dragView: true,
 },
 };

 networkRef.current = new Network(containerRef.current, data, options);

 return () => {
 networkRef.current?.destroy();
 };
 }, [aliasNodes]);

 if (aliasNodes.length === 0) {
 return (
 <div className="h-96 bg-void border border-border flex items-center justify-center">
 <p className="text-text-dim">No nodes to display</p>
 </div>
 );
 }

 return (
 <div className="space-y-4">
 <div className="flex gap-4 text-sm text-text-mute">
 <div className="flex items-center gap-2">
 <div className="w-3 h-3 rounded-full bg-plasma"></div>
 <span>High confidence (&ge;80%)</span>
 </div>
 <div className="flex items-center gap-2">
 <div className="w-3 h-3 rounded-full bg-cyan"></div>
 <span>Medium confidence (&ge;50%)</span>
 </div>
 <div className="flex items-center gap-2">
 <div className="w-3 h-3 rounded-full bg-neon-r"></div>
 <span>Low confidence (&lt;50%)</span>
 </div>
 </div>

 <div ref={containerRef} className="h-96 bg-void border border-border" />
 </div>
 );
}
