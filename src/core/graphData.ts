import {
  embeddedRelationships,
  normalizeEmbeddedRelationships,
} from "./embeddedRelationships";
import { getValuesAtPath, mongoishMatchObject } from "./match";
import {
  ConfigInput,
  isStixIdValidForNode,
  isStixTypeValidForNode,
  normalizeConfig,
  normalizeContent,
} from "./stixContent";
import type { GraphData, GraphEdge, GraphNode } from "../types";

function uniquefyName(
  baseName: string,
  nameCounts: Map<string, number>
): string {
  let uniqueName;
  let nameCount = nameCounts.get(baseName) || 0;

  ++nameCount;
  nameCounts.set(baseName, nameCount);

  if (nameCount === 1) uniqueName = baseName;
  else uniqueName = baseName + "(" + nameCount.toString() + ")";

  return uniqueName;
}

/**
 * Picks the label for a STIX object, in the same order of preference as the
 * web package: `config.userLabels[id]`, then the type's `displayProperty`,
 * then `name`, `value`, `path`, and finally the STIX type. Labels are
 * truncated to 40 characters and de-duplicated with a `(n)` suffix.
 */
function nameForStixObject(
  stixObject: Map<string, any>,
  stixIdToName: Map<string, string>,
  nameCounts: Map<string, number>,
  config: Map<string, any> | null = null
): string {
  let stixId = stixObject.get("id");
  let stixType = stixObject.get("type");

  let name = stixIdToName.get(stixId);
  if (!name) {
    let baseName;
    let userLabels;

    if (config) {
      userLabels = config.get("userLabels");
      if (userLabels) baseName = userLabels.get(stixId);

      if (!baseName) {
        let typeConfig = config.get(stixType);
        if (typeConfig) {
          let labelPropName = typeConfig.get("displayProperty");
          if (labelPropName) baseName = stixObject.get(labelPropName);
        }
      }
    }

    if (!baseName) baseName = stixObject.get("name");
    if (!baseName) baseName = stixObject.get("value");
    if (!baseName) baseName = stixObject.get("path");
    if (!baseName) baseName = stixType;

    if (baseName.length > 40) baseName = baseName.substr(0, 40) + "...";

    name = uniquefyName(baseName, nameCounts);
    stixIdToName.set(stixId, name);
  }

  return name;
}

function makeEdgeObject(
  sourceRef: string,
  targetRef: string,
  label: string,
  stixId: string | null = null
): any {
  let edge: any = {
    from: sourceRef,
    to: targetRef,
    label: label,
  };

  if (stixId) edge.id = stixId;

  return edge;
}

function makeNodeObject(name: string, stixObject: Map<string, any>): any {
  let node = {
    id: stixObject.get("id"),
    label: name,
  };

  return node;
}

/**
 * Gives every edge a stable, unique id.
 *
 * Explicit STIX relationships already have one. Embedded references do not, so
 * a deterministic id is derived from the endpoints and the label — the
 * renderer needs stable ids to track selection, and tests need them to be
 * reproducible.
 */
function assignEdgeIds(edges: any[]): GraphEdge[] {
  let used: Set<string> = new Set();

  return edges.map((edge) => {
    let id: string = edge.id ?? `${edge.from}->${edge.to}::${edge.label}`;

    if (used.has(id)) {
      let suffix = 2;
      while (used.has(`${id}#${suffix}`)) suffix += 1;
      id = `${id}#${suffix}`;
    }

    used.add(id);

    return { ...edge, id } as GraphEdge;
  });
}

/**
 * Builds the edge for a STIX `relationship` object, or `null` when it cannot be
 * rendered.
 *
 * A relationship between objects that are missing from the content is skipped
 * (with a warning) unless `showDanglingRefs` is set, in which case the missing
 * endpoints are rendered as ghost nodes. Relationships whose endpoints are not
 * usable as node ids (i.e. relationships to relationships) are always dropped.
 */
function edgeForRelationship(
  stixRel: Map<string, any>,
  stixIdToObject: Map<string, any>,
  showDanglingRefs: boolean = false,
  ghostNodes: any[] = [],
  ghostIds: Set<string> = new Set()
): any | null {
  let sourceRef = stixRel.get("source_ref");
  let targetRef = stixRel.get("target_ref");
  let relType = stixRel.get("relationship_type");

  let sourceMissing = !stixIdToObject.has(sourceRef);
  let targetMissing = !stixIdToObject.has(targetRef);

  if (sourceMissing || targetMissing) {
    if (!showDanglingRefs) {
      console.warn(
        "Skipped relationship %s %s %s: missing endpoint object(s)",
        sourceRef,
        relType,
        targetRef
      );

      return null;
    }

    // Render the relationship anyway, using ghost nodes for the endpoints
    // that are missing from the content.
    let endpointsRenderable = true;

    if (sourceMissing) {
      if (isStixIdValidForNode(sourceRef))
        addGhostNode(sourceRef, ghostNodes, ghostIds);
      else endpointsRenderable = false;
    }

    if (targetMissing) {
      if (isStixIdValidForNode(targetRef))
        addGhostNode(targetRef, ghostNodes, ghostIds);
      else endpointsRenderable = false;
    }

    if (!endpointsRenderable) {
      console.warn(
        "Skipped relationship %s %s %s: missing endpoint object(s)",
        sourceRef,
        relType,
        targetRef
      );

      return null;
    }

    return makeEdgeObject(sourceRef, targetRef, relType, stixRel.get("id"));
  }

  if (isStixIdValidForNode(sourceRef) && isStixIdValidForNode(targetRef))
    return makeEdgeObject(sourceRef, targetRef, relType, stixRel.get("id"));

  return null;
}

/**
 * Builds one edge per reference found at each configured property path, in the
 * direction the relationship table specifies.
 */
function edgesFromPropertyPaths(
  stixObject: Map<string, any>,
  stixIdToObject: Map<string, any>,
  relInfo: [string, string, boolean][],
  showDanglingRefs: boolean = false,
  ghostNodes: any[] = [],
  ghostIds: Set<string> = new Set()
): any[] {
  let sourceId = stixObject.get("id");
  let edges: any[] = [];

  for (let [propPath, edgeLabel, forward] of relInfo) {
    for (let ref of getValuesAtPath(stixObject, propPath)) {
      if (isStixIdValidForNode(ref)) {
        if (stixIdToObject.has(ref)) {
          let edgeSrc, edgeDst;

          if (forward) [edgeSrc, edgeDst] = [sourceId, ref];
          else [edgeSrc, edgeDst] = [ref, sourceId];

          edges.push(makeEdgeObject(edgeSrc, edgeDst, edgeLabel));
        } else if (showDanglingRefs) {
          addGhostNode(ref, ghostNodes, ghostIds);

          let edgeSrc, edgeDst;

          if (forward) [edgeSrc, edgeDst] = [sourceId, ref];
          else [edgeSrc, edgeDst] = [ref, sourceId];

          edges.push(makeEdgeObject(edgeSrc, edgeDst, edgeLabel));
        } else
          console.warn(
            "Skipped embedded relationship %s %s %s: target object" +
              " missing",
            sourceId,
            propPath,
            ref
          );
      }
    }
  }

  return edges;
}

/**
 * Edges implied by the object's own properties (e.g. `file.parent_directory_ref`),
 * including any `embeddedRelationships` supplied through `config`.
 */
function edgesForEmbeddedRelationships(
  stixObject: Map<string, any>,
  stixIdToObject: Map<string, any>,
  config: Map<string, any> | null = null,
  showDanglingRefs: boolean = false,
  ghostNodes: any[] = [],
  ghostIds: Set<string> = new Set()
): any[] {
  let stixType = stixObject.get("type");

  let typeAgnosticRels = embeddedRelationships.get(null);
  let typeSpecificRels = embeddedRelationships.get(stixType);

  let userTypeAgnosticRels = null;
  let userTypeSpecificRels = null;

  if (config) {
    if (config.has("")) {
      let typeConfig = config.get("");
      if (typeConfig.has("embeddedRelationships"))
        userTypeAgnosticRels = typeConfig.get("embeddedRelationships");
    }

    if (config.has(stixType)) {
      let typeConfig = config.get(stixType);
      if (typeConfig.has("embeddedRelationships"))
        userTypeSpecificRels = typeConfig.get("embeddedRelationships");
    }
  }

  let allRels: [string, string, boolean][] = [];

  if (typeAgnosticRels) allRels.push(...typeAgnosticRels);

  if (typeSpecificRels) allRels.push(...typeSpecificRels);

  // User-supplied relationships are normalised rather than pushed as-is: a
  // tuple with two entries defaults to a forward edge, and malformed entries
  // are dropped instead of producing a broken edge.
  if (userTypeAgnosticRels)
    allRels.push(...normalizeEmbeddedRelationships(userTypeAgnosticRels));

  if (userTypeSpecificRels)
    allRels.push(...normalizeEmbeddedRelationships(userTypeSpecificRels));

  let edges = edgesFromPropertyPaths(
    stixObject,
    stixIdToObject,
    allRels,
    showDanglingRefs,
    ghostNodes,
    ghostIds
  );

  return edges;
}

/**
 * STIX 2.0 `observed-data` objects embed their captured cyber observables
 * directly in an `objects` dictionary, rather than referencing separate SCO
 * objects via `object_refs` as STIX 2.1 does. This renders each embedded
 * observable as its own node, connected to the observed-data node with a
 * "refers-to" edge (mirroring the 2.1 `object_refs` behaviour).
 */
function nodesAndEdgesForObservedDataObjects(
  stixObject: Map<string, any>
): [any[], any[]] {
  let nodes: any[] = [];
  let edges: any[] = [];

  let observedId = stixObject.get("id");
  let observedObjects = stixObject.get("objects");

  if (!(observedObjects instanceof Map)) return [nodes, edges];

  for (let [key, sco] of observedObjects) {
    if (!(sco instanceof Map)) continue;

    let scoType = sco.get("type") || "unknown";
    // 2.0 SCOs carry no id of their own, so derive a deterministic one from
    // the observed-data id and the dictionary key.
    let scoId = observedId + ".objects." + key;

    let scoName =
      sco.get("name") || sco.get("value") || sco.get("path") || scoType;
    if (scoName.length > 40) scoName = scoName.substring(0, 40) + "...";

    nodes.push({ id: scoId, label: scoName, group: scoType });
    edges.push(makeEdgeObject(observedId, scoId, "refers-to"));
  }

  return [nodes, edges];
}

/**
 * Builds a placeholder ("ghost") node for a STIX id referenced by the content
 * but not present in it, so dangling relationships stay visible instead of
 * being silently dropped. Only used when `showDanglingRefs` is enabled.
 */
function makeGhostNode(refId: string): any {
  // A STIX id is "<type>--<uuid>", so the type is everything except the
  // trailing "--" plus 36-character UUID (38 characters).
  let type = refId.substring(0, refId.length - 38);
  if (type.length === 0) type = "unknown";

  return {
    id: refId,
    label: type,
    group: type,
    dangling: true,
    opacity: 0.35,
    font: { color: "#9ca3af" },
  };
}

/**
 * Adds a ghost node for a dangling reference, unless one already exists for
 * that id. Returns true when the reference can be rendered (ghost created or
 * already present).
 */
function addGhostNode(
  refId: string,
  ghostNodes: any[],
  ghostIds: Set<string>
): boolean {
  if (ghostIds.has(refId)) return true;

  ghostNodes.push(makeGhostNode(refId));
  ghostIds.add(refId);
  return true;
}

/**
 * Builds the node and edge lists for a set of STIX objects.
 *
 * Every non-relationship object becomes a node (labelled via
 * {@link nameForStixObject}), every `relationship` object becomes an edge, and
 * every embedded reference becomes an edge. Ghost nodes are appended last.
 */
function makeNodesAndEdges(
  stixIdToObject: Map<string, any>,
  config: Map<string, any> | null = null
): [any[], any[]] {
  let nodes: any[] = [];
  let edges: any[] = [];
  let nameCounts: Map<string, number> = new Map();

  let stixIdToName: Map<string, string> = new Map();

  let ghostNodes: any[] = [];
  let ghostIds: Set<string> = new Set();

  let showDanglingRefs = false;
  if (config && config.has("showDanglingRefs"))
    showDanglingRefs = config.get("showDanglingRefs") === true;

  for (let object of stixIdToObject.values()) {
    let stixType = object.get("type");

    if (stixType === "relationship") {
      let edge = edgeForRelationship(
        object,
        stixIdToObject,
        showDanglingRefs,
        ghostNodes,
        ghostIds
      );

      if (edge) edges.push(edge);
    } else if (isStixTypeValidForNode(stixType)) {
      let name = nameForStixObject(object, stixIdToName, nameCounts, config);
      let node = makeNodeObject(name, object);
      node.group = stixType;
      nodes.push(node);

      let embeddedRelEdges = edgesForEmbeddedRelationships(
        object,
        stixIdToObject,
        config,
        showDanglingRefs,
        ghostNodes,
        ghostIds
      );

      edges.push(...embeddedRelEdges);

      let [scoNodes, scoEdges] = nodesAndEdgesForObservedDataObjects(object);
      nodes.push(...scoNodes);
      edges.push(...scoEdges);
    }
  }

  nodes.push(...ghostNodes);

  return [nodes, edges];
}

/**
 * Applies `config.include` / `config.exclude` (Mongo-style match criteria) to
 * the parsed STIX objects.
 */
function filterStixObjects(
  stixObjects: any[],
  config: Map<string, any> | null
): any[] {
  if (config && config.has("include")) {
    let filterCriteria = config.get("include");
    stixObjects = stixObjects.filter((obj) =>
      mongoishMatchObject(obj, filterCriteria)
    );
  }

  if (config && config.has("exclude")) {
    let filterCriteria = config.get("exclude");
    stixObjects = stixObjects.filter(
      (obj) => !mongoishMatchObject(obj, filterCriteria)
    );
  }

  return stixObjects;
}

/**
 * Turns STIX content — a bundle, a single object, an array of objects or a JSON
 * string of any of those — into nodes and edges ready to be laid out and drawn.
 *
 * @param stixContent STIX 2.0/2.1 content to visualise.
 * @param config Graph-builder configuration. Set `showDanglingRefs: true` to
 *   render placeholder nodes for references missing from the content, or use
 *   `include`/`exclude` to filter the objects that are rendered.
 * @throws {STIXContentError} / {InvalidSTIXObjectError} when the content cannot
 *   be read, and {InvalidConfigError} when `config` is not an object.
 */
export function makeGraphData(
  stixContent: any,
  config: ConfigInput = null
): GraphData {
  let normalizedConfig: Map<string, any> | null = null;
  if (config !== null) normalizedConfig = normalizeConfig(config);

  let stixObjects = normalizeContent(stixContent);
  stixObjects = filterStixObjects(stixObjects, normalizedConfig);

  let stixIdToObject: Map<string, any> = new Map();

  for (let object of stixObjects) stixIdToObject.set(object.get("id"), object);

  let [nodes, edges] = makeNodesAndEdges(stixIdToObject, normalizedConfig);

  return {
    nodes: nodes as GraphNode[],
    edges: assignEdgeIds(edges),
    stixIdToObject,
  };
}

/**
 * The STIX types that are rendered as nodes, sorted alphabetically. This is the
 * set the toolbar legend lists and toggles, and it excludes STIX types that
 * only ever appear as ghost nodes.
 */
export function legendTypes(graph: GraphData): string[] {
  let types: Set<string> = new Set();

  for (let node of graph.nodes)
    if (!node.dangling && isStixTypeValidForNode(node.group))
      types.add(node.group);

  return [...types].sort();
}
