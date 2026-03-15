#!/usr/bin/env node
/**
 * Set all @farming-labs/* dependencies in example projects to the matching
 * local package versions (instead of workspace:* or an older version).
 *
 * Usage: node scripts/set-examples-version.mjs
 *    or: pnpm run examples:version
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const packagesDir = path.join(root, "packages");
const examplesDir = path.join(root, "examples");

function getPackageVersions() {
  const versions = new Map();
  const dirs = fs.readdirSync(packagesDir, { withFileTypes: true });

  for (const ent of dirs) {
    if (!ent.isDirectory()) continue;

    const pkgPath = path.join(packagesDir, ent.name, "package.json");
    if (!fs.existsSync(pkgPath)) continue;

    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
    if (typeof pkg.name === "string" && pkg.name.startsWith("@farming-labs/")) {
      versions.set(pkg.name, pkg.version);
    }
  }

  return versions;
}

function updatePackageJson(dir) {
  const pkgPath = path.join(dir, "package.json");
  if (!fs.existsSync(pkgPath)) return false;

  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
  let changed = false;

  for (const key of ["dependencies", "devDependencies"]) {
    const deps = pkg[key];
    if (!deps || typeof deps !== "object") continue;

    for (const name of Object.keys(deps)) {
      const expectedVersion = packageVersions.get(name);
      if (expectedVersion && deps[name] !== expectedVersion) {
        deps[name] = expectedVersion;
        changed = true;
      }
    }
  }

  if (changed) {
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n", "utf-8");
    return true;
  }
  return false;
}

const packageVersions = getPackageVersions();
console.log("Using local package versions:\n");
for (const [name, version] of [...packageVersions.entries()].sort(([a], [b]) => a.localeCompare(b))) {
  console.log(`- ${name}: ${version}`);
}
console.log();

const dirs = fs.readdirSync(examplesDir, { withFileTypes: true });
let updated = 0;

for (const ent of dirs) {
  if (!ent.isDirectory()) continue;
  const dir = path.join(examplesDir, ent.name);
  if (updatePackageJson(dir)) {
    console.log(`Updated ${path.relative(root, dir)}/package.json`);
    updated++;
  }
}

if (updated === 0) {
  console.log("All example package.json files already use the latest version.");
} else {
  console.log(`\nDone. Updated ${updated} example(s).`);
}
