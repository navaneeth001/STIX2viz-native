import { InvalidMatchOperator } from "./errors";

/**
 * Mongo-style matching used by `config.include` / `config.exclude` and dotted
 * `displayProperty` lookups. Supports `$eq`, `$ne`, `$gt`, `$gte`, `$lt`,
 * `$lte`, `$in`, `$nin`, the logical operators `$and`, `$or`, `$not` and the
 * `$exists` presence check, plus dotted paths into nested objects and arrays.
 */
type ValueOp = (value: any, operand: any) => boolean;

const valueOps = new Map<string, ValueOp>([
  ["$eq", (a, b) => a === b],
  ["$gt", (a, b) => a > b],
  ["$gte", (a, b) => a >= b],
  ["$in", (val, arr) => arr.includes(val)],
  ["$lt", (a, b) => a < b],
  ["$lte", (a, b) => a <= b],
  ["$ne", (a, b) => a !== b],
  ["$nin", (val, arr) => !arr.includes(val)],
]);

/**
 * Yields every value found at `propPath` inside `stixValue`, descending into
 * arrays and nested maps. A path step of `""` is skipped, which makes `"a..b"`
 * behave like `"a.b"`.
 */
export function* getValuesAtPath(
  stixValue: any,
  propPath: string,
  index: number = -1
): Generator<any> {
  if (Array.isArray(stixValue)) {
    for (let elt of stixValue) yield* getValuesAtPath(elt, propPath, index);
  } else if (stixValue instanceof Map) {
    let nextDotIdx = propPath.indexOf(".", index + 1);
    let pathStep;

    if (nextDotIdx === -1) pathStep = propPath.substring(index + 1);
    else pathStep = propPath.substring(index + 1, nextDotIdx);

    if (pathStep.length > 0) {
      if (stixValue.has(pathStep)) {
        let propValue = stixValue.get(pathStep);

        if (nextDotIdx === -1) {
          if (Array.isArray(propValue)) yield* propValue;
          else yield propValue;
        } else yield* getValuesAtPath(propValue, propPath, nextDotIdx);
      }
    } else if (nextDotIdx !== -1)
      yield* getValuesAtPath(stixValue, propPath, nextDotIdx);
  }
}

export function mongoishMatchProperty(
  object: any,
  propPath: string,
  criteria: any
): boolean {
  let logicalCriteria: Map<string, any> = new Map();
  let valueCriteria: Map<string, any> = new Map();
  let presenceCriteria: Map<string, any> = new Map();

  if (criteria instanceof Map) {
    for (let [critPropName, critPropValue] of criteria) {
      if (["$and", "$or", "$not"].includes(critPropName))
        logicalCriteria.set(critPropName, critPropValue);
      else if (valueOps.has(critPropName))
        valueCriteria.set(critPropName, critPropValue);
      else if (critPropName === "$exists")
        presenceCriteria.set(critPropName, critPropValue);
      else if (critPropName.startsWith("$"))
        throw new InvalidMatchOperator(critPropName);
      else valueCriteria.set(critPropName, critPropValue);
    }
  } else valueCriteria.set("$eq", criteria);

  let result = true;

  for (let [logicalOp, subCriteria] of logicalCriteria) {
    if (logicalOp === "$or") {
      let orResult = false;
      for (let subCriterion of subCriteria)
        if (mongoishMatchProperty(object, propPath, subCriterion)) {
          orResult = true;
          break;
        }

      result &&= orResult;
    } else if (logicalOp === "$and") {
      let andResult = true;
      for (let subCriterion of subCriteria)
        if (!mongoishMatchProperty(object, propPath, subCriterion)) {
          andResult = false;
          break;
        }

      result &&= andResult;
    } // logicalOp === "$not"
    else result &&= !mongoishMatchProperty(object, propPath, subCriteria);

    if (!result) break;
  }

  let anyValuesFound = false;
  if (result) {
    if (valueCriteria.size > 0) result = false;

    for (let propValue of getValuesAtPath(object, propPath)) {
      anyValuesFound = true;
      if (result) break;

      result = mongoishMatchObject(propValue, valueCriteria);

      if (result) break;
    }
  }

  if (result) {
    if (presenceCriteria.has("$exists")) {
      let exists = presenceCriteria.get("$exists"); // true or false
      result &&= exists === anyValuesFound;
    }
  }

  return result;
}

export function mongoishMatchObject(value: any, criteria: any): boolean {
  let result = true;

  // Separate the various types of criteria.
  let logicalCriteria: Map<string, any> = new Map();
  let valueCriteria: Map<string, any> = new Map();
  let propValueCriteria: Map<string, any> = new Map();

  if (criteria instanceof Map) {
    for (let [critKey, critValue] of criteria) {
      if (["$and", "$or", "$not"].includes(critKey))
        logicalCriteria.set(critKey, critValue);
      else if (valueOps.has(critKey)) valueCriteria.set(critKey, critValue);
      else if (critKey.startsWith("$")) throw new InvalidMatchOperator(critKey);
      else propValueCriteria.set(critKey, critValue);
    }
  } else if (value instanceof Map) result = false;
  else valueCriteria.set("$eq", criteria);

  if (result) {
    for (let [logicalOp, subCriteria] of logicalCriteria) {
      if (logicalOp === "$or") {
        let orResult = false;
        for (let subCriterion of subCriteria)
          if (mongoishMatchObject(value, subCriterion)) {
            orResult = true;
            break;
          }

        result &&= orResult;
      } else if (logicalOp === "$and") {
        let andResult = true;
        for (let subCriterion of subCriteria)
          if (!mongoishMatchObject(value, subCriterion)) {
            andResult = false;
            break;
          }

        result &&= andResult;
      } // logicalOp === "$not"
      else result &&= !mongoishMatchObject(value, subCriteria);

      if (!result) break;
    }
  }

  if (result) {
    for (let [op, operand] of valueCriteria) {
      // `valueOps` is the only source of keys in `valueCriteria`, so this
      // lookup always resolves. The cast is compile-time only.
      let opFunc = valueOps.get(op) as ValueOp;
      result &&= opFunc(value, operand);

      if (!result) break;
    }
  }

  if (result) {
    for (let [propPath, criteria] of propValueCriteria) {
      if (value instanceof Map)
        result &&= mongoishMatchProperty(value, propPath, criteria);
      else result = false;

      if (!result) break;
    }
  }

  return result;
}
