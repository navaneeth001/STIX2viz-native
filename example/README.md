# Example

A single-screen example that renders a STIX 2.1 bundle with the toolbar, the
detail panel and dangling-reference placeholders turned on.

This folder is **not** part of the published package — it exists so the API is
exercised with exactly the code a consumer would write, and so `npm run
typecheck` / `npm run lint` keep it compiling.

## Run it

The quickest way is Expo, in a scratch app:

```bash
npx create-expo-app stix-demo
cd stix-demo
npx expo install react-native-svg
npm install stix2vis-native
```

Then copy `App.tsx` over the generated one and change the import to the
published package:

```tsx
import { Stix2Vis } from "stix2vis-native";
```

On a bare React Native project the same steps apply, plus a pod install on iOS:

```bash
npm install stix2vis-native react-native-svg
cd ios && pod install
```

## What it demonstrates

- `showToolbar` — search, per-type legend toggles, zoom/fit and the JSON export
  hook.
- `showDetailsPanel` — key fields for the selected node, plus the full object.
- `showDanglingRefs` — the threat actor referenced but missing from the bundle
  is drawn as a placeholder node instead of being dropped.
- `onSelectionChange` — a single callback that covers node, edge and
  "tapped the background" selections.
- `theme` — overriding just the accent colour, leaving the rest of the default
  palette in place.
