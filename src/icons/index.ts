import type { ImageSourcePropType } from "react-native";

import { STIX_ICON_FILES, STIX_ICON_SOURCES } from "./registry";

/**
 * Icon lookup for the bundled STIX icons.
 *
 * `registry.ts` is generated from the files in this directory and maps each
 * STIX type to its icon (see `scripts/generate-icons.mjs`). A handful of icon
 * files do not follow that mechanical naming rule, so their STIX type is
 * aliased here.
 */

/** STIX type → registry key, for icons whose file name differs. */
export const STIX_ICON_ALIASES: Record<string, string> = {
  // The file is `stix2_language_icon_tiny_round_v1.png`, while the STIX 2.1
  // type is `language-content`.
  "language-content": "language",
};

/** A map of STIX type to icon, e.g. `{ malware: require("./malware.png") }`. */
export type StixIconMap = Record<string, ImageSourcePropType>;

/** Resolves a STIX type to the key used by the generated icon registry. */
export function iconKeyForStixType(stixType: string): string {
  return STIX_ICON_ALIASES[stixType] ?? stixType;
}

/**
 * The bundled icon for a STIX type, or `undefined` when no bundled icon
 * matches — in that case the graph draws a letter placeholder instead.
 *
 * Note: the `custom-object` icon only exists as an SVG, and `react-native-svg`
 * cannot render SVG files through `<Image>` on native, so custom objects fall
 * back to the placeholder glyph too.
 */
export function getStixIcon(
  stixType: string | null | undefined
): ImageSourcePropType | undefined {
  if (!stixType) return undefined;

  return STIX_ICON_SOURCES[iconKeyForStixType(stixType)];
}

/**
 * Resolves the icon to draw for a STIX type, preferring a consumer-supplied
 * icon (the `icons` prop) over the bundled one.
 */
export function resolveStixIcon(
  stixType: string | null | undefined,
  overrides?: StixIconMap | null
): ImageSourcePropType | undefined {
  if (!stixType) return undefined;

  const key = iconKeyForStixType(stixType);

  return overrides?.[stixType] ?? overrides?.[key] ?? STIX_ICON_SOURCES[key];
}

/** The file name backing a STIX type's bundled icon, if there is one. */
export function getStixIconFile(
  stixType: string | null | undefined
): string | undefined {
  if (!stixType) return undefined;

  return STIX_ICON_FILES[iconKeyForStixType(stixType)];
}

/** Every STIX type that ships a bundled icon, sorted alphabetically. */
export function bundledIconTypes(): string[] {
  return Object.keys(STIX_ICON_SOURCES).sort();
}

export { STIX_ICON_FILES, STIX_ICON_SOURCES };
