/**
 * `stix2vis-native` — render STIX 2.1 content as an interactive relationship
 * graph in React Native, entirely on-device.
 *
 * ```tsx
 * import { Stix2Vis } from "stix2vis-native";
 *
 * <Stix2Vis stixJson={bundle} showToolbar showDetailsPanel />;
 * ```
 *
 * Everything the component is built from is exported too, so a screen can use
 * only the pieces it needs (the graph builder alone lives at
 * `stix2vis-native/core` and has no UI dependencies at all).
 *
 * Note: unlike the `stix2vis` web package there is deliberately no default
 * export. A CommonJS module that sets both `__esModule` and `default` breaks
 * default imports in bundlers that interpret the entry as ESM (`publint` flags
 * it), so the component is a named export here.
 */
export { Stix2Vis } from "./components/Stix2Vis";
export type { Stix2VisProps } from "./components/Stix2Vis";

export { GraphCanvas } from "./components/GraphCanvas";
export type {
  GraphCanvasProps,
  GraphViewportControls,
} from "./components/GraphCanvas";

export { StixToolbar } from "./components/StixToolbar";
export type { StixToolbarProps } from "./components/StixToolbar";

export { StixDetailsPanel } from "./components/StixDetailsPanel";
export type { StixDetailsPanelProps } from "./components/StixDetailsPanel";

export { useStixGraph } from "./hooks/useStixGraph";
export type {
  UseStixGraphOptions,
  UseStixGraphResult,
} from "./hooks/useStixGraph";

export { computeLayout, defaultLayoutOptions } from "./layout/forceLayout";
export type { LayoutOptions } from "./layout/forceLayout";

export {
  MAX_SCALE,
  MIN_SCALE,
  clamp,
  distance,
  edgeGeometry,
  fitToBounds,
  round,
  truncateLabel,
  zoomAround,
} from "./layout/geometry";
export type { EdgeGeometry, ViewTransform } from "./layout/geometry";

export { defaultTheme, groupColor, resolveTheme } from "./theme";
export type { StixTheme } from "./theme";

export {
  STIX_ICON_ALIASES,
  STIX_ICON_FILES,
  STIX_ICON_SOURCES,
  bundledIconTypes,
  getStixIcon,
  getStixIconFile,
  iconKeyForStixType,
  resolveStixIcon,
} from "./icons";
export type { StixIconMap } from "./icons";

export type { LayoutBounds, LayoutResult, Point } from "./types";

export * from "./core";
