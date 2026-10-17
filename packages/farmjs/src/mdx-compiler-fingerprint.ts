import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Read implementation bytes, not mtimes or just package versions: linked workspace
// compilers and patched dependencies can change without a version bump.
const RUNTIME_FILE = /\.(?:[cm]?[jt]sx?|json|wasm)$/;
const MAX_FINGERPRINT_BYTES = 128 * 1024 * 1024;
let pendingFingerprint: Promise<string | undefined> | undefined;

async function packageRoot(name: string, importer: string): Promise<string> {
  const require = createRequire(importer);
  for (const base of require.resolve.paths(name) ?? []) {
    const candidate = path.join(base, name);
    try {
      const manifest = JSON.parse(await fs.readFile(path.join(candidate, "package.json"), "utf8"));
      if (manifest.name === name) return await fs.realpath(candidate);
    } catch {
      /* Try the next Node resolution location. */
    }
  }
  throw new Error(`Cannot fingerprint MDX compiler dependency ${name}`);
}

/** @internal An unavailable fingerprint disables reuse, not compilation. */
export function fingerprintMdxCompiler(): Promise<string | undefined> {
  // Client and SSR graphs can request the same snapshot concurrently. Keep only
  // in-flight work shared; a later build in this process must read inputs again.
  return (pendingFingerprint ??= readCompilerFingerprint().finally(() => {
    pendingFingerprint = undefined;
  }));
}

async function readCompilerFingerprint(): Promise<string | undefined> {
  try {
    const implementation = path.dirname(fileURLToPath(import.meta.url));
    const importer = fileURLToPath(import.meta.url);
    const docsRoot = await packageRoot("@farming-labs/docs", importer);
    const directories = new Set([implementation, path.join(docsRoot, "dist")]);
    const packages = new Set<string>();
    const queue: string[] = [];
    for (const name of [
      "@mdx-js/rollup",
      "remark-gfm",
      "remark-frontmatter",
      "remark-mdx-frontmatter",
      "fumadocs-core",
    ]) {
      queue.push(await packageRoot(name, importer));
    }
    for (const name of ["@mdx-js/mdx", "github-slugger", "parse-entities", "remark-gfm"]) {
      queue.push(await packageRoot(name, path.join(docsRoot, "package.json")));
    }
    while (queue.length) {
      const root = queue.pop()!;
      if (packages.has(root)) continue;
      packages.add(root);
      directories.add(root);
      const manifest = JSON.parse(await fs.readFile(path.join(root, "package.json"), "utf8"));
      for (const name of Object.keys(manifest.dependencies ?? {})) {
        if (!name.startsWith("@types/"))
          queue.push(await packageRoot(name, path.join(root, "package.json")));
      }
      for (const name of Object.keys(manifest.optionalDependencies ?? {})) {
        try {
          queue.push(await packageRoot(name, path.join(root, "package.json")));
        } catch {
          /* Optional dependency absent. */
        }
      }
    }
    return await fingerprintMdxFiles([...directories]);
  } catch {
    return undefined;
  }
}

/** @internal Kept separate to verify changed/deleted compiler dependencies. */
export async function fingerprintMdxFiles(directories: string[]): Promise<string> {
  const files = new Set<string>();
  const seen = new Set<string>();
  async function visit(directory: string): Promise<void> {
    const real = await fs.realpath(directory);
    if (seen.has(real)) return;
    seen.add(real);
    for (const entry of await fs.readdir(real, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      const file = path.join(real, entry.name);
      if (entry.isDirectory()) await visit(file);
      else if (
        entry.isFile() &&
        RUNTIME_FILE.test(entry.name) &&
        !/\.d\.[cm]?ts$|\.(?:test|spec)\.[jt]sx?$/.test(entry.name)
      )
        files.add(file);
      // An untracked symlink inside a compiler package could hide an input.
      else if (entry.isSymbolicLink()) throw new Error("Linked compiler input");
    }
  }
  for (const directory of directories) await visit(directory);
  const ordered = [...files].sort();
  const hash = createHash("sha256");
  let bytes = 0;
  for (let index = 0; index < ordered.length; index += 32) {
    const batch = ordered.slice(index, index + 32);
    const contents = await Promise.all(batch.map((file) => fs.readFile(file)));
    for (let i = 0; i < batch.length; i++) {
      bytes += contents[i].byteLength;
      if (bytes > MAX_FINGERPRINT_BYTES) throw new Error("Compiler fingerprint size limit");
      hash.update(JSON.stringify([batch[i], contents[i].byteLength]));
      hash.update(contents[i]);
    }
  }
  return hash.digest("hex");
}
