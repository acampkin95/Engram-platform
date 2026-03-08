import { useRef, useCallback, useEffect } from 'react';

export interface SimNode {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  fx?: number | null; // fixed position (while dragging)
  fy?: number | null;
  radius: number;
}

export interface SimEdge {
  source: string;
  target: string;
}

interface ForceSimulationOptions {
  width: number;
  height: number;
  onTick: (nodes: SimNode[]) => void;
}

// Quadtree node for Barnes-Hut approximation
interface QuadNode {
  x: number;
  y: number;
  mass: number;
  children?: (QuadNode | null)[];
}

function buildQuadTree(nodes: SimNode[], x0: number, y0: number, x1: number, y1: number): QuadNode | null {
  if (nodes.length === 0) return null;
  if (nodes.length === 1) {
    return { x: nodes[0].x, y: nodes[0].y, mass: 1 };
  }

  const mx = (x0 + x1) / 2;
  const my = (y0 + y1) / 2;
  const cx = nodes.reduce((s, n) => s + n.x, 0) / nodes.length;
  const cy = nodes.reduce((s, n) => s + n.y, 0) / nodes.length;

  const q0 = nodes.filter((n) => n.x < mx && n.y < my);
  const q1 = nodes.filter((n) => n.x >= mx && n.y < my);
  const q2 = nodes.filter((n) => n.x < mx && n.y >= my);
  const q3 = nodes.filter((n) => n.x >= mx && n.y >= my);

  return {
    x: cx,
    y: cy,
    mass: nodes.length,
    children: [
      buildQuadTree(q0, x0, y0, mx, my),
      buildQuadTree(q1, mx, y0, x1, my),
      buildQuadTree(q2, x0, my, mx, y1),
      buildQuadTree(q3, mx, my, x1, y1),
    ],
  };
}

function applyBarnesHutForce(
  node: SimNode,
  tree: QuadNode | null,
  theta: number,
  repulsion: number,
  regionSize: number
): void {
  if (!tree) return;

  const dx = tree.x - node.x;
  const dy = tree.y - node.y;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;

  // If the region is small enough relative to distance, treat as single body
  if (!tree.children || regionSize / dist < theta) {
    const force = (repulsion * tree.mass) / (dist * dist);
    node.vx -= (force * dx) / dist;
    node.vy -= (force * dy) / dist;
  } else {
    const half = regionSize / 2;
    for (const child of tree.children) {
      if (child) {
        applyBarnesHutForce(node, child, theta, repulsion, half);
      }
    }
  }
}

export function useForceSimulation(options: ForceSimulationOptions) {
  const nodesRef = useRef<SimNode[]>([]);
  const edgesRef = useRef<SimEdge[]>([]);
  const rafRef = useRef<number>(0);
  const runningRef = useRef(false);
  const onTickRef = useRef(options.onTick);

  // Keep onTick current without restarting simulation
  useEffect(() => {
    onTickRef.current = options.onTick;
  }, [options.onTick]);

  const tick = useCallback(() => {
    const nodes = nodesRef.current;
    const edges = edgesRef.current;
    const { width, height } = options;

    if (nodes.length === 0) return;

    const repulsion = 4000;
    const attraction = 0.035;
    const idealLength = 160;
    const centerGravity = 0.04;
    const damping = 0.75;
    const theta = 0.8; // Barnes-Hut approximation threshold

    // Build quad tree for O(n log n) repulsion
    const margin = 50;
    const tree = buildQuadTree(
      nodes,
      -margin,
      -margin,
      width + margin,
      height + margin
    );

    for (const node of nodes) {
      if (node.fx != null) {
        node.x = node.fx;
        node.vx = 0;
      }
      if (node.fy != null) {
        node.y = node.fy;
        node.vy = 0;
      }

      if (node.fx != null && node.fy != null) continue;

      // Barnes-Hut repulsion
      applyBarnesHutForce(node, tree, theta, repulsion, width + margin * 2);

      // Centre gravity
      node.vx += (width / 2 - node.x) * centerGravity;
      node.vy += (height / 2 - node.y) * centerGravity;

      // Damping
      node.vx *= damping;
      node.vy *= damping;
    }

    // Spring forces along edges
    for (const edge of edges) {
      const source = nodes.find((n) => n.id === edge.source);
      const target = nodes.find((n) => n.id === edge.target);
      if (!source || !target) continue;

      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const force = (dist - idealLength) * attraction;

      const fx = (force * dx) / dist;
      const fy = (force * dy) / dist;

      if (source.fx == null) { source.vx += fx; source.vy += fy; }
      if (target.fx == null) { target.vx -= fx; target.vy -= fy; }
    }

    // Integrate positions
    for (const node of nodes) {
      if (node.fx == null) node.x += node.vx;
      if (node.fy == null) node.y += node.vy;

      // Boundary
      const r = node.radius + 8;
      node.x = Math.max(r, Math.min(width - r, node.x));
      node.y = Math.max(r, Math.min(height - r, node.y));
    }

    onTickRef.current([...nodes]);

    if (runningRef.current) {
      rafRef.current = requestAnimationFrame(tick);
    }
  }, [options]);

  const start = useCallback(() => {
    if (runningRef.current) return;
    runningRef.current = true;
    rafRef.current = requestAnimationFrame(tick);
  }, [tick]);

  const stop = useCallback(() => {
    runningRef.current = false;
    cancelAnimationFrame(rafRef.current);
  }, []);

  const setNodes = useCallback(
    (nodes: SimNode[]) => {
      nodesRef.current = nodes;
    },
    []
  );

  const setEdges = useCallback((edges: SimEdge[]) => {
    edgesRef.current = edges;
  }, []);

  const updateNodePosition = useCallback((id: string, x: number, y: number, fixed: boolean) => {
    const node = nodesRef.current.find((n) => n.id === id);
    if (!node) return;
    node.x = x;
    node.y = y;
    node.fx = fixed ? x : null;
    node.fy = fixed ? y : null;
    if (!fixed) {
      node.vx = 0;
      node.vy = 0;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      runningRef.current = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return { start, stop, setNodes, setEdges, updateNodePosition };
}
