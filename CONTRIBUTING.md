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

It executes lint, format check, type check, the test suite, the build, the size
budget, the packaging gate, and package/type-resolution checks (`publint`,
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

## Releasing

Publishing is done from CI, not from a laptop: `.github/workflows/publish.yml`
runs the full verification gate and then `npm publish --provenance --access public`
whenever a GitHub Release is published, so the tarball on the registry is the one
the gate proved and it carries a signed provenance statement.

1. Bump `version` in `package.json` and add the matching entry to `CHANGELOG.md`
   (`Added` / `Changed` / `Fixed` / `Notes`).
2. `npm run verify`, then commit and push to `main` — CI re-runs the same gate.
3. Tag the release and push the tag:
   ```bash
   git tag -a v0.1.0 -m "stix2vis-native 0.1.0"
   git push origin v0.1.0
   ```
4. Draft a GitHub Release from that tag (the changelog entry makes a good body)
   and publish it. The workflow does the rest.

### The first release of a new package

A trusted publisher can only be configured once the package exists on npmjs.com,
so the very first publish needs a credential. Create a **granular access token**
with read + write access (write tokens have a 90-day maximum lifetime — classic
tokens no longer work at all, they were revoked) and store it as the `NPM_TOKEN`
repository secret, then publish the Release as above.

### After the first release: drop the token

Once `stix2vis-native@0.1.0` exists you can publish with OIDC and no secret:

- Add a trusted publisher for `navaneeth001/STIX2viz-native` with the workflow
  name `publish.yml` (package → Settings → Trusted Publisher on npmjs.com, or
  `npm trust list stix2vis-native` to inspect what is configured).
- Delete the `NODE_AUTH_TOKEN` environment block from `publish.yml` and delete the
  `NPM_TOKEN` secret. The variable has to be **absent, not empty** — npm treats an
  empty `NODE_AUTH_TOKEN` as a real token and will not fall back to OIDC.
- Keep `id-token: write` (already set) and publish from cloud-hosted runners
  only, using a Node that ships npm ≥ 11.5.1 (the workflow pins Node 24; Node 22
  ships an npm that is too old for OIDC). `--provenance` becomes redundant —
  npm attaches provenance automatically.

`npm login && npm publish` still works locally in a pinch, but a local `npm
publish` does not attach provenance, which is half the value of the CI flow.

## Reporting bugs

Open a [bug report](https://github.com/navaneeth001/STIX2viz-native/issues/new?template=bug_report.yml)
and include a minimal STIX bundle that reproduces the issue (scrub any real
indicators first!), plus the platform (iOS/Android), the React Native version
and whether you use Expo.

## Feature requests

[Open a feature request](https://github.com/navaneeth001/STIX2viz-native/issues/new?template=feature_request.yml)
describing the analyst workflow you're trying to support — concrete CTI use
cases carry the most weight.
