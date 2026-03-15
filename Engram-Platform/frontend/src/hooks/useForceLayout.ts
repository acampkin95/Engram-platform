import { useReactFlow } from '@xyflow/react';
import {
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type SimulationNodeDatum,
} from 'd3-force';
import { useEffect } from 'react';

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

    const simulationNodes = nodesToLayout.map((node) => ({
      ...node,
      x: node.position.x || Math.random() * 500,
      y: node.position.y || Math.random() * 500,
    }));

    const simulationLinks = edges
      .map((edge) => ({
        // biome-ignore lint/suspicious/noExplicitAny: D3 node reference
        source: simulationNodes.find((n) => n.id === edge.source) as any,
        // biome-ignore lint/suspicious/noExplicitAny: D3 node reference
        target: simulationNodes.find((n) => n.id === edge.target) as any,
      }))
      .filter((link) => link.source && link.target);

    const simulation = forceSimulation(simulationNodes as import('d3-force').SimulationNodeDatum[])
      .force('charge', forceManyBody().strength(strength))
      .force(
        'link',
        forceLink(simulationLinks)
          .id((d: SimulationNodeDatum) => d.id)
          .distance(distance),
      )
      .force('x', forceX(0).strength(0.05))
      .force('y', forceY(0).strength(0.05))
      .on('tick', () => {
        setNodes((currentNodes) => {
          return currentNodes.map((node) => {
            const simNode = simulationNodes.find((n) => n.id === node.id);
            if (simNode) {
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
