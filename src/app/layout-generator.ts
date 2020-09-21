import { capitalize, random, sample, shuffle } from "lodash";

import { IEdge, INode } from "./graph-creator";
import { ISettings } from "./interfaces";
import { MapLayouts } from "./map-layouts";
import { randomTownName } from "./townname";

const potentialLayouts = MapLayouts;

export interface IGraphResult {
  nodes: INode[];
  edges: IEdge[];
  error: string;
}

export function generateLayout(width: number, height: number, settings: ISettings): IGraphResult {

  const { maxAttempts, minConnections, maxConnections, townNames } = settings;

  const nodes = [];

  const layout = sample(potentialLayouts);

  layout.nodePositions.forEach((pos, i) => {
    nodes.push({
      id: i,
      r: 50,
      title: townNames ? capitalize(randomTownName()) : "Clearing" + i,
      x: pos.x * (width / layout.maxX),
      y: pos.y * (height / layout.maxY),
    });
  });

  const potentialEdges = {};

  layout.validNodeConnections.forEach(({ path, blocks }) => {
    const [start, end] = path.split("-");
    const allBlocks = (blocks || [])
      .map((b) => [b, b.split("-").reverse().join("-")])
      .flat(Infinity);

    potentialEdges[start] = potentialEdges[start] || {};
    potentialEdges[start][end] = allBlocks;

    potentialEdges[end] = potentialEdges[end] || {};
    potentialEdges[end][start] = allBlocks;
  });

  let attempts = 0;
  let error = "";

  let chosenEdges = {};
  let blockedEdges = {};
  let edgesPerClearing = {};

  while (attempts++ < maxAttempts) {
    chosenEdges = {};
    blockedEdges = {};
    edgesPerClearing = Object.fromEntries(Array(nodes.length).fill(0).map((x, i) => [i, 0]));

    let isValid = true;

    // create paths for each node
    shuffle(Array(nodes.length).fill(0).map((x, i) => i)).forEach((i) => {
      const paths = random(minConnections, maxConnections);
      for (let p = 0; p < paths; p++) {
        const curNodeEdges = potentialEdges[i];
        const possibleNewEdges = Object.keys(curNodeEdges)
          .filter((e) => !blockedEdges[`${e}-${i}`] && !blockedEdges[`${i}-${e}`]
                      && !chosenEdges[`${e}-${i}`] && !chosenEdges[`${i}-${e}`]
                      && edgesPerClearing[e] < maxConnections && edgesPerClearing[i] < maxConnections);
        const edge = sample(possibleNewEdges);

        if (edge) {
          chosenEdges[`${i}-${edge}`] = true;
          chosenEdges[`${edge}-${i}`] = true;

          edgesPerClearing[i]++;
          edgesPerClearing[edge]++;

          potentialEdges[i][edge].forEach((block) => {
            blockedEdges[block] = true;
          });
        }
      }
    });

    // validate # connections per clearing
    if (Object.values(edgesPerClearing).some((v) => v < minConnections || v > maxConnections)) {
      isValid = false;
    }

    if (isValid) { break; }
  }

  if (attempts >= maxAttempts) { error = "Max retry threshold reached; map may require adjustments to be valid."; }

  const oneWayEdges = {};
  Object.keys(chosenEdges).forEach((key) => {
    const [start, end] = key.split("-");
    if (oneWayEdges[`${end}-${start}`]) { return; }
    oneWayEdges[`${start}-${end}`] = true;
  });

  const edges = Object.keys(oneWayEdges)
    .map((key) => ({ source: nodes[+key.split("-")[0]], target: nodes[+key.split("-")[1]] }));

  return { nodes, edges, error };
}
