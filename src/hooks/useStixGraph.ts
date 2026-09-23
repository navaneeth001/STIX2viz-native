import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { legendTypes, makeGraphData } from "../core";
import { computeLayout, type LayoutOptions } from "../layout/forceLayout";
import type { GraphData, LayoutBounds, Point } from "../types";

export interface UseStixGraphOptions {
  /** STIX 2.1 content: a bundle, an object array, a single object or JSON. */
  stixJson: any;
  /**
   * Graph-builder configuration (`include`/`exclude`, `userLabels`, per-type
   * `displayProperty`/`displayIcon`/`embeddedRelationships`).
   */
  config?: Record<string, any>;
  /** Render placeholder nodes for references missing from the content. */
  showDanglingRefs?: boolean;
  /** Force-layout tuning, see {@link LayoutOptions}. */
  layout?: LayoutOptions;
  /** Called when the content or the configuration is invalid. */
  onError?: (error: unknown) => void;
}

export interface UseStixGraphResult {
  /** The parsed graph, or `null` when the content could not be read. */
  graph: GraphData | null;
  /** Graph-space position for every node. */
  positions: Map<string, Point>;
  /** Bounding box of the laid-out graph, or `null` when there is none. */
  bounds: LayoutBounds | null;
  /** STIX types that are rendered, sorted (the toolbar legend). */
  legend: string[];
  /** The error thrown while reading the content, if any. */
  error: unknown;
  /** Clears the error and recomputes the layout (same content, new run). */
  relayout: () => void;
}

/**
 * Turns STIX content into a laid-out graph, memoised on content and config, and
 * safe to call during render: an invalid bundle yields `error` instead of
 * throwing, so a screen can show a message rather than a red box.
 *
 * Both steps are pure and deterministic, so this hook is also the easiest way
 * to use the renderer headlessly (e.g. to find a node's position).
 */
export function useStixGraph({
  stixJson,
  config,
  showDanglingRefs,
  layout,
  onError,
}: UseStixGraphOptions): UseStixGraphResult {
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onErrorRef.current = onError;
  });

  // Object identity changes should not rebuild the graph; only actual content
  // changes should. Maps serialise as "{}", which is stable across renders.
  const configKey = JSON.stringify(config ?? null);
  const layoutKey = JSON.stringify(layout ?? null);

  const [relayoutNonce, setRelayoutNonce] = useState(0);

  const { graph, error } = useMemo<{
    graph: GraphData | null;
    error: unknown;
  }>(() => {
    if (stixJson === null || stixJson === undefined)
      return { graph: null, error: null };

    const merged: Record<string, any> = { ...(config ?? {}) };
    if (showDanglingRefs !== undefined)
      merged.showDanglingRefs = showDanglingRefs;

    const dataConfig = Object.keys(merged).length > 0 ? merged : null;

    try {
      return { graph: makeGraphData(stixJson, dataConfig), error: null };
    } catch (caught) {
      return { graph: null, error: caught };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stixJson, configKey, showDanglingRefs]);

  useEffect(() => {
    if (error) onErrorRef.current?.(error);
  }, [error]);

  const layoutResult = useMemo(() => {
    if (!graph) return null;

    try {
      return computeLayout(graph.nodes, graph.edges, layout ?? {});
    } catch (caught) {
      return { error: caught } as const;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph, layoutKey, relayoutNonce]);

  const relayoutError =
    layoutResult && "error" in layoutResult ? layoutResult.error : null;

  useEffect(() => {
    if (relayoutError) onErrorRef.current?.(relayoutError);
  }, [relayoutError]);

  const relayout = useCallback(
    () => setRelayoutNonce((value) => value + 1),
    []
  );

  const legend = useMemo(() => (graph ? legendTypes(graph) : []), [graph]);

  const computed =
    layoutResult && !("error" in layoutResult) ? layoutResult : null;

  return {
    graph,
    positions: computed?.positions ?? EMPTY_POSITIONS,
    bounds: computed?.bounds ?? null,
    legend,
    error: error ?? relayoutError,
    relayout,
  };
}

const EMPTY_POSITIONS: Map<string, Point> = new Map();
