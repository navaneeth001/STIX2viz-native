import { computeLayout } from "./forceLayout";
import type { GraphEdge, GraphNode } from "../types";

function makeNodes(count: number): GraphNode[] {
  return Array.from({ length: count }, (_unused, index) => ({
    id: `node-${index}`,
    label: `Node ${index}`,
    group: "malware",
  }));
}

function makeEdges(count: number): GraphEdge[] {
  return Array.from({ length: Math.max(count - 1, 0) }, (_unused, index) => ({
    id: `edge-${index}`,
    from: `node-${index}`,
    to: `node-${index + 1}`,
    label: "refers-to",
  }));
}

describe("computeLayout", () => {
  it("positions every node", () => {
    const nodes = makeNodes(8);
    const { positions } = computeLayout(nodes, makeEdges(8));

    expect(positions.size).toBe(8);

    for (const node of nodes) {
      const position = positions.get(node.id);

      expect(position).toBeDefined();
      expect(Number.isFinite(position!.x)).toBe(true);
      expect(Number.isFinite(position!.y)).toBe(true);
    }
  });

  it("is deterministic: the same input always produces the same picture", () => {
    const nodes = makeNodes(12);
    const edges = makeEdges(12);

    const first = computeLayout(nodes, edges);
    const second = computeLayout(nodes, edges);

    expect([...second.positions.entries()]).toEqual([
      ...first.positions.entries(),
    ]);
    expect(second.bounds).toEqual(first.bounds);
  });

  it("does not depend on Math.random", () => {
    const random = jest.spyOn(Math, "random");

    computeLayout(makeNodes(5), makeEdges(5));

    expect(random).not.toHaveBeenCalled();
  });

  it("pulls linked nodes to the spring length", () => {
    const nodes = makeNodes(3);
    const edges: GraphEdge[] = [
      { id: "e1", from: "node-0", to: "node-1", label: "refers-to" },
    ];

    // With repulsion and gravity switched off, the only force left is the
    // spring along the edge, so its effect on each pair is directly visible.
    const { positions } = computeLayout(nodes, edges, {
      repulsion: 0,
      gravity: 0,
      damping: 1,
      springLength: 100,
      springConstant: 0.1,
      seedRadius: 200,
      iterations: 400,
    });

    const distanceBetween = (a: string, b: string) =>
      Math.hypot(
        positions.get(a)!.x - positions.get(b)!.x,
        positions.get(a)!.y - positions.get(b)!.y
      );

    // The linked pair settles at the preferred edge length...
    expect(distanceBetween("node-0", "node-1")).toBeCloseTo(100, 0);
    // ...while the unlinked node is left where the spiral put it, further away.
    expect(distanceBetween("node-0", "node-2")).toBeGreaterThan(
      distanceBetween("node-0", "node-1")
    );
  });

  it("ignores edges that point at nodes which are not laid out", () => {
    const nodes = makeNodes(2);
    const edges: GraphEdge[] = [
      { id: "e1", from: "node-0", to: "missing", label: "refers-to" },
      { id: "e2", from: "node-0", to: "node-0", label: "self" },
    ];

    expect(() => computeLayout(nodes, edges)).not.toThrow();
    expect(computeLayout(nodes, edges).positions.size).toBe(2);
  });

  it("reports the number of iterations, scaled down for large graphs", () => {
    expect(computeLayout(makeNodes(10), []).iterations).toBe(250);

    const large = computeLayout(makeNodes(300), makeEdges(300));
    expect(large.iterations).toBeLessThan(250);
  });

  it("honours an explicit iteration count", () => {
    const result = computeLayout(makeNodes(5), [], { iterations: 7 });

    expect(result.iterations).toBe(7);
  });

  it("positions a single node at the origin and pads the bounds", () => {
    const { positions, bounds } = computeLayout(makeNodes(1), [], {
      nodeRadius: 20,
    });

    expect(positions.get("node-0")).toEqual({ x: 0, y: 0 });
    expect(bounds.width).toBe(80);
    expect(bounds.height).toBe(80);
  });

  it("handles empty input", () => {
    const { positions, bounds, iterations } = computeLayout([], []);

    expect(positions.size).toBe(0);
    expect(bounds.width).toBe(0);
    expect(bounds.height).toBe(0);
    expect(iterations).toBe(250);
  });

  it("lays out a few hundred nodes in reasonable time and space", () => {
    const nodes = makeNodes(400);
    const edges = makeEdges(400);

    const started = Date.now();
    const { positions, bounds } = computeLayout(nodes, edges);
    const elapsed = Date.now() - started;

    expect(positions.size).toBe(400);
    // A smoke test for accidental O(n^3) regressions, with a generous budget so
    // it does not turn into a flaky benchmark on slow CI machines.
    expect(elapsed).toBeLessThan(10000);
    // The graph must stay a sensible size: a runaway simulation would show up
    // as an enormous bounding box.
    expect(bounds.width).toBeLessThan(100000);
    expect(bounds.height).toBeLessThan(100000);
  });
});
