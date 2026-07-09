import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const packageDir = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const stylesDir = path.join(packageDir, "styles");
const bundlesDir = path.join(stylesDir, "bundles");

const importPattern = /@import\s+(?:url\()?["']([^"']+)["']\)?[^;]*;/g;

function resolveCssImport(specifier, fromFile) {
  if (specifier.startsWith(".")) {
    return path.resolve(path.dirname(fromFile), specifier);
  }

  if (specifier.startsWith("fumadocs-ui/")) {
    const packageJson = require.resolve("fumadocs-ui/package.json", { paths: [packageDir] });
    const filePath = path.join(path.dirname(packageJson), specifier.slice("fumadocs-ui/".length));

    if (existsSync(filePath)) {
      return filePath;
    }
  }

  return require.resolve(specifier, { paths: [packageDir] });
}

async function inlineCss(filePath, stack = []) {
  if (stack.includes(filePath)) {
    throw new Error(`Circular CSS import detected: ${[...stack, filePath].join(" -> ")}`);
  }

  const content = (await readFile(filePath, "utf8")).replace(/\/\*[\s\S]*?\*\//g, "");
  let output = "";
  let cursor = 0;

  for (const match of content.matchAll(importPattern)) {
    output += content.slice(cursor, match.index);
    const importedFile = resolveCssImport(match[1], filePath);
    output += await inlineCss(importedFile, [...stack, filePath]);
    output += "\n";
    cursor = match.index + match[0].length;
  }

  output += content.slice(cursor);
  return output;
}

function normalizeGeneratedCss(css) {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
  return `${withoutComments
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()}\n`;
}

async function buildBundle(name, files) {
  const parts = [];

  for (const file of files) {
    const filePath = file.startsWith("fumadocs-ui/")
      ? resolveCssImport(file, path.join(stylesDir, "index.css"))
      : path.join(stylesDir, file);
    parts.push(await inlineCss(filePath));
  }

  const css = normalizeGeneratedCss(parts.join("\n"));
  if (importPattern.test(css)) {
    throw new Error(`Generated bundle ${name} still contains @import rules`);
  }

  await writeFile(path.join(bundlesDir, `${name}.css`), css);
}

await mkdir(bundlesDir, { recursive: true });

await buildBundle("shared-framework", ["fumadocs-ui/dist/style.css", "base.css", "framework.css"]);
