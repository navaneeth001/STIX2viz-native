# stix2vis-native — STIX 2.1 graphs in React Native

[![npm version](https://img.shields.io/npm/v/stix2vis-native.svg)](https://www.npmjs.com/package/stix2vis-native)
[![CI](https://github.com/navaneeth001/STIX2viz-native/actions/workflows/ci.yml/badge.svg)](https://github.com/navaneeth001/STIX2viz-native/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/stix2vis-native.svg)](./LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/navaneeth001/STIX2viz-native?style=social)](https://github.com/navaneeth001/STIX2viz-native/stargazers)
[![npm downloads](https://img.shields.io/npm/dm/stix2vis-native.svg)](https://www.npmjs.com/package/stix2vis-native)

A React Native component that renders STIX 2.1 content — bundles, arrays of
objects or a single object — as an interactive relationship graph, entirely
on-device. It is the native sibling of the
[`stix2vis`](https://github.com/navaneeth001/STIX2viz) web package: the same
graph engine, the same props, a real native renderer instead of a canvas.

```tsx
import { Stix2Vis } from "stix2vis-native";
import bundle from "./bundle.json";

export default function Screen() {
  return <Stix2Vis stixJson={bundle} showToolbar showDetailsPanel />;
}
```

## Highlights

- Native `react-native-svg` rendering with touch selection, pan and pinch-to-zoom
- Web-package API parity, TypeScript declarations and zero runtime dependencies
- Deterministic layout, STIX 2.0/2.1 support and no network calls or telemetry
- Optional toolbar, details panel, theming, custom icons and JSON export

## Install

```bash
npm install stix2vis-native react-native-svg
```

With Expo:

```bash
npx expo install react-native-svg
npm install stix2vis-native
```

`react` and `react-native` are peers you already have. `react-native-svg` is
the renderer and has native code, so install it the way your project prefers
(`expo install` keeps it aligned with your SDK). On a bare project, run
`pod install` for iOS afterwards.

## Quick start

```tsx
import React from "react";
import { View } from "react-native";
import { Stix2Vis } from "stix2vis-native";
import bundle from "./bundle.json"; // STIX 2.1 bundle

export default function Screen() {
  return (
    <View style={{ flex: 1, padding: 12 }}>
      <Stix2Vis
        stixJson={bundle}
        graphStyle={{ flex: 1 }}
        showToolbar
        showDetailsPanel
        showDanglingRefs
      />
    </View>
  );
}
```

React Native views have no intrinsic size, so the graph takes a **420pt-high
block by default**. Pass `graphStyle={{ flex: 1 }}` (as above) to fill the
parent instead.

With callbacks:

```tsx
<Stix2Vis
  stixJson={bundle}
  onNodeclick={(nodeId) => console.log("clicked", nodeId)}
  onNodeSelect={(nodeId, stixObject) => {
    // `stixObject` is plain JSON, or null for ghost/embedded nodes.
    if (stixObject) console.log(stixObject.type, stixObject.name);
  }}
  onEdgeSelect={(edgeId, relationship) => {
    // `relationship` is the STIX relationship object, or null for edges derived
    // from embedded references such as created_by_ref.
    console.log(edgeId, relationship?.relationship_type);
  }}
  onSelectionChange={({ nodes, edges }) =>
    console.log("selection", nodes, edges)
  }
  onError={(error) => Alert.alert("STIX error", String(error))}
/>
```

## Props

Every prop is optional except `stixJson`. The first block mirrors the web
package; the second is React Native specific.

| Prop                | Type                                                        | Default           | Description                                                                                                                       |
| ------------------- | ----------------------------------------------------------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `stixJson`          | `any`                                                       | —                 | STIX 2.1 content: a bundle, a single STIX object, an array of objects, or a JSON string of any of those.                          |
| `config`            | `object`                                                    | —                 | Graph-builder configuration: `include`/`exclude`, `userLabels`, per-type `displayProperty`/`displayIcon`/`embeddedRelationships`. |
| `showDanglingRefs`  | `boolean`                                                   | `false`           | Render placeholder "ghost" nodes for references missing from the bundle.                                                          |
| `showDetailsPanel`  | `boolean`                                                   | `false`           | Show the detail panel for the selected node.                                                                                      |
| `showToolbar`       | `boolean`                                                   | `false`           | Show the toolbar: search, legend toggles, zoom/fit, export.                                                                       |
| `graphStyle`        | `StyleProp<ViewStyle>`                                      | `{ height: 420 }` | Style of the graph container.                                                                                                     |
| `wrapStyle`         | `StyleProp<ViewStyle>`                                      | —                 | Style of the wrapper around toolbar, graph and panel.                                                                             |
| `onNodeclick`       | `(nodeId: string) => void`                                  | —                 | Called with the clicked node's STIX id.                                                                                           |
| `onNodeSelect`      | `(nodeId, stixObject \| null) => void`                      | —                 | Called with the node's STIX id and its full object as plain JSON (`null` for ghost and embedded-observable nodes).                |
| `onEdgeSelect`      | `(edgeId, relationship \| null) => void`                    | —                 | Called with the edge id and the backing STIX relationship object, or `null` for embedded-reference edges.                         |
| `onSelectionChange` | `(selection: { nodes: string[]; edges: string[] }) => void` | —                 | Called on every tap; empty arrays mean the tap cleared the selection.                                                             |
| `onError`           | `(error: unknown) => void`                                  | —                 | Called when the content is invalid or the layout fails.                                                                           |

React Native specific:

| Prop             | Type                                  | Default      | Description                                                                                                                                   |
| ---------------- | ------------------------------------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `theme`          | `Partial<StixTheme>`                  | —            | Colours for the canvas, edges, selection ring, toolbar and panel, plus a palette per STIX type.                                               |
| `icons`          | `Record<string, ImageSourcePropType>` | —            | Icons to use instead of the bundled ones, keyed by STIX type.                                                                                 |
| `layout`         | `LayoutOptions`                       | —            | Force-layout tuning: `repulsion`, `springLength`, `springConstant`, `gravity`, `damping`, `iterations`, `seedRadius`, `cutoff`, `nodeRadius`. |
| `nodeRadius`     | `number`                              | `22`         | Radius of the node circles, in points.                                                                                                        |
| `onExportJson`   | `(json: string) => void`              | —            | Renders the toolbar's "Export JSON" button and receives the visible graph as pretty-printed JSON.                                             |
| `onCopyJson`     | `(json: string) => void`              | —            | Renders the detail panel's "Copy JSON" button (React Native needs a clipboard package, so the behaviour is yours).                            |
| `emptyComponent` | `ReactNode`                           | hint text    | Shown when there is no content to draw.                                                                                                       |
| `errorComponent` | `(error) => ReactNode`                | error text   | Shown when the content is invalid.                                                                                                            |
| `testID`         | `string`                              | `"stix2vis"` | Test id of the wrapper; everything inside uses it as a prefix.                                                                                |

### Test ids

Everything interactive carries a stable id, which keeps Detox/Appium flows (and
the unit tests in this repository) to the point: `stix2vis` (wrapper),
`stix2vis-canvas`, `stix2vis-node-<stix id>`, `stix2vis-edge-<edge id>`,
`stix2vis-toolbar`, `stix2vis-search-input`, `stix2vis-search-submit`,
`stix2vis-legend-<type>`, `stix2vis-zoom-in`, `stix2vis-zoom-out`,
`stix2vis-fit`, `stix2vis-export-json`, `stix2vis-details`,
`stix2vis-details-heading`, `stix2vis-details-<property>`.

## Interactions

| Gesture                   | Result                                                                                                                                              |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tap a node                | Selects it: `onNodeclick`, `onNodeSelect` and `onSelectionChange` fire, the node gets a ring, and the detail panel opens (when `showDetailsPanel`). |
| Tap an edge               | Selects it: `onEdgeSelect` and `onSelectionChange` fire. Edges carry a generous invisible touch target, so thin lines are still easy to hit.        |
| Tap the background        | Clears the selection and closes the detail panel.                                                                                                   |
| Drag                      | Pans the graph.                                                                                                                                     |
| Pinch                     | Zooms around the midpoint between your fingers.                                                                                                     |
| Toolbar `+` / `−` / `Fit` | Zoom in, zoom out, and fit the whole graph on screen.                                                                                               |

Toolbar search matches a STIX id exactly or a label substring, then selects and
centres the match — exactly like the web package, which means the selection
callbacks stay reserved for taps.

## Supported input

Anything the web package accepts:

- a STIX 2.1 bundle (`{ type: "bundle", objects: [...] }`),
- a single STIX object,
- an array of STIX objects,
- a JSON string of any of the above.

Relationships become edges (never nodes). Embedded references such as
`created_by_ref`, `object_refs` and `parent_directory_ref` become edges too, and
STIX 2.0 `observed-data` objects get one node per embedded observable. Node
labels prefer `name`, then `value`, then `path`, then the STIX type, are
truncated at 40 characters and de-duplicated with a `(n)` suffix.

### Loading a bundle at runtime

`stixJson` also accepts a JSON string, so the package can render a file or
pasted value without any file-system or network code of its own. For Expo,
install `expo-document-picker` and `expo-file-system`, keep the picker's URI
(`copyToCacheDirectory: false`), and pass its text to `stixJson`:

```tsx
const pick = await DocumentPicker.getDocumentAsync({
  type: ["application/json", "text/plain"],
  copyToCacheDirectory: false,
});

if (!pick.canceled && pick.assets[0]) {
  const text = await new File(pick.assets[0].uri).text();
  setBundle(JSON.parse(text));
}
```

For pasted text, call `JSON.parse` yourself to report malformed input, or pass
the raw string to `stixJson` and handle `onError`. On Android, add a timeout
around file reads because a stalled provider can otherwise leave a picker
spinner running indefinitely.

## Filtering and labelling with `config`

```tsx
<Stix2Vis
  stixJson={bundle}
  config={{
    // Mongo-style criteria: $eq, $ne, $gt, $gte, $lt, $lte, $in, $nin,
    // $and, $or, $not, $exists, plus dotted paths.
    include: { type: { $in: ["malware", "indicator", "relationship"] } },
    exclude: { revoked: true },
    // Rename specific objects.
    userLabels: { "malware--9c4638ec-f1de-4ddb-abf4-1b760417654e": "Loader" },
    // Per-type display options.
    indicator: { displayProperty: "pattern_type" },
    malware: { embeddedRelationships: [["sample_refs", "sample-of", false]] },
  }}
/>
```

The graph is rebuilt when the config _content_ changes, not when the object
identity does, so an inline object literal is fine.

`include`/`exclude` are validated: an unknown `$` operator throws an
`InvalidMatchOperator`, which reaches `onError` and renders the error state.

## Dangling references

By default, relationships whose endpoints are missing from the bundle are
dropped with a `console.warn` — that is the web package's behaviour. Pass
`showDanglingRefs` to draw the missing endpoints as dashed placeholder nodes
instead, so a partially delivered bundle still shows its structure:

```tsx
<Stix2Vis stixJson={bundle} showDanglingRefs />
```

## Toolbar and detail panel

Both are off by default, like the web package.

- **Toolbar** (`showToolbar`) — a search box, one legend chip per STIX type
  (tap to hide/show that type), `−` / `Fit` / `+`, and "Export JSON" when you
  pass `onExportJson`.
- **Detail panel** (`showDetailsPanel`) — opens under the graph when a node is
  selected: type, name, value, path, description, pattern, pattern type,
  created, modified, labels, confidence, revoked. "Full JSON" expands the whole
  object, and "Copy JSON" appears when you pass `onCopyJson`.

## Theming

`theme` is deep-merged over the defaults, so you can override one colour or the
whole palette:

```tsx
<Stix2Vis
  stixJson={bundle}
  theme={{
    edge: "#94a3b8",
    selection: "#0b8043",
    // Colour per STIX type; anything not listed cycles through `palette`.
    groupColors: { malware: "#c5221f", indicator: "#1a73e8" },
    palette: ["#1a73e8", "#8e24aa", "#0b8043"],
  }}
/>
```

`StixTheme` covers `background`, `surface`, `border`, `text`, `mutedText`,
`edge`, `edgeLabel`, `selection`, `nodeFill`, `nodeBorder`, `accent`, `danger`,
`dangling` and `palette`. `groupColor(type, theme)` is exported if you need the
same colour outside the graph.

## Icons

48 STIX icon assets ship with the package and are resolved from each node's
STIX type (the same artwork as the web package). Types without an icon — and
`custom-object`, whose asset is an SVG that native `<Image>` cannot render — are
drawn as a coloured letter placeholder.

Override any of them:

```tsx
import myMalwareIcon from "./icons/malware.png";

<Stix2Vis
  stixJson={bundle}
  icons={{ malware: myMalwareIcon, "language-content": myLanguageIcon }}
/>;
```

`getStixIcon(type)`, `getStixIconFile(type)` and `bundledIconTypes()` are
exported for building your own legends.

## Exporting

- **JSON** — pass `onExportJson` and the toolbar grows an "Export JSON" button.
  It hands you the currently _visible_ nodes and edges (hidden types excluded)
  as pretty-printed JSON; where it goes is up to you:

  ```tsx
  import { Share } from "react-native";

  <Stix2Vis
    stixJson={bundle}
    showToolbar
    onExportJson={(json) => Share.share({ message: json })}
  />;
  ```

- **PNG** — the web package snapshots a `<canvas>`; React Native has no
  equivalent, so this is deliberately left to your app. With
  [`react-native-view-shot`](https://github.com/gre/react-native-view-shot):

  ```tsx
  const graphRef = useRef<View>(null);

  <View ref={graphRef} collapsable={false}>
    <Stix2Vis stixJson={bundle} graphStyle={{ height: 480 }} />
  </View>;

  const uri = await captureRef(graphRef, { format: "png" });
  await Share.share({ url: uri });
  ```

  Capturing needs a real device or simulator (`captureRef` is a no-op in Jest),
  which is why the package does not depend on it.

## Using the graph builder without UI

`stix2vis-native/core` exports the graph builder, the STIX helpers and the
errors — with **no React Native and no SVG imports at all**, so it also runs in
plain Node:

```ts
import {
  makeGraphData,
  legendTypes,
  computeLayout,
} from "stix2vis-native/core";

const { nodes, edges, stixIdToObject } = makeGraphData(bundle, {
  showDanglingRefs: true,
});
const { positions, bounds } = computeLayout(nodes, edges);

console.log(legendTypes({ nodes, edges, stixIdToObject })); // ["identity", "malware", …]
console.log(positions.get("malware--9c4638ec-f1de-4ddb-abf4-1b760417654e"));
```

`useStixGraph({ stixJson, config, layout })` is the React hook version of the
same pipeline (it returns `graph`, `positions`, `bounds`, `legend`, `error`),
which is handy when you want the data without the default presentation.

## Differences from the web package

- Use the named import: `import { Stix2Vis } from "stix2vis-native"`.
- Graphs default to 420pt high in native views; pass `graphStyle={{ flex: 1 }}`
  to fill a parent.
- Interactions are touch-first: tap, drag, pinch and toolbar controls.
- PNG export is app-provided via `react-native-view-shot`.
- The package has three peer dependencies and no runtime dependencies.

Props, configuration and callbacks match `stix2vis` and are locked by tests.

## Performance

- The layout is computed **once per graph**, not per frame: `computeLayout` runs
  a fixed number of force iterations (250 for small graphs, fewer as the node
  count grows) on the JS thread, then the renderer just draws.
- Repulsion uses uniform spatial buckets, so each node only looks at its
  neighbourhood instead of every other node.
- Nodes and edges outside the visible area are skipped while rendering, which
  keeps panning smooth on large bundles.
- Zooming changes the projection, not the layout, so node radii, stroke widths
  and font sizes stay constant and legible at any zoom level.
- Everything is memoised: a parent re-render does not rebuild the graph or the
  SVG elements.

For very large bundles (thousands of objects) the layout is the bottleneck.
Tune it with the `layout` prop (`iterations`, `cutoff`, `repulsion`), or compute
positions ahead of time with `computeLayout` and hand them to `GraphCanvas`
directly.

## Development and contributing

```bash
npm install
npm test
npm run verify
```

`npm run verify` runs lint, formatting, TypeScript, tests, build, size and package
checks, `publint`, and `@arethetypeswrong/cli`. See [CONTRIBUTING.md](./CONTRIBUTING.md)
for project conventions and the release workflow. Please run verification before
opening a pull request.

## Links

- [Report a bug](https://github.com/navaneeth001/STIX2viz-native/issues/new?template=bug_report.yml)
- [Request a feature](https://github.com/navaneeth001/STIX2viz-native/issues/new?template=feature_request.yml)
- [Security advisories](https://github.com/navaneeth001/STIX2viz-native/security/advisories/new)
- [Web sibling (`stix2vis`)](https://github.com/navaneeth001/STIX2viz)
- [OASIS CTI STIX Visualization](https://oasis-open.github.io/cti-stix-visualization/)

## License

MIT — see [LICENSE](./LICENSE). Author: [Navaneeth001](https://github.com/navaneeth001).
