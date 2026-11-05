import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export function packPackages(repo, output, folders) {
  mkdirSync(output, { recursive: true });
  const packages = new Map();
  const sources = new Map();
  for (const folder of folders) {
    const source = join(repo, "packages", folder);
    const meta = JSON.parse(readFileSync(join(source, "package.json"), "utf8"));
    const packDir = join(output, folder);
    mkdirSync(packDir, { recursive: true });
    const log = execFileSync("pnpm", ["pack", "--pack-destination", packDir], {
      cwd: source,
      encoding: "utf8",
    });
    writeFileSync(join(packDir, "pack.log"), log);
    const tarball = readdirSync(packDir).filter((file) => file.endsWith(".tgz"));
    assert.equal(tarball.length, 1);
    execFileSync("tar", ["-xzf", join(packDir, tarball[0]), "-C", packDir]);
    packages.set(meta.name, join(packDir, "package"));
    sources.set(meta.name, source);
  }
  // Resolve peers from the lockfile installation, but all changed workspace packages
  // resolve to their extracted tarballs, including transitive package dependencies.
  for (const [name, target] of packages) {
    const sourceModules = join(sources.get(name), "node_modules");
    const modules = join(target, "node_modules");
    mkdirSync(modules, { recursive: true });
    for (const item of readdirSync(sourceModules, { withFileTypes: true })) {
      if (item.name === ".bin") continue;
      if (item.name.startsWith("@")) {
        mkdirSync(join(modules, item.name), { recursive: true });
        for (const child of readdirSync(join(sourceModules, item.name))) {
          const dependency = `${item.name}/${child}`;
          const link = join(modules, item.name, child);
          if (!existsSync(link))
            symlinkSync(
              packages.get(dependency) ?? realpathSync(join(sourceModules, item.name, child)),
              link,
              "dir",
            );
        }
      } else {
        const link = join(modules, item.name);
        if (!existsSync(link))
          symlinkSync(realpathSync(join(sourceModules, item.name)), link, "dir");
      }
    }
    const meta = JSON.parse(readFileSync(join(target, "package.json"), "utf8"));
    const check = (value) => {
      if (typeof value === "string" && value.startsWith("./") && !value.includes("*"))
        assert(existsSync(join(target, value)), `${name}: ${value} missing from tarball`);
      else if (value && typeof value === "object") Object.values(value).forEach(check);
    };
    check(meta.exports);
  }
  const importEntry = async (name, entry) => {
    const root = packages.get(name);
    const meta = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    return import(pathToFileURL(join(root, meta.exports[entry].import)).href);
  };
  return { packages, importEntry };
}
