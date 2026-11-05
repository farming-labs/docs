import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";

const repo = fileURLToPath(new URL("../..", import.meta.url));
const require = createRequire(path.join(repo, "packages/docs/package.json"));
const ts = require("typescript");
const matter = require("gray-matter");
const [baseline = "HEAD", output] = process.argv.slice(2);
const hash = (value) => createHash("sha256").update(value).digest("hex");

// Exercise the real private navigation builder without initializing unrelated
// servers, API renderers, telemetry or filesystem discovery. Extraction/imports
// are outside the timer; parsing frontmatter and sorting remain inside it.
function loadBuilder(source) {
  const ast = ts.createSourceFile("server.ts", source, ts.ScriptTarget.Latest, true);
  const declaration = ast.statements.find(
    (node) => ts.isFunctionDeclaration(node) && node.name?.text === "navTreeFromMap",
  );
  assert(declaration, "navTreeFromMap must exist");
  const code = ts.transpileModule(declaration.getText(ast), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText;
  const sidebar = fs.readFileSync(path.join(repo, "packages/docs/src/sidebar.ts"), "utf8");
  const sidebarAst = ts.createSourceFile("sidebar.ts", sidebar, ts.ScriptTarget.Latest, true);
  const resolver = sidebarAst.statements.find(
    (node) =>
      ts.isFunctionDeclaration(node) && node.name?.text === "resolvePageSidebarFolderIndexBehavior",
  );
  assert(resolver, "sidebar resolver must exist");
  const resolverCode = ts.transpileModule(resolver.getText(sidebarAst).replace(/^export /, ""), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText;
  return new Function("matter", `${resolverCode}\n${code}\nreturn navTreeFromMap;`)(matter);
}

function fixture(count, shape) {
  const content = { "/docs/page.md": "---\ntitle: Documentation\n---\n# Docs" };
  const ordering = [];
  for (let index = 0; index < count; index++) {
    const slug = `page-${String(index).padStart(5, "0")}`;
    content[`/docs/${slug}/page.md`] =
      `---\ntitle: Page ${index}\norder: ${count - index}\n---\n# Page ${index}`;
    if (shape === "nested") {
      content[`/docs/${slug}/child/page.mdx`] = `---\ntitle: Child ${index}\n---\n# Child`;
      content[`/docs/${slug}/gap/deep/page.md`] = "# Orphan descendant";
    }
    ordering.unshift({ slug, children: [{ slug: "child" }] });
  }
  return {
    content,
    ordering: shape === "explicit" ? ordering : shape === "numeric" ? "numeric" : undefined,
  };
}

const report = {
  baseline: execFileSync("git", ["rev-parse", baseline], { cwd: repo, encoding: "utf8" }).trim(),
  candidateBase: execFileSync("git", ["rev-parse", "HEAD"], { cwd: repo, encoding: "utf8" }).trim(),
  node: process.version,
  platform: `${process.platform}/${process.arch}`,
  cpu: os.cpus()[0]?.model,
  method:
    "Private bundled-navigation builders extracted from real adapter source. Warm gray-matter cache; ten alternating A/B and A/A trials after three warmups. Deep equality checked outside every timed sample. Includes frontmatter calls, sorting and tree construction; excludes module loading, full server load, MDX rendering, browser and full builds. Nested fixtures have three non-root index pages per branch, including one orphan descendant.",
  sources: {},
  cases: [],
};

for (const adapter of ["tanstack-start", "astro", "svelte", "nuxt"]) {
  const sourcePath = `packages/${adapter}/src/server.ts`;
  const before = execFileSync("git", ["show", `${baseline}:${sourcePath}`], {
    cwd: repo,
    encoding: "utf8",
  });
  const after = fs.readFileSync(path.join(repo, sourcePath), "utf8");
  const builders = { before: loadBuilder(before), after: loadBuilder(after) };
  report.sources[adapter] = { before: hash(before), after: hash(after) };

  // Preserve legacy duplicates, missing parents, prototype-like names, prefix
  // isolation and the first matching nested ordering entry.
  const edgeContent = {
    "/docs/index.mdx": "---\ntitle: First root\n---\n",
    "/docs/page.md": "---\ntitle: Second root\n---\n",
    "/docs/a/index.mdx": "---\ntitle: First A\n---\n",
    "/docs/a/page.md": "---\ntitle: Second A\n---\n",
    "/docs/a/one/page.md": "---\norder: 2\n---\n",
    "/docs/a/two/page.md": "---\norder: 1\n---\n",
    "/docs/b/page.md": "---\nsidebar:\n  folderIndexBehavior: hidden\n---\n",
    "/docs/b/missing/deep/page.md": "# Deep",
    "/docs/orphan/deep/page.md": "# Orphan",
    "/docs/__proto__/page.md": "# Prototype",
    "/docs/a/agent.md": "# Agent",
    "/docs/a/flat.md": "# Flat",
    "/docs-fr/page.md": "# Other prefix",
  };
  for (const ordering of [
    undefined,
    "alphabetical",
    "numeric",
    [],
    [
      { slug: "missing" },
      { slug: "a", children: [{ slug: "two" }, { slug: "one" }] },
      { slug: "a", children: [{ slug: "one" }] },
    ],
  ]) {
    assert.deepEqual(
      builders.after(edgeContent, "/docs/", "docs", ordering),
      builders.before(edgeContent, "/docs/", "docs", ordering),
    );
  }

  for (const count of [100, 1000, 5000]) {
    for (const shape of ["flat", "numeric", "explicit", "nested"]) {
      const { content, ordering } = fixture(count, shape);
      const args = [content, "/docs/", "docs", ordering];
      const expected = builders.before(...args);
      assert.deepEqual(builders.after(...args), expected);
      for (let warmup = 0; warmup < 3; warmup++) {
        builders.before(...args);
        builders.after(...args);
      }
      const samples = { before: [], after: [], aa1: [], aa2: [] };
      for (let trial = 0; trial < 10; trial++) {
        for (const label of trial % 2 ? ["after", "before"] : ["before", "after"]) {
          const start = performance.now();
          const tree = builders[label](...args);
          samples[label].push(performance.now() - start);
          assert.deepEqual(tree, expected, `${adapter}/${count}/${shape}/${label}`);
        }
        for (const label of trial % 2 ? ["aa2", "aa1"] : ["aa1", "aa2"]) {
          const start = performance.now();
          const tree = builders.before(...args);
          samples[label].push(performance.now() - start);
          assert.deepEqual(tree, expected, `${adapter}/${count}/${shape}/${label}`);
        }
      }
      const median = (values) => {
        const sorted = [...values].sort((a, b) => a - b);
        return (
          (sorted[Math.floor((sorted.length - 1) / 2)] + sorted[Math.floor(sorted.length / 2)]) / 2
        );
      };
      report.cases.push({
        adapter,
        branches: count,
        sourcePages: Object.keys(content).length,
        shape,
        milliseconds: samples,
        medianMilliseconds: Object.fromEntries(
          Object.entries(samples).map(([key, values]) => [key, median(values)]),
        ),
        p95Milliseconds: Object.fromEntries(
          Object.entries(samples).map(([key, values]) => [
            key,
            [...values].sort((a, b) => a - b)[Math.ceil(values.length * 0.95) - 1],
          ]),
        ),
        navigationHash: hash(JSON.stringify(expected)),
      });
    }
  }
}

const json = JSON.stringify(report, null, 2) + "\n";
if (output) {
  fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true });
  fs.writeFileSync(output, json);
}
console.log(json);
