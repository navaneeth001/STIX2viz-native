// Size budget check for the published bundle.
//
// React Native apps ship their dependencies as source (Metro cannot tree-shake
// a prebuilt library), so every kilobyte here ends up in the app binary. The
// budgets live in package.json under "size-budget" and are enforced at build
// time — `size-limit` itself requires a newer Node than this package's own
// React Native toolchain supports, and a 40-line script needs no dependency.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");

const packageJson = JSON.parse(
  readFileSync(join(root, "package.json"), "utf8")
);
const budget = packageJson["size-budget"] ?? [];

/** Parses "40 kB" into bytes. */
function parseLimit(limit) {
  const match = /^([\d.]+)\s*(B|kB|MB)$/.exec(String(limit).trim());

  if (!match) throw new Error(`Unsupported size budget "${limit}"`);

  const value = Number(match[1]);
  const unit = match[2];

  if (unit === "B") return value;
  if (unit === "kB") return value * 1000;

  return value * 1000 * 1000;
}

function measure(path) {
  const stats = statSync(path);

  if (!stats.isDirectory()) return stats.size;

  return readdirSync(path).reduce(
    (total, entry) => total + measure(join(path, entry)),
    0
  );
}

function format(bytes) {
  if (bytes >= 1000 * 1000) return `${(bytes / 1000000).toFixed(2)} MB`;

  return `${(bytes / 1000).toFixed(1)} kB`;
}

let failed = false;

for (const entry of budget) {
  const path = join(root, entry.path);
  let actual;

  try {
    actual = measure(path);
  } catch {
    console.error(
      `${entry.name}: ${entry.path} is missing — run \`npm run build\`.`
    );
    failed = true;
    continue;
  }

  const limit = parseLimit(entry.limit);
  const status = actual > limit ? "FAIL" : "ok";

  console.log(
    `${status.padEnd(4)} ${entry.name}: ${format(actual)} of ${format(limit)}`
  );

  if (actual > limit) failed = true;
}

if (failed) {
  console.error(
    "\nSize budget exceeded. Either shrink the bundle or raise the budget in " +
      'package.json "size-budget" deliberately.'
  );
  process.exit(1);
}
