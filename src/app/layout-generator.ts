import { pull, random, sample } from "lodash";

import { IEdge, INode } from "./graph-creator";

const distBetweenNodes = (x1, y1, x2, y2): number => {
  return Math.sqrt(((x2 - x1) ** 2) + ((y2 - y1) ** 2));
};

export const generateLayout = (width: number, height: number): { nodes: INode[], edges: IEdge[] } => {

  let id = 0;

  const nodes = [];

  for (let x = 0; x < 4; x++) {
    for (let y = 0; y < 3; y++) {
      nodes.push({
        _genXPos: x,
        _genYPos: y,
        id: id++,
        title: "Clearing " + id,
        x: 150 + (width / 4 * x),
        y: 150 + (height / 3 * y),
      });
    }
  }

  const edges = [];

  nodes.forEach((node) => {
    const numPaths = 1;

    const validTargetNodes = nodes.filter((checkNode) => {
      if (checkNode === node) { return false; }

      const doWeAlreadyMatch = edges.find((edge) => {
        return (edge.source === checkNode && edge.target === node)
            || (edge.target === node && edge.source === checkNode);
      });

      if (doWeAlreadyMatch) { return false; }

      const dist = distBetweenNodes(node._genXPos, node._genYPos, checkNode._genXPos, checkNode._genYPos);

      if (dist > 1) { return false; }

      return true;
    });

    for (let i = 0; i < numPaths; i++) {
      const nextNode = sample(validTargetNodes);
      if (!nextNode) { break; }

      const numConnectionsMe = edges.filter((edge) => {
        return edge.source === node
            || edge.target === node;
      }).length;

      const numConnectionsTarget = edges.filter((edge) => {
        return edge.source === nextNode
            || edge.target === nextNode;
      }).length;

      if (numConnectionsMe > 3 || numConnectionsTarget > 3) { continue; }

      edges.push({ source: node, target: nextNode });
      pull(validTargetNodes, nextNode);
    }
  });

  nodes.forEach((node) => {
    delete node._genXPos;
    delete node._genYPos;
  });

  return { nodes, edges };
};
