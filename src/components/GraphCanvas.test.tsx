import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";

import { GraphCanvas, type GraphViewportControls } from "./GraphCanvas";
import { fitToBounds } from "../layout/geometry";
import type { GraphEdge, GraphNode, LayoutBounds, Point } from "../types";

const NODES: GraphNode[] = [
  { id: "a", label: "Node A", group: "malware" },
  { id: "b", label: "Node B", group: "indicator" },
];

const EDGES: GraphEdge[] = [
  { id: "e1", from: "a", to: "b", label: "indicates" },
];

const POSITIONS = new Map<string, Point>([
  ["a", { x: 0, y: 0 }],
  ["b", { x: 100, y: 0 }],
]);

const BOUNDS: LayoutBounds = {
  minX: -50,
  minY: -50,
  maxX: 150,
  maxY: 50,
  width: 200,
  height: 100,
};

function findAllByTestId(renderer: ReactTestRenderer, testID: string) {
  return renderer.root.findAll((node) => node.props.testID === testID);
}

/**
 * Host elements carrying `testID`. Composite components forward the prop to the
 * host element they render, so a plain `findAll` matches twice.
 */
function findByTestId(renderer: ReactTestRenderer, testID: string) {
  return findAllByTestId(renderer, testID).filter(
    (node) => typeof node.type === "string"
  );
}

function byType(renderer: ReactTestRenderer, type: string) {
  // `node.type` is typed as React's `ElementType`, which only admits the
  // platform's own host component names; the SVG mock uses its own names.
  return renderer.root.findAll(
    (node) => (node.type as unknown as string) === type
  );
}

/** Simulates the native layout pass that gives the canvas its size. */
function layout(renderer: ReactTestRenderer, width = 400, height = 400) {
  const canvas = findByTestId(renderer, "stix2vis-canvas")[0]!;

  act(() => {
    canvas.props.onLayout({
      nativeEvent: { layout: { x: 0, y: 0, width, height } },
    });
  });
}

interface RenderOptions {
  nodes?: GraphNode[];
  edges?: GraphEdge[];
  positions?: Map<string, Point>;
  selectedNodes?: string[];
  selectedEdges?: string[];
  hiddenTypes?: string[];
  onNodePress?: jest.Mock;
  onEdgePress?: jest.Mock;
  onBackgroundPress?: jest.Mock;
}

function renderCanvas(options: RenderOptions = {}) {
  const callbacks = {
    onNodePress: options.onNodePress ?? jest.fn(),
    onEdgePress: options.onEdgePress ?? jest.fn(),
    onBackgroundPress: options.onBackgroundPress ?? jest.fn(),
  };
  const ref = React.createRef<GraphViewportControls>();

  let renderer!: ReactTestRenderer;

  act(() => {
    renderer = create(
      <GraphCanvas
        ref={ref}
        nodes={options.nodes ?? NODES}
        edges={options.edges ?? EDGES}
        positions={options.positions ?? POSITIONS}
        bounds={BOUNDS}
        selectedNodes={options.selectedNodes}
        selectedEdges={options.selectedEdges}
        hiddenTypes={options.hiddenTypes}
        {...callbacks}
      />
    );
  });

  return { renderer, ref, ...callbacks };
}

describe("GraphCanvas", () => {
  it("renders nothing until it has been measured", () => {
    const { renderer } = renderCanvas();

    expect(byType(renderer, "RNSVG.Svg")).toHaveLength(0);
  });

  it("draws one circle, icon and label per node once measured", () => {
    const { renderer } = renderCanvas();
    layout(renderer);

    expect(byType(renderer, "RNSVG.Circle")).toHaveLength(2);
    expect(byType(renderer, "RNSVG.Image")).toHaveLength(2);
    expect(byType(renderer, "RNSVG.Text")).toHaveLength(3); // 2 labels + 1 edge
  });

  it("draws the edge line, arrow head and label", () => {
    const { renderer } = renderCanvas();
    layout(renderer);

    expect(byType(renderer, "RNSVG.Line")).toHaveLength(2); // visible + hit area
    expect(byType(renderer, "RNSVG.Polygon")).toHaveLength(1);
    expect(byType(renderer, "RNSVG.Text")[0]!.props.children).toBe("indicates");
  });

  it("centres the graph in the viewport", () => {
    const { renderer } = renderCanvas();
    layout(renderer);

    const circle = byType(renderer, "RNSVG.Circle")[0]!;

    // Position (0, 0) in a 200x100 graph, centred in a 400x400 viewport.
    expect(circle.props.cx).toBe(150);
    expect(circle.props.cy).toBe(200);
  });

  it("draws a letter placeholder when a type has no bundled icon", () => {
    const nodes: GraphNode[] = [
      { id: "x", label: "Mystery", group: "mystery" },
    ];

    const { renderer } = renderCanvas({
      nodes,
      edges: [],
      positions: new Map([["x", { x: 0, y: 0 }]]),
    });
    layout(renderer);

    expect(byType(renderer, "RNSVG.Image")).toHaveLength(0);

    const texts = byType(renderer, "RNSVG.Text");
    expect(texts.some((text) => text.props.children === "M")).toBe(true);
  });

  it("calls onNodePress with the whole node", () => {
    const onNodePress = jest.fn();
    const { renderer } = renderCanvas({ onNodePress });
    layout(renderer);

    act(() => {
      findByTestId(renderer, "stix2vis-node-a")[0]!.props.onPress();
    });

    expect(onNodePress).toHaveBeenCalledWith(NODES[0]);
  });

  it("calls onEdgePress with the whole edge", () => {
    const onEdgePress = jest.fn();
    const { renderer } = renderCanvas({ onEdgePress });
    layout(renderer);

    act(() => {
      findByTestId(renderer, "stix2vis-edge-e1")[0]!.props.onPress();
    });

    expect(onEdgePress).toHaveBeenCalledWith(EDGES[0]);
  });

  it("calls onBackgroundPress when the canvas itself is tapped", () => {
    const onBackgroundPress = jest.fn();
    const { renderer } = renderCanvas({ onBackgroundPress });
    layout(renderer);

    const background = byType(renderer, "RNSVG.Rect").find(
      (node) => typeof node.props.onPress === "function"
    )!;

    act(() => {
      background.props.onPress();
    });

    expect(onBackgroundPress).toHaveBeenCalledTimes(1);
  });

  it("hides every node of a hidden STIX type", () => {
    const { renderer } = renderCanvas({ hiddenTypes: ["indicator"] });
    layout(renderer);

    expect(findByTestId(renderer, "stix2vis-node-a")).toHaveLength(1);
    expect(findByTestId(renderer, "stix2vis-node-b")).toHaveLength(0);
    // The edge loses one of its endpoints, so it is not drawn either.
    expect(findByTestId(renderer, "stix2vis-edge-e1")).toHaveLength(0);
  });

  it("draws a selection ring around the selected node", () => {
    const { renderer } = renderCanvas({ selectedNodes: ["a"] });
    layout(renderer);

    expect(byType(renderer, "RNSVG.Circle")).toHaveLength(3);
  });

  it("highlights the selected edge", () => {
    const { renderer } = renderCanvas({ selectedEdges: ["e1"] });
    layout(renderer);

    const line = byType(renderer, "RNSVG.Line")[0]!;

    expect(line.props.strokeWidth).toBe(3);
  });

  it("skips nodes that have no position", () => {
    const { renderer } = renderCanvas({
      positions: new Map([["a", { x: 0, y: 0 }]]),
    });
    layout(renderer);

    expect(findByTestId(renderer, "stix2vis-node-a")).toHaveLength(1);
    expect(findByTestId(renderer, "stix2vis-node-b")).toHaveLength(0);
  });

  it("accepts a custom node radius", () => {
    const ref = React.createRef<GraphViewportControls>();

    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(
        <GraphCanvas
          ref={ref}
          nodes={NODES}
          edges={EDGES}
          positions={POSITIONS}
          bounds={BOUNDS}
          nodeRadius={10}
        />
      );
    });
    layout(renderer);

    expect(byType(renderer, "RNSVG.Circle")[0]!.props.r).toBe(10);
  });
});

describe("GraphCanvas viewport controls", () => {
  it("exposes zoom, fit, reset and centre-on through a ref", () => {
    const { renderer, ref } = renderCanvas();
    layout(renderer);

    expect(ref.current).not.toBeNull();
    expect(ref.current!.getTransform()).toEqual({
      scale: 1,
      translateX: 150,
      translateY: 200,
    });

    act(() => {
      ref.current!.zoomIn();
    });

    const zoomed = ref.current!.getTransform();
    expect(zoomed.scale).toBeGreaterThan(1);
    // The anchor is the viewport centre, so the graph stays centred.
    expect(byType(renderer, "RNSVG.Circle")[0]!.props.cx).toBeLessThan(150);

    act(() => {
      ref.current!.zoomOut();
    });

    expect(ref.current!.getTransform().scale).toBeCloseTo(1);

    act(() => {
      ref.current!.reset();
    });

    expect(byType(renderer, "RNSVG.Circle")[0]!.props.cx).toBe(150);

    act(() => {
      ref.current!.centerOn("b");
    });

    // Node b sits at x = 100 in graph space, now in the middle of the viewport.
    const circles = byType(renderer, "RNSVG.Circle");
    expect(circles[1]!.props.cx).toBe(200);
  });

  it("does nothing when asked to centre an unknown node", () => {
    const { renderer, ref } = renderCanvas();
    layout(renderer);

    const before = ref.current!.getTransform();

    act(() => {
      ref.current!.centerOn("nope");
    });

    expect(ref.current!.getTransform()).toEqual(before);
  });

  it("re-fits the graph when the viewport is resized", () => {
    const { renderer, ref } = renderCanvas();
    layout(renderer, 400, 400);

    const before = ref.current!.getTransform();

    layout(renderer, 200, 200);

    const after = ref.current!.getTransform();

    expect(after).not.toEqual(before);
    expect(after).toEqual(fitToBounds(BOUNDS, 200, 200));
    // The whole graph is still inside the smaller viewport.
    expect(after.scale).toBeLessThan(1);
  });
});

describe("GraphCanvas gestures", () => {
  interface TouchRecord {
    pageX: number;
    pageY: number;
  }

  /**
   * Builds the events React Native's `PanResponder` expects: it derives drag
   * deltas from a touch history of its own, so a realistic (if synthetic)
   * `touchHistory` is needed rather than a hand-written `dx`/`dy`.
   */
  function createGestureSimulator() {
    let timestamp = 0;
    let start: TouchRecord[] = [];
    let previous: TouchRecord[] = [];

    return function simulate(touches: TouchRecord[]) {
      timestamp += 100;

      if (start.length !== touches.length) {
        start = touches.map((touch) => ({ ...touch }));
        previous = touches.map((touch) => ({ ...touch }));
      }

      const touchBank = touches.map((touch, index) => {
        const before = previous[index] ?? touch;
        const first = start[index] ?? touch;

        return {
          touchActive: true,
          startPageX: first.pageX,
          startPageY: first.pageY,
          startTimeStamp: 0,
          currentPageX: touch.pageX,
          currentPageY: touch.pageY,
          currentTimeStamp: timestamp,
          previousPageX: before.pageX,
          previousPageY: before.pageY,
          previousTimeStamp: timestamp - 100,
        };
      });

      previous = touches.map((touch) => ({ ...touch }));

      return {
        nativeEvent: { touches },
        touchHistory: {
          touchBank,
          numberActiveTouches: touches.length,
          indexOfSingleActiveTouch: 0,
          mostRecentTimeStamp: timestamp,
        },
      };
    };
  }

  function canvasProps(renderer: ReactTestRenderer) {
    return findByTestId(renderer, "stix2vis-canvas")[0]!.props;
  }

  it("only claims the responder once the finger actually moves", () => {
    const { renderer } = renderCanvas();
    layout(renderer);

    const simulate = createGestureSimulator();
    const props = canvasProps(renderer);

    // A tap belongs to the SVG elements, not to the pan gesture.
    expect(
      props.onStartShouldSetResponder(simulate([{ pageX: 100, pageY: 100 }]))
    ).toBe(false);
    expect(
      props.onStartShouldSetResponder(
        simulate([
          { pageX: 100, pageY: 100 },
          { pageX: 200, pageY: 100 },
        ])
      )
    ).toBe(true);

    act(() => {
      props.onResponderGrant(simulate([{ pageX: 100, pageY: 100 }]));
    });

    // React Native dispatches the capture phase before the bubble phase, and
    // that is where PanResponder refreshes the drag deltas.
    const moveTo = (pageX: number) => {
      const event = simulate([{ pageX, pageY: 100 }]);

      props.onMoveShouldSetResponderCapture(event);

      return props.onMoveShouldSetResponder(event);
    };

    expect(moveTo(102)).toBe(false);
    expect(moveTo(140)).toBe(true);
  });

  it("pans the graph with one finger", () => {
    const { renderer, ref } = renderCanvas();
    layout(renderer);

    const simulate = createGestureSimulator();
    const props = canvasProps(renderer);

    act(() => {
      props.onResponderGrant(simulate([{ pageX: 100, pageY: 100 }]));
    });
    act(() => {
      props.onResponderMove(simulate([{ pageX: 130, pageY: 90 }]));
    });

    const transform = ref.current!.getTransform();

    expect(transform.scale).toBe(1);
    expect(transform.translateX).toBe(180);
    expect(transform.translateY).toBe(190);
    expect(byType(renderer, "RNSVG.Circle")[0]!.props.cx).toBe(180);
  });

  it("zooms with two fingers, anchored on their midpoint", () => {
    const { renderer, ref } = renderCanvas();
    layout(renderer);

    const simulate = createGestureSimulator();
    const props = canvasProps(renderer);

    // Two fingers 200pt apart, centred on the middle of the viewport.
    act(() => {
      props.onResponderGrant(
        simulate([
          { pageX: 100, pageY: 200 },
          { pageX: 300, pageY: 200 },
        ])
      );
    });

    // Spread to 400pt apart: double the distance, same midpoint.
    act(() => {
      props.onResponderMove(
        simulate([
          { pageX: 0, pageY: 200 },
          { pageX: 400, pageY: 200 },
        ])
      );
    });

    expect(ref.current!.getTransform().scale).toBeCloseTo(2);
    expect(ref.current!.getTransform().translateX).toBeCloseTo(100);
    // The graph point that was under the fingers is still under them.
    expect(byType(renderer, "RNSVG.Circle")[0]!.props.cx).toBe(100);
  });

  it("keeps panning while two fingers are down", () => {
    const { renderer, ref } = renderCanvas();
    layout(renderer);

    const simulate = createGestureSimulator();
    const props = canvasProps(renderer);

    act(() => {
      props.onResponderGrant(
        simulate([
          { pageX: 100, pageY: 200 },
          { pageX: 300, pageY: 200 },
        ])
      );
    });

    // Same distance, moved 25pt to the right.
    act(() => {
      props.onResponderMove(
        simulate([
          { pageX: 125, pageY: 200 },
          { pageX: 325, pageY: 200 },
        ])
      );
    });

    const transform = ref.current!.getTransform();

    expect(transform.scale).toBeCloseTo(1);
    expect(transform.translateX).toBeCloseTo(175);
  });
});
