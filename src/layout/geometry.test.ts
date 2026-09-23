import {
  MAX_SCALE,
  MIN_SCALE,
  clamp,
  distance,
  edgeGeometry,
  fitToBounds,
  round,
  truncateLabel,
  zoomAround,
} from "./geometry";
import type { LayoutBounds } from "../types";

const bounds: LayoutBounds = {
  minX: -100,
  minY: -50,
  maxX: 100,
  maxY: 50,
  width: 200,
  height: 100,
};

describe("fitToBounds", () => {
  it("centres the graph in the viewport", () => {
    const transform = fitToBounds(bounds, 400, 400);

    // The graph centre (0, 0) maps onto the viewport centre.
    expect(transform.translateX).toBe(200);
    expect(transform.translateY).toBe(200);
  });

  it("never enlarges a small graph past 1:1", () => {
    expect(fitToBounds(bounds, 2000, 2000).scale).toBe(1);
  });

  it("shrinks a graph that does not fit, leaving room for padding", () => {
    const transform = fitToBounds(bounds, 120, 120, 10);

    expect(transform.scale).toBeLessThan(1);
    expect(transform.scale).toBeCloseTo(100 / 200);
  });

  it("never shrinks past the minimum scale", () => {
    const huge: LayoutBounds = { ...bounds, width: 1e9, height: 1e9 };

    expect(fitToBounds(huge, 100, 100).scale).toBe(MIN_SCALE);
  });

  it("survives a zero-sized viewport", () => {
    const transform = fitToBounds(bounds, 0, 0);

    expect(Number.isFinite(transform.scale)).toBe(true);
    expect(Number.isFinite(transform.translateX)).toBe(true);
  });
});

describe("zoomAround", () => {
  it("keeps the anchor point under the user's fingers", () => {
    const start = { scale: 1, translateX: 10, translateY: 20 };
    const anchor = { x: 100, y: 80 };

    const zoomed = zoomAround(start, 2, anchor.x, anchor.y);

    // Graph point under the anchor before...
    const graphX = (anchor.x - start.translateX) / start.scale;
    const graphY = (anchor.y - start.translateY) / start.scale;

    // ...is still under the anchor after.
    expect(graphX * zoomed.scale + zoomed.translateX).toBeCloseTo(anchor.x);
    expect(graphY * zoomed.scale + zoomed.translateY).toBeCloseTo(anchor.y);
    expect(zoomed.scale).toBe(2);
  });

  it("clamps the scale to the supported range", () => {
    expect(
      zoomAround({ scale: 1, translateX: 0, translateY: 0 }, 1e6, 0, 0).scale
    ).toBe(MAX_SCALE);
    expect(
      zoomAround({ scale: 1, translateX: 0, translateY: 0 }, 1e-6, 0, 0).scale
    ).toBe(MIN_SCALE);
  });
});

describe("edgeGeometry", () => {
  it("starts and ends at the rim of the two node circles", () => {
    const geometry = edgeGeometry({ x: 0, y: 0 }, { x: 100, y: 0 }, 20, 20, 10);

    expect(geometry.x1).toBe(20);
    expect(geometry.y1).toBe(0);
    // 100 - (20 + arrow head 10)
    expect(geometry.x2).toBe(70);
    expect(geometry.y2).toBe(0);
    expect(geometry.labelX).toBe(45);
  });

  it("builds a triangle at the target end", () => {
    const { arrowPoints } = edgeGeometry(
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      20,
      20,
      10
    );

    const points = arrowPoints
      .split(" ")
      .map((pair) => pair.split(",").map(Number));

    expect(points).toHaveLength(3);
    expect(points[0]).toEqual([70, 0]);
    // The two back corners sit behind the tip, either side of the line.
    expect(points[1]![0]).toBeCloseTo(60);
    expect(points[1]![1]).toBeCloseTo(4.5);
    expect(points[2]![1]).toBeCloseTo(-4.5);
  });

  it("does not invert very short edges", () => {
    const geometry = edgeGeometry({ x: 0, y: 0 }, { x: 2, y: 0 }, 20, 20, 10);

    expect(geometry.x2).toBeGreaterThanOrEqual(geometry.x1);
    expect(Number.isFinite(geometry.labelX)).toBe(true);
  });

  it("handles two nodes at exactly the same position", () => {
    const geometry = edgeGeometry({ x: 5, y: 5 }, { x: 5, y: 5 }, 20, 20, 10);

    expect(Number.isFinite(geometry.x1)).toBe(true);
    expect(Number.isFinite(geometry.labelY)).toBe(true);
  });
});

describe("small helpers", () => {
  it("clamps and rounds", () => {
    expect(clamp(5, 0, 1)).toBe(1);
    expect(clamp(-5, 0, 1)).toBe(0);
    expect(clamp(0.5, 0, 1)).toBe(0.5);
    expect(round(1.23456)).toBe(1.23);
  });

  it("measures distance", () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });

  it("truncates labels with an ellipsis", () => {
    expect(truncateLabel("short", 10)).toBe("short");
    expect(truncateLabel("a-very-long-label", 6)).toBe("a-very…");
  });
});
