import * as core from "./core";
import * as publicApi from "./index";

/**
 * The published surface of the package, as documented in the README. Locking it
 * down means a barrel-file edit cannot silently drop or rename an export.
 */
const PUBLIC_API = [
  // Component and building blocks
  "Stix2Vis",
  "GraphCanvas",
  "StixToolbar",
  "StixDetailsPanel",
  "useStixGraph",
  // Graph building
  "makeGraphData",
  "legendTypes",
  "computeLayout",
  "defaultLayoutOptions",
  // Geometry and theme
  "edgeGeometry",
  "fitToBounds",
  "zoomAround",
  "truncateLabel",
  "clamp",
  "round",
  "distance",
  "MIN_SCALE",
  "MAX_SCALE",
  "defaultTheme",
  "resolveTheme",
  "groupColor",
  // Icons
  "STIX_ICON_SOURCES",
  "STIX_ICON_FILES",
  "STIX_ICON_ALIASES",
  "bundledIconTypes",
  "getStixIcon",
  "getStixIconFile",
  "iconKeyForStixType",
  "resolveStixIcon",
  // STIX helpers and errors
  "STIXContentError",
  "InvalidSTIXObjectError",
  "InvalidConfigError",
  "InvalidMatchOperator",
  "isStixVisError",
  "mapToPlain",
  "normalizeConfig",
  "normalizeContent",
  "parseToMap",
  "recursiveObjectToMap",
  "isPlainObject",
  "isValidStixObject",
  "isStixTypeValidForNode",
  "isStixIdValidForNode",
  "embeddedRelationships",
  "normalizeEmbeddedRelationships",
  "mongoishMatchObject",
  "mongoishMatchProperty",
  "getValuesAtPath",
];

describe("public API", () => {
  it.each(PUBLIC_API)("exports %s", (name) => {
    expect(publicApi).toHaveProperty(name);
    expect((publicApi as Record<string, unknown>)[name]).toBeDefined();
  });

  it("has no default export, so the CommonJS interop stays unambiguous", () => {
    // A CommonJS entry that sets both `__esModule` and `default` breaks default
    // imports in bundlers that read the entry as ESM (publint's rule); the
    // component is a named export instead.
    expect(publicApi).not.toHaveProperty("default");
  });

  it("exports the core graph builder from the subpath entry too", () => {
    // `stix2vis-native/core` resolves to this module, and it must not drag the
    // UI layer (or react-native-svg) in with it.
    expect(typeof core.makeGraphData).toBe("function");
    expect(typeof core.legendTypes).toBe("function");
    expect(core).not.toHaveProperty("computeLayout");
    expect(core).not.toHaveProperty("Stix2Vis");
  });
});
