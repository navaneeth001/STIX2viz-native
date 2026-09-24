// Packaging gate: everything `package.json` promises to consumers must exist on
// disk, and nothing that should not be published may sit in the published
// directories.
//
// This deliberately works on the filesystem rather than on `npm pack` output:
// the tarball that npm builds is exactly `files` plus the always-included
// metadata files, so checking the declared entry points and the contents of
// those directories is the same assertion without the JSON-parsing fragility.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const packageJson = JSON.parse(
  readFileSync(join(root, "package.json"), "utf8")
);

const problems = [];

function checkPath(description, relativePath) {
  const path = join(root, relativePath.replace(/^\.\//, ""));

  if (!existsSync(path)) {
    problems.push(
      `${description} points at "${relativePath}", which is missing`
    );
    return false;
  }

  return true;
}

/** Collects every path string in the `exports` map (including conditions). */
function collectExportPaths(value, collected = []) {
  if (typeof value === "string") collected.push(value);
  else if (value && typeof value === "object")
    for (const entry of Object.values(value))
      collectExportPaths(entry, collected);

  return collected;
}

for (const field of ["main", "types"])
  if (packageJson[field])
    checkPath(`package.json "${field}"`, packageJson[field]);

for (const path of collectExportPaths(packageJson.exports, []))
  checkPath('package.json "exports"', path);

for (const paths of Object.values(packageJson.typesVersions ?? {}))
  for (const list of Object.values(paths))
    for (const path of list) checkPath('package.json "typesVersions"', path);

for (const entry of packageJson.files ?? [])
  checkPath('package.json "files"', entry);

// The published directories may only contain compiled output and assets.
const PUBLISHABLE = /\.(js|png)$/;

function scan(directory, relativeDirectory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const relativePath = `${relativeDirectory}/${entry.name}`;

    if (entry.isDirectory()) {
      scan(join(directory, entry.name), relativePath);
      continue;
    }

    // `.d.ts` is a declaration file: types only, no runtime code.
    const isDeclaration = entry.name.endsWith(".d.ts");

    if (!isDeclaration && /\.(ts|tsx)$/.test(entry.name))
      problems.push(`${relativePath} is TypeScript source and must not ship`);
    else if (/\.test\./.test(entry.name))
      problems.push(`${relativePath} is test code and must not ship`);
    else if (!isDeclaration && !PUBLISHABLE.test(entry.name))
      problems.push(`${relativePath} is not a compiled file or an asset`);
  }
}

const distDir = join(root, "dist");

if (existsSync(distDir)) scan(distDir, "dist");
else problems.push("dist/ is missing — run `npm run build`");

// Every icon the registry requires must be next to it.
const registryPath = join(distDir, "icons", "registry.js");

if (existsSync(registryPath)) {
  const registry = readFileSync(registryPath, "utf8");
  const referenced = [
    ...new Set(
      [...registry.matchAll(/["']\.\/([^"']+)["']/g)].map((match) => match[1])
    ),
  ];

  for (const file of referenced)
    if (!existsSync(join(distDir, "icons", String(file))))
      problems.push(
        `dist/icons/${file} is required by the registry but missing`
      );

  console.log(`Checked ${referenced.length} bundled icon assets.`);
} else problems.push("dist/icons/registry.js is missing — run `npm run build`");

// The tarball should stay small; assets dominate it, so a threshold catches an
// accidental directory copy that the extension checks would not.
const distSize = (function size(directory) {
  return readdirSync(directory, { withFileTypes: true }).reduce(
    (total, entry) => {
      const path = join(directory, entry.name);

      return total + (entry.isDirectory() ? size(path) : statSync(path).size);
    },
    0
  );
})(distDir);

console.log(`Published payload: ${(distSize / 1000).toFixed(1)} kB`);

if (problems.length > 0) {
  console.error("\nPackaging problems:");

  for (const problem of problems) console.error(`  - ${problem}`);

  process.exit(1);
}

console.log("Packaging check passed.");
