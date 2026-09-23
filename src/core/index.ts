/**
 * Framework-agnostic STIX graph builder — the entry point of the
 * `stix2vis-native/core` subpath.
 *
 * Nothing in here imports React, React Native or `react-native-svg`, so it can
 * also run in Node (scripts, servers, tests) and inside any other renderer.
 */
export {
  InvalidConfigError,
  InvalidMatchOperator,
  InvalidSTIXObjectError,
  STIXContentError,
  isStixVisError,
} from "./errors";

export {
  embeddedRelationships,
  normalizeEmbeddedRelationships,
  type EmbeddedRelationship,
} from "./embeddedRelationships";

export {
  type ConfigInput,
  isPlainObject,
  isStixIdValidForNode,
  isStixTypeValidForNode,
  isValidStixObject,
  mapToPlain,
  normalizeConfig,
  normalizeContent,
  parseToMap,
  recursiveObjectToMap,
} from "./stixContent";

export {
  getValuesAtPath,
  mongoishMatchObject,
  mongoishMatchProperty,
} from "./match";

export { legendTypes, makeGraphData } from "./graphData";

export type { GraphData, GraphEdge, GraphNode } from "../types";
