# Changelog

All notable changes to this project are documented in this file.
This project follows [Semantic Versioning](https://semver.org/).

## 0.1.0

The first release: STIX 2.1 visualisation for React Native, extracted from the
graph engine of the [`stix2vis`](https://github.com/navaneeth001/STIX2viz) web
package and rebuilt around native rendering.

### Added

- **`Stix2Vis` component** — renders a STIX 2.1 bundle, a single object, an array
  of objects or a JSON string as an interactive relationship graph in a
  `react-native-svg` surface. No WebView, no network access, nothing leaves the
  device.
- **Web-package prop parity** — `stixJson`, `config`, `showDanglingRefs`,
  `showDetailsPanel`, `showToolbar`, `graphStyle` and the
  `onNodeclick` / `onNodeSelect` / `onEdgeSelect` / `onSelectionChange` /
  `onError` callbacks behave as they do in `stix2vis`, including STIX 2.0
  `observed-data.objects`, embedded references, ghost nodes for dangling
  references and the `include`/`exclude`/`userLabels`/`displayProperty`
  configuration.
- **Native interaction** — tap to select a node or an edge, tap the background
  to clear, drag to pan, pinch to zoom, plus zoom/fit controls in the toolbar.
  Edges carry a wider invisible touch target so they can be hit with a finger.
- **Deterministic force-directed layout** (`computeLayout`) — no `Math.random()`
  and no per-frame physics: the whole layout is computed once on the JS thread
  with spatial bucketing, so the same bundle always produces the same picture
  and large graphs stay responsive.
- **Toolbar** (`showToolbar`) — search by STIX id or label (selects and centres
  the match), per-type legend toggles, zoom/fit, and an optional "Export JSON"
  button that hands the visible nodes and edges to your `onExportJson` callback.
- **Detail panel** (`showDetailsPanel`) — key fields, a collapsible full-JSON
  view and an optional "Copy JSON" hook, for the selected node.
- **Bundled STIX icons** — 48 icon assets, resolved per STIX type, with a letter
  placeholder for types that have no icon and an `icons` prop for overrides.
- **Theming** — `StixTheme` with a default palette, per-type colour overrides
  and per-part overrides, deep-merged over the defaults.
- **Headless entry point** (`stix2vis-native/core`) — the graph builder and the
  STIX helpers (`makeGraphData`, `legendTypes`, matchers, errors) with no React
  Native or SVG dependency at all, so bundles can be turned into graph data in
  plain Node (scripts, servers, tests).
- **Loading your own bundle at runtime** — the README documents the
  `expo-document-picker` recipe for handing a file (or pasted text) to
  `stixJson`, including the `copyToCacheDirectory: false` trap on Android, and
  the example app can load a picked file or a pasted bundle.
- **Packaging** — CommonJS build with type declarations, validated by `publint`
  and `@arethetypeswrong/cli`, a size budget for the JS and the icons, and
  subpath shims so `stix2vis-native/core` resolves with or without package
  `exports` support.

### Fixed

- **The graph no longer collapses to zero height** — the SVG surface is wrapped
  in a `flex: 1` container, so it measures correctly inside a scroll view, a
  `SafeAreaView` or any parent that does not hand it an explicit height.

### Notes

- Unlike the web package there is **no default export**: a CommonJS entry that
  sets both `__esModule` and `default` breaks default imports in bundlers that
  read the entry as ESM. Import the component by name:
  `import { Stix2Vis } from "stix2vis-native"`.
- **PNG export is not included.** The web package snapshots a `<canvas>`; on
  React Native that needs a screenshot library. Wire it up with
  `react-native-view-shot` in your app — see the README.
- User-supplied `embeddedRelationships` entries with two elements now default to
  a forward edge instead of silently reversing it, and malformed entries are
  dropped.
