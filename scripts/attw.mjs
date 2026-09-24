// Cross-platform wrapper around `@arethetypeswrong/cli`.
//
// `attw --pack .` runs `npm pack` internally, and when the caller is itself
// `npm publish --dry-run` (which sets `npm_config_dry_run`) that nested pack
// produces no tarball, so the check reports a bogus failure. The published
// `verify` script has to clear that variable — `env -u npm_config_dry_run attw`
// does it on POSIX shells only, so the clearing happens here instead and the
// CLI is spawned through Node directly rather than through a `.bin` shim.
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);

const cliPackage = require.resolve("@arethetypeswrong/cli/package.json");
const cliEntry = join(dirname(cliPackage), "dist", "index.js");

const env = { ...process.env };
delete env.npm_config_dry_run;

const result = spawnSync(
  process.execPath,
  [cliEntry, "--pack", ".", ...process.argv.slice(2)],
  { env, stdio: "inherit" }
);

if (result.error) throw result.error;

process.exit(result.status ?? 1);
