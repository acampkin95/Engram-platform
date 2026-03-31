import { useReactFlow } from '@xyflow/react';
import {
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from 'd3-force';
import { useEffect } from 'react';

/** D3 simulation node with React Flow node fields preserved */
type SimNode = SimulationNodeDatum & { id: string; position: { x: number; y: number } };

type UseForceLayoutOptions = {
  strength?: number;
  distance?: number;
};

export function useForceLayout({ strength = -300, distance = 100 }: UseForceLayoutOptions = {}) {
  const { setNodes, getNodes, getEdges } = useReactFlow();

  useEffect(() => {
    const nodes = getNodes();
    const edges = getEdges();

    if (!nodes.length) return;

    // Filter out nodes that don't need layout (like parents/children if using groups)
    const nodesToLayout = nodes.filter((n) => !n.parentId);

    const simulationNodes: SimNode[] = nodesToLayout.map((node, i) => ({
      ...node,
      x: node.position.x || ((i % 10) * 50 + 50),
      y: node.position.y || (Math.floor(i / 10) * 50 + 50),
    }));

    const simulationLinks: SimulationLinkDatum<SimNode>[] = edges
      .map((edge) => ({
        source: simulationNodes.find((n) => n.id === edge.source) as SimNode | undefined,
        target: simulationNodes.find((n) => n.id === edge.target) as SimNode | undefined,
      }))
      .filter(
        (link): link is { source: SimNode; target: SimNode } =>
          link.source !== undefined && link.target !== undefined,
      );

    const simulation = forceSimulation<SimNode>(simulationNodes)
      .force('charge', forceManyBody().strength(strength))
      .force(
        'link',
        forceLink<SimNode, SimulationLinkDatum<SimNode>>(simulationLinks)
          .id((d) => d.id)
          .distance(distance),
      )
      .force('x', forceX(0).strength(0.05))
      .force('y', forceY(0).strength(0.05))
      .on('tick', () => {
        setNodes((currentNodes) => {
          return currentNodes.map((node) => {
            const simNode = simulationNodes.find((n) => n.id === node.id);
            if (simNode && simNode.x !== undefined && simNode.y !== undefined) {
              return {
                ...node,
                position: { x: simNode.x, y: simNode.y },
              };
            }
            return node;
          });
        });
      });

    return () => {
      simulation.stop();
    };
  }, [getNodes, getEdges, setNodes, strength, distance]);
}
