import React from "react";
import {
  act,
  create,
  type ReactTestInstance,
  type ReactTestRenderer,
} from "react-test-renderer";

import Stix2Vis from "./Stix2Vis";

const IDENTITY = "identity--11111111-1111-4111-8111-111111111111";
const MALWARE = "malware--33333333-3333-4333-8333-333333333333";
const INDICATOR = "indicator--44444444-4444-4444-8444-444444444444";
const RELATIONSHIP = "relationship--55555555-5555-4555-8555-555555555555";
const BUNDLE = "bundle--66666666-6666-4666-8666-666666666666";
const MISSING = "threat-actor--99999999-9999-4999-8999-999999999999";

/**
 * Same fixture shape as the published demo data: an identity, the malware it
 * created, an indicator and the relationship that connects them.
 */
function makeBundle() {
  return {
    type: "bundle",
    id: BUNDLE,
    objects: [
      {
        type: "identity",
        id: IDENTITY,
        name: "Example Corp",
        created: "2024-01-01T00:00:00.000Z",
      },
      {
        type: "malware",
        id: MALWARE,
        name: "Adversary-in-the-middle",
        description: "A description",
        created_by_ref: IDENTITY,
      },
      {
        type: "indicator",
        id: INDICATOR,
        pattern_type: "stix",
        pattern: "[file:hashes.'MD5' = 'd41d8cd98f00b204e9800998ecf8427e']",
      },
      {
        type: "relationship",
        id: RELATIONSHIP,
        relationship_type: "indicates",
        source_ref: INDICATOR,
        target_ref: MALWARE,
      },
    ],
  };
}

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

/** Waits for effects (the graph is built and laid out in an effect chain). */
async function render(component: React.ReactElement) {
  let renderer!: ReactTestRenderer;

  await act(async () => {
    renderer = create(component);
  });

  // The canvas needs a size before anything is drawn; simulate the native
  // layout pass the way React Native would.
  const canvas = findByTestId(renderer, "stix2vis-canvas")[0];

  if (canvas) {
    await act(async () => {
      canvas.props.onLayout({
        nativeEvent: { layout: { x: 0, y: 0, width: 400, height: 400 } },
      });
    });
  }

  return renderer;
}

/**
 * Presses the element with `testID`, whichever layer of the tree carries the
 * handler (React Native's `Touchable*` forward `onPress` through several
 * components, `TextInput` through its own props).
 */
function press(renderer: ReactTestRenderer, testID: string) {
  const target = findAllByTestId(renderer, testID).find(
    (node: ReactTestInstance) => typeof node.props.onPress === "function"
  );

  if (!target) throw new Error(`No pressable element with testID "${testID}"`);

  act(() => {
    target.props.onPress();
  });
}

function type(renderer: ReactTestRenderer, testID: string, value: string) {
  const target = findAllByTestId(renderer, testID).find(
    (node: ReactTestInstance) => typeof node.props.onChangeText === "function"
  );

  if (!target) throw new Error(`No text input with testID "${testID}"`);

  act(() => {
    target.props.onChangeText(value);
  });
}

describe("Stix2Vis", () => {
  it("renders the graph with no toolbar or details panel by default", async () => {
    const renderer = await render(<Stix2Vis stixJson={makeBundle()} />);

    expect(findByTestId(renderer, `stix2vis-node-${MALWARE}`)).toHaveLength(1);
    expect(findByTestId(renderer, `stix2vis-node-${IDENTITY}`)).toHaveLength(1);
    expect(findByTestId(renderer, `stix2vis-node-${INDICATOR}`)).toHaveLength(
      1
    );
    expect(findByTestId(renderer, "stix2vis-toolbar")).toHaveLength(0);
    expect(findByTestId(renderer, "stix2vis-details")).toHaveLength(0);

    // Relationships are edges: no node for them.
    expect(
      findByTestId(renderer, `stix2vis-node-${RELATIONSHIP}`)
    ).toHaveLength(0);
    expect(byType(renderer, "RNSVG.Polygon")).toHaveLength(2);
  });

  it("calls onNodeclick and onNodeSelect with plain JSON", async () => {
    const onNodeclick = jest.fn();
    const onNodeSelect = jest.fn();

    const renderer = await render(
      <Stix2Vis
        stixJson={makeBundle()}
        onNodeclick={onNodeclick}
        onNodeSelect={onNodeSelect}
      />
    );

    press(renderer, `stix2vis-node-${MALWARE}`);

    expect(onNodeclick).toHaveBeenCalledWith(MALWARE);
    expect(onNodeSelect).toHaveBeenCalledWith(
      MALWARE,
      expect.objectContaining({
        type: "malware",
        name: "Adversary-in-the-middle",
      })
    );
    // Plain JSON-able object, not the internal Map representation.
    expect(onNodeSelect.mock.calls[0]![1]).not.toBeInstanceOf(Map);
  });

  it("calls onEdgeSelect with the relationship object", async () => {
    const onEdgeSelect = jest.fn();

    const renderer = await render(
      <Stix2Vis stixJson={makeBundle()} onEdgeSelect={onEdgeSelect} />
    );

    press(renderer, `stix2vis-edge-${RELATIONSHIP}`);

    expect(onEdgeSelect).toHaveBeenCalledWith(
      RELATIONSHIP,
      expect.objectContaining({
        type: "relationship",
        relationship_type: "indicates",
      })
    );
  });

  it("passes null for embedded-reference edges", async () => {
    const onEdgeSelect = jest.fn();

    const renderer = await render(
      <Stix2Vis stixJson={makeBundle()} onEdgeSelect={onEdgeSelect} />
    );

    press(renderer, `stix2vis-edge-${MALWARE}->${IDENTITY}::created-by`);

    expect(onEdgeSelect).toHaveBeenCalledWith(
      `${MALWARE}->${IDENTITY}::created-by`,
      null
    );
  });

  it("reports the selection on every tap", async () => {
    const onSelectionChange = jest.fn();

    const renderer = await render(
      <Stix2Vis stixJson={makeBundle()} onSelectionChange={onSelectionChange} />
    );

    press(renderer, `stix2vis-node-${MALWARE}`);
    expect(onSelectionChange).toHaveBeenLastCalledWith({
      nodes: [MALWARE],
      edges: [],
    });

    press(renderer, `stix2vis-edge-${RELATIONSHIP}`);
    expect(onSelectionChange).toHaveBeenLastCalledWith({
      nodes: [],
      edges: [RELATIONSHIP],
    });

    const background = byType(renderer, "RNSVG.Rect").find(
      (node) => typeof node.props.onPress === "function"
    )!;

    act(() => {
      background.props.onPress();
    });
    expect(onSelectionChange).toHaveBeenLastCalledWith({
      nodes: [],
      edges: [],
    });
  });

  it("shows the details panel for a selected node when asked", async () => {
    const renderer = await render(
      <Stix2Vis stixJson={makeBundle()} showDetailsPanel />
    );

    expect(findByTestId(renderer, "stix2vis-details")).toHaveLength(0);

    press(renderer, `stix2vis-node-${MALWARE}`);

    expect(findByTestId(renderer, "stix2vis-details")).toHaveLength(1);
    expect(
      findByTestId(renderer, "stix2vis-details-heading")[0]!.props.children
    ).toBe("Adversary-in-the-middle");
    expect(findByTestId(renderer, "stix2vis-details-type")).toHaveLength(1);

    // Tapping the empty canvas clears the panel.
    const background = byType(renderer, "RNSVG.Rect").find(
      (node) => typeof node.props.onPress === "function"
    )!;

    act(() => {
      background.props.onPress();
    });

    expect(findByTestId(renderer, "stix2vis-details")).toHaveLength(0);
  });

  it("renders ghost nodes when showDanglingRefs is set", async () => {
    const bundle = {
      type: "bundle",
      id: BUNDLE,
      objects: [
        {
          type: "malware",
          id: MALWARE,
          name: "Lonely",
          created_by_ref: MISSING,
        },
      ],
    };

    const withoutGhosts = await render(<Stix2Vis stixJson={bundle} />);
    expect(
      findByTestId(withoutGhosts, `stix2vis-node-${MISSING}`)
    ).toHaveLength(0);

    const withGhosts = await render(
      <Stix2Vis stixJson={bundle} showDanglingRefs showDetailsPanel />
    );
    expect(findByTestId(withGhosts, `stix2vis-node-${MISSING}`)).toHaveLength(
      1
    );

    const onNodeSelect = jest.fn();
    const ghostRenderer = await render(
      <Stix2Vis
        stixJson={bundle}
        showDanglingRefs
        showDetailsPanel
        onNodeSelect={onNodeSelect}
      />
    );

    press(ghostRenderer, `stix2vis-node-${MISSING}`);

    expect(onNodeSelect).toHaveBeenCalledWith(MISSING, null);
    expect(findByTestId(ghostRenderer, "stix2vis-details-empty")).toHaveLength(
      1
    );
  });
});

describe("Stix2Vis toolbar", () => {
  it("renders search, legend and zoom controls", async () => {
    const renderer = await render(
      <Stix2Vis stixJson={makeBundle()} showToolbar />
    );

    expect(findByTestId(renderer, "stix2vis-toolbar")).toHaveLength(1);
    expect(findByTestId(renderer, "stix2vis-search-input")).not.toHaveLength(0);
    expect(findByTestId(renderer, "stix2vis-legend-malware")).not.toHaveLength(
      0
    );
    expect(findByTestId(renderer, "stix2vis-legend-identity")).not.toHaveLength(
      0
    );
    expect(findByTestId(renderer, "stix2vis-zoom-in")).not.toHaveLength(0);
    expect(findByTestId(renderer, "stix2vis-zoom-out")).not.toHaveLength(0);
    expect(findByTestId(renderer, "stix2vis-fit")).not.toHaveLength(0);
    // Export only exists when the app says where the JSON should go.
    expect(findByTestId(renderer, "stix2vis-export-json")).toHaveLength(0);
  });

  it("hides a STIX type when its legend chip is toggled", async () => {
    const renderer = await render(
      <Stix2Vis stixJson={makeBundle()} showToolbar />
    );

    expect(findByTestId(renderer, `stix2vis-node-${IDENTITY}`)).toHaveLength(1);

    press(renderer, "stix2vis-legend-identity");
    expect(findByTestId(renderer, `stix2vis-node-${IDENTITY}`)).toHaveLength(0);
    expect(findByTestId(renderer, `stix2vis-node-${MALWARE}`)).toHaveLength(1);

    press(renderer, "stix2vis-legend-identity");
    expect(findByTestId(renderer, `stix2vis-node-${IDENTITY}`)).toHaveLength(1);
  });

  it("selects and centres a node found by label", async () => {
    const onNodeSelect = jest.fn();

    const renderer = await render(
      <Stix2Vis
        stixJson={makeBundle()}
        showToolbar
        showDetailsPanel
        onNodeSelect={onNodeSelect}
      />
    );

    type(renderer, "stix2vis-search-input", "adversary-in-the-middle");
    press(renderer, "stix2vis-search-submit");

    // Searching selects and centres, exactly like the web package: the
    // selection callbacks belong to taps, not to search.
    expect(findByTestId(renderer, "stix2vis-search-message")).toHaveLength(0);
    expect(onNodeSelect).not.toHaveBeenCalled();
    expect(
      findByTestId(renderer, "stix2vis-details-heading")[0]!.props.children
    ).toBe("Adversary-in-the-middle");
    expect(
      findByTestId(renderer, `stix2vis-node-${MALWARE}`).length
    ).toBeGreaterThan(0);
  });

  it("finds a node by exact STIX id and centres it", async () => {
    const renderer = await render(
      <Stix2Vis stixJson={makeBundle()} showToolbar />
    );

    const circleX = () => byType(renderer, "RNSVG.Circle")[0]!.props.cx;
    const before = byType(renderer, "RNSVG.Circle").map(
      (node) => node.props.cx
    );

    type(renderer, "stix2vis-search-input", INDICATOR);
    press(renderer, "stix2vis-search-submit");

    const after = byType(renderer, "RNSVG.Circle").map((node) => node.props.cx);

    expect(findByTestId(renderer, "stix2vis-search-message")).toHaveLength(0);
    expect(after).not.toEqual(before);
    expect(circleX()).toBeDefined();
  });

  it("says so when the search matches nothing", async () => {
    const renderer = await render(
      <Stix2Vis stixJson={makeBundle()} showToolbar />
    );

    type(renderer, "stix2vis-search-input", "definitely-not-there");
    press(renderer, "stix2vis-search-submit");

    expect(
      findByTestId(renderer, "stix2vis-search-message")[0]!.props.children
    ).toBe('No node matching "definitely-not-there"');
  });

  it("zooms and re-fits from the toolbar", async () => {
    const renderer = await render(
      <Stix2Vis stixJson={makeBundle()} showToolbar />
    );

    const firstCircleX = () => byType(renderer, "RNSVG.Circle")[0]!.props.cx;
    const before = firstCircleX();

    press(renderer, "stix2vis-zoom-in");
    expect(firstCircleX()).not.toBe(before);

    press(renderer, "stix2vis-fit");
    expect(firstCircleX()).toBe(before);
  });

  it("exports only the visible graph as JSON", async () => {
    const onExportJson = jest.fn();

    const renderer = await render(
      <Stix2Vis
        stixJson={makeBundle()}
        showToolbar
        onExportJson={onExportJson}
      />
    );

    expect(findByTestId(renderer, "stix2vis-export-json")).not.toHaveLength(0);

    press(renderer, "stix2vis-export-json");

    const exported = JSON.parse(onExportJson.mock.calls[0]![0]);

    expect(exported.nodes).toHaveLength(3);
    expect(exported.edges).toHaveLength(2);

    // Hidden types are filtered out of the export.
    press(renderer, "stix2vis-legend-identity");
    press(renderer, "stix2vis-export-json");

    const filtered = JSON.parse(onExportJson.mock.calls[1]![0]);

    expect(filtered.nodes).toHaveLength(2);
    // The created-by edge lost an endpoint.
    expect(filtered.edges).toHaveLength(1);
  });
});

describe("Stix2Vis empty and error states", () => {
  it("shows a hint when there is no content", async () => {
    const renderer = await render(<Stix2Vis stixJson={null} />);

    expect(findByTestId(renderer, "stix2vis-empty")).toHaveLength(1);
    expect(findByTestId(renderer, "stix2vis-canvas")).toHaveLength(0);
  });

  it("accepts a custom empty component", async () => {
    const renderer = await render(
      <Stix2Vis
        stixJson={null}
        emptyComponent={<React.Fragment>Nothing here</React.Fragment>}
      />
    );

    expect(findByTestId(renderer, "stix2vis-empty")).toHaveLength(0);
    expect(renderer.toJSON()).not.toBeNull();
  });

  it("shows the error message for invalid content and reports it", async () => {
    const onError = jest.fn();

    const renderer = await render(
      <Stix2Vis stixJson={{ type: "malware" }} onError={onError} />
    );

    const error = findByTestId(renderer, "stix2vis-error")[0]!;

    expect(error.props.children).toMatch(/Invalid STIX/);
    expect(onError).toHaveBeenCalledWith(expect.any(Error));
    expect(findByTestId(renderer, "stix2vis-canvas")).toHaveLength(0);
  });

  it("accepts a custom error component", async () => {
    const renderer = await render(
      <Stix2Vis
        stixJson={{}}
        errorComponent={(error) => (
          <React.Fragment>
            {error instanceof Error ? error.message : "error"}
          </React.Fragment>
        )}
      />
    );

    expect(findByTestId(renderer, "stix2vis-error")).toHaveLength(0);
    expect(renderer.toJSON()).not.toBeNull();
  });
});

describe("Stix2Vis configuration", () => {
  it("applies include/exclude filters through the config prop", async () => {
    const renderer = await render(
      <Stix2Vis
        stixJson={makeBundle()}
        config={{ exclude: { type: "identity" } }}
      />
    );

    expect(findByTestId(renderer, `stix2vis-node-${IDENTITY}`)).toHaveLength(0);
    expect(findByTestId(renderer, `stix2vis-node-${MALWARE}`)).toHaveLength(1);
  });

  it("applies custom labels through the config prop", async () => {
    const renderer = await render(
      <Stix2Vis
        stixJson={makeBundle()}
        config={{ userLabels: { [MALWARE]: "Renamed" } }}
      />
    );

    const labels = byType(renderer, "RNSVG.Text").map(
      (node) => node.props.children
    );

    expect(labels).toContain("Renamed");
  });

  it("only rebuilds a stable graph once", async () => {
    const config = { exclude: { type: "identity" } };
    const renderer = await render(
      <Stix2Vis stixJson={makeBundle()} config={config} />
    );

    // Re-rendering with an equal-but-new config object keeps the same graph.
    await act(async () => {
      renderer.update(
        <Stix2Vis stixJson={makeBundle()} config={{ ...config }} />
      );
    });

    expect(findByTestId(renderer, `stix2vis-node-${MALWARE}`)).toHaveLength(1);
  });
});
