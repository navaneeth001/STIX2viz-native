import { InvalidMatchOperator } from "./errors";
import {
  getValuesAtPath,
  mongoishMatchObject,
  mongoishMatchProperty,
} from "./match";
import { normalizeEmbeddedRelationships } from "./embeddedRelationships";

/** Converts plain JSON to the internal Map form, like `config` parsing does. */
function toMap(value: any): any {
  if (Array.isArray(value)) return value.map(toMap);
  if (value && typeof value === "object")
    return new Map(
      Object.entries(value).map(([key, item]) => [key, toMap(item)])
    );

  return value;
}

function matches(value: any, criteria: any) {
  return mongoishMatchObject(toMap(value), toMap(criteria));
}

describe("mongoishMatchObject", () => {
  it("matches equality by default and with $eq", () => {
    expect(matches({ type: "malware" }, { type: "malware" })).toBe(true);
    expect(matches({ type: "malware" }, { type: "indicator" })).toBe(false);
    expect(matches({ type: "malware" }, { type: { $eq: "malware" } })).toBe(
      true
    );
  });

  it("supports $ne", () => {
    expect(matches({ type: "malware" }, { type: { $ne: "indicator" } })).toBe(
      true
    );
    expect(matches({ type: "malware" }, { type: { $ne: "malware" } })).toBe(
      false
    );
  });

  it("supports the numeric comparisons", () => {
    expect(matches({ confidence: 50 }, { confidence: { $gt: 40 } })).toBe(true);
    expect(matches({ confidence: 50 }, { confidence: { $gte: 50 } })).toBe(
      true
    );
    expect(matches({ confidence: 50 }, { confidence: { $lt: 60 } })).toBe(true);
    expect(matches({ confidence: 50 }, { confidence: { $lte: 50 } })).toBe(
      true
    );
    expect(matches({ confidence: 50 }, { confidence: { $gt: 60 } })).toBe(
      false
    );
  });

  it("supports $in and $nin", () => {
    expect(
      matches({ type: "malware" }, { type: { $in: ["malware", "tool"] } })
    ).toBe(true);
    expect(
      matches({ type: "malware" }, { type: { $nin: ["malware", "tool"] } })
    ).toBe(false);
  });

  it("supports $and, $or and $not", () => {
    const value = { type: "malware", is_family: false };

    expect(
      matches(value, { $and: [{ type: "malware" }, { is_family: false }] })
    ).toBe(true);
    expect(
      matches(value, { $and: [{ type: "malware" }, { is_family: true }] })
    ).toBe(false);
    expect(
      matches(value, { $or: [{ type: "tool" }, { is_family: false }] })
    ).toBe(true);
    expect(
      matches(value, { $or: [{ type: "tool" }, { is_family: true }] })
    ).toBe(false);
    expect(matches(value, { $not: { type: "tool" } })).toBe(true);
    expect(matches(value, { $not: { type: "malware" } })).toBe(false);
  });

  it("supports $exists through property criteria", () => {
    expect(
      matches({ a: 1 }, { $or: [{ b: { $exists: true } }, { a: 1 }] })
    ).toBe(true);
    expect(matches({ a: 1 }, { b: { $exists: true } })).toBe(false);
  });

  it("follows dotted paths into nested objects and arrays", () => {
    const value = {
      hashes: { MD5: "abc" },
      refs: [{ id: "1" }, { id: "2" }],
    };

    expect(matches(value, { "hashes.MD5": "abc" })).toBe(true);
    expect(matches(value, { "refs.id": "2" })).toBe(true);
    expect(matches(value, { "refs.id": "3" })).toBe(false);
  });

  it("rejects unknown $ operators", () => {
    expect(() => matches({ a: 1 }, { a: { $nope: 1 } })).toThrow(
      InvalidMatchOperator
    );
    expect(() => matches({ a: 1 }, { $nope: 1 })).toThrow(InvalidMatchOperator);
  });

  it("compares non-map values directly", () => {
    expect(mongoishMatchObject(5, 5)).toBe(true);
    expect(mongoishMatchObject(5, 6)).toBe(false);
    expect(mongoishMatchObject(new Map(), 5)).toBe(false);
  });
});

describe("mongoishMatchProperty", () => {
  it("matches a property path against a bare value", () => {
    const object = toMap({ name: "Example" });

    expect(mongoishMatchProperty(object, "name", "Example")).toBe(true);
    expect(mongoishMatchProperty(object, "name", "Other")).toBe(false);
  });

  it("handles the empty path step of a doubled dot", () => {
    const object = toMap({ a: { b: "c" } });

    expect(mongoishMatchProperty(object, "a..b", "c")).toBe(true);
  });
});

describe("getValuesAtPath", () => {
  it("yields every value at a path, flattening arrays", () => {
    const value = toMap({
      refs: [{ id: "1" }, { id: "2" }],
      nested: [{ id: "3" }],
    });

    expect([...getValuesAtPath(value, "refs.id")]).toEqual(["1", "2"]);
    expect([...getValuesAtPath(value, "nested.id")]).toEqual(["3"]);
  });

  it("yields nothing for a missing path", () => {
    expect([...getValuesAtPath(toMap({ a: 1 }), "b.c")]).toEqual([]);
  });

  it("walks into arrays of arrays", () => {
    const value = toMap([{ id: "1" }, { id: "2" }]);

    expect([...getValuesAtPath(value, "id")]).toEqual(["1", "2"]);
  });
});

describe("normalizeEmbeddedRelationships", () => {
  it("keeps three-entry tuples and defaults the direction", () => {
    expect(
      normalizeEmbeddedRelationships([
        ["a_ref", "linked-to", false],
        ["b_ref", "linked-to"],
      ])
    ).toEqual([
      ["a_ref", "linked-to", false],
      ["b_ref", "linked-to", true],
    ]);
  });

  it("drops entries that are not tuples", () => {
    expect(
      normalizeEmbeddedRelationships(["nope", [], ["ok", "label"]])
    ).toEqual([["ok", "label", true]]);
  });

  it("tolerates junk", () => {
    expect(normalizeEmbeddedRelationships(null)).toEqual([]);
    expect(normalizeEmbeddedRelationships("nope")).toEqual([]);
  });
});
