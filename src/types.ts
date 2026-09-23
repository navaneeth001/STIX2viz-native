/**
 * Public data types returned by the graph builder.
 *
 * These are deliberately framework-agnostic (no React Native, no SVG): the
 * layout and the renderer both consume them, and so can you — `makeGraphData`
 * is exported from `stix2vis-native/core`.
 */

/** A node in the graph: one STIX object (or a placeholder for a missing one). */
export interface GraphNode {
  /** The node's STIX id, or a derived id for embedded STIX 2.0 observables. */
  id: string;
  /** Display label: `name`, else `value`, else `path`, else the STIX type. */
  label: string;
  /** STIX type of the backing object — nodes are coloured/iconed by group. */
  group: string;
  /**
   * `true` for a placeholder "ghost" node standing in for a STIX id that is
   * referenced but not present in the content (only when `showDanglingRefs`).
   */
  dangling?: boolean;
  /** Additional vis-style fields, kept for parity with the web package. */
  opacity?: number;
  font?: { color: string };
  hidden?: boolean;
}

/** An edge in the graph: a STIX relationship, or an embedded reference. */
export interface GraphEdge {
  /**
   * The STIX relationship's id for explicit relationships. Embedded
   * references have no STIX id of their own, so a stable synthetic id
   * (`"<from>-><to>::<label>"`, suffixed with `#n` on collisions) is derived.
   */
  id: string;
  from: string;
  to: string;
  label: string;
  hidden?: boolean;
}

/** Everything the renderer needs to draw one STIX content value. */
export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  /** The parsed STIX objects, keyed by STIX id (internal Map form). */
  stixIdToObject: Map<string, any>;
}

/** A position in graph space. */
export interface Point {
  x: number;
  y: number;
}

/** Bounding box of a laid-out graph. */
export interface LayoutBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

/** Result of {@link computeLayout}. */
export interface LayoutResult {
  positions: Map<string, Point>;
  bounds: LayoutBounds;
  /** Number of iterations actually performed. */
  iterations: number;
}
