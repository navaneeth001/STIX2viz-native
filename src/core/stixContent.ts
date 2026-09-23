import {
  InvalidConfigError,
  InvalidSTIXObjectError,
  STIXContentError,
} from "./errors";

/**
 * Accepted shapes for the graph-builder configuration: an internal `Map`, a
 * plain object (recommended), or a JSON string of a plain object.
 */
export type ConfigInput =
  Map<string, any> | Record<string, any> | string | null;

/** Plain objects only — class instances and Maps are not converted. */
export function isPlainObject(value: any): value is object {
  let result = false;

  if (value) result = Object.getPrototypeOf(value) === Object.prototype;

  return result;
}

function mapReviver(_key: string, value: any): any {
  if (isPlainObject(value)) return new Map(Object.entries(value));
  else return value;
}

/** Recursively converts plain objects to Maps (the internal STIX shape). */
export function recursiveObjectToMap(obj: any): any {
  let newValue;

  if (isPlainObject(obj)) {
    let map = new Map();
    for (let [key, value] of Object.entries(obj))
      map.set(key, recursiveObjectToMap(value));

    newValue = map;
  } else if (Array.isArray(obj)) newValue = obj.map(recursiveObjectToMap);
  else newValue = obj;

  return newValue;
}

/**
 * Normalizes STIX content to the internal Map-based representation. JSON
 * strings are parsed first; plain objects are converted recursively.
 */
export function parseToMap(jsonContent: any): any {
  let newValue;

  if (typeof jsonContent === "string" || jsonContent instanceof String)
    newValue = JSON.parse(jsonContent as string, mapReviver);
  else newValue = recursiveObjectToMap(jsonContent);

  return newValue;
}

/** A STIX object needs at least `id` and `type`. */
export function isValidStixObject(stixObject: Map<string, any>): boolean {
  return stixObject.has("id") && stixObject.has("type");
}

/**
 * Relationships are drawn as edges, not nodes, so they are not valid node
 * types. Every other STIX type becomes a node.
 */
export function isStixTypeValidForNode(stixType: string): boolean {
  return stixType !== "relationship";
}

/**
 * A STIX id is `"<type>--<uuid>"`, so the type is everything except the
 * trailing `--` plus 36-character UUID (38 characters) — i.e. an id is usable
 * as a node id unless it names a relationship type.
 */
export function isStixIdValidForNode(stixId: string): boolean {
  if (typeof stixId !== "string") return false;

  let typeLength = stixId.length - 38;
  let stixType = stixId.substring(0, typeLength);

  return isStixTypeValidForNode(stixType);
}

/** Parses and validates the graph-builder configuration. */
export function normalizeConfig(config: any): Map<string, any> {
  let parsed;

  try {
    parsed = parseToMap(config);
  } catch (err) {
    throw new InvalidConfigError(null, { cause: err });
  }

  if (!(parsed instanceof Map)) throw new InvalidConfigError();

  return parsed;
}

/**
 * Normalizes STIX content into an array of STIX objects.
 *
 * Accepts a bundle, a single STIX object, a non-empty array of objects, or a
 * JSON string of any of those.
 */
export function normalizeContent(stixContent: any): any[] {
  let stixObjects;
  let parsed;

  try {
    parsed = parseToMap(stixContent);
  } catch (err) {
    throw new STIXContentError(null, { cause: err });
  }

  if (parsed instanceof Map && parsed.size > 0) {
    if (parsed.get("type") === "bundle")
      stixObjects = parsed.get("objects") || [];
    else stixObjects = [parsed];
  } else if (Array.isArray(parsed)) stixObjects = parsed;
  else throw new STIXContentError();

  if (!Array.isArray(stixObjects) || stixObjects.length <= 0)
    throw new STIXContentError();

  for (let stixObject of stixObjects)
    if (!isValidStixObject(stixObject))
      throw new InvalidSTIXObjectError(stixObject);

  return stixObjects;
}

/**
 * Converts the internal Map representation of a STIX object back into plain
 * JSON-able objects, recursively. Used to hand STIX objects to callbacks.
 */
export function mapToPlain(value: any): any {
  if (value instanceof Map) {
    let result: Record<string, any> = {};
    for (let [key, item] of value) result[key] = mapToPlain(item);
    return result;
  }

  if (Array.isArray(value)) return value.map(mapToPlain);

  return value;
}
