import type { LayoutBounds, Point } from "../types";

/** Maps graph coordinates onto the view: `screen = graph * scale + translate`. */
export interface ViewTransform {
  scale: number;
  translateX: number;
  translateY: number;
}

/** Zoom limits, so a stray pinch cannot make the graph unusable. */
export const MIN_SCALE = 0.05;
export const MAX_SCALE = 4;

export function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;

  return value;
}

export function distance(a: Point, b: Point): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

/**
 * A transform that fits the whole graph inside a view of `width` x `height`
 * with `padding` around it, centred, and never zoomed in past 1:1.
 */
export function fitToBounds(
  bounds: LayoutBounds,
  width: number,
  height: number,
  padding: number = 16
): ViewTransform {
  const availableWidth = Math.max(width - padding * 2, 1);
  const availableHeight = Math.max(height - padding * 2, 1);

  const scale = clamp(
    Math.min(
      bounds.width > 0 ? availableWidth / bounds.width : 1,
      bounds.height > 0 ? availableHeight / bounds.height : 1
    ),
    MIN_SCALE,
    1
  );

  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;

  return {
    scale,
    translateX: width / 2 - centerX * scale,
    translateY: height / 2 - centerY * scale,
  };
}

/**
 * Zooms around a point in view space, so the graph stays anchored under the
 * user's fingers rather than drifting towards the top-left corner.
 */
export function zoomAround(
  transform: ViewTransform,
  factor: number,
  viewX: number,
  viewY: number
): ViewTransform {
  const scale = clamp(transform.scale * factor, MIN_SCALE, MAX_SCALE);
  const ratio = scale / transform.scale;

  return {
    scale,
    translateX: viewX - (viewX - transform.translateX) * ratio,
    translateY: viewY - (viewY - transform.translateY) * ratio,
  };
}

/** Geometry for one edge: the line to draw, the arrow head and the label. */
export interface EdgeGeometry {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** Midpoint, where the label goes. */
  labelX: number;
  labelY: number;
  /** SVG `points` value for the arrow head triangle at the target end. */
  arrowPoints: string;
}

/**
 * Shortens an edge so it starts and ends at the rim of the two node circles,
 * and builds the arrow head polygon at the target end.
 */
export function edgeGeometry(
  from: Point,
  to: Point,
  fromRadius: number,
  toRadius: number,
  arrowSize: number = 12
): EdgeGeometry {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.sqrt(dx * dx + dy * dy) || 0.01;

  const ux = dx / length;
  const uy = dy / length;

  // Never let the arrow head eat the whole edge.
  const head = Math.min(arrowSize, length / 3);
  const startRadius = Math.min(fromRadius, length / 3);
  const endRadius = Math.min(toRadius + head, (length * 2) / 3);

  const x1 = from.x + ux * startRadius;
  const y1 = from.y + uy * startRadius;
  const x2 = to.x - ux * endRadius;
  const y2 = to.y - uy * endRadius;

  // Perpendicular, used for the two back corners of the arrow head.
  const px = -uy;
  const py = ux;

  const backX = x2 - ux * head;
  const backY = y2 - uy * head;
  const halfWidth = head * 0.45;

  const arrowPoints = [
    `${round(x2)},${round(y2)}`,
    `${round(backX + px * halfWidth)},${round(backY + py * halfWidth)}`,
    `${round(backX - px * halfWidth)},${round(backY - py * halfWidth)}`,
  ].join(" ");

  return {
    x1: round(x1),
    y1: round(y1),
    x2: round(x2),
    y2: round(y2),
    labelX: round((x1 + x2) / 2),
    labelY: round((y1 + y2) / 2) - 4,
    arrowPoints,
  };
}

/**
 * Rounds to 2 decimals: SVG attributes stay compact and snapshots do not churn
 * on floating-point noise.
 */
export function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Shortens a label for display, with an ellipsis. */
export function truncateLabel(label: string, max: number = 40): string {
  if (label.length <= max) return label;

  return label.slice(0, max) + "…";
}
