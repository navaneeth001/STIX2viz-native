// Generates `src/icons/registry.ts` from the PNGs in `src/icons/`.
//
// Why generate instead of hand-writing: Metro only bundles assets that are
// referenced through a *static* `require()`/`import` literal, so every icon
// has to be listed explicitly — and the list must stay in sync with the files
// on disk. The generator keeps that mapping mechanical: the STIX type of an
// icon file is its name with the `stix2_` prefix and
// `_icon_tiny_round_v1.<ext>` suffix removed and underscores turned back into
// dashes, mirroring `stixTypeToIconURL()` in the web package.
//
// Run with `npm run icons` after adding or removing an icon.
import { readdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const iconsDir = resolve(here, "..", "src", "icons");
const registryPath = resolve(iconsDir, "registry.ts");

const PREFIX = "stix2_";
const SUFFIX = "_icon_tiny_round_v1";

function stixTypeForFile(fileName) {
  return fileName
    .slice(PREFIX.length, fileName.length - SUFFIX.length - ".png".length)
    .replaceAll("_", "-");
}

function identifierFor(stixType) {
  const camel = stixType.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
  return `${camel}Icon`;
}

const entries = readdirSync(iconsDir)
  .filter((name) => name.startsWith(PREFIX) && name.includes(SUFFIX))
  .sort();

const pngs = entries.filter((name) => name.endsWith(".png"));
const skipped = entries.filter((name) => !name.endsWith(".png"));

const rows = pngs.map((file) => ({
  file,
  stixType: stixTypeForFile(file),
  identifier: identifierFor(stixTypeForFile(file)),
}));

// Guard against two files mapping onto the same STIX type (e.g. an accidental
// duplicate icon), which would silently drop one of them.
const seen = new Map();
for (const row of rows) {
  if (seen.has(row.stixType))
    throw new Error(
      `Two icon files map to the STIX type "${row.stixType}": ` +
        `"${seen.get(row.stixType)}" and "${row.file}".`
    );
  seen.set(row.stixType, row.file);
}

const imports = rows
  .map((row) => `  "${row.stixType}": require("./${row.file}"),`)
  .join("\n");

const source = `// AUTO-GENERATED FILE — do not edit by hand.
//
// Regenerate with \`npm run icons\` after adding, removing or renaming a file in
// \`src/icons\`. Every entry is a static \`require()\` call, because that is the
// only form Metro can resolve to a bundled asset; the key is the STIX type the
// file name encodes (see scripts/generate-icons.mjs).
${
  skipped.length
    ? `//\n// Skipped non-PNG files (react-native-svg cannot render SVG files through\n// <Image> on native): ${skipped.join(", ")}.\n`
    : ""
}
import type { ImageSourcePropType } from "react-native";

/**
 * Bundled STIX icon for every STIX 2.1 domain object type that ships one, keyed
 * by STIX type. Icons without a bundled file are drawn as a letter placeholder
 * by the graph instead.
 */
export const STIX_ICON_SOURCES: Record<string, ImageSourcePropType> = {
${imports}
};

/** The icon file backing each key of {@link STIX_ICON_SOURCES}. */
export const STIX_ICON_FILES: Record<string, string> = {
${rows.map((row) => `  "${row.stixType}": "${row.file}",`).join("\n")}
};
`;

writeFileSync(registryPath, source, "utf8");

console.log(
  `Wrote ${rows.length} icons to src/icons/registry.ts` +
    (skipped.length ? ` (skipped ${skipped.length} non-PNG file(s))` : "")
);
