import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import { builtinModules, createRequire } from "node:module";
import path from "node:path";
import type { DocsMdxOptions, DocsMdxPlugin } from "@farming-labs/docs";
import { resolveDocsMdxOptions } from "@farming-labs/docs/build";
import { parseAst } from "vite";
import { addPackageTrees, fingerprintMdxFiles, packageRoot } from "./mdx-compiler-fingerprint.js";

const BUILTINS = new Set(builtinModules);

type Node = { type: string; [key: string]: unknown };

function packageName(specifier: string): string {
  const [scope, name] = specifier.split("/");
  return specifier.startsWith("@") ? `${scope}/${name}` : scope!;
}

/** Module specifiers a file imports; throws when one is computed at runtime. */
function importedSpecifiers(code: string): string[] {
  const specifiers: string[] = [];
  const literal = (node: unknown, kind: string) => {
    const source = node as Node | null;
    if (source?.type === "Literal" && typeof source.value === "string") {
      specifiers.push(source.value);
    } else {
      throw new Error(`Cannot trace a ${kind} whose specifier is computed`);
    }
  };
  const visit = (node: unknown): void => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const child of node) visit(child);
      return;
    }
    const current = node as Node;
    if (
      current.type === "ImportDeclaration" ||
      current.type === "ExportAllDeclaration" ||
      (current.type === "ExportNamedDeclaration" && current.source)
    ) {
      literal(current.source, "static import");
    } else if (current.type === "ImportExpression") {
      literal(current.source, "dynamic import");
    } else if (
      current.type === "CallExpression" &&
      (current.callee as Node | undefined)?.type === "Identifier" &&
      (current.callee as Node).name === "require"
    ) {
      literal((current.arguments as unknown[])[0], "require");
    }
    for (const value of Object.values(current)) {
      if (value && typeof value === "object") visit(value);
    }
  };
  visit(parseAst(code));
  return specifiers;
}

function isInstalledPackage(file: string): boolean {
  return file.split(path.sep).includes("node_modules");
}

async function installedPackageRoot(file: string): Promise<string> {
  let directory = path.dirname(file);
  for (;;) {
    try {
      await fs.access(path.join(directory, "package.json"));
      return await fs.realpath(directory);
    } catch {
      const parent = path.dirname(directory);
      if (parent === directory) throw new Error(`No package.json above ${file}`);
      directory = parent;
    }
  }
}

const loadedFingerprints = new Map<string, string>();

/**
 * @internal The fingerprint of the app's MDX plugins as this process loads them. Node keeps the
 * first copy of an imported module, so once a plugin changes under a running process its output
 * no longer matches its files: resolve to `undefined` and compile without reuse, as the
 * adapter's own compiler fingerprint does.
 */
export async function fingerprintMdxPlugins(
  options: DocsMdxOptions,
  root: string,
): Promise<string | undefined> {
  const current = await readMdxPluginFingerprint(options, root);
  if (current === undefined) return undefined;
  const key = JSON.stringify([root, options]);
  const loaded = loadedFingerprints.get(key);
  if (loaded === undefined) loadedFingerprints.set(key, current);
  return loaded === undefined || loaded === current ? current : undefined;
}

/**
 * @internal Fingerprints the app's MDX plugins: their options, every app or workspace source
 * file they import, and the implementation bytes of every installed package they reach. Resolves
 * to `undefined`, which disables reuse, when a plugin or one of its imports cannot be traced.
 */
export async function readMdxPluginFingerprint(
  options: DocsMdxOptions,
  root: string,
): Promise<string | undefined> {
  try {
    const { remarkPlugins, rehypePlugins, codeHighlighter } = resolveDocsMdxOptions(options);
    const plugins: DocsMdxPlugin[] = [
      ...remarkPlugins,
      ...rehypePlugins,
      ...(codeHighlighter === undefined ? [] : [codeHighlighter]),
    ];
    const sources = new Set<string>();
    const packages: string[] = [];
    const queue: string[] = [];
    const appRequire = createRequire(path.join(root, "package.json"));

    const follow = async (specifier: string, importer: string) => {
      if (specifier.startsWith("node:") || BUILTINS.has(specifier)) return;
      if (specifier.startsWith(".") || path.isAbsolute(specifier)) {
        queue.push(await fs.realpath(path.resolve(path.dirname(importer), specifier)));
        return;
      }
      const pkg = await packageRoot(packageName(specifier), importer);
      // A linked workspace package is source the app can edit; trace it like the app's own.
      if (isInstalledPackage(pkg)) packages.push(pkg);
      else queue.push(await fs.realpath(createRequire(importer).resolve(specifier)));
    };

    for (const plugin of plugins) {
      const resolved = await fs.realpath(
        appRequire.resolve(Array.isArray(plugin) ? plugin[0] : plugin),
      );
      if (isInstalledPackage(resolved)) packages.push(await installedPackageRoot(resolved));
      else queue.push(resolved);
    }
    while (queue.length) {
      const file = queue.pop()!;
      if (sources.has(file)) continue;
      sources.add(file);
      if (isInstalledPackage(file)) {
        packages.push(await installedPackageRoot(file));
        continue;
      }
      for (const specifier of importedSpecifiers(await fs.readFile(file, "utf8"))) {
        await follow(specifier, file);
      }
    }

    const directories = new Set<string>();
    await addPackageTrees(packages, directories);
    const hash = createHash("sha256");
    hash.update(JSON.stringify(plugins));
    for (const file of [...sources].sort()) {
      hash.update(JSON.stringify([path.relative(root, file)]));
      hash.update(await fs.readFile(file));
    }
    hash.update(directories.size > 0 ? await fingerprintMdxFiles([...directories]) : "");
    return hash.digest("hex");
  } catch {
    return undefined;
  }
}
