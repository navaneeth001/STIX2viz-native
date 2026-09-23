/**
 * Default look and feel of the graph, its toolbar and its detail panel.
 *
 * Every value can be overridden by passing a partial `theme` prop, which is
 * deep-merged with this default.
 */
export interface StixTheme {
  /** Canvas background behind the graph. */
  background: string;
  /** Background of the toolbar and the detail panel. */
  surface: string;
  /** Hairlines and panel borders. */
  border: string;
  /** Primary text (labels, panel fields). */
  text: string;
  /** Secondary text (field names, hints, ghost labels). */
  mutedText: string;
  /** Edge lines. */
  edge: string;
  /** Edge labels. */
  edgeLabel: string;
  /** Ring drawn around the selected node / edge. */
  selection: string;
  /** Node circle fill (used behind icons and for icon-less types). */
  nodeFill: string;
  /** Node circle outline. */
  nodeBorder: string;
  /** Buttons and interactive accents. */
  accent: string;
  /** Error text. */
  danger: string;
  /** Placeholder nodes for dangling references. */
  dangling: string;
  /** Colours cycled deterministically across STIX types. */
  palette: string[];
  /** Explicit colour per STIX type, taking precedence over `palette`. */
  groupColors?: Record<string, string>;
}

export const defaultTheme: StixTheme = {
  background: "#ffffff",
  surface: "#ffffff",
  border: "#dcdfe4",
  text: "#1c1e21",
  mutedText: "#6b7280",
  edge: "#8b949e",
  edgeLabel: "#4b5563",
  selection: "#1a73e8",
  nodeFill: "#f4f6f8",
  nodeBorder: "#1c1e21",
  accent: "#1a73e8",
  danger: "#a12b26",
  dangling: "#9ca3af",
  palette: [
    "#1a73e8",
    "#8e24aa",
    "#0b8043",
    "#e37400",
    "#c5221f",
    "#00838f",
    "#5f6368",
    "#6d4c41",
  ],
};

/** Deep-merges a partial theme over {@link defaultTheme}. */
export function resolveTheme(theme?: Partial<StixTheme> | null): StixTheme {
  if (!theme) return defaultTheme;

  return {
    ...defaultTheme,
    ...theme,
    palette: theme.palette?.length ? theme.palette : defaultTheme.palette,
    groupColors: theme.groupColors ?? defaultTheme.groupColors,
  };
}

/** FNV-1a, so a STIX type always maps to the same palette slot. */
function hashString(value: string): number {
  let hash = 0x811c9dc5;

  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }

  return hash >>> 0;
}

/**
 * The colour used for a STIX type: an explicit `theme.groupColors` entry if
 * there is one, otherwise a stable slot in `theme.palette`.
 */
export function groupColor(stixType: string, theme: StixTheme): string {
  const explicit = theme.groupColors?.[stixType];
  if (explicit) return explicit;

  const palette = theme.palette.length ? theme.palette : defaultTheme.palette;

  return palette[hashString(stixType) % palette.length] as string;
}
