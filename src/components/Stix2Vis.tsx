import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { mapToPlain } from "../core";
import { useStixGraph } from "../hooks/useStixGraph";
import type { StixIconMap } from "../icons";
import type { LayoutOptions } from "../layout/forceLayout";
import { resolveTheme, type StixTheme } from "../theme";
import type { GraphEdge, GraphNode } from "../types";
import GraphCanvas, { type GraphViewportControls } from "./GraphCanvas";
import StixDetailsPanel from "./StixDetailsPanel";
import StixToolbar from "./StixToolbar";

export interface Stix2VisProps {
  /** STIX 2.1 content: a bundle, a single STIX object, or an array of objects. */
  stixJson: any;
  /** Style of the graph container. Defaults to a 420pt-high block. */
  graphStyle?: StyleProp<ViewStyle>;
  /** Style of the wrapper element around the toolbar, graph and panel. */
  wrapStyle?: StyleProp<ViewStyle>;
  /** Called with the clicked node's STIX id. */
  onNodeclick?: (nodeId: string) => void;
  /**
   * Called when a node is clicked, with the node's STIX id and its full STIX
   * object as plain JSON (null for nodes without a backing STIX object).
   */
  onNodeSelect?: (
    nodeId: string,
    stixObject: Record<string, any> | null
  ) => void;
  /**
   * Called when an edge is clicked, with the edge id and the backing STIX
   * relationship object (plain JSON), or null for embedded-reference edges.
   */
  onEdgeSelect?: (
    edgeId: string,
    relationship: Record<string, any> | null
  ) => void;
  /**
   * Called on every tap with the currently selected node and edge ids (empty
   * arrays mean the tap deselected everything).
   */
  onSelectionChange?: (selection: { nodes: string[]; edges: string[] }) => void;
  /** Called when the STIX content is invalid or the layout fails. */
  onError?: (error: unknown) => void;
  /**
   * Graph-builder configuration: `include`/`exclude` filter criteria,
   * `userLabels`, per-type `displayProperty`/`displayIcon`/
   * `embeddedRelationships`. Plain JSON-able object (recommended).
   */
  config?: Record<string, any>;
  /** Render placeholder "ghost" nodes for references missing from the bundle. */
  showDanglingRefs?: boolean;
  /** Show a detail panel for the selected node. Off by default. */
  showDetailsPanel?: boolean;
  /** Show the toolbar (search, legend toggles, zoom, export). Off by default. */
  showToolbar?: boolean;
  /** Colours and sizes, merged with the defaults (see {@link StixTheme}). */
  theme?: Partial<StixTheme>;
  /** Icons to use instead of the bundled ones, keyed by STIX type. */
  icons?: StixIconMap;
  /** Force-layout tuning for large or unusual graphs. */
  layout?: LayoutOptions;
  /** Radius of the node circles, in points. Defaults to 22. */
  nodeRadius?: number;
  /**
   * Renders the toolbar's "Export JSON" button when provided. It receives the
   * currently visible nodes and edges as pretty-printed JSON; where that goes
   * (clipboard, filesystem, share sheet) is up to the caller.
   */
  onExportJson?: (json: string) => void;
  /** Renders the detail panel's "Copy JSON" button when provided. */
  onCopyJson?: (json: string) => void;
  /** Shown instead of the graph when there is no STIX content to draw. */
  emptyComponent?: React.ReactNode;
  /** Shown instead of the graph when the STIX content is invalid. */
  errorComponent?: (error: unknown) => React.ReactNode;
  testID?: string;
}

interface SelectedNode {
  id: string;
  stixObject: Record<string, any> | null;
}

/**
 * Renders STIX 2.1 content as an interactive relationship graph on iOS and
 * Android, entirely on-device.
 *
 * The props mirror the `stix2vis` web component, so the same screen code works
 * on web and native: `stixJson`, `config`, `showDanglingRefs`,
 * `showDetailsPanel`, `showToolbar` and the `onNodeclick`/`onNodeSelect`/
 * `onEdgeSelect`/`onSelectionChange`/`onError` callbacks all behave the same
 * way. Everything React Native needs on top of that — `theme`, `icons`,
 * `layout` — is additive.
 */
export const Stix2Vis: React.FC<Stix2VisProps> = ({
  stixJson,
  graphStyle,
  wrapStyle,
  onNodeclick,
  onNodeSelect,
  onEdgeSelect,
  onSelectionChange,
  onError,
  config,
  showDanglingRefs,
  showDetailsPanel = false,
  showToolbar = false,
  theme,
  icons,
  layout,
  nodeRadius,
  onExportJson,
  onCopyJson,
  emptyComponent,
  errorComponent,
  testID = "stix2vis",
}) => {
  const resolvedTheme = useMemo(() => resolveTheme(theme), [theme]);

  const canvasRef = useRef<GraphViewportControls | null>(null);

  const { graph, positions, bounds, legend, error } = useStixGraph({
    stixJson,
    config,
    showDanglingRefs,
    layout,
    onError,
  });

  // Latest props, so the handlers below can stay referentially stable and the
  // memoised SVG elements are not rebuilt on every parent render. The refs are
  // synced in an effect (declared before the graph effect that reads them), as
  // refs must not be written during render.
  const callbacksRef = useRef({
    onNodeclick,
    onNodeSelect,
    onEdgeSelect,
    onSelectionChange,
    showDetailsPanel,
    onExportJson,
  });

  const graphRef = useRef(graph);

  const [selectedNodes, setSelectedNodes] = useState<string[]>([]);
  const [selectedEdges, setSelectedEdges] = useState<string[]>([]);
  const [selectedNode, setSelectedNode] = useState<SelectedNode | null>(null);
  const [hiddenTypes, setHiddenTypes] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMessage, setSearchMessage] = useState<string | null>(null);

  const hiddenTypesRef = useRef(hiddenTypes);

  useEffect(() => {
    callbacksRef.current = {
      onNodeclick,
      onNodeSelect,
      onEdgeSelect,
      onSelectionChange,
      showDetailsPanel,
      onExportJson,
    };
    graphRef.current = graph;
    hiddenTypesRef.current = hiddenTypes;
  });

  // A new graph means the previous selection, filters and search no longer
  // refer to anything. Resetting it in one batch here is intentional (once per
  // rebuild, not per render) and mirrors the web package's behaviour.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedNodes([]);
    setSelectedEdges([]);
    setSelectedNode(null);
    setHiddenTypes([]);
    setSearchMessage(null);
  }, [graph]);

  const handleNodePress = useCallback((node: GraphNode) => {
    const callbacks = callbacksRef.current;
    const raw = graphRef.current?.stixIdToObject.get(node.id) ?? null;
    const plainObject = raw ? mapToPlain(raw) : null;

    // Legacy contract: onNodeclick only fires when a node was clicked.
    callbacks.onNodeclick?.(node.id);
    callbacks.onNodeSelect?.(node.id, plainObject);

    setSelectedNodes([node.id]);
    setSelectedEdges([]);

    if (callbacks.showDetailsPanel)
      setSelectedNode({ id: node.id, stixObject: plainObject });

    callbacks.onSelectionChange?.({ nodes: [node.id], edges: [] });
  }, []);

  const handleEdgePress = useCallback((edge: GraphEdge) => {
    const callbacks = callbacksRef.current;
    const raw = graphRef.current?.stixIdToObject.get(edge.id) ?? null;

    // Embedded-reference edges have no STIX object of their own.
    const relationship =
      raw && raw.get("type") === "relationship" ? mapToPlain(raw) : null;

    callbacks.onEdgeSelect?.(edge.id, relationship);

    setSelectedEdges([edge.id]);
    setSelectedNodes([]);
    callbacks.onSelectionChange?.({ nodes: [], edges: [edge.id] });
  }, []);

  const handleBackgroundPress = useCallback(() => {
    setSelectedNodes([]);
    setSelectedEdges([]);
    setSelectedNode(null);

    callbacksRef.current.onSelectionChange?.({ nodes: [], edges: [] });
  }, []);

  const handleToggleType = useCallback((type: string) => {
    setHiddenTypes((previous) =>
      previous.includes(type)
        ? previous.filter((entry) => entry !== type)
        : [...previous, type]
    );
  }, []);

  const handleSearchSubmit = useCallback(() => {
    const query = searchQuery.trim();
    setSearchMessage(null);

    const current = graphRef.current;
    if (!query || !current) return;

    const needle = query.toLowerCase();
    const target =
      current.nodes.find((node) => node.id === query) ??
      current.nodes.find((node) => node.label.toLowerCase().includes(needle));

    if (!target) {
      setSearchMessage(`No node matching "${query}"`);
      return;
    }

    const raw = current.stixIdToObject.get(target.id) ?? null;
    const plainObject = raw ? mapToPlain(raw) : null;

    setSelectedNodes([target.id]);
    setSelectedEdges([]);

    if (callbacksRef.current.showDetailsPanel)
      setSelectedNode({ id: target.id, stixObject: plainObject });

    canvasRef.current?.centerOn(target.id);
  }, [searchQuery]);

  const handleExportJson = useCallback(() => {
    const current = graphRef.current;
    if (!current) return;

    const hidden = new Set(hiddenTypesRef.current);
    const nodes = current.nodes.filter((node) => !hidden.has(node.group));
    const visibleIds = new Set(nodes.map((node) => node.id));
    const edges = current.edges.filter(
      (edge) => visibleIds.has(edge.from) && visibleIds.has(edge.to)
    );

    callbacksRef.current.onExportJson?.(
      JSON.stringify({ nodes, edges }, null, 2)
    );
  }, []);

  const graphContent = graph ? (
    <GraphCanvas
      ref={canvasRef}
      nodes={graph.nodes}
      edges={graph.edges}
      positions={positions}
      bounds={bounds}
      hiddenTypes={hiddenTypes}
      selectedNodes={selectedNodes}
      selectedEdges={selectedEdges}
      theme={theme}
      icons={icons}
      nodeRadius={nodeRadius}
      onNodePress={handleNodePress}
      onEdgePress={handleEdgePress}
      onBackgroundPress={handleBackgroundPress}
    />
  ) : error ? (
    (errorComponent?.(error) ?? (
      <Text
        testID="stix2vis-error"
        style={[styles.message, { color: resolvedTheme.danger }]}
      >
        {error instanceof Error ? error.message : String(error)}
      </Text>
    ))
  ) : (
    (emptyComponent ?? (
      <Text
        testID="stix2vis-empty"
        style={[styles.message, { color: resolvedTheme.mutedText }]}
      >
        No STIX content to display.
      </Text>
    ))
  );

  return (
    <View testID={testID} style={[styles.app, wrapStyle]}>
      {showToolbar ? (
        <StixToolbar
          legend={legend}
          hiddenTypes={hiddenTypes}
          onToggleType={handleToggleType}
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          onSubmitSearch={handleSearchSubmit}
          searchMessage={searchMessage}
          onZoomIn={() => canvasRef.current?.zoomIn()}
          onZoomOut={() => canvasRef.current?.zoomOut()}
          onFit={() => canvasRef.current?.fit()}
          onExportJson={onExportJson ? handleExportJson : undefined}
          icons={icons}
          theme={theme}
        />
      ) : null}

      <View style={[styles.graph, graphStyle]}>{graphContent}</View>

      {showDetailsPanel && selectedNode ? (
        <StixDetailsPanel
          id={selectedNode.id}
          stixObject={selectedNode.stixObject}
          theme={theme}
          onCopyJson={onCopyJson}
          onClose={() => setSelectedNode(null)}
        />
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  app: {
    alignSelf: "stretch",
  },
  graph: {
    // React Native views have no intrinsic size, so the canvas needs one.
    // Override with `graphStyle`, e.g. `{ flex: 1 }` inside a flex parent.
    height: 420,
  },
  message: {
    margin: 16,
    fontSize: 13,
  },
});

export default Stix2Vis;
