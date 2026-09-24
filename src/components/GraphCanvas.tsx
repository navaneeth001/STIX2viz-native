import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  PanResponder,
  StyleSheet,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from "react-native";
import Svg, {
  Circle,
  G,
  Image as SvgImage,
  Line,
  Polygon,
  Rect,
  Text as SvgText,
} from "react-native-svg";

import { resolveStixIcon, type StixIconMap } from "../icons";
import {
  edgeGeometry,
  fitToBounds,
  round,
  truncateLabel,
  zoomAround,
  type ViewTransform,
} from "../layout/geometry";
import { groupColor, resolveTheme, type StixTheme } from "../theme";
import type { GraphEdge, GraphNode, LayoutBounds, Point } from "../types";

const DEFAULT_NODE_RADIUS = 22;
/** Touch width of an edge: lines are thin, fingers are not. */
const EDGE_HIT_WIDTH = 24;
/** Characters of a node label drawn under the node. */
const LABEL_MAX_CHARS = 22;
/** Nodes this far outside the viewport are still drawn (avoids edge popping). */
const CULL_MARGIN = 80;

/** Imperative viewport controls, so a toolbar can drive the canvas. */
export interface GraphViewportControls {
  zoomIn(): void;
  zoomOut(): void;
  /** Fits the whole graph into the viewport. */
  fit(): void;
  /** Restores 1:1 scale, centred on the graph. */
  reset(): void;
  /** Centres (and selects) a node — used by the toolbar search. */
  centerOn(nodeId: string): void;
  getTransform(): ViewTransform;
}

export interface GraphCanvasProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  /** Graph-space position of every node, as returned by `computeLayout`. */
  positions: Map<string, Point>;
  /** Bounding box used by the initial fit; `null` for an empty graph. */
  bounds: LayoutBounds | null;
  /** STIX types hidden through the legend. */
  hiddenTypes?: string[];
  /** Currently selected node/edge ids. */
  selectedNodes?: string[];
  selectedEdges?: string[];
  /** Partial theme, merged over the defaults. */
  theme?: Partial<StixTheme>;
  /** Icons to use instead of the bundled ones, keyed by STIX type. */
  icons?: StixIconMap;
  /** Radius of the node circles, in screen units. */
  nodeRadius?: number;
  /** Called when a node is tapped, including ghost nodes. */
  onNodePress?(node: GraphNode): void;
  /** Called when an edge is tapped. */
  onEdgePress?(edge: GraphEdge): void;
  /** Called when the canvas itself is tapped (clears the selection). */
  onBackgroundPress?(): void;
  testID?: string;
}

interface TouchPoint {
  pageX: number;
  pageY: number;
}

function touchDistance(touches: TouchPoint[]): number {
  const [a, b] = touches;
  if (!a || !b) return 1;

  return Math.sqrt((a.pageX - b.pageX) ** 2 + (a.pageY - b.pageY) ** 2) || 1;
}

function touchMidpoint(touches: TouchPoint[]): Point {
  const [a, b] = touches;
  if (!a || !b) return { x: 0, y: 0 };

  return { x: (a.pageX + b.pageX) / 2, y: (a.pageY + b.pageY) / 2 };
}

interface GestureStart {
  transform: ViewTransform;
  distance: number | null;
  midpoint: Point | null;
}

/**
 * The graph itself: a `react-native-svg` surface with tap selection, drag to
 * pan and pinch to zoom.
 *
 * Positions come from {@link computeLayout} in graph space; this component maps
 * them onto the screen, so node radii, stroke widths and font sizes stay
 * constant while zooming — only the distances change.
 */
export const GraphCanvas = forwardRef<GraphViewportControls, GraphCanvasProps>(
  function GraphCanvas(
    {
      nodes,
      edges,
      positions,
      bounds,
      hiddenTypes,
      selectedNodes,
      selectedEdges,
      theme,
      icons,
      nodeRadius = DEFAULT_NODE_RADIUS,
      onNodePress,
      onEdgePress,
      onBackgroundPress,
      testID = "stix2vis-canvas",
    },
    ref
  ) {
    const resolvedTheme = useMemo(() => resolveTheme(theme), [theme]);

    const [size, setSize] = useState({ width: 0, height: 0 });
    const [transform, setTransform] = useState<ViewTransform>({
      scale: 1,
      translateX: 0,
      translateY: 0,
    });

    const transformRef = useRef(transform);
    transformRef.current = transform;

    const gestureRef = useRef<GestureStart>({
      transform,
      distance: null,
      midpoint: null,
    });

    // Re-fit whenever a new graph is laid out or the viewport is resized. The
    // bounds object identity changes exactly once per layout, so panning and
    // zooming afterwards are not undone by a re-render.
    const fittedBoundsRef = useRef<LayoutBounds | null>(null);
    const previousSizeRef = useRef({ width: 0, height: 0 });

    useEffect(() => {
      if (size.width <= 0 || size.height <= 0 || !bounds) return;

      const sizeChanged =
        previousSizeRef.current.width !== size.width ||
        previousSizeRef.current.height !== size.height;

      if (fittedBoundsRef.current === bounds && !sizeChanged) return;

      fittedBoundsRef.current = bounds;
      previousSizeRef.current = { ...size };

      setTransform(fitToBounds(bounds, size.width, size.height));
    }, [bounds, size]);

    const handleLayout = useCallback((event: LayoutChangeEvent) => {
      const { width, height } = event.nativeEvent.layout;
      setSize((previous) =>
        previous.width === width && previous.height === height
          ? previous
          : { width, height }
      );
    }, []);

    const zoomBy = useCallback(
      (factor: number) => {
        setTransform((current) =>
          zoomAround(
            current,
            factor,
            (size.width || 0) / 2,
            (size.height || 0) / 2
          )
        );
      },
      [size.height, size.width]
    );

    useImperativeHandle(
      ref,
      (): GraphViewportControls => ({
        zoomIn: () => zoomBy(1.4),
        zoomOut: () => zoomBy(1 / 1.4),
        fit: () => {
          if (bounds && size.width > 0 && size.height > 0)
            setTransform(fitToBounds(bounds, size.width, size.height));
        },
        reset: () => {
          if (!bounds) return;

          setTransform({
            scale: 1,
            translateX: size.width / 2 - (bounds.minX + bounds.maxX) / 2,
            translateY: size.height / 2 - (bounds.minY + bounds.maxY) / 2,
          });
        },
        centerOn: (nodeId: string) => {
          const position = positions.get(nodeId);
          if (!position) return;

          setTransform((current) => ({
            ...current,
            translateX: size.width / 2 - position.x * current.scale,
            translateY: size.height / 2 - position.y * current.scale,
          }));
        },
        getTransform: () => transformRef.current,
      }),
      [bounds, positions, size.height, size.width, zoomBy]
    );

    const panResponder = useMemo(
      () =>
        PanResponder.create({
          // Two fingers always mean "zoom"; a single tap is left to the SVG
          // elements, which receive it as a normal press.
          onStartShouldSetPanResponder: (event) =>
            event.nativeEvent.touches.length > 1,
          onMoveShouldSetPanResponder: (event, gesture) =>
            event.nativeEvent.touches.length > 1 ||
            Math.abs(gesture.dx) > 3 ||
            Math.abs(gesture.dy) > 3,
          onPanResponderGrant: (event) => {
            const touches = event.nativeEvent.touches;

            gestureRef.current = {
              transform: transformRef.current,
              distance: touches.length > 1 ? touchDistance(touches) : null,
              midpoint: touches.length > 1 ? touchMidpoint(touches) : null,
            };
          },
          onPanResponderMove: (event: GestureResponderEvent, gesture) => {
            const start = gestureRef.current;
            const touches = event.nativeEvent.touches;

            if (touches.length > 1 && start.distance && start.midpoint) {
              const factor = touchDistance(touches) / start.distance;
              const midpoint = touchMidpoint(touches);

              const zoomed = zoomAround(
                start.transform,
                factor,
                start.midpoint.x,
                start.midpoint.y
              );

              // Two fingers also drag: follow the midpoint.
              setTransform({
                ...zoomed,
                translateX: zoomed.translateX + (midpoint.x - start.midpoint.x),
                translateY: zoomed.translateY + (midpoint.y - start.midpoint.y),
              });

              return;
            }

            setTransform({
              ...start.transform,
              translateX: start.transform.translateX + gesture.dx,
              translateY: start.transform.translateY + gesture.dy,
            });
          },
          onPanResponderTerminationRequest: () => true,
        }),
      []
    );

    const project = useCallback(
      (position: Point): Point => ({
        x: position.x * transform.scale + transform.translateX,
        y: position.y * transform.scale + transform.translateY,
      }),
      [transform]
    );

    const hidden = useMemo(() => new Set(hiddenTypes ?? []), [hiddenTypes]);
    const selectedNodesSet = useMemo(
      () => new Set(selectedNodes ?? []),
      [selectedNodes]
    );
    const selectedEdgesSet = useMemo(
      () => new Set(selectedEdges ?? []),
      [selectedEdges]
    );

    const { nodeElements, edgeElements } = useMemo(() => {
      const nodeElementsOut: React.ReactElement[] = [];
      const edgeElementsOut: React.ReactElement[] = [];

      if (size.width <= 0 || size.height <= 0)
        return { nodeElements: nodeElementsOut, edgeElements: edgeElementsOut };

      const inView = (point: Point) =>
        point.x >= -CULL_MARGIN &&
        point.x <= size.width + CULL_MARGIN &&
        point.y >= -CULL_MARGIN &&
        point.y <= size.height + CULL_MARGIN;

      // Project first: everything below works in screen coordinates, so radii,
      // strokes and fonts do not scale with the zoom.
      const projected = new Map<string, Point>();
      for (const node of nodes) {
        if (hidden.has(node.group)) continue;

        const position = positions.get(node.id);
        if (position) projected.set(node.id, project(position));
      }

      for (const edge of edges) {
        const from = projected.get(edge.from);
        const to = projected.get(edge.to);

        if (!from || !to) continue;
        if (!inView(from) && !inView(to)) continue;

        const geometry = edgeGeometry(from, to, nodeRadius, nodeRadius);
        const highlight = selectedEdgesSet.has(edge.id);

        edgeElementsOut.push(
          <G key={edge.id}>
            <Line
              x1={geometry.x1}
              y1={geometry.y1}
              x2={geometry.x2}
              y2={geometry.y2}
              stroke={highlight ? resolvedTheme.selection : resolvedTheme.edge}
              strokeWidth={highlight ? 3 : 1.5}
            />
            <Polygon
              points={geometry.arrowPoints}
              fill={highlight ? resolvedTheme.selection : resolvedTheme.edge}
            />
            <SvgText
              x={geometry.labelX}
              y={geometry.labelY}
              fontSize={10}
              textAnchor="middle"
              fill={resolvedTheme.edgeLabel}
            >
              {edge.label}
            </SvgText>
            {/* Wider transparent line: edges are hard to hit otherwise. This
                is the element that receives the tap, so it carries the
                testID. */}
            <Line
              testID={`stix2vis-edge-${edge.id}`}
              x1={geometry.x1}
              y1={geometry.y1}
              x2={geometry.x2}
              y2={geometry.y2}
              stroke="transparent"
              strokeWidth={EDGE_HIT_WIDTH}
              strokeLinecap="round"
              onPress={() => onEdgePress?.(edge)}
            />
          </G>
        );
      }

      for (const node of nodes) {
        const screen = projected.get(node.id);
        if (!screen || !inView(screen)) continue;

        const color =
          node.group === "unknown"
            ? resolvedTheme.dangling
            : groupColor(node.group, resolvedTheme);
        const selected = selectedNodesSet.has(node.id);
        const icon = resolveStixIcon(node.group, icons);
        const opacity = node.dangling ? 0.35 : 1;

        nodeElementsOut.push(
          <G
            key={node.id}
            testID={`stix2vis-node-${node.id}`}
            onPress={() => onNodePress?.(node)}
          >
            {selected ? (
              <Circle
                cx={round(screen.x)}
                cy={round(screen.y)}
                r={nodeRadius + 5}
                fill="none"
                stroke={resolvedTheme.selection}
                strokeWidth={2}
              />
            ) : null}
            <Circle
              cx={round(screen.x)}
              cy={round(screen.y)}
              r={nodeRadius}
              fill={resolvedTheme.nodeFill}
              stroke={color}
              strokeWidth={node.dangling ? 2 : 1.5}
              strokeDasharray={node.dangling ? "4,3" : undefined}
              opacity={opacity}
            />
            {icon ? (
              <SvgImage
                x={round(screen.x - nodeRadius * 0.72)}
                y={round(screen.y - nodeRadius * 0.72)}
                width={round(nodeRadius * 1.44)}
                height={round(nodeRadius * 1.44)}
                href={icon}
                opacity={opacity}
              />
            ) : (
              <SvgText
                x={round(screen.x)}
                y={round(screen.y + 5)}
                fontSize={16}
                fontWeight="600"
                textAnchor="middle"
                fill={color}
                opacity={opacity}
              >
                {placeholderLetter(node.group)}
              </SvgText>
            )}
            <SvgText
              x={round(screen.x)}
              y={round(screen.y + nodeRadius + 14)}
              fontSize={11}
              textAnchor="middle"
              fill={node.dangling ? resolvedTheme.dangling : resolvedTheme.text}
            >
              {truncateLabel(node.label, LABEL_MAX_CHARS)}
            </SvgText>
          </G>
        );
      }

      return { nodeElements: nodeElementsOut, edgeElements: edgeElementsOut };
    }, [
      edges,
      hidden,
      icons,
      nodeRadius,
      nodes,
      onEdgePress,
      onNodePress,
      positions,
      project,
      resolvedTheme,
      selectedEdgesSet,
      selectedNodesSet,
      size.height,
      size.width,
    ]);

    return (
      <View
        testID={testID}
        style={[
          styles.container,
          { backgroundColor: resolvedTheme.background },
        ]}
        onLayout={handleLayout}
        {...panResponder.panHandlers}
      >
        {size.width > 0 && size.height > 0 ? (
          <Svg width={size.width} height={size.height}>
            {/* Tapping the empty canvas clears the selection. */}
            <Rect
              x={0}
              y={0}
              width={size.width}
              height={size.height}
              fill="transparent"
              onPress={() => onBackgroundPress?.()}
            />
            <G>{edgeElements}</G>
            <G>{nodeElements}</G>
          </Svg>
        ) : null}
      </View>
    );
  }
);

/** Single-letter stand-in for STIX types without a bundled icon. */
function placeholderLetter(stixType: string): string {
  const letter = (stixType || "?").trim().charAt(0);

  return letter ? letter.toUpperCase() : "?";
}

const styles = StyleSheet.create({
  container: {
    // The canvas has no intrinsic size of its own: fill the box the parent
    // gives it — `Stix2Vis` sizes its wrapper (420pt by default) and callers
    // can pass `graphStyle={{ flex: 1 }}`. Without this the view measures 0
    // high, the `onLayout` size stays 0 and the SVG — which is only rendered
    // once the viewport is known — never appears.
    flex: 1,
    overflow: "hidden",
  },
});

export default GraphCanvas;
