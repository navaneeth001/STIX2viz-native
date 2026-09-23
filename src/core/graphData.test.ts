import {
  InvalidMatchOperator,
  InvalidSTIXObjectError,
  STIXContentError,
  isStixVisError,
  legendTypes,
  makeGraphData,
} from "./index";

import type { GraphNode } from "../types";

const IDENTITY_1 = "identity--11111111-1111-4111-8111-111111111111";
const IDENTITY_2 = "identity--22222222-2222-4222-8222-222222222222";
const MALWARE = "malware--33333333-3333-4333-8333-333333333333";
const INDICATOR = "indicator--44444444-4444-4444-8444-444444444444";
const RELATIONSHIP = "relationship--55555555-5555-4555-8555-555555555555";
const BUNDLE = "bundle--66666666-6666-4666-8666-666666666666";
const OBSERVED = "observed-data--77777777-7777-4777-8777-777777777777";

/**
 * Fixture mirroring the shape of the published demo data. The expectations
 * below double as documentation of the public behaviour, and are deliberately
 * the same ones the `stix2vis` web package locks down: the graph that comes out
 * of the builder must be identical on web and native.
 */
function makeBundle() {
  return {
    type: "bundle",
    id: BUNDLE,
    objects: [
      {
        type: "identity",
        spec_version: "2.1",
        id: IDENTITY_1,
        name: "Example Corp",
        identity_class: "organization",
      },
      {
        type: "malware",
        spec_version: "2.1",
        id: MALWARE,
        name: "Adversary-in-the-middle",
        is_family: false,
        created_by_ref: IDENTITY_1,
      },
      {
        type: "indicator",
        spec_version: "2.1",
        id: INDICATOR,
        pattern_type: "stix",
        pattern: "[file:hashes.'MD5' = 'd41d8cd98f00b204e9800998ecf8427e']",
      },
      {
        type: "relationship",
        spec_version: "2.1",
        id: RELATIONSHIP,
        relationship_type: "indicates",
        source_ref: INDICATOR,
        target_ref: MALWARE,
      },
      // Same display name as IDENTITY_1 on purpose: names must be uniquified.
      {
        type: "identity",
        spec_version: "2.1",
        id: IDENTITY_2,
        name: "Example Corp",
      },
    ],
  };
}

function nodeById(nodes: GraphNode[], id: string): GraphNode | undefined {
  return nodes.find((node) => node.id === id);
}

function edgeSummary(edges: { from: string; to: string; label: string }[]) {
  return edges.map(({ from, to, label }) => ({ from, to, label }));
}

describe("makeGraphData", () => {
  it("makes one node per non-relationship object and uniquifies labels", () => {
    const { nodes, stixIdToObject } = makeGraphData(makeBundle());

    expect(stixIdToObject.size).toBe(5);
    expect(nodes).toHaveLength(4);
    expect(nodeById(nodes, IDENTITY_1)?.label).toBe("Example Corp");
    expect(nodeById(nodes, MALWARE)?.label).toBe("Adversary-in-the-middle");
    expect(nodeById(nodes, INDICATOR)?.label).toBe("indicator");
    expect(nodeById(nodes, IDENTITY_2)?.label).toBe("Example Corp(2)");
  });

  it("tags every node with its STIX type as the group", () => {
    const { nodes } = makeGraphData(makeBundle());

    for (const node of nodes)
      expect(node.group).toBe(node.id.split("--")[0].split(":")[0]);
  });

  it("turns relationships into labelled edges keeping the relationship id", () => {
    const { edges } = makeGraphData(makeBundle());

    expect(edges.find((edge) => edge.id === RELATIONSHIP)).toMatchObject({
      from: INDICATOR,
      to: MALWARE,
      label: "indicates",
    });
  });

  it("derives edges from embedded references such as created_by_ref", () => {
    const { edges } = makeGraphData(makeBundle());

    expect(edgeSummary(edges)).toEqual(
      expect.arrayContaining([
        { from: MALWARE, to: IDENTITY_1, label: "created-by" },
      ])
    );
    expect(edges).toHaveLength(2);
  });

  it("gives every edge a unique id, deriving one when STIX has none", () => {
    const { edges } = makeGraphData(makeBundle());

    const ids = edges.map((edge) => edge.id);

    expect(new Set(ids).size).toBe(ids.length);
    // The embedded created-by edge has no STIX id of its own.
    expect(ids).toContain(`${MALWARE}->${IDENTITY_1}::created-by`);
  });
});

describe("makeGraphData input formats", () => {
  it("accepts a single STIX object", () => {
    const { nodes, edges } = makeGraphData({
      type: "malware",
      spec_version: "2.1",
      id: MALWARE,
      name: "Standalone",
    });

    expect(nodes).toHaveLength(1);
    expect(nodeById(nodes, MALWARE)?.label).toBe("Standalone");
    expect(edges).toHaveLength(0);
  });

  it("accepts an array of STIX objects", () => {
    const { nodes } = makeGraphData(makeBundle().objects);

    expect(nodes).toHaveLength(4);
  });

  it("accepts a JSON string", () => {
    const { nodes } = makeGraphData(JSON.stringify(makeBundle()));

    expect(nodes).toHaveLength(4);
  });
});

describe("makeGraphData configuration", () => {
  it("applies include criteria", () => {
    const { nodes, edges } = makeGraphData(makeBundle(), {
      include: { type: "malware" },
    });

    expect(nodes).toHaveLength(1);
    expect(nodeById(nodes, MALWARE)).toBeTruthy();
    expect(edges).toHaveLength(0);
  });

  it("applies exclude criteria", () => {
    const { nodes, edges } = makeGraphData(makeBundle(), {
      exclude: { type: "identity" },
    });

    expect(nodes).toHaveLength(2);
    expect(edgeSummary(edges)).toEqual([
      { from: INDICATOR, to: MALWARE, label: "indicates" },
    ]);
  });

  it("accepts a Map config (internal representation)", () => {
    const config = new Map<string, any>([
      ["include", new Map([["type", "malware"]])],
    ]);

    const { nodes } = makeGraphData(makeBundle(), config);

    expect(nodes).toHaveLength(1);
  });

  it("honours userLabels", () => {
    const { nodes } = makeGraphData(makeBundle(), {
      userLabels: { [MALWARE]: "Custom label" },
    });

    expect(nodeById(nodes, MALWARE)?.label).toBe("Custom label");
  });

  it("honours per-type displayProperty overrides", () => {
    const { nodes } = makeGraphData(makeBundle(), {
      indicator: { displayProperty: "pattern_type" },
    });

    expect(nodeById(nodes, INDICATOR)?.label).toBe("stix");
  });

  it("supports $and, $or, $not and $exists in filters", () => {
    const orResult = makeGraphData(makeBundle(), {
      include: { $or: [{ type: "malware" }, { type: "indicator" }] },
    });

    expect(orResult.nodes.map((node) => node.group).sort()).toEqual([
      "indicator",
      "malware",
    ]);

    const andResult = makeGraphData(makeBundle(), {
      include: { $and: [{ type: "malware" }, { is_family: false }] },
    });

    expect(andResult.nodes).toHaveLength(1);

    const notResult = makeGraphData(makeBundle(), {
      exclude: { $not: { type: "identity" } },
    });

    expect(notResult.nodes).toHaveLength(2);

    const existsResult = makeGraphData(makeBundle(), {
      include: { pattern: { $exists: true } },
    });

    expect(existsResult.nodes).toHaveLength(1);
  });

  it("honours user supplied embedded relationships", () => {
    const { edges } = makeGraphData(
      {
        type: "bundle",
        id: BUNDLE,
        objects: [
          {
            type: "malware",
            id: MALWARE,
            name: "M",
            analyses_ref: "malware-analysis--x",
          },
          { type: "identity", id: IDENTITY_1, name: "I" },
          { type: "malware-analysis", id: "malware-analysis--x", name: "A" },
        ],
      },
      {
        malware: {
          embeddedRelationships: [["analyses_ref", "analysed-by", true]],
        },
      }
    );

    expect(edgeSummary(edges)).toEqual([
      { from: MALWARE, to: "malware-analysis--x", label: "analysed-by" },
    ]);
  });

  it("rejects unknown $ operators in filters", () => {
    expect(() =>
      makeGraphData(makeBundle(), { include: { $nope: 1 } })
    ).toThrow(InvalidMatchOperator);
  });

  it("rejects config that is not an object", () => {
    expect(() => makeGraphData(makeBundle(), 42 as any)).toThrow(
      /Invalid configuration value/
    );
  });
});

describe("makeGraphData error handling", () => {
  it("rejects empty content", () => {
    expect(() => makeGraphData({})).toThrow(STIXContentError);
    expect(() => makeGraphData({})).toThrow(/Invalid STIX content/);
  });

  it("rejects an empty array", () => {
    expect(() => makeGraphData([])).toThrow(/Invalid STIX content/);
  });

  it("rejects an empty bundle", () => {
    expect(() =>
      makeGraphData({ type: "bundle", id: BUNDLE, objects: [] })
    ).toThrow(/Invalid STIX content/);
  });

  it("rejects objects without an id", () => {
    expect(() => makeGraphData({ type: "malware" })).toThrow(
      InvalidSTIXObjectError
    );
    expect(() => makeGraphData({ type: "malware" })).toThrow(
      /Invalid STIX object: requires at least type and id/
    );
  });

  it("reports which errors came from this package", () => {
    expect(isStixVisError(new STIXContentError())).toBe(true);
    expect(isStixVisError(new InvalidMatchOperator("$nope"))).toBe(true);
    expect(isStixVisError(new Error("nope"))).toBe(false);
    expect(isStixVisError("nope")).toBe(false);
  });

  it("warns and drops relationships whose endpoints are missing", () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});

    const { nodes, edges } = makeGraphData({
      type: "bundle",
      id: BUNDLE,
      objects: [
        { type: "malware", id: MALWARE, name: "Lonely" },
        {
          type: "relationship",
          id: RELATIONSHIP,
          relationship_type: "indicates",
          source_ref: INDICATOR,
          target_ref: MALWARE,
        },
      ],
    });

    expect(nodes).toHaveLength(1);
    expect(edges).toHaveLength(0);
    expect(warn).toHaveBeenCalled();
  });
});

describe("makeGraphData STIX 2.0 observed-data", () => {
  it("renders embedded 2.0 objects as nodes referred to by the observed-data", () => {
    const { nodes, edges } = makeGraphData({
      type: "bundle",
      id: BUNDLE,
      objects: [
        {
          type: "observed-data",
          id: OBSERVED,
          first_observed: "2020-01-01T00:00:00.000Z",
          last_observed: "2020-01-01T00:00:00.000Z",
          number_observed: 1,
          objects: {
            0: { type: "file", name: "evil.exe" },
            1: { type: "ipv4-addr", value: "1.2.3.4" },
          },
        },
      ],
    });

    expect(nodes).toHaveLength(3);
    expect(nodeById(nodes, OBSERVED)).toBeTruthy();
    expect(nodeById(nodes, OBSERVED + ".objects.0")?.label).toBe("evil.exe");
    expect(nodeById(nodes, OBSERVED + ".objects.0")?.group).toBe("file");
    expect(nodeById(nodes, OBSERVED + ".objects.1")?.label).toBe("1.2.3.4");
    expect(nodeById(nodes, OBSERVED + ".objects.1")?.group).toBe("ipv4-addr");

    expect(edgeSummary(edges)).toEqual([
      { from: OBSERVED, to: OBSERVED + ".objects.0", label: "refers-to" },
      { from: OBSERVED, to: OBSERVED + ".objects.1", label: "refers-to" },
    ]);
  });

  it("still resolves 2.1 object_refs on observed-data (locked behaviour)", () => {
    const scoId = "file--88888888-8888-4888-8888-888888888888";
    const { nodes, edges } = makeGraphData({
      type: "bundle",
      id: BUNDLE,
      objects: [
        {
          type: "observed-data",
          id: OBSERVED,
          first_observed: "2020-01-01T00:00:00.000Z",
          number_observed: 1,
          object_refs: [scoId],
        },
        { type: "file", id: scoId, name: "ref.exe" },
      ],
    });

    expect(nodes).toHaveLength(2);
    expect(edgeSummary(edges)).toEqual([
      { from: OBSERVED, to: scoId, label: "refers-to" },
    ]);
  });

  it("ignores 2.0 objects entries that are not a mapping", () => {
    const { nodes, edges } = makeGraphData({
      type: "bundle",
      id: BUNDLE,
      objects: [
        {
          type: "observed-data",
          id: OBSERVED,
          first_observed: "2020-01-01T00:00:00.000Z",
          number_observed: 1,
          objects: { 0: "not-an-object" },
        },
      ],
    });

    expect(nodes).toHaveLength(1);
    expect(edges).toHaveLength(0);
  });
});

describe("makeGraphData dangling references", () => {
  const MISSING_IDENTITY = IDENTITY_1; // referenced but never defined
  const MISSING_INDICATOR = INDICATOR; // referenced but never defined

  function danglingBundle() {
    return {
      type: "bundle",
      id: BUNDLE,
      objects: [
        {
          type: "malware",
          id: MALWARE,
          name: "Lonely",
          created_by_ref: MISSING_IDENTITY,
        },
        {
          type: "relationship",
          id: RELATIONSHIP,
          relationship_type: "indicates",
          source_ref: MISSING_INDICATOR,
          target_ref: MALWARE,
        },
      ],
    };
  }

  it("warns and drops by default (locked legacy behaviour)", () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});

    const { nodes, edges } = makeGraphData(danglingBundle());

    expect(nodes).toHaveLength(1);
    expect(edges).toHaveLength(0);
    expect(warn).toHaveBeenCalled();
  });

  it("creates ghost nodes for missing endpoints when showDanglingRefs is set", () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});

    const { nodes, edges } = makeGraphData(danglingBundle(), {
      showDanglingRefs: true,
    });

    // Malware + two ghost nodes (identity, indicator).
    expect(nodes).toHaveLength(3);

    const ghost = nodeById(nodes, MISSING_IDENTITY);
    expect(ghost).toMatchObject({ dangling: true, group: "identity" });
    expect(ghost?.label).toBe("identity");

    expect(edgeSummary(edges)).toEqual(
      expect.arrayContaining([
        { from: MALWARE, to: MISSING_IDENTITY, label: "created-by" },
        { from: MISSING_INDICATOR, to: MALWARE, label: "indicates" },
      ])
    );
    expect(edges).toHaveLength(2);
    expect(warn).not.toHaveBeenCalled();
  });

  it("accepts showDanglingRefs through the prop as well as the config", () => {
    const { nodes } = makeGraphData(danglingBundle(), {
      showDanglingRefs: false,
    });

    expect(nodes).toHaveLength(1);
  });

  it("deduplicates repeated references to the same missing object", () => {
    const { nodes, edges } = makeGraphData(
      {
        type: "bundle",
        id: BUNDLE,
        objects: [
          {
            type: "malware",
            id: MALWARE,
            name: "First",
            created_by_ref: MISSING_IDENTITY,
          },
          {
            type: "malware",
            id: IDENTITY_2,
            name: "Second",
            created_by_ref: MISSING_IDENTITY,
          },
        ],
      },
      { showDanglingRefs: true }
    );

    expect(nodes.filter((node) => node.dangling)).toHaveLength(1);
    expect(edges).toHaveLength(2);
  });
});

describe("legendTypes", () => {
  const MISSING_ACTOR = "threat-actor--99999999-9999-4999-8999-999999999999";

  it("lists the rendered STIX types, sorted and without ghost-only types", () => {
    const graph = makeGraphData(
      {
        type: "bundle",
        id: BUNDLE,
        objects: [
          { type: "malware", id: MALWARE, name: "M" },
          { type: "indicator", id: INDICATOR, name: "I" },
          {
            type: "identity",
            id: IDENTITY_1,
            name: "Example Corp",
            created_by_ref: MISSING_ACTOR,
          },
        ],
      },
      { showDanglingRefs: true }
    );

    // The threat actor is only present as a ghost node.
    expect(
      graph.nodes.some((node) => node.group === "threat-actor" && node.dangling)
    ).toBe(true);
    expect(legendTypes(graph)).toEqual(["identity", "indicator", "malware"]);
  });
});
