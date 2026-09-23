import type {
  GraphEdge,
  GraphNode,
  LayoutBounds,
  LayoutResult,
  Point,
} from "../types";

/**
 * Force-directed layout.
 *
 * React Native has no `<canvas>`, so instead of a physics engine running on
 * every frame this computes the whole layout up front, in plain JavaScript, and
 * the renderer just draws the result. That keeps the UI thread free and makes
 * the output reproducible: the simulation is fully deterministic (there is no
 * `Math.random()` anywhere — positions are seeded on a spiral, in node order),
 * so the same content always produces the same picture and snapshots stay
 * stable.
 */
export interface LayoutOptions {
  /**
   * How hard nodes push each other apart. Raise it for tighter clusters,
   * lower it for a more spread-out graph.
   */
  repulsion?: number;
  /** Preferred edge length, in graph units. */
  springLength?: number;
  /** How hard edges pull their endpoints together. */
  springConstant?: number;
  /** Pull towards the origin, which keeps isolated nodes from drifting away. */
  gravity?: number;
  /** Velocity retained per iteration (0-1). Lower settles faster. */
  damping?: number;
  /** Speed limit per iteration, so nothing overshoots. */
  maxVelocity?: number;
  /** Simulation steps to run. Defaults scale down with the node count. */
  iterations?: number;
  /** Radius of the seeded starting spiral. */
  seedRadius?: number;
  /**
   * Distance beyond which two nodes stop repelling, and the size of the
   * spatial buckets used to find neighbours. Large graphs stay fast because
   * every node only looks at the buckets around it.
   */
  cutoff?: number;
  /** Node radius, used for the padding around the computed bounds. */
  nodeRadius?: number;
}

export const defaultLayoutOptions: Required<LayoutOptions> = {
  repulsion: 6000,
  springLength: 120,
  springConstant: 0.04,
  gravity: 0.06,
  damping: 0.82,
  maxVelocity: 30,
  iterations: 250,
  seedRadius: 120,
  cutoff: 320,
  nodeRadius: 22,
};

/**
 * Iterations are reduced for large graphs: cost grows with the node count and
 * the layout is usually good enough after fewer passes.
 */
function iterationsFor(nodeCount: number): number {
  if (nodeCount > 1500) return 70;
  if (nodeCount > 600) return 110;
  if (nodeCount > 200) return 170;

  return defaultLayoutOptions.iterations;
}

function cellKey(x: number, y: number, size: number): string {
  return `${Math.floor(x / size)}:${Math.floor(y / size)}`;
}

/**
 * Runs the simulation and returns a position for every node.
 *
 * Nodes with no edges are placed on the seeded spiral and then only affected by
 * gravity, so they stay near the graph instead of flying off.
 */
export function computeLayout(
  nodes: GraphNode[],
  edges: GraphEdge[],
  options: LayoutOptions = {}
): LayoutResult {
  const opts = { ...defaultLayoutOptions, ...options };

  const count = nodes.length;
  const positions: Point[] = new Array(count);
  const velocities: Point[] = new Array(count);

  // Seeded start: an even spiral in node order. Deterministic, and already
  // close to the shape the simulation settles into, which shortens the run.
  for (let i = 0; i < count; i++) {
    const angle = (count <= 1 ? 0 : i / count) * Math.PI * 2 * 3;
    const radius =
      count <= 1
        ? 0
        : opts.seedRadius * Math.sqrt(count) * Math.sqrt((i + 0.5) / count);

    positions[i] = { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
    velocities[i] = { x: 0, y: 0 };
  }

  // Adjacency in index space, so the inner loops never touch Maps.
  const indexById = new Map<string, number>();
  for (let i = 0; i < count; i++) indexById.set(nodes[i]!.id, i);

  const links: [number, number][] = [];
  for (const edge of edges) {
    const from = indexById.get(edge.from);
    const to = indexById.get(edge.to);

    // Skip self-loops and edges to nodes that are not on screen.
    if (from === undefined || to === undefined || from === to) continue;

    links.push([from, to]);
  }

  // Read from `options`, not from the defaults: spreading the defaults would
  // always pin `iterations` to its default and disable the scaling below.
  const iterations = options.iterations ?? iterationsFor(count);
  const cutoffSquared = opts.cutoff * opts.cutoff;

  const buckets = new Map<string, number[]>();

  for (let iteration = 0; iteration < iterations && count > 1; iteration++) {
    for (let i = 0; i < count; i++) {
      const bucket = cellKey(positions[i]!.x, positions[i]!.y, opts.cutoff);
      const contents = buckets.get(bucket);

      if (contents) contents.push(i);
      else buckets.set(bucket, [i]);
    }

    // Repulsion: every node pushes the nodes in its own and the eight
    // surrounding buckets away, within the cutoff distance.
    for (let i = 0; i < count; i++) {
      const a = positions[i]!;
      const cx = Math.floor(a.x / opts.cutoff);
      const cy = Math.floor(a.y / opts.cutoff);

      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const contents = buckets.get(`${cx + dx}:${cy + dy}`);
          if (!contents) continue;

          for (const j of contents) {
            if (j <= i) continue;

            const b = positions[j]!;
            let ex = a.x - b.x;
            let ey = a.y - b.y;
            let distanceSquared = ex * ex + ey * ey;

            if (distanceSquared > cutoffSquared) continue;

            // Two nodes exactly on top of each other: nudge them apart
            // deterministically instead of dividing by zero.
            if (distanceSquared < 0.01) {
              ex = i % 2 === 0 ? 0.1 : -0.1;
              ey = j % 2 === 0 ? 0.1 : -0.1;
              distanceSquared = ex * ex + ey * ey;
            }

            const distance = Math.sqrt(distanceSquared);
            const force = opts.repulsion / distanceSquared;
            const fx = (ex / distance) * force;
            const fy = (ey / distance) * force;

            velocities[i]!.x += fx;
            velocities[i]!.y += fy;
            velocities[j]!.x -= fx;
            velocities[j]!.y -= fy;
          }
        }
      }
    }

    // Attraction along edges.
    for (const [from, to] of links) {
      const a = positions[from]!;
      const b = positions[to]!;

      const ex = b.x - a.x;
      const ey = b.y - a.y;
      const distance = Math.sqrt(ex * ex + ey * ey) || 0.01;

      const force = opts.springConstant * (distance - opts.springLength);
      const fx = (ex / distance) * force;
      const fy = (ey / distance) * force;

      velocities[from]!.x += fx;
      velocities[from]!.y += fy;
      velocities[to]!.x -= fx;
      velocities[to]!.y -= fy;
    }

    // Gravity towards the origin, integration and speed limiting.
    for (let i = 0; i < count; i++) {
      const position = positions[i]!;
      const velocity = velocities[i]!;

      velocity.x -= position.x * opts.gravity;
      velocity.y -= position.y * opts.gravity;

      velocity.x *= opts.damping;
      velocity.y *= opts.damping;

      const speed = Math.sqrt(
        velocity.x * velocity.x + velocity.y * velocity.y
      );

      if (speed > opts.maxVelocity) {
        const factor = opts.maxVelocity / speed;
        velocity.x *= factor;
        velocity.y *= factor;
      }

      position.x += velocity.x;
      position.y += velocity.y;
    }

    buckets.clear();
  }

  const result: Map<string, Point> = new Map();

  let minX = 0;
  let minY = 0;
  let maxX = 0;
  let maxY = 0;

  for (let i = 0; i < count; i++) {
    const id = nodes[i]!.id;
    const position = positions[i]!;

    result.set(id, { x: position.x, y: position.y });

    if (i === 0) {
      minX = maxX = position.x;
      minY = maxY = position.y;
    } else {
      if (position.x < minX) minX = position.x;
      if (position.x > maxX) maxX = position.x;
      if (position.y < minY) minY = position.y;
      if (position.y > maxY) maxY = position.y;
    }
  }

  const margin = opts.nodeRadius * 2;

  const bounds: LayoutBounds = {
    minX: minX - margin,
    minY: minY - margin,
    maxX: maxX + margin,
    maxY: maxY + margin,
    width: count ? maxX - minX + margin * 2 : 0,
    height: count ? maxY - minY + margin * 2 : 0,
  };

  return { positions: result, bounds, iterations };
}
