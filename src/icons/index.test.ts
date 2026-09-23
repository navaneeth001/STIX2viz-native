import { existsSync } from "node:fs";
import { resolve } from "node:path";

import {
  STIX_ICON_FILES,
  STIX_ICON_SOURCES,
  bundledIconTypes,
  getStixIcon,
  getStixIconFile,
  iconKeyForStixType,
  resolveStixIcon,
} from "./index";

describe("bundled STIX icons", () => {
  it("ships an icon for every STIX domain object type it knows", () => {
    const expected = [
      "artifact",
      "attack-pattern",
      "campaign",
      "course-of-action",
      "domain-name",
      "email-addr",
      "file",
      "identity",
      "indicator",
      "infrastructure",
      "intrusion-set",
      "ipv4-addr",
      "ipv6-addr",
      "location",
      "malware",
      "note",
      "observed-data",
      "report",
      "sighting",
      "threat-actor",
      "tool",
      "url",
      "user-account",
      "vulnerability",
    ];

    for (const type of expected) expect(getStixIcon(type)).toBeDefined();
  });

  it("keeps the file map in step with the icon map", () => {
    expect(Object.keys(STIX_ICON_FILES).sort()).toEqual(
      Object.keys(STIX_ICON_SOURCES).sort()
    );
  });

  it("every referenced icon file actually exists on disk", () => {
    const iconsDir = resolve(__dirname);

    for (const file of Object.values(STIX_ICON_FILES))
      expect(existsSync(resolve(iconsDir, file))).toBe(true);
  });

  it("has no duplicate file names", () => {
    const files = Object.values(STIX_ICON_FILES);

    expect(new Set(files).size).toBe(files.length);
  });

  it("resolves the language-content alias", () => {
    expect(iconKeyForStixType("language-content")).toBe("language");
    expect(getStixIcon("language-content")).toBe(getStixIcon("language"));
    expect(getStixIconFile("language-content")).toBe(
      "stix2_language_icon_tiny_round_v1.png"
    );
  });

  it("returns undefined for types without a bundled icon", () => {
    expect(getStixIcon("not-a-stix-type")).toBeUndefined();
    expect(getStixIcon("custom-object")).toBeUndefined();
    expect(getStixIcon(undefined)).toBeUndefined();
    expect(getStixIcon("")).toBeUndefined();
    expect(getStixIconFile("not-a-stix-type")).toBeUndefined();
  });

  it("lets consumers override an icon", () => {
    const custom = 12345;

    expect(resolveStixIcon("malware", { malware: custom })).toBe(custom);
    expect(resolveStixIcon("malware")).toBe(getStixIcon("malware"));
    expect(resolveStixIcon(undefined, { malware: custom })).toBeUndefined();
  });

  it("lists bundled types alphabetically", () => {
    const types = bundledIconTypes();

    expect(types).toEqual([...types].sort());
    expect(types).toContain("malware");
  });
});
