# Contributing to stix2vis-native

Thanks for your interest in contributing! This project renders STIX 2.1 threat
intelligence natively on iOS and Android, and every kind of contribution is
welcome — code, documentation, sample data, bug reports and feature ideas.

## Getting started

Requires Node `>= 20.19.4` (see `.nvmrc`) — the same floor React Native's own
toolchain has.

```bash
git clone https://github.com/navaneeth001/STIX2viz-native.git
cd STIX2viz-native
npm install
npm test           # Jest suite (react-test-renderer, no device needed)
npm run build      # tsc → dist/, icons copied, subpath shims written
npm run icons      # regenerate src/icons/registry.ts after adding an icon
```

There is no simulator step: the component suite renders the tree with
`react-test-renderer`, and `react-native-svg` is mocked down to host elements
(see `__mocks__/react-native-svg.js`) so assertions can look at the graph the
same way a user would.

## Before opening a PR

Run the full verification gate — CI runs exactly this:

```bash
npm run verify
```

It executes lint, format check, type check, the test suite, the build, the
size budget, and package/type-resolution checks (`publint`,
`@arethetypeswrong/cli`).

## Project rules that keep this package trustworthy

- **Prop compatibility with the web package is sacred.** `stixJson`,
  `config`, `showDanglingRefs`, `showDetailsPanel`, `showToolbar` and the
  `onNodeclick`/`onNodeSelect`/`onEdgeSelect`/`onSelectionChange`/`onError`
  callbacks must keep behaving exactly as `stix2vis` does. New features go
  behind new, default-off props.
- **The dependency budget is a feature.** `react`, `react-native` and
  `react-native-svg` are peers; there are no runtime dependencies. New ones are
  almost certainly rejected — the graph builder, the force layout, the pan/zoom
  handling and the rendering are all first-party code.
- **The layout stays deterministic.** No `Math.random()`, no wall-clock input:
  the same bundle must always produce the same picture, or the snapshots and
  the tests stop meaning anything.
- **Behaviour is locked by tests.** If a change to `makeGraphData` output is
  intentional, update the expectations in `src/core/graphData.test.ts`
  deliberately and say so in your PR.
- **No telemetry, no network calls.** STIX content must never leave the device.

## Reporting bugs

Open a [bug report](https://github.com/navaneeth001/STIX2viz-native/issues/new?template=bug_report.yml)
and include a minimal STIX bundle that reproduces the issue (scrub any real
indicators first!), plus the platform (iOS/Android), the React Native version
and whether you use Expo.

## Feature requests

[Open a feature request](https://github.com/navaneeth001/STIX2viz-native/issues/new?template=feature_request.yml)
describing the analyst workflow you're trying to support — concrete CTI use
cases carry the most weight.
